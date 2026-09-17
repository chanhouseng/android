# 批次 10F：編輯 Homework 主要內容 HTML 設計規格

## 目的與範圍

本批次讓已登入管理者從「已發佈 Homework」清單載入、預覽及儲存可安全編輯頁面的主要內容 HTML。唯一可變動的正式資料是對應詳細頁之 `data-original-content` 內的 HTML。

不修改 Homework ID、標題、簡介、封面、圖片、圖片替代文字、Training folder、`status`、`order`、公開網址、`content/homework.json` 或 `homework/index.html`。舊式頁面不會被遷移或猜測改寫。

## 安全可編輯判定

內容編輯沿用批次 10E-1 的 `inspectHomeworkEditability()`：manifest 必須有唯一 published 記錄，`resultPage` 必須完全等於 `<id>.html`，詳細頁必須是 `homework/` 內的普通非 symlink 檔案，只有一個相符的 `data-content-id` 與一個可定位的 `data-original-content`，而且以 manifest 現有標題、簡介和抽出的內容呼叫 `renderHomeworkPage()` 後必須與磁碟頁面逐位元相同。

不符合條件的項目維持 `editable: false`，清單只顯示「此舊項目暫不支援網站編輯」，不顯示基本資料或主要內容編輯按鈕。伺服器針對這些頁面回傳 `409 homework_not_editable`。

## API 與路由

新增四個受保護端點，全部沿用既有安全標頭並加上 `Cache-Control: no-store`：

1. `GET <ADMIN_PATH>/api/homeworks/:id/content`
   - 需要有效 Session，不需要 CSRF。
   - 回傳 `id`、manifest 最新 `title`、可信任公開 `url`、原始 `contentHtml` 與 `revision`。
2. `POST <ADMIN_PATH>/api/homeworks/:id/content/preview`
   - 在讀取 JSON 前依序驗證 Origin、有效 Session 與 CSRF。
   - body 只接受 `{ "contentHtml": "..." }`。
   - 伺服器以 manifest 最新標題和簡介組合完整 preview input，依序執行 `validateHomeworkPreviewInput()`、`validateHtmlFragment()`、現有圖片引用驗證及 `renderHomeworkPage()`。
   - 回傳 sandbox iframe 使用的 `previewHtml`；伺服器在驗證既有圖片後，把預覽文件中的 `src` 改寫為該圖片 bytes 的 `data:` URL，textarea 原值保持不變。管理頁 CSP 只額外允許 `img-src data:`；script 仍禁止。
3. `PATCH <ADMIN_PATH>/api/homeworks/:id/content`
   - 在讀取 JSON 前依序驗證 Origin、有效 Session 與 CSRF。
   - body 必須恰好是 `{ "contentHtml": "...", "revision": "..." }`。
   - 成功回傳新的 `revision` 與可信任公開網址。
4. `GET <ADMIN_PATH>/api/homeworks/:id/images/:filename`
   - 供已登入管理者讀取既有內容圖片，需要有效 Session，不需要 CSRF；隔離預覽不依賴 iframe 傳送 Session cookie。
   - 僅接受既有安全圖片檔名規則，且只回傳目前 Homework 的圖片。

動態路由只接受未編碼的既有 Homework ID／圖片檔名格式；查詢、fragment、額外斜線、反斜線、編碼別名及路徑穿越一律拒絕。錯誤沿用統一 JSON 格式：`400 invalid_request`、`401 not_authenticated`、`403 invalid_origin`／`invalid_csrf`、`404 homework_not_found`、`409 homework_not_editable`／`content_changed`、`415 unsupported_media_type`、`422 validation_failed`、`500 internal_error`。不回傳實體路徑、stack trace 或底層錯誤。

## Revision 與並行更新

`revision` 是 Homework ID 與目前主要內容 HTML UTF-8 bytes 的 SHA-256 十六進位摘要。它不包含檔案路徑、Session 或秘密資料。

PATCH 取得共享的 `content/homework.json.lock` 後重新讀取 manifest 和詳細頁，再重新判定 editability。只有 request revision 與鎖內重新抽出的主要內容 revision 完全相同時才可繼續；不相同回傳 `409 content_changed`，前端保留 textarea 並要求管理者重新載入，不會自動覆蓋。

revision 只追蹤主要內容。若另一操作更新標題或簡介但主要內容未變，內容 PATCH 會使用鎖內 manifest 的最新標題和簡介重新渲染，因此不會覆蓋較新的 metadata。

## 現有圖片驗證

驗證器從已通過 `validateHtmlFragment()` 的 HTML 擷取每個 `<img src>`。每個值必須完全符合 `img/<目前 ID>/<安全檔名>`，其中檔名重用 `isSafeContentImageFilename()`，不得是其他 Homework、絕對路徑、外部 URL、編碼路徑或 traversal。

對應檔案必須位於 `homework/img/<id>/`；驗證器會以受限路徑解析、`lstat` 及 `realpath` 檢查檔案和圖片目錄，要求目標存在、是普通檔案、不是 symlink，且最終實體路徑仍位於該 Homework 圖片目錄。檔案不存在、新檔名沒有實體檔案或任何檢查失敗均回傳 `422 validation_failed`。

