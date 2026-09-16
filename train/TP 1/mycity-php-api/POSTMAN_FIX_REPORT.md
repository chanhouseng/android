# Postman 相容性修正報告

## 原先問題與本次依據

原先伺服器雖然存有 JSON 檔案，API 卻依早期 Markdown 裁切回應欄位，沒有完整提供 Postman 要求的資料與功能。先前把「已複製檔案」等同於「API 已完整提供」的說明不準確。

本次依使用者最新要求，以 `IS2025_MyCity_Transit.postman_collection.json` 的請求、描述、範例與測試腳本修正。已有 JSON 值優先保留，不用 Postman 範例中的節錄或自填數字覆蓋來源。原始 Markdown、collection 和 resources/data 均未改寫；README 已更新為目前的契約。

## 已修正

| 功能 | 本次結果 |
|---|---|
| 路線 | 回傳 4 條完整路線及 23 個站點物件，保留 route_number、color、frequency_minutes、operating_hours、全部 next_departures、座標、arrival_time、distance_from_user_m、地圖百分比位置等來源欄位 |
| 路線篩選 | 支援 type=bus、type=metro、status=cancelled，以及 type/status 同時篩選 |
| 單一路線 | 新增 GET /api/transit/routes/{route_id}，存在回傳完整物件，不存在 404 |
| 附近站點 | 新增 GET /api/transit/stops/nearby?lat=...&lng=...&limit=...，Haversine 距離計算、stop_id 去重、距離升序、參數檢查；保留原站點欄位並補上距離及路線資訊 |
| 天氣 | 回傳完整原始物件，包括 feels_like_c、UV、空氣品質、日出日落與 10 小時預報 |
| 警報 | 回傳完整 7 筆原始警報，保留 affected_stop_ids、type、short_description、updated_at、estimated_resolution；補上 status/severity 篩選並保留排序 |
| 收藏建立 | 成功回傳 save_id、route_id、saved_at；建立完整收藏紀錄。新紀錄的路線名稱、編號、起訖站從既有路線取得 |
| 重複收藏 | 409 回傳 Route already saved，以及原有 save_id、saved_at，不重複新增 |
| 收藏列表 | 保留原有 save_id、user_id、route_number、route_name、route_type、origin_stop、destination_stop、note 等全部欄位；只返回目前使用者資料，時間由新到舊 |
| 刪除收藏 | 新增 DELETE /api/routes/saved/{save_id}，驗證令牌及所有權；成功回傳 Deleted successfully，查無本人紀錄回傳 404 |
| 資源清單 | 新增 GET /api/resources/list，完整返回 resources.json |
| 資源查詢 | 新增 GET /api/resource?path=resources/...，支援 Postman 格式；保留原本 /api/resources/... 路徑，兩者皆驗證資源目錄邊界 |
| 登入訊息 | 錯誤密碼包含 Postman 檢查的 Incorrect password；新註冊訊息為 Sign up successful |
| 隱私頁 | 提供 HTML 及紅色 Close ✕ 按鈕，ID 為 closeBtn |
| Postman 環境 | 新增 IS2025_Env.json，使用目前 Wi-Fi IP 172.21.122.235 及埠 3000 |

登入仍只回傳 auth_token；Postman 沒有要求公開 users.json 或密碼的端點。

## 既有資料保留

SHA-256 比對確認：伺服器 routes.json、weather.json、alerts.json、saved_routes.json、resources.json 與原始 resources/data 對應檔案逐位元一致。

users.json 中的 3 個原始帳號仍存在；先前已有一個帳號於成功登入後將明文密碼轉成 password_hash，這是本次修正前的狀態。本次沒有重設帳號、令牌、密碼或既有收藏，也沒有在使用中的資料執行 Postman 的新增／刪除測試。

原始 collection 未修改；tests 內的副本與來源檔案一致。測試資料由原始 JSON 複製到 tests/fixtures，再在每次驗收時複製到唯一的暫存目錄。

## 補齊的資源檔案

resources.json 列出 2 張地圖、4 張站點圖片、4 個應用圖示，共 10 個檔案，現在均可經 API 取得。

- 原有 mumbai_base.png：沿用 resources/maps/Mumbai Map.png，未改圖。
- art_icon_citymove.png、pin_bus.png、pin_metro.png、pin_rapid.png：由已提供的 icons 檔案原樣複製。
- mumbai_transit_overlay.png：原本缺少，依 routes.json 的顏色、sequence、map_x_percent、map_y_percent 產生 1200×1600 透明交通線路圖。這是練習用示意覆蓋圖。
- andheri_bus_stand.jpg、bandra_station_east.jpg、andheri_metro.jpg、ghatkopar_metro.jpg：原本缺少照片，補成 800×450 練習佔位卡，標示原有站名、stop_id 及「Practice placeholder - original photo not supplied」。不是實景照片。
- tools/prepare-resources.ps1 可重建缺少的上述檔案，只填補不存在的檔案，不覆蓋已有資源或 JSON。

保留的來源差異：原始地圖檔案尺寸為 1364×1500，而 resources.json 的 mumbai_base.png 中繼資料標示 1200×1600；依要求兩者均保留原值。Postman 的附近站點示例距離／次序與 JSON 座標推算亦不完全一致，因此端點以真實 JSON 座標計算，不硬編示例數字。

## 驗證結果

- `php tests/run.php --newman`：退出碼 0。
- 原始 Postman collection 透過 Newman 6.2.2 執行：30 個請求、23 個測試腳本、49 個斷言，失敗數均為 0。
- 22 組單元測試、9 組完整 JSON／Postman 契約測試、2 組 HTTP 測試、1 組實際重啟持久化測試，全數通過。
- 契約測試逐筆比較完整來源欄位和值；補測 collection 中未完整斷言的組合篩選、缺少參數、跨使用者刪除、所有 10 個資源與兩種資源入口。
- 測試啟動獨立 PHP 伺服器，監聽 0.0.0.0 的臨時埠；所有新增／刪除都在暫存資料副本執行，結束後移除該副本。
- Newman 在目前 Node.js 上有第三方套件棄用提示；collection 仍完整通過。PHP API 不依賴 Newman 或 Node.js。
- 使用中的服務仍監聽 0.0.0.0:3000。本機透過 Wi-Fi IP 測試完整路線詳情、天氣、附近站點、資源清單及補齊的 JPEG，均為 200。跨設備是否可通仍需由另一設備實測。

目前可用網址：

- http://172.21.122.235:3000/api/transit/routes
- http://172.21.122.235:3000/api/transit/stops/nearby?lat=19.1197&lng=72.8468&limit=3
- http://172.21.122.235:3000/api/weather/current
- http://172.21.122.235:3000/api/resources/list

## 接入格式變更

路線 stops 現為完整物件陣列，next_departures 現為完整時間陣列。收藏回傳完整紀錄；409 的 data 為現有收藏摘要。這些是此次依 Postman 修正的格式，舊版以簡化 Markdown 格式撰寫的客戶端需調整對應解析。
