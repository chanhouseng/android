# WS-MAD 純 PHP API 伺服器

這是一個依據 `WS-MAD-SERVER-API` Postman Collection 建立的純 PHP 8 API 伺服器。它不使用框架、Composer 套件或資料庫，提供照片、技能、影片及影片留言資料；新增留言會寫入 JSON，因此重新啟動後仍會保留。

## 環境需求

- PHP 8.0 或以上
- TCP 3000 埠可用
- 執行整合測試時需要 Windows PowerShell 5.1 或 PowerShell 7

確認 PHP：

```powershell
php -v
```

## 啟動伺服器

在本 README 所在目錄執行：

```powershell
php -S 0.0.0.0:3000 server.php
```

本機可以使用：

```text
http://127.0.0.1:3000
```

`0.0.0.0` 是監聽位址，不是手機或其他客戶端應輸入的網址。

## 從手機或區域網路連線

1. 在伺服器電腦執行 `ipconfig`。
2. 找到目前網路介面的 IPv4 位址，例如 `192.168.1.100`。
3. 在手機或其他客戶端使用 `http://192.168.1.100:3000` 作為伺服器位址。
4. 確認客戶端與伺服器位於可互相連通的網路，且訪客 Wi-Fi 沒有開啟裝置隔離。
5. 確認 Windows 防火牆允許 TCP 3000 的輸入連線。

如需建立 Windows 防火牆規則，可以管理員身分開啟 PowerShell，確認後執行：

```powershell
New-NetFirewallRule -DisplayName "WS-MAD PHP 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

## API 清單

| Method | Path | 功能 |
|---|---|---|
| `POST` | `/api/image/photos` | 未提供 `pageNumber` 時取得照片頁面資訊；提供 `0` 或 `1` 時取得該頁照片 |
| `GET` | `/api/image/photos/{filename}` | 取得照片 JPEG |
| `GET` | `/api/skills-types` | 取得技能分類及其技能 |
| `GET` | `/api/skills/{id}` | 取得指定技能詳情 |
| `GET` | `/api/image/skills_images/{filename}` | 取得技能 JPEG |
| `GET` | `/api/video` | 取得 20 筆影片資料 |
| `GET` | `/api/video/comment` | 取得所有影片留言 |
| `POST` | `/api/video/comment` | 新增影片留言並持久化 |

所有 JSON 回應都使用以下外層格式：

```json
{
  "code": 200,
  "msg": "Success",
  "data": []
}
```

Content-Type 為 `application/json;charset=UTF-8`。

## API 範例

### 照片頁面資訊

```powershell
curl.exe -X POST http://127.0.0.1:3000/api/image/photos
```

```json
{
  "code": 200,
  "msg": "Success",
  "data": {
    "firstPageNumber": 0,
    "totalPhotos": 18,
    "totalPage": 2
  }
}
```

### 指定照片頁面

`pageNumber` 使用 form-data 或 URL-encoded form；有效值只有 `0` 和 `1`。

```powershell
curl.exe -X POST -F "pageNumber=0" http://127.0.0.1:3000/api/image/photos
```

成功時 `data` 含 9 筆照片，URL 會根據客戶端實際使用的 Host 自動產生：

```json
{
  "code": 200,
  "msg": "Success",
  "data": [
    {
      "visit-count": "389",
      "heat": "1004",
      "url": "http://127.0.0.1:3000/api/image/photos/No_00009.jpg"
    }
  ]
}
```

### 技能分類與詳情

```powershell
curl.exe http://127.0.0.1:3000/api/skills-types
curl.exe http://127.0.0.1:3000/api/skills/1000
```

技能詳情格式：

```json
{
  "code": 200,
  "msg": "Success",
  "data": {
    "id": "1000",
    "name": "Information Network Cabling",
    "introduction": "The occupations related to “Information Network Cabling” are deeply related to the technology that supports modern information societies in which lives can be more comfortable and sustainable.",
    "img": "http://127.0.0.1:3000/api/image/skills_images/1000.jpg"
  }
}
```

### 影片及留言

```powershell
curl.exe http://127.0.0.1:3000/api/video
curl.exe http://127.0.0.1:3000/api/video/comment
```

新增留言：

```powershell
curl.exe -X POST `
  -H "Content-Type: application/json" `
  -d '{"commentText":"Nice video!","videoUUID":"2D6A33E7-AE3C-FCFA-5AF1-249C71C1AC57"}' `
  http://127.0.0.1:3000/api/video/comment
```

