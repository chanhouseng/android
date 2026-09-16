# MyCity Transit 純 PHP API 伺服器項目規格

## 1. 文件用途

本文件是 MyCity Transit Web API 的實作規格，可用來人工開發，或交給 AI 產生一個可執行的純 PHP API 伺服器。

規格來源的優先次序：

1. `Day 1 AM TP.pdf` 第 13–16 頁的 **Web API documents** 章節。
2. `IS2025_MyCity_Transit.postman_collection.json` 只用來輔助測試 PDF 已定義的 API。
3. `mycity-api/data/*.json` 用作初始資料。

若 PDF、Postman 與 JSON 範例之間有差異，必須以 PDF 為準。

## 2. 專案目標

建立一個不使用 PHP 框架、Composer 套件或資料庫的 REST 風格 API 伺服器。伺服器使用 JSON 檔案作為資料儲存，並實作 PDF 指定的 8 個 API。

必要功能：

- 使用者登入或自動註冊。
- 取得交通路線。
- 取得當前天氣。
- 收藏交通路線。
- 取得交通服務警報。
- 提供靜態資源檔案。
- 提供隱私政策 HTML 頁面。
- 取得當前使用者已收藏的路線。

## 3. 技術與執行要求

- PHP 8.0 或以上。
- 不使用 Laravel、Symfony 或其他 PHP 框架。
- 不使用 MySQL、SQLite 或其他資料庫。
- 使用 `json_encode()` 與 `json_decode()` 讀寫 JSON。
- 寫入 JSON 時必須使用排他檔案鎖，例如 `LOCK_EX`。
- API JSON 回應使用 `Content-Type: application/json; charset=utf-8`。
- HTML 回應使用 `Content-Type: text/html; charset=utf-8`。
- 靜態檔案必須回傳正確的 MIME type。
- 開發環境可使用 PHP 內建伺服器：

```bash
php -S 0.0.0.0:3000 server.php
```

伺服器必須監聽 `0.0.0.0`，讓同一區域網路內的其他設備可以連線。

客戶端的 Base URL 必須使用伺服器的實際區域網路 IP，例如：

```text
http://192.168.1.100:3000
```

`0.0.0.0` 是伺服器的監聽地址，不是供手機或其他設備連線的目標網址。手機與伺服器應位於同一網路，並必須允許防火牆接收 TCP 3000 連入連線。

## 4. 建議目錄結構

```text
mycity-php-api/
├── public/
│   └── index.php
├── src/
│   ├── App.php
│   ├── FileStore.php
│   ├── AuthService.php
│   └── Response.php
├── data/
│   ├── users.json
│   ├── routes.json
│   ├── weather.json
│   ├── alerts.json
│   ├── saved_routes.json
│   └── resources/
│       ├── maps/
│       ├── stops/
│       └── ...
├── server.php
└── README.md
```

`resources.json` 可作為內部資源清單，但 PDF 沒有要求提供「資源清單 API」。

## 5. 統一回應格式

PDF 的 JSON 範例使用以下外層結構：

```json
{
  "msg": "Success",
  "data": {}
}
```

規則：

- `msg` 必須是字串。
- `data` 可以是物件、陣列或 `null`。
- 成功時必須回傳 PDF 指定的欄位名稱與類型。
- 不應因為 JSON 資料檔含有更多欄位，就自動將全部欄位暴露給 API 客戶端。

## 6. API 一覽

| No. | 方法 | 路徑 | `auth_token` | 功能 |
| --- | --- | --- | --- | --- |
| 1 | `POST` | `/api/users/signin` | 不需要 | 登入或自動註冊 |
| 2 | `GET` | `/api/transit/routes` | 不需要 | 取得全部路線 |
| 3 | `GET` | `/api/weather/current` | 不需要 | 取得當前天氣 |
| 4 | `PUT` | `/api/routes/save` | header 必須 | 收藏一條路線 |
| 5 | `GET` | `/api/alerts` | 不需要 | 取得交通服務警報 |
| 6 | `GET` | `/api/{relative-path}` | 不需要 | 取得靜態資源檔案 |
| 7 | `GET` | `/api/privacy-policy` | 不需要 | 取得隱私政策 HTML 頁面 |
| 8 | `GET` | `/api/routes/saved` | header 必須 | 取得當前使用者的收藏 |

## 7. API 詳細規格

### API 1 - Sign in or sign up

```http
POST /api/users/signin
Content-Type: application/json
```

請求 body：

```json
{
  "userEmailAddress": "user@email.com",
  "userPassword": "pass123"
}
```

