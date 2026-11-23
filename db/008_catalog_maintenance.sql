CREATE TABLE IF NOT EXISTS catalog_maintenance (
    item_id bigint PRIMARY KEY REFERENCES catalog_items(id) ON DELETE CASCADE,
    first_seen_at timestamptz NOT NULL DEFAULT now(),
    last_listed_at timestamptz,
    last_popular_at timestamptz,
    inspection_attempted_at timestamptz,
    inspected_at timestamptz,
    rating numeric CHECK (rating BETWEEN 1 AND 5),
    review_count bigint CHECK (review_count >= 0),
    sales_count bigint CHECK (sales_count >= 0),
    retired_at timestamptz,
    retired_reason text CHECK (retired_reason IN ('low_rating', 'low_sales', 'out_of_trend')),
    CHECK ((retired_at IS NULL) = (retired_reason IS NULL)),
    CHECK (last_popular_at IS NULL OR (last_listed_at IS NOT NULL AND last_popular_at <= last_listed_at))
);

CREATE INDEX IF NOT EXISTS agent_runs_catalog_collection_idx
    ON agent_runs (created_at)
    WHERE kind = 'catalog_refresh' AND status = 'success'
          AND details->>'source' = 'musinsa_root_scan';

-- The weekly refresh and on-demand expansion also write catalog_items.
CREATE OR REPLACE FUNCTION keep_retired_catalog_items_inactive()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.active AND EXISTS (
        SELECT 1 FROM catalog_maintenance
        WHERE item_id = NEW.id AND retired_at IS NOT NULL
    ) THEN
        NEW.active := false;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS keep_retired_catalog_items_inactive ON catalog_items;
CREATE TRIGGER keep_retired_catalog_items_inactive
    BEFORE UPDATE OF active ON catalog_items
    FOR EACH ROW
    EXECUTE FUNCTION keep_retired_catalog_items_inactive();
