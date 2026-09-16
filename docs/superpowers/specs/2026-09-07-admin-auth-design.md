# 批次 10A：Homework 管理服務與單一密碼登入設計

## 目標與邊界

本批建立一個獨立、只監聽管理端口的 Node.js 管理服務。功能限於單一管理密碼登入、安全 Session、登入狀態檢查、登出、登入失敗限制，以及登入後的 Homework 編輯器佔位首頁。

本批不修改 Homework、World Skill、Training 的內容、索引、資料檔、公開網址或 Navigation，也不建立帳號、角色、資料庫、內容表單、預覽、上傳或發佈能力。

## 運行模型

管理服務使用 Node.js 20.6.0 或以上版本的內建模組，獨立於現有靜態網站服務運行。最低版本取決於 v20.6.0 加入的 `--env-file`；服務啟動時會檢查實際 Node 版本。目前開發環境為 Node.js v24.19.0。

預設設定如下：

- Host：`127.0.0.1`
- Port：`8787`
- 管理路徑：`/homework-editor-private`
- 本機 Cookie Secure：`false`
- Session 固定有效期：8 小時
- 登入限制窗口：15 分鐘
- 同一來源 IP 在窗口內最多失敗 5 次

服務以 `node --env-file=.env admin/server/server.mjs` 啟動。測試直接呼叫 server factory 並使用 port `0`，由作業系統分配隨機端口。

## 檔案責任

### 管理前端

- `admin/login.html`：未登入畫面，只包含網站名稱、密碼欄位、登入按鈕、Loading 狀態與 live region。
- `admin/index.html`：已登入畫面，只包含管理頁標題、登入狀態、下一批提示及登出按鈕。
- `admin/admin.css`：管理頁專用排列；透過同源路由載入現有 foundation CSS，不複製 Design Tokens。服務必須同時提供 `foundation.css` 及它依賴的 `tokens.css`、`base.css`、`utilities.css`、`components.css`。
- `admin/login.js`：以相對 URL 呼叫 `api/login`，呈現 Loading 與一般化錯誤，不保存密碼或 Session。
- `admin/admin.js`：以相對 URL取得 Session／CSRF 狀態並執行登出；未登入時重新載入入口。

### 管理後端

- `admin/server/config.mjs`：解析及驗證環境變數、Node 版本、管理路徑、Cookie Secure 與正式環境要求。
- `admin/server/password.mjs`：建立及驗證隨機 salt 的 scrypt hash，並使用 constant-time comparison。
- `admin/server/session-store.mjs`：產生隨機 Session token、以 Session secret 計算 token hash、保存 CSRF token及固定到期時間，並清理過期 Session。
- `admin/server/login-rate-limit.mjs`：使用來源 IP 與可注入 clock 管理 15 分鐘／5 次失敗限制。
- `admin/server/security-headers.mjs`：集中設定管理頁與 API 的安全回應標頭。
- `admin/server/server.mjs`：HTTP routing、同源檢查、Cookie／JSON request parsing、靜態管理資源回應與各小型模組協調，不保存管理內容。

### 工具、設定與測試

- `scripts/create-admin-credentials.mjs`：在 TTY 隱藏讀取兩次密碼，建立 scrypt hash及高強度 Session secret，只輸出 `.env` 可複製值。
- `.env.example`：列出全部管理設定及說明，所有值保持空白，使用者複製後自行填寫。
- `.gitignore`：加入根目錄 `.env`，不影響其他既有規則。
- `tests/admin-auth.test.mjs`：使用 Node.js test runner 與真實本機 HTTP 請求驗證管理服務契約。
- `README.md`：記錄 Node 版本、憑證產生、本機設定、啟動、安全 Cookie 與本批範圍。

## 設定驗證

`ADMIN_PATH` 必須：

- 以 `/` 開始且不能是根路徑 `/`。
- 每個 segment 只含小寫英文字母、數字及連字符。
- 不含空 segment、尾端斜線、反斜線、`..`、百分號編碼、query 或 fragment。

`ADMIN_HOST` 只接受明確的 loopback address `127.0.0.1` 或 `::1`，拒絕 `0.0.0.0`、`::`、LAN address及 hostname。批次 10A 不直接暴露管理服務；正式部署仍由 Nginx 代理至 loopback。

`ADMIN_PORT` 必須是有效端口；測試可使用 `0`。`ADMIN_COOKIE_SECURE` 只接受 `true` 或 `false`。`NODE_ENV=production` 時若 Secure 不為 `true`，服務拒絕啟動。

`ADMIN_PASSWORD_HASH` 與 `ADMIN_SESSION_SECRET` 缺少或空白時拒絕建立服務。Session secret 使用無 padding 的 base64url；解碼後必須至少包含 32 bytes 隨機資料，而不是只檢查字串長度。任何設定錯誤只回報欄位及修正方向，不輸出秘密內容。

