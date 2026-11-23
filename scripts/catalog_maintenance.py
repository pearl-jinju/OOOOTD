#!/usr/bin/env python3
"""Refresh and retire the public OOOOTD shopping catalog."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from html import unescape
from html.parser import HTMLParser
import json
import os
import re
import sys
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


STORE = "https://www.musinsa.com"
ROOTS = {"outer": "002", "top": "001", "bottom": "003", "shoes": "103"}
SCAN_SOURCE = "musinsa_root_scan"
CATALOG_LOCK = 7100300  # Also used by backend/catalog.mjs.
MAX_PAGE_BYTES = 8 * 1024 * 1024
KIDS = re.compile(r"(?:^|[\s\[(])(?:키즈|주니어|아동|유아|kids|junior)(?:[\s\])]|$)", re.I)
SHOE_ACCESSORY = re.compile(
    r"깔창|슈레이스|신발끈|슈케어|구두약|구두솔|구둣주걱|슈트리|부츠키퍼|"
    r"신발.?커버|신발.?주머니|인솔|탈취제|shoelace|insole|shoe.?care",
    re.I,
)


@dataclass(frozen=True)
class Listing:
    category: str
    code: str
    gender: str
    label: str
    audience: str
    sort: str

    @property
    def url(self):
        return f"{STORE}/category/{self.code}/goods?gf={self.audience}&sortCode={self.sort}"


@dataclass(frozen=True)
class CleanupPolicy:
    trend_days: int = 60
    minimum_rating: float = 3.5
    minimum_reviews: int = 10
    minimum_sales: int = 5
    sales_age_days: int = 30
    metric_age_days: int = 21
    max_retirements: int = 100


class MerchantError(Exception):
    pass


class PageData(HTMLParser):
    def __init__(self, markup):
        super().__init__()
        self.listing = None
        self.structured = []
        self.target = None
        self.feed(markup)
        self.close()

    def handle_starttag(self, tag, attrs):
        if tag != "script":
            return
        attributes = dict(attrs)
        if attributes.get("id") == "__NEXT_DATA__":
            self.target = "listing"
        elif attributes.get("type") == "application/ld+json":
            self.target = "structured"

    def handle_data(self, data):
        if self.target is None:
            return
        try:
            value = json.loads(data)
        except (ValueError, RecursionError):
            return
        if self.target == "listing":
            self.listing = value
        else:
            self.structured.append(value)

    def handle_endtag(self, tag):
        if tag == "script":
            self.target = None


def fetch_page(url):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urlopen(request, timeout=12) as response:
            if urlsplit(response.url).hostname != urlsplit(STORE).hostname:
                raise MerchantError("Unexpected merchant response host")
            data = response.read(MAX_PAGE_BYTES + 1)
    except (OSError, URLError) as exc:
        raise MerchantError("Merchant request failed") from exc
    if len(data) > MAX_PAGE_BYTES:
        raise MerchantError("Merchant page exceeded size limit")
    return PageData(data.decode("utf-8", errors="replace"))


def objects(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from objects(child)


def integer(value):
    if isinstance(value, str) and re.fullmatch(r"[0-9]{1,18}", value):
        value = int(value)
    return value if type(value) is int and 0 <= value < 2**63 else None


def keyword(name, groups, default):
    return next((value for value, words in groups if any(word in name for word in words.split())), default)


def garment_attributes(name):
    name = name.lower()
    return {
        "color": keyword(name, [
            ("black", "블랙 검정 black"), ("white", "화이트 아이보리 크림 white ivory"),
            ("grey", "그레이 차콜 grey gray charcoal"), ("navy", "네이비 navy"),
            ("beige", "베이지 브라운 카멜 beige brown"), ("khaki", "카키 올리브 그린 khaki green"),
            ("blue", "블루 데님 인디고 blue denim"), ("point", "레드 핑크 옐로우 퍼플 red pink yellow purple"),
        ], "black"),
        "season": keyword(name, [
            ("winter", "패딩 다운 기모 방한 무스탕 down shearling"),
            ("hot", "반팔 린넨 리넨 쇼츠 반바지 샌들 슬리퍼 shorts sandal"),
            ("chilly", "코트 울 플리스 후리스 니트 가디건 fleece wool coat knit"),
            ("warm", "반소매 티셔츠 tee t-shirt"),
        ], "mild"),
        "occasion": keyword(name, [
            ("hiking", "등산 트레킹 트래킹 hiking trekking"), ("running", "러닝 런닝 running"),
            ("exercise", "트레이닝 조거 training"), ("work", "블레이저 슬랙스 로퍼 구두 수트 loafer blazer"),
            ("date", "코트 니트 가디건 펌프스 스커트 coat cardigan"), ("library", "후드 맨투맨 스웨트 hood sweat"),
        ], "daily"),
    }


def parse_listing(page, listing, observed_at):
    result = {}
    eligible = 0
    for record in objects(page.listing):
        item_id = integer(record.get("goodsNo"))
        name, image = record.get("goodsName"), record.get("thumbnail")
        label = record.get("displayGenderText")
        if not item_id or not isinstance(name, str) or not name.strip():
            continue
        if label not in (listing.label, "공용") or not isinstance(image, str):
            continue
        if not image.startswith("https://image.msscdn.net/") or KIDS.search(name):
            continue
        if listing.category == "shoes" and SHOE_ACCESSORY.search(name):
            continue
        if listing.code == "100" and not re.search(r"스커트|skirt", name, re.I):
            continue
        if record.get("isSoldOut") is True:
            eligible += 1
            continue
        price = integer(record.get("price"))
        if not price:
            continue
        eligible += 1
        unisex = label == "공용"
        name = unescape(name).strip()
        result[item_id] = {
            "id": item_id,
            "name": name,
            "category": listing.category,
            "gender": listing.gender,
            "unisex": unisex,
            "sourceGender": label,
            "genderOptions": ["men", "women"] if unisex else [listing.gender],
            **garment_attributes(name),
            "image": image,
            "sourceUrl": f"{STORE}/products/{item_id}",
            "price": price,
            "currency": "KRW",
            "priceCheckedAt": observed_at.isoformat(),
            "availability": "in_stock",
        }
    if not eligible:
        raise MerchantError(f"No valid products in {listing.code}/{listing.audience}/{listing.sort}")
    return result


def collect_listings(observed_at, fetch=fetch_page):
    audiences = (("men", "남성", "M"), ("women", "여성", "F"))
    listings = []
    for gender, label, audience in audiences:
        categories = list(ROOTS.items())
        if audience == "F":
            categories.append(("bottom", "100"))
        listings.extend(
            Listing(category, code, gender, label, audience, sort)
            for category, code in categories for sort in ("NEW", "POPULAR")
        )

    def collect_one(listing):
        return parse_listing(fetch(listing.url), listing, observed_at)

    items, popular = {}, set()
    with ThreadPoolExecutor(max_workers=4) as pool:
        for listing, records in zip(listings, pool.map(collect_one, listings), strict=True):
            for item_id, item in records.items():
                previous = items.get(item_id)
                if previous is None or (previous["unisex"] and not item["unisex"]):
                    items[item_id] = item
            if listing.sort == "POPULAR":
                popular.update(records)
    if not items or not popular:
        raise MerchantError("Incomplete catalog listing scan")
    return items, popular, len(listings)


def schema_type(record, expected):
    if isinstance(record, dict):
        value = record.get("@type")
    else:
        value = record
    values = value if isinstance(value, list) else [value]
    return any(entry in (expected, f"https://schema.org/{expected}", f"http://schema.org/{expected}") for entry in values)


def product_metrics(page, item_id):
    products = [node for node in objects(page.structured) if schema_type(node, "Product")]
    path = f"/products/{item_id}"
    matching = [
        node for node in products
        if isinstance(node.get("url"), str) and urlsplit(node["url"]).path.rstrip("/") == path
    ]
    if len(matching) == 1:
        product = matching[0]
    elif len(products) == 1 and not products[0].get("url"):
        product = products[0]
    else:
        return None, None, None

    rating, reviews = None, None
    aggregate = product.get("aggregateRating")
    if isinstance(aggregate, dict):
        try:
            score = float(aggregate.get("ratingValue"))
            best = float(aggregate.get("bestRating", 5))
            worst = float(aggregate.get("worstRating", 1))
        except (TypeError, ValueError, OverflowError):
            score, best, worst = 0, 0, 0
        if best == 5 and worst in (0, 1) and 1 <= score <= 5 and not isinstance(aggregate.get("ratingValue"), bool):
            rating = score
            reviews = integer(aggregate.get("reviewCount"))

    statistics = product.get("interactionStatistic", [])
    if isinstance(statistics, dict):
        statistics = [statistics]
    sales = {
        integer(counter.get("userInteractionCount"))
        for counter in statistics if isinstance(counter, dict)
        and schema_type(counter.get("interactionType"), "BuyAction")
        and "startTime" not in counter and "endTime" not in counter
    } if isinstance(statistics, list) else set()
    sales_count = next(iter(sales)) if len(sales) == 1 else None
    return rating, reviews, sales_count


def retirement_reason(item, now, policy, trend_coverage):
    if item["inspected_at"] and item["inspected_at"] >= now - timedelta(days=policy.metric_age_days):
        if (
            item["rating"] is not None and item["review_count"] is not None
            and item["review_count"] >= policy.minimum_reviews and item["rating"] < policy.minimum_rating
        ):
            return "low_rating"
        if (
            item["sales_count"] is not None and item["sales_count"] < policy.minimum_sales
            and now - item["first_seen_at"] >= timedelta(days=policy.sales_age_days)
        ):
            return "low_sales"
    cutoff = now - timedelta(days=policy.trend_days)
    if trend_coverage and item["last_popular_at"] and item["last_listed_at"] < cutoff:
        return "out_of_trend"
    return None


def inspection_queue(conn, limit):
    return [row["id"] for row in conn.execute("""
        SELECT item.id
        FROM catalog_items AS item
        LEFT JOIN catalog_maintenance AS state ON state.item_id = item.id
        WHERE item.active AND item.data->>'sourceUrl' = %s || item.id::text
        ORDER BY state.inspection_attempted_at NULLS FIRST, item.id
        LIMIT %s
    """, (f"{STORE}/products/", limit))]


def inspect_products(item_ids, fetch=fetch_page):
    def inspect_one(item_id):
        try:
            page = fetch(f"{STORE}/products/{item_id}")
            return item_id, product_metrics(page, item_id)
        except MerchantError:
            return item_id, None

    with ThreadPoolExecutor(max_workers=4) as pool:
        return dict(pool.map(inspect_one, item_ids))


def record_run(conn, kind, status, details):
    conn.execute(
        "INSERT INTO agent_runs (kind, status, details) VALUES (%s, %s, %s::jsonb)",
        (kind, status, json.dumps(details)),
    )


def save_collection(conn, items, popular, listings, inspections, observed_at):
    conn.execute("SELECT pg_advisory_xact_lock(%s)", (CATALOG_LOCK,))
    conn.execute("""
        INSERT INTO catalog_items AS item (id, data, active, updated_at)
        SELECT (value->>'id')::bigint, value, true, %s
        FROM jsonb_array_elements(%s::jsonb)
        ON CONFLICT (id) DO UPDATE SET
            data = CASE
                WHEN item.data->>'name' = EXCLUDED.data->>'name'
                 AND item.data->>'category' = EXCLUDED.data->>'category'
                THEN item.data
                ELSE item.data - ARRAY['productTags', 'productTagVersion', 'occasions']
            END || EXCLUDED.data,
            active = true,
            updated_at = EXCLUDED.updated_at
        WHERE item.updated_at <= EXCLUDED.updated_at
    """, (observed_at, json.dumps(list(items.values()), ensure_ascii=False)))
    conn.execute("""
        INSERT INTO catalog_maintenance AS state
            (item_id, first_seen_at, last_listed_at, last_popular_at)
        SELECT id, %s, %s, CASE WHEN id = ANY(%s::bigint[]) THEN %s END
        FROM unnest(%s::bigint[]) AS listed(id)
        ON CONFLICT (item_id) DO UPDATE SET
            last_listed_at = GREATEST(state.last_listed_at, EXCLUDED.last_listed_at),
            last_popular_at = GREATEST(state.last_popular_at, EXCLUDED.last_popular_at),
            retired_at = CASE WHEN state.retired_reason = 'out_of_trend'
                AND EXCLUDED.last_popular_at > state.retired_at THEN NULL ELSE state.retired_at END,
            retired_reason = CASE WHEN state.retired_reason = 'out_of_trend'
                AND EXCLUDED.last_popular_at > state.retired_at THEN NULL ELSE state.retired_reason END
    """, (observed_at, observed_at, sorted(popular), observed_at, sorted(items)))
    conn.execute("""
        UPDATE catalog_items AS item SET active = true
        FROM catalog_maintenance AS state
        WHERE state.item_id = item.id AND state.retired_at IS NULL
          AND item.updated_at = %s AND NOT item.active AND item.id = ANY(%s::bigint[])
    """, (observed_at, sorted(popular)))
    with conn.cursor() as cursor:
        cursor.executemany("""
            INSERT INTO catalog_maintenance AS state
                (item_id, first_seen_at, inspection_attempted_at, inspected_at, rating, review_count, sales_count)
            SELECT id, %(observed)s, %(observed)s, %(inspected)s, %(rating)s, %(reviews)s, %(sales)s
            FROM catalog_items WHERE id = %(id)s
            ON CONFLICT (item_id) DO UPDATE SET
                inspection_attempted_at = EXCLUDED.inspection_attempted_at,
                inspected_at = COALESCE(EXCLUDED.inspected_at, state.inspected_at),
                rating = CASE WHEN EXCLUDED.inspected_at IS NULL THEN state.rating ELSE EXCLUDED.rating END,
                review_count = CASE WHEN EXCLUDED.inspected_at IS NULL THEN state.review_count ELSE EXCLUDED.review_count END,
                sales_count = CASE WHEN EXCLUDED.inspected_at IS NULL THEN state.sales_count ELSE EXCLUDED.sales_count END
            WHERE state.inspection_attempted_at IS NULL OR state.inspection_attempted_at < EXCLUDED.inspection_attempted_at
        """, [
            {
                "id": item_id, "observed": observed_at, "inspected": observed_at if metrics is not None else None,
                "rating": metrics[0] if metrics else None, "reviews": metrics[1] if metrics else None,
                "sales": metrics[2] if metrics else None,
            }
            for item_id, metrics in inspections.items()
        ])
    successful = [metrics for metrics in inspections.values() if metrics is not None]
    details = {
        "source": SCAN_SOURCE,
        "count": conn.execute("SELECT count(*) AS total FROM catalog_items WHERE active").fetchone()["total"],
        "collected": len(items),
        "listing_pages": listings,
        "popular": len(popular),
        "inspected": len(successful),
        "inspection_failures": len(inspections) - len(successful),
        "ratings_observed": sum(rating is not None and reviews is not None for rating, reviews, _ in successful),
        "sales_observed": sum(sales is not None for _, _, sales in successful),
    }
    record_run(conn, "catalog_refresh", "success", details)
    return details


def collect(conn, detail_limit):
    observed_at = datetime.now(timezone.utc)
    items, popular, listings = collect_listings(observed_at)
    inspections = inspect_products(inspection_queue(conn, detail_limit))
    with conn.transaction():
        return save_collection(conn, items, popular, listings, inspections, observed_at)


def prune(conn, policy, dry_run=False):
    now = datetime.now(timezone.utc)
    with conn.transaction():
        conn.execute("SELECT pg_advisory_xact_lock(%s)", (CATALOG_LOCK,))
        scans = conn.execute("""
            SELECT max(created_at) AS latest, count(DISTINCT (created_at AT TIME ZONE 'UTC')::date) AS days
            FROM agent_runs
            WHERE kind = 'catalog_refresh' AND status = 'success'
                AND details->>'source' = 'musinsa_root_scan' AND created_at >= %s
        """, (now - timedelta(days=policy.trend_days),)).fetchone()
        healthy = bool(
            scans["latest"] and scans["latest"] >= now - timedelta(hours=2)
            and scans["days"] * 4 >= policy.trend_days * 3
        )
        pending = conn.execute("""
            SELECT state.*
            FROM catalog_maintenance AS state
            JOIN catalog_items AS item ON item.id = state.item_id
            WHERE item.active AND state.retired_at IS NULL
            ORDER BY state.first_seen_at, state.item_id
        """)
        matches = []
        for item in pending:
            reason = retirement_reason(item, now, policy, healthy)
            if reason:
                matches.append({"id": item["item_id"], "reason": reason})
        selected = matches[:policy.max_retirements]
        counts = {reason: sum(item["reason"] == reason for item in selected)
                  for reason in ("low_rating", "low_sales", "out_of_trend")}
        if selected and not dry_run:
            conn.execute("""
                UPDATE catalog_maintenance AS state SET retired_at = %s, retired_reason = retired.reason
                FROM jsonb_to_recordset(%s::jsonb) AS retired(id bigint, reason text)
                WHERE state.item_id = retired.id
            """, (now, json.dumps(selected)))
            conn.execute(
                "UPDATE catalog_items SET active = false WHERE id = ANY(%s::bigint[])",
                ([item["id"] for item in selected],),
            )
        details = {
            "dry_run": dry_run, "matched": len(matches), "selected": len(selected),
            "retired": 0 if dry_run else len(selected), "by_reason": counts,
            "trend_coverage": healthy, "trend_days_observed": scans["days"],
        }
        if not dry_run:
            record_run(conn, "catalog_cleanup", "success", details)
        return details


def positive_integer(value):
    val = integer(value)
    if not val:
        raise argparse.ArgumentTypeError("expected a positive integer")
    return val


def rating_limit(value):
    val = float(value)
    if not 1 <= val <= 5:
        raise argparse.ArgumentTypeError("expected a rating between 1 and 5")
    return val


def arguments(argv):
    parser = argparse.ArgumentParser(description=__doc__)
    jobs = parser.add_subparsers(dest="job", required=True)
    collection = jobs.add_parser("collect", help="refresh the public shopping catalog")
    collection.add_argument("--detail-limit", type=positive_integer, default=24)
    cleanup = jobs.add_parser("prune", help="retire catalog entries")
    cleanup.add_argument("--dry-run", action="store_true")
    defaults = CleanupPolicy()
    for key, default in vars(defaults).items():
        cleanup.add_argument(
            "--" + key.replace("_", "-"), default=default,
            type=rating_limit if key == "minimum_rating" else positive_integer,
        )
    return parser.parse_args(argv)


def main(argv=None):
    args = arguments(argv)
    database_url = os.environ.get("OOOOTD_DATABASE_URL")
    if not database_url:
        print("OOOOTD_DATABASE_URL is required", file=sys.stderr)
        return 1

    import psycopg
    from psycopg.rows import dict_row

    kind = "catalog_refresh" if args.job == "collect" else "catalog_cleanup"
    try:
        with psycopg.connect(database_url, autocommit=True, row_factory=dict_row, connect_timeout=15) as conn:
            try:
                if args.job == "collect":
                    results = collect(conn, args.detail_limit)
                else:
                    policy = CleanupPolicy(**{name: getattr(args, name) for name in vars(CleanupPolicy())})
                    results = prune(conn, policy, args.dry_run)
            except (MerchantError, psycopg.Error) as exc:
                details = {"error": type(exc).__name__}
                if isinstance(exc, MerchantError):
                    details.update(source=SCAN_SOURCE, message=str(exc))
                if isinstance(exc, psycopg.Error):
                    details["sqlstate"] = exc.sqlstate
                if not getattr(args, "dry_run", False):
                    try:
                        record_run(conn, kind, "failed", details)
                    except psycopg.Error:
                        pass
                print(json.dumps(details), file=sys.stderr)
                return 1
    except psycopg.Error as exc:
        print(f"Database connection failed ({type(exc).__name__})", file=sys.stderr)
        return 1
    print(json.dumps(results))
    return 0


if __name__ == "__main__":
    sys.exit(main())
