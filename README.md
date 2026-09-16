這是一個關於 Android 知識點及練習的網站，當中存放第四十八屆世界技能大賽（World Skill）澳門選拔賽及密集式訓練的檔案和練習。

## 內容資料來源

- Homework 入口：`content/homework.json`
- World Skill 入口：`content/world-skills.json`

詳細教學、Kotlin／XML 程式碼和成果仍放在原有 HTML 頁面。請勿直接手動新增索引卡片；修改 JSON 後使用建置指令產生卡片。

## 新增 Homework

1. 建立不會立即顯示的 draft：

   ```sh
   node scripts/new-content.mjs homework module-f
   ```

2. 編輯 `content/homework.json` 中的新項目，填寫 `title`、`description`、`image`、`resultPage` 和 `trainingFolder`。
3. 在 `homework/module-f.html` 加入真實成果或教學內容。
4. 把成果圖片放到 `homework/img/`，並在 `image` 使用相對路徑，例如 `img/moduleF.png`。多張圖片可用 `additionalImages`。
5. Training 題目放在 `train/<實際資料夾名稱>/`；`trainingFolder` 必須保留相同大小寫，不要手動輸入 `%20`。
6. 如有 Training 資料夾，先安全發佈該單一資料夾，再執行驗證。
7. 所有內容完成後，把 `status` 由 `draft` 改成 `published`，重新產生索引並執行完整驗證。

## 新增 World Skill Exercise

1. 建立 draft：

   ```sh
   node scripts/new-content.mjs exercise exercise25
   ```

2. 編輯 `content/world-skills.json` 的新項目，填寫原有名稱、說明、搜尋文字、圖片和 `detailPage`。
3. 把圖片放到 `world skill/img/`。
4. 在 `world skill/exercise25.html` 加入真實教學內容；不要把大量 Kotlin／XML 程式碼放入 JSON。
5. 完成後把 `status` 改為 `published`，再重建及驗證索引。

## Draft 與 Published

- `status: "draft"`：保留在資料檔，但不會出現在正式索引。
- `status: "published"`：建置器會產生入口；驗證器會檢查所有已宣告的圖片、頁面和 Training 路徑。
- 現有刻意缺少資源的舊卡片使用 `null`，不要填寫不存在的檔名。

## 安全發佈單一 Training 資料夾

```sh
node scripts/publish-training-folder.mjs "Module F"
```

這個指令只掃描明確指定的 `train/Module F/`，並安全合併到現有 `training/files.json`。它會拒絕路徑穿越、symlink、`.env`、私鑰、keystore、credentials、secret 和 `local.properties` 等敏感項目。

> 警告：不要使用 `node scripts/generate-training-index.mjs` 作為日常內容流程。舊指令會掃描整個 `train/`，可能擴大公開範圍。

## 驗證及重建索引

重建兩個入口頁：

```sh
node scripts/build-content-indexes.mjs
```

只檢查 JSON 與 HTML 是否同步，不修改檔案：

```sh
node scripts/build-content-indexes.mjs --check
```

發佈前驗證內容及路徑：

```sh
node scripts/validate-content.mjs
```

執行全部自動測試：

```sh
node --test tests/*.test.mjs
```

## Batch 10A：本機 Homework 管理入口

此管理入口需要 Node.js >= 20.6.0，並且只綁定本機 loopback 位址。先以互動式指令產生憑證資料（密碼不會顯示在終端）：

```sh
node scripts/create-admin-credentials.mjs
```

複製範本，再把指令產生的 `ADMIN_PASSWORD_HASH` 與 `ADMIN_SESSION_SECRET` 填入本機 `.env`；不要提交 `.env`：

```sh
cp .env.example .env
```

可在 `.env` 設定自訂的 `ADMIN_PATH`（必須是私有、以 `/` 開頭的路徑），然後啟動服務：

```sh
node --env-file=.env admin/server/server.mjs
```

本機 localhost HTTP 開發時，將 `ADMIN_COOKIE_SECURE=false`，否則瀏覽器不會傳送 Secure cookie。正式 production 環境必須使用 HTTPS 並設定 `ADMIN_COOKIE_SECURE=true`。

Batch 10A has no Homework creation/editing/upload/publication behavior；此批次只提供受保護的本機登入與佔位管理入口，不會改動公開網站內容流程。

## Batch 10B：Homework 輸入與安全預覽

