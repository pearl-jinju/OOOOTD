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

## AI 코디 채팅

홈의 **AI 코디 채팅**은 메시지의 조건을 추출한 뒤 기존 룩북을 갱신합니다. 선택한 날짜·지역·용도·옷 범위와 색상, 의상 포함·제외, 예산은 대화 중 이어집니다. 대화 초기화와 옷장 전환 시 이전 대화가 지워집니다.

- `GET /weather?city=Seoul`은 인증 없이 관측값과 일별 예보를 반환합니다. 화면에서 오늘 또는 내일 값을 선택합니다. 조회 실패 시 임시 15°C를 명시합니다.
- `GET /closet`의 의상은 기존 Bearer 세션의 소유자로 제한됩니다. 추천과 유사 코디는 홈페이지의 기존 룩북 엔진에서 실행합니다. 채팅의 **내 옷만** 모드는 부족한 부위를 상품으로 채우지 않습니다.
- `GET /catalog`는 공개 상품 및 마지막 수집 정보를 반환합니다. 구매 안내는 여기서 조회한 상품만 표시하며, 판매처 링크는 무신사 상품 상세 주소로 제한합니다. 표시 가격은 기록 시점 기준이며 상품 카드를 눌러 해당 상품을 포함한 코디를 다시 계산할 수 있습니다.
- `POST /chat/interpret`는 기존 Bearer 세션과 JSON `{message,context,history,lookbook}`를 받아 검증된 `{intent,source}`를 반환합니다. 메시지는 400자까지 받습니다. Gemini로 메시지, 검증한 조건, 최근 대화 최대 4개와 룩북 요약을 보냅니다. Gemini는 스타일 질문에 답하고, 모호한 요청에 추가 조건을 물을 수 있습니다. 키 누락, 모델 응답 오류 또는 한도 초과 시 기본 한국어 규칙을 사용합니다.
- `POST /chat/transcribe`는 같은 세션과 `multipart/form-data`의 `audio` 파일을 받아 `{text}`를 반환합니다. 브라우저에서 최대 20초, 서버에서 파일당 2 MiB로 제한합니다. Google Gemini는 한국어 전사에 사용되며, 전사 결과는 입력창에서 수정한 뒤 직접 보내야 합니다.
- OOOOTD 서버는 채팅 원문과 녹음을 DB, 디스크 또는 로그에 남기지 않습니다. 공급자가 처리하는 데이터는 각 서비스의 정책을 따릅니다. 요청 제한은 현재 API 인스턴스 내 분당 텍스트 12회·음성 5회(세션별), 텍스트 60회·음성 18회(전체)입니다.

### 배포와 확인

Render는 정적 화면을 호스팅하고 채팅 API는 기존 **Neon Functions `api`**에서 실행됩니다. 다음 설정은 Neon Function에 등록합니다.

| 환경변수 | 설정 |
| --- | --- |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey)에서 만든 Gemini API 키. 텍스트 해석과 음성 전사에 함께 사용 |
| `GEMINI_MODEL` | 선택 사항. 기본값은 `gemini-3.1-flash-lite`. 바꿀 때는 오디오 입력과 구조화 출력을 모두 지원하는 모델 지정 |

개발·운영 브랜치별 키를 각각 발급합니다. 기존 DB 설정과 함께 해당 브랜치의 Git 제외 환경 파일에만 값을 넣고 `neon deploy --env .env.local`로 배포합니다. 사용 중인 브랜치를 확인한 뒤 배포하며, Render 프런트엔드에는 키를 등록하지 않습니다. 키가 없으면 텍스트에 기본 한국어 규칙을 사용하며, 음성 전사는 준비 중으로 표시됩니다. HTTPS 또는 localhost에서 마이크를 사용할 수 있습니다.

`npm test`로 의도 검증, 제공자 장애 시 대체 동작, 음성 파일 처리와 기존 룩북 회귀 테스트를 실행합니다. 개발 브랜치에서는 아래 항목을 확인합니다.

