# MyCity Transit PHP API

純 PHP 8.0+，不需 Composer、框架或資料庫。依使用者最新要求，以提供的 Postman collection 為 API 契約，回傳既有 JSON 的完整資料。早期 Markdown 的「簡化欄位、僅 8 個 API」限制已由本次要求取代。

## 啟動與接入

在此資料夾執行：

```bash
php -S 0.0.0.0:3000 server.php
```

目前確認的 Wi-Fi IP 為 `172.21.122.235`。其他設備可使用：

- [完整路線](http://172.21.122.235:3000/api/transit/routes)
- [天氣與逐小時預報](http://172.21.122.235:3000/api/weather/current)
- [資源清單](http://172.21.122.235:3000/api/resources/list)

IP 可能隨網路變更；以電腦當下 Wi-Fi IPv4 為準。伺服器監聽 `0.0.0.0:3000`，客戶端填實際 IP。只有本機測試可以使用 `127.0.0.1`。

Postman 匯入原始 collection（測試目錄內也保留相同副本），再匯入本資料夾的 `IS2025_Env.json`，選取環境後先執行登入。登入腳本會自動設定 `auth_token`；收藏列表腳本會設定刪除使用的 `last_save_id`。

## API

| 方法 | 路徑 | 內容／參數 |
|---|---|---|
| POST | /api/users/signin | userEmailAddress、userPassword；登入或註冊 |
| GET | /api/transit/routes | 完整路線與站點物件；可用 type、status 篩選 |
| GET | /api/transit/routes/{route_id} | 單一路線完整資料 |
| GET | /api/transit/stops/nearby | 必須 lat、lng；limit 預設 3；依距離排序及 stop_id 去重 |
| GET | /api/weather/current | 完整天氣、空氣品質、日出日落與 10 小時預報 |
| GET | /api/alerts | 完整警報；可用 status、severity 篩選；嚴重度優先、時間由新到舊 |
| PUT | /api/routes/save | body：route_id；header：auth_token；回傳 save_id |
| GET | /api/routes/saved | header：auth_token；完整個人收藏，由新到舊 |
| DELETE | /api/routes/saved/{save_id} | header：auth_token；只能刪除自己的收藏 |
| GET | /api/resources/list | 完整 resources.json |
| GET | /api/resource?path=resources/maps/mumbai_base.png | Postman 的二進位資源入口 |
| GET | /api/resources/{relative-path} | 保留原本的直接資源路徑 |
| GET | /api/privacy-policy | HTML，包含紅色 Close ✕ 按鈕 closeBtn |

路線回傳 `next_departures` 陣列與完整 `stops` 物件，已取代舊版的 `next_departure` 和站名字串陣列。收藏成功回傳 save_id、route_id、saved_at；重複收藏回傳 409，以及既有 save_id、saved_at。

## 資料與資源

伺服器讀取本資料夾的 `data/`。原始 `resources/data/` 是初始來源，不會自動同步。既有資料保持原值，帳號表用於驗證；登入 API 只回傳令牌，不公開帳號表或密碼。

資源清單中的 10 個檔案皆已提供。現有地圖與圖示直接沿用；缺少的交通覆蓋圖依 JSON 站點百分比位置生成，4 張缺少的站點照片使用有明確標記的練習佔位 JPEG。詳見 `POSTMAN_FIX_REPORT.md`。

## 測試

```bash
php tests/run.php
```

測試在獨立暫存伺服器及資料副本上執行，包含重啟持久化驗證。正式使用中的 users.json、saved_routes.json 不會被測試改動。

若要執行原始 Postman 的全部測試，需要 Node.js/npm 與測試用 Newman：

```bash
npm exec --yes --package=newman -- newman --version
php tests/run.php --newman
```

Newman 僅為開發驗收工具，啟動 PHP API 不需要它。
