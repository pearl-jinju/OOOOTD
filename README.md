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

User image uploads are private. Short-lived signed reads are returned only after ownership checks.

The My Clothes and Recommended Clothes tabs are separate. Explicit owned, owned-plus-missing and unowned catalog outfit modes are available. Shopping cards use actual product prices and merchant links, sum only unowned items, and label cached-price fallbacks and excluded shipping/coupons. Body sizes are saved for future fit recommendations and do not affect the present ranking.

## Weekly refresh

Neon trigger `weekly-catalog`: `0 0 * * 1` UTC, Monday 09:00 Asia/Seoul. Collects real adult clothing and footwear across discovered merchant categories using NEW and POPULAR sorts. Public gender metadata is preserved, including explicitly marked unisex products. Every one of 18 outfit types must have at least four candidates per gender/category before a full batch is accepted. New records accumulate rather than discarding the previous catalog; confirmed sold-out records become inactive. Failures retain the last successful batch and record a failed run. Prices are collection-time values; shopping checkout is not implemented.

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

`tests/integration.mjs` tests real API user isolation, private images and sizes on a development branch; `tests/browser.mjs` uses a local server and headless Edge against that branch. Closet photos are analyzed in the browser using [Pasma Small-320](https://huggingface.co/Prikol5ist/pasma) (Apache-2.0) and ONNX Runtime Web. The model suggests a garment category and the app estimates its color and assigns season and occasion suggestions by type. The photo is uploaded to the private closet only on registration. The first analysis downloads the runtime and model.

## Expanded outfit coverage

18 purpose-specific outfit types use shared eligibility rules in shared/outfits.mjs. Ranking keeps up to 200 distinct combinations and prioritizes visibly different successive results. Missing public-category coverage triggers authenticated, rate-limited category collection; user closets are never automatically populated by collection. Public catalog responses are compressed and the table is paginated with type/search filters.

## Project guide

- [OOOOTD architecture and deployment](ARCHITECTURE.ko.md)
- [PBL public catalog search exhibit](pbl/index.html)
