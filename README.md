# OOOOTD

Render hosts the static frontend. Neon hosts Postgres, the API Function, private images and scheduled catalog refreshes.

## Data separation

- `catalog_items`: public shopping/reference products; never treated as owned clothes automatically.
- `user_closet`: owned clothes scoped to a server-issued identity. The API sets a non-bypass Postgres role and a transaction-local user ID; row-level security enforces ownership.
- `user_profiles`: optional body sizes under the same ownership policy.
- `device_sessions`: hashes of random 256-bit browser session tokens. Clothing and body measurements are not stored in localStorage.
- `device_claims`: one-use, 15-minute browser transfer links. URL fragments are removed after exchange.
- `agent_runs`: catalog refresh status and counts, with no personal sizes or photos.

This release uses a browser-specific identity without requiring email. Clearing browser data loses the connection to that identity; cross-device account login is future work. New browsers receive empty closets.

## Behavior

The default recommendation uses owned clothes only. Formal looks exclude hoodies, sweatshirts, joggers and sports shoes, including similar-look replacements. Insufficient suitable clothes produce an explicit empty state. Tomorrow uses the forecast's daily minimum/maximum mean in Asia/Seoul; the min/max and rain probability remain visible.

A private endpoint imports 50 male reference products as owned trial clothes for its authenticated caller, idempotently. User image uploads are private. Short-lived signed reads are returned only after ownership checks.

The My Clothes and Recommended Clothes tabs are separate. Explicit owned, owned-plus-missing and unowned catalog outfit modes are available. Shopping cards use actual product prices and merchant links, sum only unowned items, and label cached-price fallbacks and excluded shipping/coupons. Body sizes are saved for future fit recommendations and do not affect the present ranking.

## Weekly refresh

Neon trigger `weekly-catalog`: `0 0 * * 1` UTC, Monday 09:00 Asia/Seoul. Collects 150 male and 150 female products using the merchant's NEW sort, real gender metadata and purchase URLs. The entire batch is validated before replacing the active catalog in a transaction. Failures retain the last successful batch and record a failed run. Prices are collection-time values; shopping checkout is not implemented.

## Development

Node.js 24:

```sh
npm ci
npm run build
npm test
```

Build outputs: `assets/cloud.js` (static client) and `.build/index.mjs` (Neon Function bundle). The checked-in static client is deployed directly by Render.

`cloud-config.json` contains only public service URLs. Database credentials belong exclusively in Neon Function secret environment variable `OOOOTD_DATABASE_URL`. No live secrets may be committed. The custom name avoids a platform-injected DATABASE_URL override observed during integration.

Schema: `db/001_initial.sql`. Infrastructure: `neon.ts`. Project and branch IDs: `backend-config.json`.

`tests/integration.mjs` tests real API user isolation, private images and sizes on a development branch; `tests/browser.mjs` uses a local server and headless Edge against that branch. AI photo analysis uses Neon AI Gateway when a vision model and credits are available; otherwise it explicitly returns an editable manual fallback rather than claiming a visual analysis succeeded.