移除 HTML 引用不會刪除圖片。內容交易與預覽只讀取圖片；測試會比較圖片檔案清單及 SHA-256，證明檔案數量與 bytes 均未改變。

## 儲存交易與回滾

內容 editor 重用 `withFileLock()`、`writeTextAtomic()`、`validateContent()`、`buildContentIndexes({ check: true })`、`inspectHomeworkEditability()` 及 `renderHomeworkPage()`。

鎖內流程：

1. 重新讀取 manifest，依網址 ID 找出唯一 published 記錄。
2. 重新讀取並檢查詳細頁的 renderer 結構。
3. 驗證 revision。
4. 以 400 KiB UTF-8 上限及既有 preview contract 驗證 request。
5. 驗證 HTML fragment 與所有既有圖片引用。
6. 使用 manifest 鎖內最新標題、簡介及新內容重新產生正式詳細頁。
7. 原子寫入詳細頁。
8. 執行全站內容驗證及索引同步 `--check`；不執行索引重建。
9. 全部成功後回傳成功與新 revision。

開始正式寫入前保存詳細頁原始 bytes。步驟 7–8 任一步驟失敗時，在仍持有鎖的情況下以原子寫入恢復原頁面，再回傳 `500 internal_error`。manifest、Homework index 及圖片從不進入寫入集合，因此不會出現半更新狀態。

## 管理頁互動

可編輯清單項目在既有「編輯基本資料」旁加入「編輯主要內容」。按下後開啟獨立 `<dialog>`；不讀取、寫入或重設上方新增 Homework 表單。

Dialog 包含唯讀 ID、唯讀標題、安全公開網址、400 KiB 大小提示、普通 textarea、更新預覽、取消與儲存變更。Desktop 以編輯器與 sandbox iframe 並排；48rem 以下改為上下排列。沿用現有淺色 Design System、按鈕、狀態元件與焦點樣式，不新增第三方編輯器。

前端狀態規則：

- 開啟時顯示載入狀態，成功後才填入 textarea。
- HTML 每次 input 都即時更新 UTF-8 byte count，並讓最近成功預覽立即失效。
- `目前 textarea 字串 === 最近一次成功預覽字串` 且 Session 有效、沒有進行中的預覽／儲存時，才啟用「儲存變更」。
- 預覽與儲存各有 busy guard，快速重複操作只送出一次 request。
- 預覽只把伺服器回傳的完整文件設定到 sandbox iframe 的 srcdoc；iframe 保持無 sandbox capability，文件仍帶有禁止 script 等內容安全政策。textarea 的原始 HTML 不會被預覽改寫。
- 401 沿用 Session 過期畫面，但不關閉 dialog、不清空 textarea。422 顯示具體欄位錯誤；revision 衝突顯示需要重新載入的指示。
- 儲存成功後顯示清楚成功畫面和「開啟公開 Homework」安全新分頁連結，再由管理者關閉 dialog。
- 內容變更、取消、Escape、成功關閉均清空 iframe 預覽文件；一般關閉後焦點回到原觸發按鈕。

所有 manifest 文字只以 `textContent`／表單 `value` 顯示，不拼接 `innerHTML`。錯誤、載入、預覽完成及儲存完成使用 `role=status`／`role=alert` 與 `aria-live`。

## 測試策略

所有 production 行為先有失敗測試，再做最小實作：

- 模組：載入原始內容、revision、合法更新、最新 metadata 保留、內容上限、HTML 安全規則、圖片邊界／存在／symlink、並行 revision 衝突及鎖。
- 交易：成功只改詳細頁；write、內容驗證、索引檢查失敗時詳細頁 byte-identical 回滾；manifest、Homework index 和所有圖片清單／hash 前後相同。
- HTTP：GET／POST preview／PATCH／圖片 GET 的 method、Session、Origin、CSRF、body-before-auth、大小、400／404／409／415／422／500、no-store 及安全錯誤。
- 前端：可編輯按鈕、獨立 dialog、載入、byte count、預覽失效、sandbox、既有圖片、重複操作 guard、401 保留內容、revision 衝突、成功連結與新增表單不變。
- 回歸：10A–10E-2 管理測試、全站測試、內容驗證、索引同步、whitespace 檢查。
- 實際驗收：390、768、1024、1440px；無水平溢出、44px controls、Keyboard、focus、輔助技術狀態、Console 0 error。

正式專案內容不作人工 PATCH；成功、衝突與回滾驗收在完整臨時 fixture 上執行，正式受保護檔案在全套測試前後以 SHA-256 比較。

## 明確不實作

- 不上傳、替換、移動或刪除圖片。
- 不修改 ID、標題、簡介、封面、manifest、Homework index、Training 或任何非主要內容欄位。
- 不支援舊式 Homework，不新增草稿或刪除功能。
- 不加入第三方 HTML 編輯器，不部署，不執行 Git commit。
