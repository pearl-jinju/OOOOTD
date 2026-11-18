import json

with open('crawled_100_gender.json', 'r', encoding='utf-8') as f:
    items = json.load(f)

json_str = json.dumps(items, ensure_ascii=False)

html_code = """<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OOOOTD - 날씨 & 옷장 기반 쉬운 맞춤 코디 추천</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
  <style>
    :root {
      --primary: #0f172a;
      --accent: #4f46e5;
      --accent-hover: #4338ca;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --tag-bg: #eef2ff;
      --tag-text: #4338ca;
      --danger: #ef4444;
      --success: #10b981;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Pretendard", "Helvetica Neue", Arial, sans-serif;
    }

    body {
      background-color: var(--bg);
      color: var(--text-main);
      line-height: 1.6;
      padding: 24px 16px;
    }

    .container {
      max-width: 980px;
      margin: 0 auto;
    }

    /* Header */
    header {
      text-align: center;
      margin-bottom: 24px;
      padding: 32px 20px;
      background: linear-gradient(135deg, #e0e7ff 0%, #f1f5f9 50%, #fdf4ff 100%);
      border-radius: 20px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03);
    }

    .logo {
      font-size: 2.4rem;
      font-weight: 800;
      color: #312e81;
      letter-spacing: -0.5px;
      margin-bottom: 6px;
    }

    .subtitle {
      font-size: 1.05rem;
      color: #4338ca;
      font-weight: 600;
      margin-bottom: 10px;
    }

    .desc {
      color: var(--text-muted);
      max-width: 650px;
      margin: 0 auto;
      font-size: 0.95rem;
      word-break: keep-all;
    }

    /* Weather Bar */
    .weather-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      background-color: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px 20px;
      margin-bottom: 24px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
    }

    .weather-info {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .weather-icon-large {
      font-size: 2.2rem;
      line-height: 1;
    }

    .weather-temp {
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--text-main);
    }

    .weather-details {
      font-size: 0.88rem;
      color: var(--text-muted);
    }

    .weather-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .city-select {
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.9rem;
      background: #ffffff;
      outline: none;
      cursor: pointer;
    }

    .btn-icon {
      padding: 8px 14px;
      border: 1px solid var(--border);
      background: white;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.88rem;
      color: var(--text-main);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }

    .btn-icon:hover {
      background: #f1f5f9;
    }

    /* Nav Tabs */
    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      border-bottom: 2px solid var(--border);
      padding-bottom: 4px;
    }

    .tab-btn {
      background: none;
      border: none;
      padding: 10px 18px;
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-muted);
      cursor: pointer;
      position: relative;
      transition: color 0.2s;
    }

    .tab-btn.active {
      color: var(--accent);
    }

    .tab-btn.active::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 0;
      width: 100%;
      height: 3px;
      background-color: var(--accent);
      border-radius: 3px 3px 0 0;
    }

    /* Tab Content */
    .tab-pane {
      display: none;
    }

    .tab-pane.active {
      display: block;
    }

    /* Gender Toggle Bar */
    .gender-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      background: #ffffff;
      padding: 12px 18px;
      border-radius: 14px;
      border: 1.5px solid #cbd5e1;
      margin-bottom: 16px;
    }

    .gender-chips {
      display: flex;
      gap: 8px;
    }

    .gender-chip {
      padding: 8px 18px;
      border-radius: 20px;
      border: 1.5px solid var(--border);
      background: #f8fafc;
      font-size: 0.92rem;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }

    .gender-chip.active {
      background: var(--accent);
      color: #ffffff;
      border-color: var(--accent);
      box-shadow: 0 2px 6px rgba(79, 70, 229, 0.2);
    }

    /* Easy Occasion Selector (쉬운 상황별 룩) */
    .curation-panel {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }

    .curation-section-title {
      font-size: 0.92rem;
      font-weight: 800;
      color: var(--primary);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .occasion-selector {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    .occasion-card {
      border: 2px solid var(--border);
      border-radius: 12px;
      padding: 14px 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      background: #f8fafc;
      text-align: left;
    }

    .occasion-card:hover {
      border-color: #a5b4fc;
      transform: translateY(-2px);
    }

    .occasion-card.active {
      border-color: var(--accent);
      background: #eef2ff;
      box-shadow: 0 4px 10px rgba(79, 70, 229, 0.15);
    }

    .occasion-card-title {
      font-size: 1rem;
      font-weight: 800;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .occasion-card-desc {
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.35;
    }

    .color-rule-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      padding-top: 14px;
      border-top: 1px solid #f1f5f9;
    }

    .color-chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .color-chip {
      padding: 6px 12px;
      border-radius: 20px;
      border: 1px solid var(--border);
      background: #f8fafc;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }

    .color-chip.active {
      background: #1e293b;
      color: #ffffff;
      border-color: #1e293b;
    }

    .color-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
      border: 1px solid rgba(0,0,0,0.15);
    }

    .outfit-action-btns {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }

    /* Virtual AI Fitting Room & Flat-Lay Board Layout */
    .outfit-main-layout {
      display: grid;
      grid-template-columns: 340px 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }

    @media (max-width: 820px) {
      .outfit-main-layout {
        grid-template-columns: 1fr;
      }
    }

    /* AI 가상 착용 룩북 보드 */
    .fitting-room-card {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.04);
    }

    .fitting-room-title {
      font-size: 1rem;
      font-weight: 800;
      color: var(--primary);
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .ai-tryon-board {
      position: relative;
      width: 100%;
      height: 480px;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-radius: 14px;
      border: 1.5px solid #e2e8f0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 10px;
      padding: 12px;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
    }

    .lookbook-item {
      background: #ffffff;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      padding: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      box-shadow: 0 2px 5px rgba(0,0,0,0.04);
      transition: transform 0.2s;
    }

    .lookbook-item:hover {
      transform: scale(1.02);
    }

    .lookbook-item img {
      max-width: 100%;
      max-height: 160px;
      object-fit: contain;
      border-radius: 6px;
    }

    .lookbook-tag {
      position: absolute;
      top: 6px;
      left: 6px;
      background: rgba(15, 23, 42, 0.75);
      color: #ffffff;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.65rem;
      font-weight: 700;
      backdrop-filter: blur(2px);
    }

    /* Outfit Details Right Column */
    .outfit-card {
      background-color: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.04);
    }

    .outfit-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
      margin-bottom: 20px;
    }

    .outfit-title {
      font-size: 1.3rem;
      font-weight: 800;
      color: var(--primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .outfit-reason {
      font-size: 0.92rem;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .color-match-notice {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.82rem;
      font-weight: 700;
      color: #4338ca;
      background: #eef2ff;
      padding: 5px 12px;
      border-radius: 6px;
      margin-top: 10px;
      border: 1px solid #c7d2fe;
    }

    .badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 9999px;
      background: var(--tag-bg);
      color: var(--tag-text);
      white-space: nowrap;
    }

    /* Items Grid */
    .items-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }

    .item-card {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px;
      background-color: #fafbfc;
      display: flex;
      flex-direction: column;
      position: relative;
      transition: transform 0.15s, box-shadow 0.15s;
    }

    .item-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.05);
    }

    .item-img-preview {
      width: 100%;
      height: 130px;
      border-radius: 8px;
      object-fit: cover;
      margin-bottom: 10px;
      border: 1px solid var(--border);
      background: #f1f5f9;
    }

    .item-category {
      font-size: 0.72rem;
      color: var(--text-muted);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .item-name {
      font-size: 0.94rem;
      font-weight: 700;
      color: var(--text-main);
      margin-bottom: 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .item-tag-row {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      margin-bottom: 6px;
    }

    .item-season-badge {
      font-size: 0.68rem;
      padding: 2px 6px;
      border-radius: 4px;
      background: #e2e8f0;
      color: #475569;
    }

    .item-color-badge {
      font-size: 0.68rem;
      padding: 2px 6px;
      border-radius: 4px;
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid #cbd5e1;
    }

    .item-source {
      font-size: 0.78rem;
      color: var(--success);
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: auto;
      padding-top: 6px;
    }

    /* Addon Box */
    .addon-box {
      background: linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%);
      border: 1px dashed #d946ef;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .addon-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #a21caf;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .addon-desc {
      font-size: 0.88rem;
      color: #374151;
    }

    .addon-link {
      align-self: flex-start;
      margin-top: 4px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background-color: #a21caf;
      color: #ffffff;
      text-decoration: none;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      transition: background-color 0.2s;
    }

    .addon-link:hover {
      background-color: #86198f;
    }

    /* Closet Management */
    .closet-list-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }

    .closet-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .closet-filter-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      overflow-x: auto;
      padding-bottom: 4px;
    }

    .filter-chip {
      padding: 6px 14px;
      border-radius: 20px;
      border: 1px solid var(--border);
      background: #ffffff;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }

    .filter-chip.active {
      background: var(--accent);
      color: #ffffff;
      border-color: var(--accent);
    }

    .closet-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.92rem;
    }

    .closet-table th {
      text-align: left;
      padding: 12px 14px;
      background: #f8fafc;
      border-bottom: 1px solid var(--border);
      color: var(--text-muted);
      font-weight: 700;
    }

    .closet-table td {
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
    }

    .closet-table tr:hover {
      background-color: #fafbfc;
    }

    .table-thumb {
      width: 50px;
      height: 50px;
      border-radius: 8px;
      object-fit: cover;
      border: 1px solid var(--border);
      background: #f1f5f9;
    }

    .btn-danger {
      background: none;
      border: none;
      color: var(--danger);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      font-size: 0.85rem;
    }

    .btn-danger:hover {
      background: #fee2e2;
    }

    footer {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.85rem;
      margin-top: 40px;
      padding-bottom: 20px;
    }

    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(0,0,0,0.1);
      border-radius: 50%;
      border-top-color: var(--accent);
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>

  <div class="container">
    <!-- 서비스 소개 헤더 -->
    <header>
      <div class="logo"><i class="fa-solid fa-shirt"></i> OOOOTD</div>
      <div class="subtitle">남성 / 여성 맞춤 & 쉬운 상황별 데일리 코디</div>
      <p class="desc">
        성별(남성/여성)과 오늘 갈 곳(일상, 도서관, 데이트, 출근, 운동)을 선택하면 
        날씨와 색채학 공식에 맞춘 실제 브랜드 룩북 세트를 자동으로 매칭해 드립니다.
      </p>
    </header>

    <!-- 날씨 실시간 연동 Bar -->
    <div class="weather-bar">
      <div class="weather-info">
        <div id="weather-icon" class="weather-icon-large">🌤️</div>
        <div>
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <span id="weather-temp" class="weather-temp">--°C</span>
            <span id="weather-condition" style="font-weight: 600; color: #475569;">날씨 확인 중...</span>
          </div>
          <div id="weather-tip" class="weather-details">실시간 기상 정보를 불러오는 중입니다.</div>
        </div>
      </div>

      <div class="weather-actions">
        <select id="city-select" class="city-select" onchange="changeCity(this.value)">
          <option value="Seoul" selected>서울</option>
          <option value="Busan">부산</option>
          <option value="Incheon">인천</option>
          <option value="Daegu">대구</option>
          <option value="Daejeon">대전</option>
          <option value="Gwangju">광주</option>
          <option value="Jeju">제주</option>
        </select>
        <button class="btn-icon" onclick="fetchLiveWeather()" title="날씨 새로고침">
          <i class="fa-solid fa-rotate-right"></i> 새로고침
        </button>
      </div>
    </div>

    <!-- 탭 네비게이션 -->
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('recommendTab', this)">
        <i class="fa-solid fa-wand-magic-sparkles"></i> 오늘의 코디 추천
      </button>
      <button class="tab-btn" onclick="switchTab('closetTab', this)">
        <i class="fa-solid fa-door-open"></i> 실제 옷장 목록 (<span id="closet-count">0</span>)
      </button>
    </div>

    <!-- 1. 오늘의 코디 추천 탭 -->
    <div id="recommendTab" class="tab-pane active">
      
      <!-- 성별(남성/여성) 원터치 토글 바 -->
      <div class="gender-bar">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 0.95rem; font-weight: 800; color: var(--text-main);">
            <i class="fa-solid fa-venus-mars" style="color: var(--accent);"></i> 성별 선택:
          </span>
          <div class="gender-chips">
            <button class="gender-chip active" id="gender-btn-men" onclick="selectGender('men', this)">
              <i class="fa-solid fa-mars"></i> 남성 코디 (Men)
            </button>
            <button class="gender-chip" id="gender-btn-women" onclick="selectGender('women', this)">
              <i class="fa-solid fa-venus"></i> 여성 코디 (Women)
            </button>
          </div>
        </div>
        <span style="font-size: 0.8rem; color: var(--text-muted);">* 선택하신 성별 전용 핏과 아이템으로 필터링됩니다</span>
      </div>

      <!-- 쉬운 상황/용도별 선택 패널 -->
      <div class="curation-panel">
        <div class="curation-section-title">
          <span><i class="fa-solid fa-compass" style="color: var(--accent);"></i> 오늘 어디 가시나요? (용도별 코디 선택)</span>
          <span style="font-size: 0.8rem; font-weight: 500;">상황에 맞춰 편하게 고르세요</span>
        </div>
        
        <!-- 상황/용도 선택 버튼들 -->
        <div class="occasion-selector" id="occasion-selector-container">
          <!-- JS 동적 생성 -->
        </div>

        <!-- 컬러 하모니 공식 선택 바 -->
        <div class="color-rule-bar">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">
              <i class="fa-solid fa-swatchbook" style="color: #6366f1;"></i> 색상 조화:
            </span>
            <div class="color-chips">
              <button class="color-chip active" onclick="selectColorRule('rule_three', this)">
                3색 제한 정석
              </button>
              <button class="color-chip" onclick="selectColorRule('monochrome', this)">
                <span class="color-dot" style="background: #0f172a;"></span> 톤온톤/모노톤
              </button>
              <button class="color-chip" onclick="selectColorRule('earthy', this)">
                <span class="color-dot" style="background: #92400e;"></span> 어스톤/자연스러운 색
              </button>
              <button class="color-chip" onclick="selectColorRule('contrast', this)">
                <span class="color-dot" style="background: #2563eb;"></span> 원포인트 강조
              </button>
            </div>
          </div>

          <div class="outfit-action-btns">
            <button class="btn-icon" id="next-combo-btn" onclick="nextBestCombo()" title="색채학 점수 순위별 다음 최적 조합 보기">
              <i class="fa-solid fa-arrow-down-short-wide" style="color: var(--accent);"></i> <span id="combo-rank-text">다음 최적 조합 (Rank 1/3)</span>
            </button>
            <button class="btn-icon" onclick="downloadOotdCard()" title="OOTD 카드 이미지로 저장">
              <i class="fa-solid fa-camera"></i> 룩북 카드 저장
            </button>
          </div>
        </div>
      </div>

      <!-- 메인 코디 2열 레이아웃 (캡처 대상) -->
      <div id="capture-outfit-container">
        <div class="outfit-main-layout">
          
          <!-- 좌측: 감성 플랫레이 룩북 보드 -->
          <div class="fitting-room-card">
            <div class="fitting-room-title">
              <span><i class="fa-solid fa-images" style="color: var(--accent);"></i> 오늘의 완성 룩북 세트</span>
              <div>
                <span id="gender-indicator-badge" class="badge" style="background:#4338ca; color:#fff; margin-right:4px;">남성</span>
                <span id="occasion-indicator-badge" class="badge">일상생활용</span>
              </div>
            </div>

            <div class="ai-tryon-board">
              <div class="lookbook-item" id="lookbook-outer">
                <span class="lookbook-tag">아우터</span>
                <img id="board-img-outer" src="" alt="아우터">
              </div>
              <div class="lookbook-item" id="lookbook-top">
                <span class="lookbook-tag">상의</span>
                <img id="board-img-top" src="" alt="상의">
              </div>
              <div class="lookbook-item" id="lookbook-bottom">
                <span class="lookbook-tag">하의</span>
                <img id="board-img-bottom" src="" alt="하의">
              </div>
              <div class="lookbook-item" id="lookbook-shoes">
                <span class="lookbook-tag">신발</span>
                <img id="board-img-shoes" src="" alt="신발">
              </div>
            </div>

            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 12px; text-align: center;">
              * 선택하신 성별과 날씨에 최적화된 실물 코디 세트입니다
            </div>
          </div>

          <!-- 우측: 코디 디테일 및 아이템 목록 -->
          <div class="outfit-card">
            <div class="outfit-header">
              <div>
                <div id="recommend-title" class="outfit-title">
                  <i class="fa-solid fa-sparkles" style="color: #6366f1;"></i> 추천 코디 분석 중
                </div>
                <div id="recommend-desc" class="outfit-reason">기온과 옷장 상태를 분석 중입니다.</div>
                <div id="color-match-notice" class="color-match-notice">
                  <i class="fa-solid fa-circle-check"></i> <span id="color-match-text">색상 조화 최적화 적용됨</span>
                </div>
              </div>
              <span class="badge" id="recommend-tier-badge">기온 맞춤형</span>
            </div>

            <!-- 코디 아이템 4종 그리드 -->
            <div class="items-grid" id="outfit-items-container">
              <!-- JS 동적 렌더링 -->
            </div>

            <!-- 추가 구매 제안 박스 (링크 연결) -->
            <div class="addon-box" id="addon-box">
              <div class="addon-title">
                <i class="fa-solid fa-lightbulb"></i> <span id="addon-title-text">이런 아이템을 추가해보세요!</span>
              </div>
              <div class="addon-desc" id="addon-desc-text">
                스타일을 더 풍성하게 만들어 줄 추천 아이템을 확인해보세요.
              </div>
              <a id="addon-link" href="#" target="_blank" rel="noopener noreferrer" class="addon-link">
                <span>아이템 검색 및 구매하기</span> <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- 2. 내 옷장 관리 탭 (크롤링 100종 실물 옷장) -->
    <div id="closetTab" class="tab-pane">
      <div class="closet-list-card">
        <div class="closet-header">
          <div>
            <h3 style="font-size: 1.2rem; font-weight: 800;">실제 크롤링된 옷장 아이템 (총 100종)</h3>
            <p style="font-size: 0.88rem; color: var(--text-muted); margin-top: 4px;">
              남성 의류 50종과 여성 의류 50종으로 구성된 실제 패션 데이터베이스입니다.
            </p>
          </div>
          <button class="btn-icon" onclick="resetDefaultCloset()" style="font-size: 0.85rem;">
            <i class="fa-solid fa-arrows-rotate"></i> 100종 전체 다시 불러오기
          </button>
        </div>

        <!-- 카테고리 필터 칩 -->
        <div class="closet-filter-bar">
          <button class="filter-chip active" onclick="filterCloset('all', this)">전체 (100)</button>
          <button class="filter-chip" onclick="filterCloset('men', this)">남성 전용 (50)</button>
          <button class="filter-chip" onclick="filterCloset('women', this)">여성 전용 (50)</button>
          <button class="filter-chip" onclick="filterCloset('outer', this)">아우터 (25)</button>
          <button class="filter-chip" onclick="filterCloset('top', this)">상의 (25)</button>
          <button class="filter-chip" onclick="filterCloset('bottom', this)">하의 (25)</button>
          <button class="filter-chip" onclick="filterCloset('shoes', this)">신발 (25)</button>
        </div>

        <table class="closet-table">
          <thead>
            <tr>
              <th style="width: 65px;">실물 사진</th>
              <th>카테고리</th>
              <th>성별</th>
              <th>아이템 이름</th>
              <th>추천 용도 / 색상 / 적합 계절</th>
              <th style="width: 70px; text-align: center;">관리</th>
            </tr>
          </thead>
          <tbody id="closet-table-body">
            <!-- 동적 렌더링 -->
          </tbody>
        </table>
      </div>
    </div>

    <footer>
      <p>© OOOOTD. Weather data provided by Open-Meteo. All rights reserved.</p>
    </footer>
  </div>

  <script>
    /* ==========================================================
       실제 크롤링된 100종 의류 데이터베이스 (남성/여성 태깅 완료)
       ========================================================== */
    const CRAWLED_100_ITEMS = __REPLACE_ITEMS__;

    const OCCASIONS = [
      { id: 'daily', name: '일상생활용', icon: 'fa-mug-saucer', desc: '친구 만나기, 가벼운 외출, 카페 갈 때 편안한 코디' },
      { id: 'library', name: '도서관/마실용', icon: 'fa-book-open', desc: '독서실, 도서관, 편의점 마실 갈 때 포근하고 안 답답한 룩' },
      { id: 'date', name: '데이트용', icon: 'fa-heart', desc: '깔끔하고 분위기 있는 단정한 매력의 남친/여친룩' },
      { id: 'work', name: '출근/격식용', icon: 'fa-briefcase', desc: '오피스 출근, 미팅, 발표 때 신뢰감을 주는 단정한 스타일' },
      { id: 'exercise', name: '운동/산책용', icon: 'fa-person-running', desc: '러닝, 가벼운 등산, 산책할 때 편한 활동성 룩' }
    ];

    const COLOR_HEX = {
      black: '#1e293b',
      white: '#f8fafc',
      grey: '#64748b',
      navy: '#1e3a8a',
      beige: '#d97706',
      khaki: '#4d7c0f',
      blue: '#2563eb',
      point: '#dc2626'
    };

    const COLOR_LABELS = {
      black: '블랙',
      white: '화이트',
      grey: '그레이',
      navy: '네이비',
      beige: '베이지/브라운',
      khaki: '카키',
      blue: '블루/데님',
      point: '포인트컬러'
    };

    const SEASON_LABELS = {
      winter: '겨울/한파 (4°C 이하)',
      chilly: '늦가을/초겨울 (5°C~11°C)',
      mild: '봄/가을 (12°C~19°C)',
      warm: '초여름/선선 (20°C~25°C)',
      hot: '한여름 (26°C 이상)'
    };

    const CATEGORY_NAMES = {
      outer: '아우터 (Outer)',
      top: '상의 (Top)',
      bottom: '하의 (Bottom)',
      shoes: '신발 (Shoes)'
    };

    const CITY_COORDS = {
      Seoul: { lat: 37.5665, lon: 126.9780, name: '서울' },
      Busan: { lat: 35.1796, lon: 129.0756, name: '부산' },
      Incheon: { lat: 37.4563, lon: 126.7052, name: '인천' },
      Daegu: { lat: 35.8714, lon: 128.6014, name: '대구' },
      Daejeon: { lat: 36.3504, lon: 127.3845, name: '대전' },
      Gwangju: { lat: 35.1595, lon: 126.8526, name: '광주' },
      Jeju: { lat: 33.4996, lon: 126.5312, name: '제주' }
    };

    let currentCity = 'Seoul';
    let currentWeather = { temp: 15, code: 0, isDay: 1 };
    let closetItems = [];
    let currentFilter = 'all';
    let currentGender = 'men'; // 기본값 남성
    let currentOccasion = 'daily';
    let currentColorRule = 'rule_three';
    let rankedCombos = [];
    let currentRankIndex = 0;

    function initCloset() {
      const stored = localStorage.getItem('ooootd_closet_gender_v1');
      if (stored) {
        try {
          closetItems = JSON.parse(stored);
        } catch(e) {
          closetItems = [...CRAWLED_100_ITEMS];
        }
      } else {
        closetItems = [...CRAWLED_100_ITEMS];
        saveCloset();
      }
      renderOccasionCards();
      updateClosetUI();
    }

    function saveCloset() {
      localStorage.setItem('ooootd_closet_gender_v1', JSON.stringify(closetItems));
      updateClosetUI();
      recalculateRankedCombos();
    }

    function resetDefaultCloset() {
      if (confirm('남/여 각 50종씩 구성된 100종 정품 옷장 데이터베이스로 다시 리셋하시겠습니까?')) {
        closetItems = [...CRAWLED_100_ITEMS];
        saveCloset();
      }
    }

    /* ==========================================================
       성별 선택
       ========================================================== */
    function selectGender(gender, btnEl) {
      currentGender = gender;
      document.querySelectorAll('.gender-chip').forEach(b => b.classList.remove('active'));
      if (btnEl) btnEl.classList.add('active');

      document.getElementById('gender-indicator-badge').textContent = gender === 'men' ? '남성' : '여성';
      document.getElementById('gender-indicator-badge').style.background = gender === 'men' ? '#4338ca' : '#db2777';

      recalculateRankedCombos();
    }

    /* ==========================================================
       용도별 룩 선택 UI
       ========================================================== */
    function renderOccasionCards() {
      const container = document.getElementById('occasion-selector-container');
      container.innerHTML = '';

      OCCASIONS.forEach(occ => {
        const card = document.createElement('div');
        card.className = `occasion-card ${occ.id === currentOccasion ? 'active' : ''}`;
        card.onclick = () => selectOccasion(occ.id);
        card.innerHTML = `
          <div class="occasion-card-title">
            <i class="fa-solid ${occ.icon}" style="color: var(--accent);"></i> ${occ.name}
          </div>
          <div class="occasion-card-desc">${occ.desc}</div>
        `;
        container.appendChild(card);
      });
    }

    function selectOccasion(occId) {
      currentOccasion = occId;
      renderOccasionCards();
      recalculateRankedCombos();
    }

    function selectColorRule(rule, chipEl) {
      currentColorRule = rule;
      document.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
      if (chipEl) chipEl.classList.add('active');
      recalculateRankedCombos();
    }

    function nextBestCombo() {
      if (!rankedCombos || rankedCombos.length <= 1) {
        alert('현재 조건에서 추천 가능한 최상의 단일 조합입니다.');
        return;
      }
      currentRankIndex = (currentRankIndex + 1) % Math.min(rankedCombos.length, 5);
      renderComboAtCurrentRank();
    }

    /* ==========================================================
       결정론적 다차원 채점 엔진 (성별 + 기온 + 용도 + 색상)
       ========================================================== */
    function getTemperatureSeason(temp) {
      if (temp <= 4) return 'winter';
      if (temp <= 11) return 'chilly';
      if (temp <= 19) return 'mild';
      if (temp <= 25) return 'warm';
      return 'hot';
    }

    function calculateColorScore(items, rule) {
      const colors = items.filter(Boolean).map(it => it.color || 'black');
      if (colors.length === 0) return 0;

      const uniqueColors = [...new Set(colors)];
      let score = 0;

      if (uniqueColors.length <= 3) score += 35;
      else if (uniqueColors.length === 4) score += 10;

      const outer = items[0];
      const top = items[1];
      const bottom = items[2];
      const shoes = items[3];

      if (outer && shoes && outer.color === shoes.color) score += 20;
      if (top && bottom && top.color !== bottom.color) score += 15;

      if (rule === 'monochrome') {
        const monoList = ['black', 'white', 'grey'];
        score += colors.filter(c => monoList.includes(c)).length * 12;
      } else if (rule === 'earthy') {
        const earthList = ['beige', 'khaki', 'navy', 'white'];
        score += colors.filter(c => earthList.includes(c)).length * 12;
      } else if (rule === 'contrast') {
        const hasPoint = colors.includes('point') || colors.includes('blue');
        const neutrals = colors.filter(c => ['black', 'white', 'grey'].includes(c)).length;
        if (hasPoint && neutrals >= 2) score += 45;
      } else if (rule === 'rule_three') {
        if (uniqueColors.length >= 2 && uniqueColors.length <= 3) score += 30;
      }

      return score;
    }

    function recalculateRankedCombos() {
      const temp = currentWeather.temp;
      const targetSeason = getTemperatureSeason(temp);

      const categories = ['outer', 'top', 'bottom', 'shoes'];
      const candidatesByCategory = {};

      categories.forEach(cat => {
        // 1. 성별 일치 우선 필터링
        let pool = closetItems.filter(item => item.category === cat && (!item.gender || item.gender === currentGender));
        if (pool.length === 0) pool = closetItems.filter(item => item.category === cat);

        // 2. 기온 시즌 필터링
        let seasonPool = pool.filter(item => item.season === targetSeason);
        candidatesByCategory[cat] = seasonPool.length > 0 ? seasonPool : pool;
      });

      const combos = [];
      const outers = candidatesByCategory['outer'].slice(0, 10);
      const tops = candidatesByCategory['top'].slice(0, 10);
      const bottoms = candidatesByCategory['bottom'].slice(0, 10);
      const shoesList = candidatesByCategory['shoes'].slice(0, 10);

      for (let o of outers) {
        for (let t of tops) {
          for (let b of bottoms) {
            for (let s of shoesList) {
              const comboItems = [o, t, b, s];
              
              let tempScore = 0;
              comboItems.forEach(it => {
                if (it && it.season === targetSeason) tempScore += 25;
              });

              let occasionScore = 0;
              comboItems.forEach(it => {
                if (it && it.occasion === currentOccasion) occasionScore += 25;
              });

              let colorScore = calculateColorScore(comboItems, currentColorRule);
              const totalScore = tempScore + occasionScore + colorScore;

              combos.push({
                items: comboItems,
                totalScore,
                tempScore,
                occasionScore,
                colorScore
              });
            }
          }
        }
      }

      combos.sort((a, b) => b.totalScore - a.totalScore);
      rankedCombos = combos;
      currentRankIndex = 0;
      renderComboAtCurrentRank();
    }

    /* ==========================================================
       룩북 및 디테일 카드 렌더링
       ========================================================== */
    function renderComboAtCurrentRank() {
      if (!rankedCombos || rankedCombos.length === 0) return;

      const selected = rankedCombos[currentRankIndex] || rankedCombos[0];
      const comboItems = selected.items;
      const temp = currentWeather.temp;
      const targetSeason = getTemperatureSeason(temp);
      const occInfo = OCCASIONS.find(o => o.id === currentOccasion) || OCCASIONS[0];
      const genderName = currentGender === 'men' ? '남성' : '여성';

      // 1. 좌측 룩북 보드 이미지 교체
      const cats = ['outer', 'top', 'bottom', 'shoes'];
      cats.forEach((cat, idx) => {
        const it = comboItems[idx];
        const imgEl = document.getElementById(`board-img-${cat}`);
        if (imgEl && it) {
          imgEl.src = it.image;
          imgEl.alt = it.name;
        }
      });

      document.getElementById('occasion-indicator-badge').textContent = occInfo.name;

      // 2. 버튼 랭크 텍스트 업데이트
      const rankText = document.getElementById('combo-rank-text');
      const maxRank = Math.min(rankedCombos.length, 5);
      rankText.textContent = `다음 최적 조합 (Rank ${currentRankIndex + 1}/${maxRank})`;

      // 3. 헤더 타이틀 및 설명
      const titleEl = document.getElementById('recommend-title');
      const descEl = document.getElementById('recommend-desc');
      const badgeEl = document.getElementById('recommend-tier-badge');
      const colorNotice = document.getElementById('color-match-notice');
      const colorMatchText = document.getElementById('color-match-text');
      const container = document.getElementById('outfit-items-container');

      titleEl.innerHTML = `<i class="fa-solid ${occInfo.icon}" style="color: #6366f1;"></i> [${genderName} · ${occInfo.name}] 추천 코디`;
      descEl.textContent = `현재 기온 ${temp}°C · ${genderName} 전용 ${occInfo.desc}에 최적화된 조합입니다.`;
      badgeEl.textContent = `기온: ${temp}°C (${SEASON_LABELS[targetSeason]?.split(' ')[0]})`;

      const ruleDescriptions = {
        rule_three: '3색 제한 정석 (안정된 컬러 밸런스)',
        monochrome: '톤온톤 모노크롬 (절제된 세련미)',
        earthy: '어스톤 & 뉴트럴 하모니 (자연스러운 편안함)',
        contrast: '원포인트 컬러 대비 (감각적인 포인트)'
      };
      colorNotice.style.display = 'inline-flex';
      colorMatchText.textContent = `색상 공식: ${ruleDescriptions[currentColorRule]} / 종합 매칭 점수: ${selected.totalScore}점`;

      // 4. 아이템 상세 카드 목록 렌더링
      container.innerHTML = '';
      cats.forEach((cat, idx) => {
        const chosen = comboItems[idx];
        const card = document.createElement('div');
        card.className = 'item-card';

        if (chosen) {
          const dotColor = COLOR_HEX[chosen.color] || '#333';
          const genderBadge = chosen.gender === 'women' 
            ? '<span class="item-season-badge" style="background:#fce7f3; color:#be185d; font-weight:700;">여성</span>'
            : '<span class="item-season-badge" style="background:#e0e7ff; color:#3730a3; font-weight:700;">남성</span>';

          card.innerHTML = `
            <img src="${chosen.image}" class="item-img-preview" alt="${chosen.name}">
            <div class="item-category">
              <span>${CATEGORY_NAMES[cat]}</span>
              <span class="item-season-badge">${SEASON_LABELS[chosen.season]?.split(' ')[0] || chosen.season}</span>
            </div>
            <div class="item-name" title="${escapeHtml(chosen.name)}">${escapeHtml(chosen.name)}</div>
            <div class="item-tag-row">
              ${genderBadge}
              <span class="item-color-badge">
                <span class="color-dot" style="background: ${dotColor};"></span> ${COLOR_LABELS[chosen.color] || chosen.color}
              </span>
              <span class="item-season-badge" style="background: #f1f5f9; color: #475569;">
                ${occInfo.name}
              </span>
            </div>
            <div class="item-source"><i class="fa-solid fa-circle-check"></i> 정품 실물 매칭</div>
          `;
        }
        container.appendChild(card);
      });

      updateShoppingAddon(occInfo, targetSeason, temp);
    }

    function updateShoppingAddon(occInfo, season, temp) {
      const addonTitle = document.getElementById('addon-title-text');
      const addonDesc = document.getElementById('addon-desc-text');
      const addonLink = document.getElementById('addon-link');

      const isWomen = currentGender === 'women';
      const addonMap = {
        daily: { 
          title: isWomen ? '미니멀 숄더백 or 코튼 스크런치' : '미니멀 나일론 크로스백 or 캡모자', 
          desc: '일상에서 가볍게 들기 좋은 감각적인 데일리 백을 더해보세요.', 
          kw: isWomen ? '여성 미니멀 숄더백' : '남성 미니멀 크로스백' 
        },
        library: { 
          title: '도톰한 텀블러 에코백 & 블루라이트 안경', 
          desc: '오랜 시간 집중해도 편안한 도서관/열람실 필수 아이템을 추천합니다.', 
          kw: '캔버스 에코백' 
        },
        date: { 
          title: isWomen ? '실버 하트 목걸이 or 니치 플로럴 향수' : '은은한 우디 니치 향수 or 실버 뱅글', 
          desc: '데이트 룩의 매력을 두 배로 끌어올려 줄 은은한 포인트를 곁들여보세요.', 
          kw: isWomen ? '여성 니치 향수' : '남자 니치 향수' 
        },
        work: { 
          title: isWomen ? '포멀 토트백 or 슬림 레더 벨트' : '가죽 브리프케이스 or 클래식 벨트', 
          desc: '출근 룩에 신뢰감과 깔끔한 실루엣을 완성해 주는 클래식 아이템입니다.', 
          kw: isWomen ? '여성 포멀 토트백' : '가죽 브리프케이스' 
        },
        exercise: { 
          title: '스마트 러닝 웨어러블 밴드 & 스포츠 캡', 
          desc: '러닝과 야외 산책 시 땀을 막아주는 기능성 헤어밴드/캡모자입니다.', 
          kw: '러닝 캡모자' 
        }
      };

      const addon = addonMap[occInfo.id] || addonMap['daily'];
      addonTitle.textContent = addon.title;
      addonDesc.textContent = addon.desc;
      addonLink.href = `https://www.musinsa.com/search/musinsa/goods?q=${encodeURIComponent(addon.kw)}`;
      addonLink.innerHTML = `<span>'${addon.kw}' 아이템 보러가기</span> <i class="fa-solid fa-arrow-up-right-from-square"></i>`;
    }

    /* ==========================================================
       날씨 API
       ========================================================== */
    async function fetchLiveWeather() {
      const city = CITY_COORDS[currentCity] || CITY_COORDS['Seoul'];
      const tempEl = document.getElementById('weather-temp');
      const condEl = document.getElementById('weather-condition');
      const tipEl = document.getElementById('weather-tip');
      const iconEl = document.getElementById('weather-icon');

      condEl.innerHTML = '<span class="spinner"></span> 날씨 조회 중...';

      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current_weather=true&timezone=auto`);
        if (!res.ok) throw new Error('Weather API request failed');
        const data = await res.json();
        const cw = data.current_weather;

        currentWeather = {
          temp: Math.round(cw.temperature),
          code: cw.weathercode,
          wind: cw.windspeed
        };

        const weatherInfo = parseWeatherCode(cw.weathercode);
        tempEl.textContent = `${currentWeather.temp}°C`;
        condEl.textContent = `${city.name} - ${weatherInfo.text}`;
        iconEl.textContent = weatherInfo.icon;
        tipEl.textContent = getWeatherAdvice(currentWeather.temp, cw.weathercode);

        recalculateRankedCombos();
      } catch (err) {
        console.error('날씨 조회 에러:', err);
        tempEl.textContent = '15°C (기본값)';
        condEl.textContent = `${city.name} - 맑음`;
        iconEl.textContent = '🌤️';
        tipEl.textContent = '날씨 정보를 불러오지 못해 기본 기온(15°C) 기준으로 코디를 추천합니다.';
        currentWeather = { temp: 15, code: 0, wind: 0 };
        recalculateRankedCombos();
      }
    }

    function changeCity(cityName) {
      currentCity = cityName;
      fetchLiveWeather();
    }

    function parseWeatherCode(code) {
      if (code === 0) return { icon: '☀️', text: '맑음' };
      if ([1, 2].includes(code)) return { icon: '🌤️', text: '대체로 맑음' };
      if (code === 3) return { icon: '☁️', text: '흐림' };
      if ([45, 48].includes(code)) return { icon: '🌫️', text: '안개' };
      if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return { icon: '🌧️', text: '비' };
      if ([71, 73, 75, 77, 85, 86].includes(code)) return { icon: '❄️', text: '눈' };
      if ([95, 96, 99].includes(code)) return { icon: '⛈️', text: '뇌우' };
      return { icon: '🌤️', text: '구름 조금' };
    }

    function getWeatherAdvice(temp, code) {
      let advice = '';
      if (temp <= 4) advice = '한파에 대비해 롱패딩, 목도리 등 보온용품을 단단히 챙기세요.';
      else if (temp <= 11) advice = '체감온도가 쌀쌀합니다. 도톰한 코트나 니트를 겹쳐 입으세요.';
      else if (temp <= 19) advice = '자켓이나 가디건을 걸치기 딱 좋은 선선한 날씨입니다.';
      else if (temp <= 25) advice = '활동하기 쾌적하며 얇은 셔츠나 긴팔/반팔 조합이 좋습니다.';
      else advice = '무더운 날씨입니다. 통풍이 잘되는 시원한 린넨이나 반팔을 추천합니다.';

      if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
        advice += ' ⚠️ 비 예보가 있으니 우산과 방수 신발을 챙기세요!';
      }
      return advice;
    }

    /* ==========================================================
       옷장 목록 관리
       ========================================================== */
    function deleteCloth(id) {
      closetItems = closetItems.filter(item => item.id !== id);
      saveCloset();
    }

    function filterCloset(category, chipEl) {
      currentFilter = category;
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      if (chipEl) chipEl.classList.add('active');
      renderClosetTable();
    }

    function updateClosetUI() {
      document.getElementById('closet-count').textContent = closetItems.length;
      renderClosetTable();
    }

    function renderClosetTable() {
      const tbody = document.getElementById('closet-table-body');
      tbody.innerHTML = '';

      let filtered = closetItems;
      if (currentFilter === 'men') {
        filtered = closetItems.filter(item => item.gender === 'men');
      } else if (currentFilter === 'women') {
        filtered = closetItems.filter(item => item.gender === 'women');
      } else if (currentFilter !== 'all') {
        filtered = closetItems.filter(item => item.category === currentFilter);
      }

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">해당 조건의 옷이 없습니다.</td></tr>`;
        return;
      }

      const occNameMap = {
        daily: '일상생활용',
        library: '도서관/마실용',
        date: '데이트용',
        work: '출근/격식용',
        exercise: '운동/산책용'
      };

      filtered.forEach(item => {
        const tr = document.createElement('tr');
        const dotColor = COLOR_HEX[item.color] || '#333';
        const genderBadge = item.gender === 'women'
          ? '<span class="item-season-badge" style="background:#fce7f3; color:#be185d; font-weight:700;">여성</span>'
          : '<span class="item-season-badge" style="background:#e0e7ff; color:#3730a3; font-weight:700;">남성</span>';

        tr.innerHTML = `
          <td><img src="${item.image}" class="table-thumb" alt="실물 사진"></td>
          <td><strong>${CATEGORY_NAMES[item.category] || item.category}</strong></td>
          <td>${genderBadge}</td>
          <td><span style="font-weight: 600;">${escapeHtml(item.name)}</span></td>
          <td>
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              <span class="item-season-badge" style="background:#f1f5f9; color:#475569; font-weight:700;">${occNameMap[item.occasion] || '일상생활용'}</span>
              <span class="item-color-badge"><span class="color-dot" style="background: ${dotColor};"></span> ${COLOR_LABELS[item.color] || item.color}</span>
              <span class="item-season-badge">${SEASON_LABELS[item.season]?.split(' ')[0] || item.season}</span>
            </div>
          </td>
          <td style="text-align: center;">
            <button class="btn-danger" onclick="deleteCloth(${item.id})" title="삭제">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    function downloadOotdCard() {
      const container = document.getElementById('capture-outfit-container');
      const btn = event.currentTarget;
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> 캡처 중...';

      html2canvas(container, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = `OOOOTD-${currentGender}-${currentOccasion}-${new Date().toISOString().slice(0,10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        btn.innerHTML = originalText;
      }).catch(err => {
        console.error('캡처 에러:', err);
        alert('카드 저장 중 문제가 발생했습니다.');
        btn.innerHTML = originalText;
      });
    }

    function switchTab(tabId, btn) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    }

    function escapeHtml(text) {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    window.addEventListener('DOMContentLoaded', () => {
      initCloset();
      fetchLiveWeather();
    });
  </script>
</body>
</html>
"""

final_html = html_code.replace('__REPLACE_ITEMS__', json_str)
with open('c:/Users/Administrator/Desktop/agent/OOOOTD/index.html', 'w', encoding='utf-8') as f:
    f.write(final_html)

print('Updated index.html with Gender toggle and 100 items!')