| 欄位 | 類型 | 必須 | 規則 |
| --- | --- | --- | --- |
| `userEmailAddress` | string | 是 | 必須是有效電子郵件格式 |
| `userPassword` | string | 是 | 最少 6 個字元，並同時包含字母與數字 |

處理邏輯：

1. 驗證請求欄位。
2. 以不區分大小寫的方式在 `users.json` 搜尋電子郵件。
3. 如果使用者存在，驗證密碼；密碼正確時回傳該使用者的 `auth_token`。
4. 如果使用者不存在，建立新使用者、產生唯一 `user_id` 及 `auth_token`，然後寫入 `users.json`。
5. 不得在 API 回應中輸出使用者密碼。

成功回應：

```json
{
  "msg": "Sign in successful",
  "data": {
    "auth_token": "ABCD1234EFGH5678IJKL"
  }
}
```

HTTP status：

- 已存在使用者登入成功：`200 OK`。
- 新使用者註冊成功：建議 `201 Created`；為了容忍測試工具，`200 OK` 也可接受。
- 欄位或格式錯誤：`400 Bad Request`。
- 已存在使用者的密碼錯誤：`401 Unauthorized`。

### API 2 - Get all routes

```http
GET /api/transit/routes
```

資料來源：`data/routes.json`。

成功回應中的每條路線必須按 PDF 回傳以下欄位：

| 欄位 | 類型 | 說明 |
| --- | --- | --- |
| `route_id` | string | 路線唯一 ID |
| `route_name` | string | 路線名稱 |
| `route_type` | string | 例如 `bus`、`metro` 或 `rapid` |
| `status` | string | 例如 `on_time`、`delayed` 或 `cancelled` |
| `next_departure` | string/null | 下一班出發時間；沒有班次時為 `null` |
| `stops` | string[] | 站點名稱陣列，順序必須依路線行進順序 |

`routes.json` 內的 `next_departures` 是陣列，API 必須將其第一個值轉換為 PDF 要求的單數欄位 `next_departure`。

`routes.json` 內的 `stops` 是物件陣列，API 必須只取每個物件的 `stop_name`，轉換為字串陣列。

成功回應範例：

```json
{
  "msg": "Success",
  "data": [
    {
      "route_id": "RTE-BUS-022",
      "route_name": "Andheri to Bandra",
      "route_type": "bus",
      "status": "on_time",
      "next_departure": "2025-04-14 09:45:00",
      "stops": ["Andheri", "Vile Parle", "Santacruz", "Bandra"]
    }
  ]
}
```

HTTP status：`200 OK`。沒有路線時 `data` 回傳空陣列。

### API 3 - Get current weather

```http
GET /api/weather/current
```

資料來源：`data/weather.json`。

PDF 要求回傳的欄位：

| 欄位 | 類型 |
| --- | --- |
| `city` | string |
| `temperature_c` | number |
| `condition` | string |
| `humidity_pct` | number |
| `wind_kmh` | number |

成功回應：

```json
{
  "msg": "Success",
  "data": {
    "city": "Mumbai",
    "temperature_c": 32,
    "condition": "Partly Cloudy",
    "humidity_pct": 78,
    "wind_kmh": 14
  }
}
```

HTTP status：`200 OK`。

### API 4 - Save a route

```http
PUT /api/routes/save
Content-Type: application/json
auth_token: ABCD1234EFGH5678IJKL
```

請求 body：

```json
{
  "route_id": "RTE-BUS-022"
}
```

規則：

1. `auth_token` 必須放在同名 HTTP request header。
2. 必須能在 `users.json` 找到對應使用者。
3. `route_id` 必須存在於 `routes.json`。
4. 建立收藏後寫入 `saved_routes.json`。
5. PDF 沒有要求回傳 `save_id`，成功回應只需 `route_id` 與 `saved_at`。
6. 同一使用者不應重複收藏同一條路線。

成功回應：

```json
{
  "msg": "Success",
  "data": {
    "route_id": "RTE-BUS-022",
    "saved_at": "2025-04-14 10:05:00"
  }
}
```

HTTP status：

- 收藏成功：`200 OK`。
- 缺少或無效 `auth_token`：`401 Unauthorized`。
- 缺少 `route_id`：`400 Bad Request`。
- 路線不存在：`404 Not Found`。
- 已收藏同一路線：建議 `409 Conflict`。

### API 5 - Get service alerts

```http
GET /api/alerts
```

資料來源：`data/alerts.json`。

每筆警報按 PDF 回傳：

| 欄位 | 類型 |
| --- | --- |
| `alert_id` | string |
| `title` | string |
| `affected_routes` | string[] |
| `status` | string |
| `severity` | string |
| `description` | string |
| `created_at` | string |

成功回應：

