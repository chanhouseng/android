# PHP Diary API 專案說明

## 專案簡介

這是一個使用純 PHP 建置的小型日記與收藏 API。專案不需要 MySQL 或其他資料庫，使用 JSON 檔案儲存使用者、日記與收藏資料，適合作為前端應用的測試後端、API 原型或課程示範。

專案內建 15 篇以博物館、畫廊與藝術觀展為主題的英文日記，並附有日記封面、場景圖片與正文 JSON 資源。

## 主要功能

- 使用電子郵件與密碼登入。
- 電子郵件尚未存在時自動建立帳號。
- 登入成功後簽發新的 `auth_token`。
- 取得全部日記摘要資料。
- 將指定日記加入個人收藏。
- 取得當前使用者的收藏清單，並依收藏時間由新到舊排序。
- 透過 API 路徑提供圖片、JSON、HTML、CSS、JavaScript、影音與 PDF 等靜態檔案。
- 對電子郵件、密碼、授權令牌與日記 ID 進行基本驗證。

## 運作流程

1. 客戶端將請求送至 PHP 內建伺服器。
2. `server.php` 先判斷請求的是否為 `public` 目錄中的真實檔案；靜態檔案會直接傳送，其他請求交給應用入口。
3. `public/index.php` 建立 `App` 物件並處理請求。
4. `src/App.php` 根據 HTTP 方法與路徑執行對應功能。
5. `src/FileStore.php` 負責讀寫 `storage/data` 中的 JSON 檔案。

## API 一覽

| 方法 | 路徑 | 授權 | 功能 |
| --- | --- | --- | --- |
| `POST` | `/api/users/signin` | 不需要 | 登入；若帳號不存在則自動註冊 |
| `GET` | `/api/diary` | 不需要 | 取得全部日記摘要 |
| `PUT` | `/api/diary/collection` | 需要 | 新增或更新一筆日記收藏 |
| `GET` | `/api/diary/collection` | 需要 | 取得當前使用者的全部收藏 |
| `GET` | `/api/user-agreement` | 不需要 | 顯示簡易的使用者協議 HTML 頁面 |
| `GET` | `/api/{public 內的檔案路徑}` | 不需要 | 讀取公開的圖片或內容檔案 |

### 1. 登入或註冊

```http
POST /api/users/signin
Content-Type: application/json
```

```json
{
  "userEmailAddress": "user@example.com",
  "userPassword": "123abc"
}
```

請求支援 JSON、表單編碼、multipart form-data 與 query string。新使用者的密碼會經過 PHP `password_hash()` 處理後才儲存。已存在的使用者登入時，系統會用 `password_verify()` 比對密碼。

成功回應：

```json
{
  "msg": "Sign in successful",
  "data": {
    "auth_token": "YOUR_AUTH_TOKEN"
  }
}
```

### 2. 取得日記

```http
GET /api/diary
```

每篇日記包含以下欄位：

- `diary_id`：日記唯一 ID。
- `diary_title`：標題。
- `diary_main_text`：正文 JSON 的相對路徑。
- `diary_upload_datetime`：上傳時間。
- `diary_image`：封面圖片的相對路徑。
- `diary_upload_username`：上傳者名稱。

例如 API 回傳的 `resources/demo/d4.json` 可以通過以下網址取得：

```text
http://127.0.0.1:8000/api/resources/demo/d4.json
```

### 3. 加入收藏

```http
PUT /api/diary/collection
Authorization: Bearer YOUR_AUTH_TOKEN
Content-Type: application/json
```

```json
{
  "diary_id": "BA23617D-42DA-8C4A-F569-C1915B9B55B1"
}
```

如果同一使用者已收藏該篇日記，系統不會新增重複資料，而是更新該筆收藏的時間。

### 4. 取得個人收藏

```http
GET /api/diary/collection
Authorization: Bearer YOUR_AUTH_TOKEN
```

`auth_token` 可放在下列任一位置：

- `Authorization: Bearer <token>` header。
- `auth_token` header。
- 請求 body 的 `auth_token` 欄位（適用於會讀取 body 的請求）。
- query string，例如 `?auth_token=<token>`。

## HTTP 狀態碼

| 狀態碼 | 意義 |
| --- | --- |
| `200` | 請求成功 |
| `401` | 密碼錯誤、缺少令牌或令牌無效 |
| `404` | 路由、日記或靜態資源不存在 |
| `422` | 必要欄位缺少或電子郵件格式不正確 |
| `500` | 伺服器內部錯誤 |

## 資料儲存

| 檔案 | 用途 |
| --- | --- |
| `storage/data/diaries.json` | 日記摘要與資源路徑 |
| `storage/data/users.json` | 使用者電子郵件、密碼雜湊與授權令牌 |
| `storage/data/favorites.json` | 使用者與收藏日記的對應關係 |
| `public/resources/**/*.json` | 日記完整正文、地點、摘要與段落 |
| `public/resources/**/*.jpg` | 日記封面與場景圖片 |

寫入 JSON 時使用檔案鎖 `LOCK_EX`，可減少同時寫入所造成的檔案衝突。

## 目錄結構

```text
ws-php/
├── public/
│   ├── index.php              # Web 應用入口
│   └── resources/             # 日記圖片與正文 JSON
├── src/
│   ├── App.php                # 路由、請求驗證與回應
│   └── FileStore.php          # JSON 檔案資料存取
├── storage/data/
│   ├── diaries.json           # 日記資料
│   ├── favorites.json         # 收藏資料
│   └── users.json             # 使用者資料
├── server.php                     # PHP 內建伺服器路由腳本
├── test_server.sh                 # Linux/macOS 的基本 API 測試腳本
└── README.md                      # 原有快速說明
```

## 執行方式

### 環境需求

- PHP 8.0 或以上。
- 作業系統帳號需要對 `storage/data` 有寫入權限。
- 不需要 Composer 或資料庫。

### 啟動

在專案根目錄執行：

```bash
php -S 127.0.0.1:8000 server.php
```

啟動後的 Base URL：

```text
http://127.0.0.1:8000
```

### 快速測試

```bash
curl http://127.0.0.1:8000/api/diary
```

Linux/macOS 也可執行 `test_server.sh`，但腳本內的專案路徑固定為 `/var/www/ws`，如果專案位於其他位置，需要先調整該路徑。

## 目前限制與注意事項

- 使用 JSON 檔案當作儲存層，適合少量資料與低並發場景，不適合大型正式系統。
- `auth_token` 會直接儲存在 `users.json`，沒有過期時間、撤銷機制或令牌雜湊。
- 每次成功登入都會更換令牌，舊令牌立即失效。
- 沒有登出、刪除收藏、建立日記、修改日記或分頁功能。
- API 目前沒有 CORS 與速率限制設定。
- 伺服器錯誤回應會輸出例外訊息，正式環境應改為記錄在伺服器日誌，避免對外暴露內部資訊。
- `PUT /api/diary/collection` 缺少 `diary_id` 時，目前回應內容是整個輸入資料，而非固定錯誤文字。
- 專案中有數個 macOS/Windows 傳輸產生的隱藏或 `Zone.Identifier` 附加檔，不影響 API 主要功能，但發佈前可清理。

## 適合的使用情境

- 行動 App 或前端頁面的 API 串接練習。
- 不安裝資料庫時的快速後端原型。
- PHP 路由、JSON 檔案讀寫與 token 授權的教學範例。
- 日記、旅行或博物館內容展示應用的示範資料源。