1. “내일 서울에서 면접 코디 추천해줘”에 이어 “검정색 바지는 빼고 조금 더 편하게”를 입력해 이전 날짜·지역·용도와 새 제외 조건이 반영되는지 확인합니다.
2. 옷장이 비어 있을 때 “내 옷만 써서 출근룩 추천해줘”가 부족한 품목을 표시하고 카탈로그 상품 없이 내 옷장으로 안내하는지 확인합니다.
3. “비 오는 날 신을 신발 5만 원 안에서 찾아줘”의 판매처 링크, 가격, 확인일 및 상품 포함 코디를 확인합니다.
4. 모바일과 PC에서 마이크 허용·거부, 녹음 중지, 전사 수정 후 전송, 키 누락과 날씨 장애 시 안내를 확인합니다.

### 코디 찜과 무신사 좋아요

- “지금 룩북 전체 찜해 줘”와 룩북의 **룩북 전체 찜** 버튼은 현재 볼 수 있는 의상을 각각 찜 목록에 담습니다. 무신사 상품은 공식 링크로 연결하고 내 옷은 현재 옷장에 속한 항목으로 표시합니다. 같은 의상은 한 번만 저장됩니다.
- “지금 코디 찜해 줘”는 현재 룩북을 같은 브라우저의 OOOOTD 찜 목록에 저장합니다. 같은 코디를 반복해서 요청해도 한 건으로 유지합니다. 저장된 코디는 **찜 해제** 버튼이나 “지금 코디 찜 해제해 줘”로 해제합니다.
- “검정 로퍼 찜해 줘”는 실제 무신사 상품 링크를 표시합니다. 후보가 여러 개면 상품을 골라 열 수 있고, 없으면 무신사 검색으로 이어집니다. 상품 페이지에서 무신사 계정으로 로그인한 뒤 직접 좋아요를 누릅니다.
- 추천의상과 채팅 상품 카드에서도 **무신사에서 찜** 링크로 이동합니다. 무신사에서 좋아요를 누른 후 **찜 완료 기록**을 눌러 같은 브라우저에 남길 수 있습니다. **찜 기록 해제**는 브라우저에 남긴 기록을 삭제합니다. 무신사 좋아요 상태는 무신사에서 직접 확인합니다. 이전 OOOOTD 상품 찜도 유지됩니다.
- 텍스트와 음성 전사 결과는 같은 채팅 입력을 사용합니다. 음성 전사는 서버의 `GEMINI_API_KEY`가 필요합니다.

### 룩북에서 한 품목만 바꾸기

“상의만 검정색으로 바꿔 줘”, “신발을 로퍼로 바꿔 줘”처럼 요청하면 현재 룩북에서 해당 품목만 교체합니다. 다른 품목과 고정 상태, 기존 추천 조건을 유지합니다. “5만 원 이하 신발”처럼 말한 예산은 교체 품목에, “전체 예산”으로 말한 값은 코디 전체의 추가 구매 합계에 적용합니다. “그거 말고”는 마지막으로 교체한 품목을 다시 바꿉니다.

“상의는 밝게, 신발은 편하게”처럼 품목별 조건을 함께 요청할 수 있습니다. 두 품목의 조건이 모두 맞을 때 변경을 적용합니다. “겉옷만 빼 줘”와 “아우터 추가해 줘”도 지원하며, 날씨나 용도에 필요한 겉옷은 유지합니다.

“5만 원대 이하의 물품으로 맞춰 줘”는 새로 구매하는 상품 하나당 59,999원 이하를 뜻합니다. “5만 원 이하”는 50,000원 이하, “5만 원 미만”은 49,999원 이하입니다. “전체” 또는 “합계”를 말하면 구매 상품의 합산 가격 기준으로 적용합니다. 적용한 가격 기준은 채팅 답변에 표시됩니다.
