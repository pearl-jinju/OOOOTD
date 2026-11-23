from datetime import datetime, timedelta, timezone
import json
import unittest
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlsplit

from scripts import catalog_maintenance as catalog


NOW = datetime(2026, 11, 23, tzinfo=timezone.utc)


def page_data(value, attribute='type="application/ld+json"'):
    return catalog.PageData(f"<script {attribute}>{json.dumps(value)}</script>")


def product_record(item_id, name="화이트 셔츠", label="공용", **changes):
    return {
        "goodsNo": item_id, "goodsName": name, "displayGenderText": label,
        "thumbnail": "https://image.msscdn.net/product.jpg", "price": 39000,
        **changes,
    }


class ListingTests(unittest.TestCase):
    def test_keeps_adult_in_stock_products_with_public_prices(self):
        listing = catalog.Listing("top", "001", "women", "여성", "F", "NEW")
        page = page_data([
            product_record("1", "화이트 &amp; 블랙 셔츠"),
            product_record(2, "키즈 티셔츠"),
            product_record(3, label="남성"),
            product_record(4, isSoldOut=True),
            product_record(5, price="미정"),
        ], 'id="__NEXT_DATA__"')
        items = catalog.parse_listing(page, listing, NOW)
        self.assertEqual(list(items), [1])
        self.assertEqual(items[1]["name"], "화이트 & 블랙 셔츠")
        self.assertEqual(items[1]["genderOptions"], ["men", "women"])
        self.assertEqual(items[1]["price"], 39000)

    def test_tracks_popularity_only_from_popular_sort(self):
        def fetch(url):
            parsed = urlsplit(url)
            code = parsed.path.split("/")[2]
            query = parse_qs(parsed.query)
            item_id = int(code) * 10 + (query["sortCode"] == ["POPULAR"])
            return page_data([product_record(item_id, "스커트" if code == "100" else "상품")],
                             'id="__NEXT_DATA__"')

        items, popular, pages = catalog.collect_listings(NOW, fetch)
        self.assertEqual(pages, 18)
        self.assertEqual(popular, {11, 21, 31, 1001, 1031})
        self.assertEqual(len(items), 10)

    def test_failed_listing_scan_leaves_database_untouched(self):
        conn = MagicMock()
        with patch.object(catalog, "collect_listings", side_effect=catalog.MerchantError("incomplete")):
            with self.assertRaises(catalog.MerchantError):
                catalog.collect(conn, 24)
        self.assertEqual(conn.mock_calls, [])


class MetricTests(unittest.TestCase):
    def test_reads_product_review_and_explicit_purchase_counts(self):
        page = page_data({"@graph": [{
            "@type": "Product", "url": "/products/9",
            "aggregateRating": {"ratingValue": "3.2", "reviewCount": "27"},
            "interactionStatistic": [
                {"interactionType": "https://schema.org/BuyAction", "userInteractionCount": 0},
                {"interactionType": "LikeAction", "userInteractionCount": 5},
            ],
        }, {"@type": "Product", "url": "/products/10"}]})
        self.assertEqual(catalog.product_metrics(page, 9), (3.2, 27, 0))

    def test_ignores_conflicting_products_and_unqualified_counts(self):
        page = page_data({
            "@type": "Product", "url": "/products/9",
            "aggregateRating": {"ratingValue": 7, "bestRating": 10, "reviewCount": 10},
            "interactionStatistic": [
                {"interactionType": "LikeAction", "userInteractionCount": 1},
                {"interactionType": "BuyAction", "userInteractionCount": "1+"},
                {"interactionType": "BuyAction", "userInteractionCount": 0, "startTime": "2026-11-01"},
            ],
        })
        self.assertEqual(catalog.product_metrics(page, 9), (None, None, None))
        self.assertEqual(catalog.product_metrics(page, 10), (None, None, None))

    def test_transport_failure_is_distinct_from_unpublished_metrics(self):
        def fetch(url):
            if url.endswith("/1"):
                raise catalog.MerchantError("offline")
            return page_data({"@type": "Product", "url": url})

        self.assertEqual(catalog.inspect_products([1, 2], fetch), {1: None, 2: (None, None, None)})


class CleanupTests(unittest.TestCase):
    def reason(self, trend_coverage=False, **changes):
        item = {
            "first_seen_at": NOW - timedelta(days=61), "last_listed_at": NOW,
            "last_popular_at": None, "inspected_at": NOW,
            "rating": None, "review_count": None, "sales_count": None,
            **changes,
        }
        return catalog.retirement_reason(item, NOW, catalog.CleanupPolicy(), trend_coverage)

    def test_requires_enough_reviews_and_a_recent_measurement(self):
        self.assertEqual(self.reason(rating=3.4, review_count=10), "low_rating")
        self.assertIsNone(self.reason(rating=3.4, review_count=9))
        self.assertIsNone(self.reason(rating=3.5, review_count=10))
        self.assertIsNone(self.reason(rating=2.0, review_count=20, inspected_at=NOW - timedelta(days=22)))

    def test_preserves_products_with_missing_sales_or_short_history(self):
        self.assertIsNone(self.reason())
        self.assertEqual(self.reason(sales_count=0), "low_sales")
        self.assertIsNone(self.reason(sales_count=5))
        self.assertIsNone(self.reason(sales_count=0, first_seen_at=NOW - timedelta(days=29)))

    def test_trend_requires_previous_popularity_and_healthy_collection(self):
        past = NOW - timedelta(days=61)
        self.assertIsNone(self.reason(last_listed_at=past, last_popular_at=past))
        self.assertIsNone(self.reason(trend_coverage=True, last_listed_at=past))
        self.assertIsNone(self.reason(trend_coverage=True, last_popular_at=past))
        self.assertEqual(
            self.reason(trend_coverage=True, last_listed_at=past, last_popular_at=past),
            "out_of_trend",
        )

    def test_dry_run_and_daily_limit(self):
        conn = MagicMock()
        candidate = {
            "first_seen_at": NOW - timedelta(days=61), "last_listed_at": NOW, "last_popular_at": None,
            "inspected_at": NOW, "rating": 3.1, "review_count": 30, "sales_count": None,
        }
        coverage = {"latest": NOW, "days": 0}
        conn.execute.side_effect = [
            MagicMock(),
            MagicMock(**{"fetchone.return_value": coverage}),
            [dict(candidate, item_id=i) for i in (1, 2)],
        ]
        with patch.object(catalog, "datetime", wraps=datetime) as clock:
            clock.now.return_value = NOW
            report = catalog.prune(conn, catalog.CleanupPolicy(max_retirements=1), dry_run=True)
        self.assertEqual((report["matched"], report["selected"], report["retired"]), (2, 1, 0))
        self.assertEqual(conn.execute.call_count, 3)


if __name__ == "__main__":
    unittest.main()