```json
{
  "msg": "Success",
  "data": [
    {
      "alert_id": "ALT-001",
      "title": "Metro Line 1 Delay",
      "affected_routes": ["METRO-1"],
      "status": "active",
      "severity": "high",
      "description": "Signalling fault causing delays of 10-15 minutes.",
      "created_at": "2025-04-14 08:30:00"
    }
  ]
}
```

排序規則：

1. 優先依嚴重程度：`high` → `medium` → `low`。
2. 相同嚴重程度內，再依 `created_at` 由新到舊。

HTTP status：`200 OK`。沒有警報時 `data` 回傳空陣列。

> 排序方式來自配套 Postman 測試行為；PDF 只定義回應欄位。

### API 6 - Get static resource file

```http
GET /api/{relative-path}
```

範例：

```http
GET /api/resources/maps/mumbai_base.png
```

檔案來源應對應：

```text
data/resources/maps/mumbai_base.png
```

實作要求：

1. 將 `/api/` 後的內容視為相對路徑。
2. URL decode 後進行路徑安全驗證。
3. 只允許讀取預設公開資源目錄內的檔案。
4. 使用 `realpath()` 後，檔案實際路徑必須仍以公開資源目錄的實際路徑開頭。
5. 必須拒絕 `..`、URL-encoded traversal、絕對路徑、磁碟機名稱及符號連結越界。
6. 檔案不存在或路徑不合法時，一律回傳 `404 Not Found`，不暴露伺服器真實路徑。
7. 依副檔名回傳 MIME type，例如 PNG 為 `image/png`、JPEG 為 `image/jpeg`、JSON 為 `application/json`。
8. 成功時回傳檔案原始二進位內容，不要包在 JSON 回應內。

### API 7 - Privacy policy webpage

```http
GET /api/privacy-policy
```

回應要求：

- HTTP status：`200 OK`。
- `Content-Type: text/html; charset=utf-8`。
- 回傳完整可顯示的 HTML 頁面。
- 頁面必須有清楚的 `Privacy Policy` 標題與隱私條款內容。
- 為了相容配套 WebView/Postman 驗收，頁面應提供 ID 為 `closeBtn` 的關閉按鈕。

`closeBtn` 屬於配套驗收的相容要求；PDF Web API 章節本身只明確要求該路徑提供隱私政策網頁。

### API 8 - Get my saved routes

```http
GET /api/routes/saved
auth_token: ABCD1234EFGH5678IJKL
```

規則：

1. `auth_token` 必須放在 HTTP request header。
2. 只能回傳該令牌所屬使用者的收藏。
3. 依 `saved_at` 由新到舊排序。
4. PDF 要求每筆只回傳 `route_id`、`route_name` 與 `saved_at`。

成功回應：

```json
{
  "msg": "Success",
  "data": [
    {
      "route_id": "RTE-BUS-022",
      "route_name": "Andheri to Bandra",
      "saved_at": "2025-04-14 10:05:00"
    }
  ]
}
```

HTTP status：

- 成功：`200 OK`。
- 缺少或無效 `auth_token`：`401 Unauthorized`。
- 沒有收藏時：`200 OK`，`data` 為空陣列。

## 8. JSON 資料檔規格

### `users.json`

相容現有資料的格式：

```json
[
  {
    "user_id": "USR-001",
    "email": "user@example.com",
    "password": "pass123",
    "auth_token": "ABCD1234EFGH5678IJKL",
    "created_at": "2025-01-10 09:00:00"
  }
]
```

測試／比賽相容要求：必須能讀取現有明文 `password` 欄位。

正式環境要求：不得保存明文密碼，應改用 `password_hash`、`password_hash()` 與 `password_verify()`。如果需同時相容舊資料，可在使用者首次成功登入後，將明文密碼轉換為雜湊。

### `routes.json`

可保留原始完整路線資料，但 API 2 必須轉換為 PDF 要求的簡化回應。

### `weather.json`

可保留完整天氣資料，但 API 3 只需回傳 PDF 指定的 5 個欄位。

### `alerts.json`

可保留完整警報資料，但 API 5 只需回傳 PDF 指定的 7 個欄位。

### `saved_routes.json`

每筆收藏至少需要：

```json
{
  "user_id": "USR-001",
  "route_id": "RTE-BUS-022",
  "saved_at": "2025-04-14 10:05:00"
}
```

可額外保存 `save_id`、`note` 或路線快照欄位，但 API 8 必須依 PDF 格式輸出。

## 9. 驗證與錯誤回應

PDF 只提供成功回應範例，下列為了讓伺服器可完整實作而採用的統一錯誤規則。

錯誤回應格式：

```json
{
  "msg": "Bad Request: explanation",
  "data": null
}
```