成功回應中的 `uuid` 是新產生的 UUID v4，`ipAddress` 是提出請求的客戶端位址，`commentTime` 是 Unix 毫秒時間：

```json
{
  "code": 200,
  "msg": "Success",
  "data": {
    "uuid": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
    "ipAddress": "127.0.0.1",
    "commentText": "Nice video!",
    "commentTime": 1788440400000,
    "videoUUID": "2D6A33E7-AE3C-FCFA-5AF1-249C71C1AC57"
  }
}
```

## 錯誤狀態

| HTTP status | 情況 |
|---|---|
| `400` | 照片頁碼超出範圍、留言 JSON 無效、缺少留言欄位、欄位類型錯誤、留言為空或影片 UUID 不存在 |
| `404` | 路由、技能或媒體檔不存在，或媒體路徑不安全 |
| `405` | 已知路徑使用錯誤 HTTP method；回應包含 `Allow` header |
| `500` | JSON 儲存檔遺失、損壞、無法讀寫或發生未預期的伺服器錯誤 |

錯誤回應不會顯示 stack trace、實際檔案路徑或儲存檔內容。

## 資料與持久化

- `storage/photos.json`：18 筆照片資料，共 2 頁。
- `storage/skill-types.json`：2 個技能分類。
- `storage/skills.json`：8 筆技能詳情。
- `storage/videos.json`：從既有 `server.py` 移植的 20 筆影片資料。
- `storage/comments.json`：20 筆初始留言及後續新增留言。
- `public/media/photos/`：18 張本機照片資源。
- `public/media/skills_images/`：8 張本機技能圖片。

寫入留言時會取得排他檔案鎖，完整寫入後才釋放；讀取使用共享鎖。JSON 保留 Unicode 字元及正常的 URL slash。

若確定要刪除執行期間新增的留言，且專案由 Git 管理，可以從專案根目錄明確還原這一個檔案：

```powershell
git restore -- train/2022_module_a/storage/comments.json
```

## 測試

單元與應用層測試：

```powershell
php tests/run.php
```

真實 HTTP 整合測試：

```powershell
powershell -ExecutionPolicy Bypass -File tests/integration.ps1
```

也可以使用 PowerShell 7：

```powershell
pwsh -File tests/integration.ps1
```

整合測試會實際以 `php -S 0.0.0.0:3000 server.php` 啟動伺服器，驗證端點、狀態碼、Content-Type、圖片、路徑穿越防護與留言重啟持久化。測試結束後會停止它建立的 PHP 程序，並還原測試前的留言資料。

PHP 語法檢查：

```powershell
$failed = $false
Get-ChildItem -Path . -Recurse -Filter *.php | ForEach-Object {
    php -l $_.FullName
    if ($LASTEXITCODE -ne 0) { $failed = $true }
}
if ($failed) { exit 1 }
```

## 專案結構

```text
server.php
public/
  index.php
  media/
src/
  App.php
  FileStore.php
  Media.php
  Response.php
storage/
tests/
  bootstrap.php
  run.php
  integration.ps1
```

## 規格假設與限制

- Postman 文件定義 18 張照片與 2 頁，因此沒有沿用 `server.py` 中互相重複的 54 張／6 頁行為。
- Postman 只提供 `No_00009.jpg` 至 `No_00017.jpg` 的數值；另一頁使用固定的補充模擬數值，並在本機提供可讀取的 JPEG。
- 影片與初始留言使用 `server.py` 的擴充資料。第一筆影片 UUID、URL、length 以及第一筆留言的影片關聯已依 Postman 成功範例校正。
- 第一筆影片 URL 是 Postman 的原始 LAN URL；其餘影片使用 `server.py` 的外部示範影片 URL。外部影片需要網路連線，原始 LAN URL 只在對應主機存在時可用。
- 專案沒有提供影片二進位檔，因此沒有建立額外的影片檔案路由。
- 自動化測試只驗證本機 HTTP 連線。從另一台實體裝置連線仍需依「從手機或區域網路連線」章節手動驗證。