## 密碼憑證

Password hash 使用以下版本化格式：

`scrypt$v=1$N=131072$r=8$p=1$keyLength=64$<base64url salt>$<base64url derived key>`

建立時使用 `crypto.scrypt`、16 bytes 隨機 salt及 64 bytes輸出，並明確指定 N=2^17、r=8、p=1及足以容納該計算的 256 MiB `maxmem`。這組參數遵循 OWASP Password Storage Cheat Sheet 列出的 128 MiB scrypt 基準，不依賴 Node.js 的較低預設值。演算法、格式版本、N、r、p及 keyLength全部保存在 hash 中，讓日後可辨識及升級參數。

驗證時重新衍生相同長度的 hash，先確認合法格式與相同 buffer 長度，再用 `crypto.timingSafeEqual` 比較。錯誤格式與錯誤密碼都只回傳失敗，不把 hash 或解析細節帶到 HTTP 回應。

憑證工具不接受命令列密碼。它只在互動 TTY 中運作，啟用 raw mode 讀取輸入、不回顯字元，支援 Backspace、Enter 與 Ctrl+C；兩次輸入不同或空密碼即停止，不寫入檔案。raw mode及事件監聽器必須在 `finally` 中恢復，錯誤、取消及 Ctrl+C 都不能令終端停留在異常模式。

工具使用 `randomBytes(32).toString('base64url')` 產生 Session secret，確保解碼後正好有 32 bytes 隨機資料。

## Session 與 Cookie

登入成功時建立：

- 32 bytes 隨機 Session token，僅放入 Cookie。
- 使用 `ADMIN_SESSION_SECRET` 計算的 token HMAC-SHA-256，作為記憶體 Map key。
- 32 bytes 隨機 CSRF token，保存在 Session record。
- 固定 `createdAt` 與 `expiresAt`，有效期 8 小時，不因請求而延長。

Cookie 名稱為 `admin_session`，包含 `HttpOnly`、`SameSite=Strict`、`Path=<ADMIN_PATH>`、固定 `Max-Age`。Secure 設定為 true 時加入 `Secure`。登出及無效／過期 Session 會回傳同 Path 的到期 Cookie。

Session store 每次讀寫時清除到期記錄，並提供可停止的定期清理 timer；timer 不阻止 Node 程序正常退出。建立新的 Session store 不具有舊 Map，因此服務重啟後舊 Cookie 自然失效。

## 路由與資料流

只接受以下路由：

- `GET <ADMIN_PATH>/`：有有效 Session 時回傳管理首頁，否則回傳登入頁。
- `POST <ADMIN_PATH>/api/login`：驗證 Origin、rate limit、JSON body 與密碼；成功後建立 Session Cookie。
- `GET <ADMIN_PATH>/api/session`：回傳 `{ authenticated: false }`，或已登入狀態與 CSRF token。
- `POST <ADMIN_PATH>/api/logout`：驗證 Origin、Session 與 `X-CSRF-Token`，刪除伺服器 Session 並清除 Cookie。
- 管理頁需要的 `admin.css`、`login.js`、`admin.js`，以及 `assets/foundation.css`、`assets/tokens.css`、`assets/base.css`、`assets/utilities.css`、`assets/components.css`，由管理路徑下的固定 allowlist 唯讀路由提供。路由不接受任意檔名或檔案系統路徑。

其他管理路徑、`/admin/`、管理 HTML 的直接檔名及所有非管理 URL 一律回傳 404。API 不回傳 password hash、Session secret或完整 Session token。

POST body 只接受 media type `application/json`，並接受合法的參數形式，例如 `application/json; charset=utf-8`。Login body 上限為 4 KiB；超過上限後停止讀取並回傳 413。Login body 只讀取非空的 `password` 字串；未知欄位不影響行為。

### HTTP API 契約

所有 JSON 錯誤使用：

```json
{
  "error": {
    "code": "stable_machine_code",
    "message": "給管理者閱讀的一般化訊息"
  }
}
```

成功及錯誤行為固定如下：

