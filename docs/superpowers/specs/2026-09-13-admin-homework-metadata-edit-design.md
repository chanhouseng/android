# 批次 10E-1：編輯 Homework 基本資料設計規格

## 目的與範圍

本批次讓已登入管理者從「已發佈 Homework」清單編輯 `title` 與 `description`，並同步更新：

- `content/homework.json`
- `homework/index.html`
- 對應的 `homework/<id>.html` 詳細頁

這是既有管理發佈流程的有限延伸。新增、刪除、草稿、Training、ZIP、主要內容 HTML、封面及內容圖片編輯均不在本批次。

## 已確認基線

批次 10D 已完成。開始本設計時，全套 253 項測試、內容驗證及索引同步檢查均通過。

目前 `content/homework.json` 有 33 筆 published Homework：

- 28 筆詳細頁位於 `homework/`，但沒有管理 renderer 的結構標記。
- 4 筆沒有 `resultPage`。
- 1 筆 `resultPage` 指向 `world skill/`。
- 目前沒有任何一筆能通過本規格的安全可編輯檢查。

因此，本批次不會改寫任何現有舊式頁面。由現有管理發佈器建立、並保持 renderer 原始格式的未來頁面會自動成為可編輯項目。

## 安全可編輯判定

伺服器以共享檢查器判斷 Homework 是否可安全編輯。所有條件必須同時成立：

1. manifest 是有效陣列，且存在網址指定 ID 的唯一記錄。
2. ID 符合既有 `HOMEWORK_ID_PATTERN`。
3. 記錄狀態是 `published`。
4. `resultPage` 必須完全等於 `<id>.html`，不得包含路徑分隔符、查詢、fragment 或編碼別名。
5. 解析後的實體路徑必須位於專案 `homework/` 目錄內，且檔案存在並為一般檔案。
6. 詳細頁只有一個 `data-content-id`，其值與 manifest ID 完全相同。
7. 詳細頁只有一個 `data-original-content`，且元素具有完整開始及結束標籤來源位置。
8. 能從 `data-original-content` 取得 renderer 包裝內的原始主要內容 HTML。
9. 使用 manifest 原有 ID、標題、簡介及抽出的主要內容呼叫目前 `renderHomeworkPage()`，所得 HTML 必須與磁碟上的詳細頁逐位元相同。

第 9 項是最終來源證明：只有目前 renderer 可無損重建的頁面才允許修改。標記存在但頁面另有手動改動時仍會拒絕，以免覆蓋未知內容。

不符合條件的清單項目回傳 `editable: false`，管理頁顯示「此舊項目暫不支援網站編輯」。PATCH 針對這些項目回傳 `409`。

## 清單 API 延伸

既有 `GET <ADMIN_PATH>/api/homeworks` 保持唯讀及 Session 保護，回應項目增加：

```json
{
  "id": "module-f",
  "title": "Module F",
  "description": "練習內容",
  "status": "published",
  "publishedAt": null,
  "url": "/homework/module-f.html",
  "editable": true
}
```

`description` 直接來自 manifest；`editable` 由伺服器檢查詳細頁後產生。清單不回傳實體路徑、主要內容 HTML、Session 或其他敏感資料。舊頁無法讀取或結構不符時只標示為不可編輯，不把內部例外送到瀏覽器。

## PATCH API

新增：

```text
PATCH <ADMIN_PATH>/api/homeworks/:id
```

請求必須使用 `application/json`、可信任 Origin、有效 Session 及相同 Session 的 CSRF token。網址中的 ID 是唯一查找依據；body 僅接受兩個鍵：

```json
{
  "title": "新的 Homework 名稱",
  "description": "新的簡介"
}
```

多餘鍵、缺少鍵、陣列或非物件 body 回傳 `400`。欄位沿用現有文字驗證：標題去除首尾空白後必填且最多 120 個 Unicode 字元；簡介去除首尾空白後必填、最多 500 個 Unicode 字元，且不得包含 `<` 或 `>`。

成功時回傳：

```json
{
  "updated": true,
  "homework": {
    "id": "module-f",
    "title": "新的 Homework 名稱",
    "description": "新的簡介",
    "url": "/homework/module-f.html"
  }
}
```

錯誤狀態：

- `400 invalid_request`：動態路由 ID 或 JSON request 結構不合法。
- `401 not_authenticated`：未登入或 Session 過期。
- `403 invalid_origin`／`invalid_csrf`：Origin 或 CSRF 不合法。
- `404 homework_not_found`：合法 ID 不存在。
- `409 homework_not_editable`：不是可安全重建的管理頁格式。
- `415 unsupported_media_type`：不是 JSON。
- `422 validation_failed`：標題或簡介驗證失敗，並沿用欄位錯誤陣列。
- `500 internal_error`：交易失敗並完成回滾；回應不包含路徑、stack trace 或底層例外訊息。

PATCH 回應加上 `Cache-Control: no-store`，並沿用現有安全標頭和統一 JSON 錯誤結構。未登入、Origin 或 CSRF 失敗時在解析 request body 前拒絕。