Batch 10B 在原有本機登入後加入 Homework 表單。依照 Batch 10A 的方式建立憑證，並以 PowerShell 複製設定範本：

```powershell
node scripts/create-admin-credentials.mjs
Copy-Item .env.example .env
node --env-file=.env admin/server/server.mjs
```

使用終端顯示的 origin，加上 `.env` 內設定的 `ADMIN_PATH` 開啟管理入口。`.env`、管理密碼、password hash 與 Session secret 都只應留在本機，不要加入 Git 或貼到紀錄中。

目前表單支援：

- Homework ID：未來頁面的安全檔名 ID。
- 顯示名稱：Homework 頁面的主標題。
- 簡介：只接受普通文字，不接受 HTML。
- 主要內容 HTML：只接受會放進頁面內容區的 fragment，不接受完整 HTML 文件或 `<h1>`。

合法主要內容範例：

```html
<section>
  <h2>功能說明</h2>
  <p>這裡是 Homework 的內容。</p>

  <h2>Kotlin</h2>
  <pre class="code-block"><code>val message = &quot;Hello&quot;</code></pre>
</section>
```

程式碼內容中的 `<`、`>`、`&` 必須分別寫成 `&lt;`、`&gt;`、`&amp;`。填妥欄位後按「預覽」，伺服器會先驗證全部內容，再將正式 Homework 視覺模板放入受限制的預覽框。

預覽不會保存或發佈任何資料。重新整理或關閉頁面會失去所有輸入；目前也沒有圖片上傳、Training folder、草稿保存或正式發佈功能。

## Batch 10C：圖片與正式發佈 Homework

Batch 10C 在同一個受保護的本機管理入口加入圖片及一次性正式發佈。先完整填妥文字、封面與內容圖片，按「更新預覽」；只有 Session 有效、欄位與圖片合法、伺服器預覽成功，而且內容自該次預覽後沒有變更時，「正式發佈」才會啟用。任何文字或圖片變更都會令預覽過期，必須重新預覽。

上傳串流使用鎖定版 `busboy`。圖片驗證採用鎖定版 `pngjs`、`jpeg-js` 與 `@jsquash/webp`，因為只辨認 magic bytes 的套件無法確認壓縮資料可完整解碼；這三個專用解碼器可在既有 Node 20.6 基線內完成有界驗證，且不引入 Web 框架或 CMS。

圖片限制：

- 封面必須恰好一張，內容圖片可不選但最多 10 張。
- 只接受 PNG、JPEG 與 WebP；每張最多 5 MiB，內容圖片合計最多 30 MiB。
- 內容圖片檔名只可使用小寫英文字母、數字、連字符、底線，以及單一 `.png`、`.jpg` 或 `.webp` 副檔名；`cover.png`、`cover.jpg`、`cover.webp` 保留給封面。系統不會替不合法檔名重新命名。
- 伺服器會檢查實際 magic bytes、完整解碼、MIME、大小及副檔名，並拒絕超過 4,000 萬像素的圖片；瀏覽器顯示的 MIME、原始檔名與 `accept` 並不是安全依據。

選擇內容圖片後，管理頁會顯示可複製的未來路徑。例如 Homework ID 為 `module-f`、檔名為 `screen-1.png` 時，HTML 必須逐字使用：

```html
<img src="img/module-f/screen-1.png" alt="Module F 登入畫面">
```

每張內容圖片都必須被 HTML 引用，且每個 HTML 圖片引用都必須有本次上傳的同名檔案。系統不會進行 URL decode、大小寫修正或路徑重寫。封面不需要放入主要內容 HTML。

確認發佈後，一個交易會建立或更新：

```text
homework/<id>.html
homework/img/<id>/cover.<ext>
homework/img/<id>/<content-image>
content/homework.json
homework/index.html
```

新項目的 `trainingFolder` 固定為 `null`；本批沒有 Training folder、Training ZIP、草稿保存、修改或刪除功能。發佈失敗時，系統會恢復原本的 JSON 與 Homework index，並移除本次頁面及圖片，不影響其他 Homework。

所有上傳先放在專案內的 `.admin-staging/` 隨機 transaction 目錄，通過檢查前不會寫進公開 Homework 路徑。`.admin-staging/` 和 `.env` 都已排除於 Git，切勿強制加入版本控制。

若服務啟動時警告有未完成 staging：