- `GET <ADMIN_PATH>/`：200 HTML；有效 Session 顯示管理首頁，否則顯示登入頁。
- `POST <ADMIN_PATH>/api/login`：200 `{ "authenticated": true }` 並設定 Cookie；400 `invalid_request` 用於 JSON 無效或 password 欄位錯誤；401 `login_failed` 用於任何憑證失敗；403 `invalid_origin`；413 `payload_too_large`；415 `unsupported_media_type`；429 `rate_limited` 並加入整數秒 `Retry-After`。
- `GET <ADMIN_PATH>/api/session`：未登入時仍回傳 200 `{ "authenticated": false }`；已登入時回傳 200 `{ "authenticated": true, "csrfToken": "..." }`。
- `POST <ADMIN_PATH>/api/logout`：成功時回傳 200 `{ "authenticated": false }` 並清除 Cookie；無效 Session回傳 401 `not_authenticated`；Origin或 CSRF失敗回傳 403 `invalid_origin` 或 `invalid_csrf`；錯誤 media type回傳 415。
- 已知路由使用錯誤 HTTP method：405 `method_not_allowed` 並加入正確 `Allow` header。
- 未知路徑：404。未預期 server error：500 `internal_error`。

API JSON 一律使用 `application/json; charset=utf-8`，頁面使用 `text/html; charset=utf-8`。API成功或失敗都不回傳 password hash、Session secret、完整 Session token或密碼內容。

## Origin、CSRF 與來源 IP

登入及登出要求 `Origin`。本機模式的允許 origin 由設定的 `ADMIN_HOST`、HTTP scheme及伺服器實際監聽 port 組成，不以來自客戶端的 Host header 作為信任來源；Origin 與這個值不完全相符即拒絕。管理服務不設定 CORS，也不信任 `X-Forwarded-For`。來源 IP直接取自 `request.socket.remoteAddress`；反向代理、正式 public origin及 proxy trust 留待部署批次。

登出還必須同時提供有效 Session Cookie 與等於 Session record 的 `X-CSRF-Token`。比較 CSRF token 時使用固定長度 buffer的 constant-time comparison。

## 登入限制

Rate limiter 以來源 IP 保存失敗時間：

- 每次檢查先移除 15 分鐘窗口以外的紀錄。
- 前 5 次錯誤登入回傳相同的一般化登入失敗訊息。
- 從第 6 次嘗試開始回傳暫時限制狀態。
- 正確登入後清除該 IP 的失敗紀錄。
- clock、窗口及次數由 constructor 注入，測試不需要等待真實時間。

## 安全回應標頭

全部管理頁、API及管理服務的 404 回應設定：

- `Cache-Control: no-store`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `X-Frame-Options: DENY`
- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`

頁面不使用 inline JavaScript、外部 CDN、第三方追蹤或寬鬆 CORS。

## UI 與可存取性

管理頁保持既有簡約淺色風格，使用 foundation tokens、Button、Card 與 focus 樣式。畫面為窄版單卡容器，390px 與桌面皆保持自然寬度，不加入 App Shell 或網站 Navigation，避免意外公開管理入口。

密碼 input 有可見 label及 `autocomplete="current-password"`。錯誤訊息使用 `role="alert"`／`aria-live="polite"`。提交期間按鈕 disabled並顯示 Loading 文字。所有控制至少 44px、支援鍵盤與 visible focus，並沿用 reduced-motion 設定。

登入後頁面只顯示管理標題、已登入狀態、「Homework 編輯器將於下一批加入」與登出按鈕。

## 測試策略

測試先於實作建立，並先確認因模組不存在或行為缺失而失敗。測試使用：

- 隨機 scrypt salt與真實密碼驗證。
- 全新 Session store 驗證重新啟動失效。
- 可注入 clock驗證 Session 到期與 rate-limit窗口。
- 真實 `node:http` server，port `0`，使用 Node內建 fetch發送 HTTP request。
- 手動管理 Cookie header，直接檢查 `Set-Cookie` flags及 API輸出。
- 逐一檢查合法／非法 Admin Path、Origin、CSRF、404、安全標頭與秘密不外洩。
- 讀取管理 HTML確認 label、live region、外部 scripts與最小佔位內容。
- 全部既有測試、內容驗證與索引同步檢查。

人工驗收使用測試用環境變數啟動 `127.0.0.1:8787`，在桌面與 390px 檢查登入、錯誤、限制、重新整理頁面後仍維持登入但固定到期時間不延長、登出、Keyboard、focus及 Console。驗收不會修改任何內容資料。

## 失敗處理與記錄

伺服器預期錯誤使用一般化 JSON 或純文字訊息。未預期錯誤只在 server console記錄不含秘密的摘要，HTTP回應固定為一般化 500。登入密碼、Cookie、CSRF token、password hash與Session secret不寫入 log。

管理服務的 `close` helper會停止 HTTP server及 Session cleanup timer，供測試和正常關機使用；不加入內容寫入或其他後續批次功能。

## 參考基準

- Node.js CLI `--env-file`：https://nodejs.org/docs/latest/api/cli.html#--env-filefile
- Node.js `crypto.scrypt` options：https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback
- OWASP Password Storage Cheat Sheet：https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
