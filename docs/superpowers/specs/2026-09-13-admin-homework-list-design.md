# 管理頁已發佈 Homework 清單設計規格

## 範圍

批次 10D 在既有受登入保護的 Homework 管理頁加入唯讀的「已發佈 Homework」清單。清單放在新增／預覽工作區之後，只讀取既有 `content/homework.json`，不建立第二份資料來源，也不修改 manifest、公開頁面或索引。

本批次不包含編輯、刪除、草稿、搜尋、篩選、排序控制、分頁、Training、ZIP、資料庫或部署。

## 已確認的資料現況

- `content/homework.json` 是陣列，現有 33 筆均為 `status: "published"`。
- 29 筆有字串 `resultPage`；4 筆的 `resultPage` 是 `null`。
- manifest 目前沒有 `publishedAt` 欄位。
- 指定供檢視的 `content/index.json` 在目前專案中不存在；10D 不會建立它。

因此 API 會保留 manifest 順序，回傳 33 筆 published 記錄。日期以 `null` 表示未提供；沒有成果頁的公開 URL 亦為 `null`。前端對兩者顯示「未提供」，而沒有 URL 的「開啟 Homework」使用停用按鈕，避免虛構頁面。

## 後端設計

新增 `admin/server/homework-list.mjs`，負責：

- 從專案根目錄內固定的 `content/homework.json` 讀取資料；不接受任何瀏覽器路徑。
- 驗證頂層陣列及每筆記錄中清單需要的欄位。
- 只保留 `status === "published"` 的項目。
- 將合法的 `resultPage` 相對於 `/homework/` 轉為同源公開 URL；既有 `../world skill/...` 會安全解析成網站根目錄下的 URL。
- 對缺少日期或成果頁的項目回傳 `null`。
- 解析、讀取或格式錯誤統一拋出不含實體路徑的安全錯誤。

`GET <ADMIN_PATH>/api/homeworks` 沿用 Session cookie 驗證。未登入或 Session 過期回傳現有 `not_authenticated` JSON 錯誤；非 GET 由既有 method allowlist 回傳 405。此 GET 不要求 CSRF token。成功與失敗回應都設定 `Cache-Control: no-store`，並沿用全域安全標頭。伺服器不回傳 stack、Session、CSRF、manifest 路徑或其他敏感資料。

成功回應形狀：

```json
{
  "homeworks": [
    {
      "id": "module-f",
      "title": "Module F",
      "status": "published",
      "publishedAt": null,
      "url": "/homework/module-f.html"
    }
  ],
  "total": 1
}
```

`total` 永遠由實際回傳陣列長度計算。

## 前端設計

清單是一張沿用現有淺色 Design System 的 panel，位於既有新增表單及預覽區之後。桌面使用有欄名的整齊 grid list；48rem 以下改為單欄卡片，每個值帶欄位標籤。長標題、ID 及 URL 使用可換行排版。

狀態如下：

- 初始／重新載入：`正在載入已發佈 Homework…`
- 空清單：`目前還沒有已發佈的 Homework。`
- 失敗：`無法載入 Homework，請稍後再試。`，並顯示「重新載入」
- 成功：標題顯示 `已發佈 Homework（N）`

頁面先確認 Session，成功後才呼叫清單 API。重新載入期間按鈕停用，避免重複請求。DOM 項目全部以 `createElement`、`textContent`、`setAttribute` 和 `replaceChildren` 建立，不把 manifest 文字交給 `innerHTML`。

有 URL 時，「開啟 Homework」是 `target="_blank"`、`rel="noopener noreferrer"` 的連結；無 URL 時保留同名的停用按鈕。API 回傳 401 時沿用既有 Session 過期介面。

正式發佈成功訊息先完成呈現，再觸發清單重新載入。清單重新載入自己處理錯誤，不會進入發佈失敗分支；整個過程不重設或清空表單欄位。

## 可用性與驗收

- loading、empty、error 與更新結果使用 `role="status"`／`role="alert"` 和 `aria-live`。
- 可操作按鈕至少 44px 高，沿用現有清楚的 `:focus-visible`。
- 以 390、768、1024、1440px 本機 HTTP 頁面檢查無水平溢出、卡片／列表切換、鍵盤操作與 console。
- 自動測試涵蓋 API 授權、方法、篩選、空與錯誤 manifest、no-store、實體路徑保護、manifest 位元組不變，以及前端四種狀態、XSS 安全、新分頁連結、發佈後刷新和表單保留。