1. 停止管理服務，勿直接重新送出或搬移暫存內容。
2. 找出對應 transaction，保留其中 `recovery/homework.json` 與 `recovery/homework-index.html`。
3. 比對正式 `content/homework.json`、`homework/index.html` 及同 ID 的頁面／圖片目錄；只處理該筆 transaction，避免覆寫其他較新的 Homework。
4. 必要時以 recovery 檔恢復兩個原檔，並移除該 transaction 新增的同 ID HTML 與圖片目錄。
5. 執行 `node scripts/validate-content.mjs` 及 `node scripts/build-content-indexes.mjs --check`。兩者均通過後，才刪除該 staging transaction 並重新啟動服務。

## Batch 10D：管理頁查看已發佈 Homework

登入同一管理入口後，「已發佈 Homework」位於新增表單及預覽區下方。清單透過受 Session 保護的唯讀 `GET <ADMIN_PATH>/api/homeworks` 直接讀取 `content/homework.json`，只顯示 `published` 項目；GET 不需要 CSRF token，回應不快取，也不接受瀏覽器提供檔案路徑。

每列顯示標題、Homework ID、發佈日期、狀態、公開網址及「開啟 Homework」。目前 manifest 沒有發佈日期，所以顯示「未提供」；`resultPage` 為 `null` 的既有項目同樣顯示「未提供」，開啟按鈕會停用。可用的公開頁會以新分頁安全開啟。

正式發佈成功後清單會自動重新載入。即使重新載入失敗，成功發佈訊息及尚未清空的表單仍會保留，可用清單內的「重新載入」再試。本批次只有唯讀清單，沒有 Homework 編輯、刪除、草稿、搜尋、篩選、排序控制或分頁。

## Batch 10E-1：編輯 Homework 基本資料

「已發佈 Homework」中的「編輯基本資料」只會出現在目前管理端 renderer 能安全重新產生的頁面。管理者可修改顯示名稱與純文字簡介；Homework ID、主要內容、圖片、Training folder、順序、狀態及其他 manifest 欄位均不可修改。送出前會顯示文字確認摘要，儲存成功後清單會自動重新載入，上方尚未發佈的表單內容不會被清空。

舊式頁面、缺少或重複 renderer 結構標記、`data-content-id` 不一致、跨出 `homework/` 或無公開頁面的項目會顯示「此舊項目暫不支援網站編輯」，管理端不會猜測或改寫其 HTML。目前 manifest 的 33 個已發佈項目都是既有格式，因此安全可編輯數量為 0；之後由目前管理發佈器建立且保持原始 renderer 結構的頁面才會提供編輯按鈕。更新請求使用受 Session、Origin 與 CSRF 保護的 `PATCH <ADMIN_PATH>/api/homeworks/:id`；服務會在同一個內容檔案鎖內更新 `content/homework.json`、詳細頁與 `homework/index.html`，完成內容驗證及索引同步檢查後才回應成功。任何中途失敗會恢復這三個檔案。

本批次不提供 Homework ID、主要內容或圖片編輯，也沒有刪除、草稿、Training、ZIP、搜尋、篩選、排序、分頁或資料庫功能。

## Batch 10F：編輯 Homework 主要內容 HTML

安全可編輯的已發佈項目會同時顯示「編輯基本資料」及「編輯主要內容」。內容編輯使用獨立 Dialog 載入詳細頁 `data-original-content` 的原始 HTML，不會把內容放入或清空上方「新增 Homework」表單。HTML 仍為普通 textarea，最大 400 KiB UTF-8；每次修改都會令先前預覽失效，只有目前內容與最近一次成功安全預覽完全相同時才可儲存。

預覽及儲存沿用既有 HTML fragment、危險 URL、event handler、script 與 renderer 驗證。既有圖片引用必須逐字符合 `img/<目前 Homework ID>/<安全檔名>`，而且檔案必須存在、是普通非 symlink 檔案，實體路徑不可離開該 Homework 圖片目錄。預覽只改寫顯示文件的圖片網址；textarea 及最後儲存的 HTML 不會被改寫。這個功能不會上傳、替換或刪除圖片。

內容 API 使用 SHA-256 revision 防止舊分頁覆蓋較新內容；衝突時回傳 `409 content_changed` 並要求重新載入。PATCH 在既有 manifest 鎖內重新讀取最新標題與簡介，只原子更新對應詳細頁，再執行內容驗證及索引同步檢查。失敗時恢復原詳細頁；`content/homework.json`、`homework/index.html` 與全部圖片始終唯讀。舊式頁面仍顯示「此舊項目暫不支援網站編輯」。