## 交易與回滾

metadata editor 重用 `content/homework.json.lock`、`withFileLock()`、`writeTextAtomic()`、`buildContentIndexes()`、`validateContent()` 及 `renderHomeworkPage()`。

鎖內流程：

1. 重新讀取 manifest 與三個正式檔案的原始 bytes。
2. 以網址 ID 找到記錄並重新執行安全可編輯判定，避免清單載入後資料改變。
3. 從唯一 `data-original-content` 抽出原始主要內容 HTML。
4. 建立只替換 `title`、`description` 的新 manifest；其他屬性及記錄順序保持不變。
5. 使用現有 renderer 以原始 ID、主要內容和既有 production asset/script base 產生新詳細頁。
6. 以原子寫入更新詳細頁與 manifest。
7. 執行既有索引 builder，讓 `homework/index.html` 從新 manifest 重新產生。
8. 執行全站內容驗證及索引 `--check` 等價檢查。
9. 所有步驟成功才回傳成功。

若步驟 6–8 任一失敗，在仍持有同一把鎖時以原始 bytes 原子恢復 manifest、詳細頁及 Homework 索引。恢復完成後才回傳 `500`。測試透過依賴注入在每個關鍵寫入或驗證點製造失敗，確認三個正式檔案最後同時保持原值。

交易不會寫入或刪除圖片檔案，也不會更新 `training/files.json`。主要內容的保證以更新前後抽出的 exact string 及檔案內相同內容區段比較驗證；圖片及其他 manifest 欄位以 deep equality 驗證。

## 管理頁互動

清單每列保留「開啟 Homework」並增加編輯區：

- `editable: true`：顯示「編輯基本資料」按鈕。
- `editable: false`：顯示「此舊項目暫不支援網站編輯」，不提供可觸發 PATCH 的控制。

編輯使用一個沿用現有淺色 Design System 的 modal `<dialog>`。同一 dialog 有兩個畫面：

1. 編輯畫面：唯讀 ID、標題、簡介、字數、公開網址、取消、儲存變更。
2. 確認畫面：列出即將儲存的 ID、標題與簡介，提供「返回修改」及「確認儲存」。

前端規則：

- 初始值使用清單 API 的資料，所有 manifest 文字透過 `textContent` 或表單 `value` 顯示。
- 前端與伺服器使用相同的 120／500 字元及純文字限制。
- 沒有實際變更或輸入不合法時停用「儲存變更」。
- 儲存期間停用 dialog 所有動作，防止重複提交或關閉造成誤解。
- 401 沿用 Session 過期流程；422 顯示欄位錯誤；409 顯示舊項目不可編輯；其他失敗顯示安全的一般錯誤。
- 儲存失敗回到編輯畫面並保留使用者輸入。
- 儲存成功後關閉 dialog、宣告成功並重新載入清單。
- 清單自動重新載入失敗時不把已成功儲存顯示成失敗。
- 編輯狀態與頁面上方新增 Homework 表單完全分離，不讀取、寫入或 reset 該表單。
- dialog 支援 Escape／取消、焦點圈、焦點返回原觸發按鈕、鍵盤操作及 `aria-live` 錯誤／成功訊息。

桌面版將操作按鈕垂直或換行排列於原「操作」欄；48rem 以下維持卡片排列。長標題、簡介及網址使用既有 overflow 規則，所有按鈕至少 44px 高。

## 測試策略

先新增失敗測試，再逐步實作：

- 契約：request 結構、Unicode 字數、HTML 字元及欄位錯誤。
- editability：安全 renderer 頁、舊頁、跨目錄、缺少／重複標記、ID 不一致及手動改動頁。
- 交易：合法更新、主要內容 exact preservation、非允許欄位 deep equality、圖片 bytes 不變、同時更新序列化、驗證失敗及中途寫入失敗完整回滾。
- HTTP：method、JSON、Origin、Session、Session 過期、CSRF、400／404／409／422／500、安全錯誤及 no-store。
- 前端：可／不可編輯列、dialog、字數、dirty state、確認、重複操作、錯誤保留、成功重新載入、Session 過期、XSS inertness、新增表單不變。
- 回歸：所有管理測試、全站測試、內容驗證、索引同步及 diff whitespace 檢查。
- 手動：390、768、1024、1440px、Keyboard、focus、輔助技術狀態及 Console error。

測試 fixture 只在臨時目錄建立 renderer 管理頁並操作複本，不會修改專案正式 manifest、索引、詳細頁或圖片。正式檔案會在測試前後以 SHA-256 比較。

## 明確不實作

- 不編輯 ID、order、status、任何圖片欄位、resultPage、trainingFolder 或主要內容 HTML。
- 不新增、刪除、儲存草稿、搜尋、篩選、排序或分頁。
- 不遷移、修補或猜測舊式 Homework HTML。
- 不修改 Training、`training/files.json`、公開 Training 頁面或部署設定。
- 不加入資料庫，不執行 Git commit。