| 狀態碼 | 使用情況 |
| --- | --- |
| `400` | JSON 無效、必要欄位缺少、email 或密碼格式錯誤 |
| `401` | 密碼錯誤、`auth_token` 缺少或無效 |
| `404` | API 路由、路線或靜態資源不存在 |
| `405` | URL 存在，但 HTTP method 不受支援 |
| `409` | 同一使用者重複收藏同一路線 |
| `500` | 無法讀寫 JSON 或其他未預期錯誤 |

對外的 `500` 回應不得包含完整伺服器路徑、stack trace、令牌或密碼。

## 10. 排序與轉換規則

- 路線的 `stops` 必須先依原始 `sequence` 升序排列，然後取出 `stop_name`。
- `next_departure` 使用 `next_departures` 陣列的第一個值；空陣列轉為 `null`。
- 警報依嚴重程度由高到低，同級再依 `created_at` 由新到舊。
- 使用者收藏依 `saved_at` 由新到舊。
- API 時間字串使用 `YYYY-MM-DD HH:MM:SS`。

## 11. 安全要求

- 不在 API 回應中輸出密碼。
- 不將 `auth_token` 寫入錯誤日誌或錯誤回應。
- 產生 token 時使用 `random_bytes()` 等密碼學安全來源。
- 不以用戶輸入直接拼接檔案系統路徑。
- 靜態資源一律使用解析後的真實路徑進行邊界檢查。
- JSON 檔案寫入使用檔案鎖，並先完成編碼後再寫入。
- 正式環境必須將明文密碼改為密碼雜湊。

## 12. 驗收測試

### 12.1 登入與註冊

1. 使用 `users.json` 現有帳號及正確密碼登入，必須回傳 `200` 與非空的 `data.auth_token`。
2. 使用尚未存在的有效 email 與密碼請求時，必須建立使用者並寫入 `users.json`。
3. 新建使用者在伺服器重新啟動後仍可登入。
4. email 格式無效時回傳 `400`。
5. 密碼少於 6 個字元，或沒有同時包含字母及數字時回傳 `400`。
6. 已存在使用者的密碼錯誤時回傳 `401`。

### 12.2 路線

1. `GET /api/transit/routes` 回傳 `200`。
2. `data` 是陣列。
3. 每條路線至少含有 PDF 指定的 6 個欄位。
4. `next_departure` 是單個字串或 `null`，不是陣列。
5. `stops` 是站名字串陣列，不是站點物件陣列。

### 12.3 天氣

1. `GET /api/weather/current` 回傳 `200`。
2. `data` 含有 `city`、`temperature_c`、`condition`、`humidity_pct` 與 `wind_kmh`。
3. `temperature_c`、`humidity_pct` 及 `wind_kmh` 必須是數值。

### 12.4 收藏路線

1. 沒有 `auth_token` header 的 `PUT /api/routes/save` 回傳 `401`。
2. 有效令牌及路線 ID 可建立收藏並寫入 `saved_routes.json`。
3. 重新啟動伺服器後，該收藏仍存在。
4. 成功回應的 `data` 含有 `route_id` 與 `saved_at`。
5. `GET /api/routes/saved` 只回傳當前使用者的資料。
6. 取得的收藏依 `saved_at` 由新到舊。
7. 每筆只必須暴露 PDF 要求的 `route_id`、`route_name` 與 `saved_at`。

### 12.5 交通警報

1. `GET /api/alerts` 回傳 `200` 與陣列。
2. 每筆警報含有 PDF 指定的 7 個欄位。
3. 第一優先順位的警報應為 `high` severity（當資料中存在 high 警報時）。

### 12.6 靜態資源與隱私政策

1. 將真實 PNG 放在 `data/resources/maps/mumbai_base.png` 後，`GET /api/resources/maps/mumbai_base.png` 回傳 `200` 與 `image/png`。
2. 不存在的資源回傳 `404`。
3. `/api/../../server.php`、URL-encoded `..` 及絕對路徑等越界請求回傳 `404`。
4. `GET /api/privacy-policy` 回傳 `200` 與 HTML Content-Type。
5. HTML 內含 `Privacy Policy` 標題及 ID 為 `closeBtn` 的關閉按鈕。

## 13. 完成定義

只有同時滿足以下條件，才可視為完成：

- 8 個 PDF API 全部實作。
- 請求方法、路徑、header 與欄位名稱符合 PDF。
- 成功回應結構符合 PDF 範例。
- 新使用者及收藏路線可寫入 JSON，並在伺服器重新啟動後保留。
- 授權保護套用在 API 4 與 API 8。
- 靜態檔案存取無法越出公開資源目錄。
- 所有驗收測試通過。
