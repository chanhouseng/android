# WorldSkills 行動應用程式開發練習題

## Module A：Booth Handoff

- 本題以「系統檔案匯入、格式驗證與重複紀錄解決」為唯一最高難度核心。
- 該能力在練習範圍中標記為「未見」及「高優先核心」，且不需要網絡、帳戶或特殊硬體。
- 配套能力只有中斷草稿恢復、確認流程及系統檔案匯出，均服務於完整的交接工作流程。
- 題目包含成功、選檔取消、格式錯誤、匯出取消、背景恢復及重新啟動恢復等可重現狀態。
- 主題、資料名稱、頁面組合及流程均為本題原創，核心不是純列表、JSON 解析或靜態介面臨摹。

**建議作答時間：** 3 小時 30 分鐘  
**總分：** 15.0 分  
**目標裝置：** 直向手持裝置

## 1. 題目背景

社區活動的服務攤位每天由不同志工輪班。交班者會把設備狀態寫入一個小型文字檔，接班者需要在手機上選取該檔案、檢查格式、解決重複設備紀錄，逐項確認後完成交接。請製作 "Booth Handoff"，讓接班者能在沒有網絡的情況下完成整個流程。應用程式須保留尚未完成的交接草稿，並在交接完成後透過系統檔案儲存介面匯出一份人類可讀的收據。

## 2. 共通規格

1. 所有應用程式畫面中的固定文字必須使用本題指定的英文；本文件以半形雙引號標示這些文字。
2. 日期時間顯示格式固定為 `yyyy-MM-dd HH:mm`，使用裝置目前的本地日期與時間，例如 `2026-08-31 14:05`。
3. 數量格式為 `1 item` 或 `N items`；確認進度格式為 `X of N acknowledged`。
4. 匯入檔案採 UTF-8 純文字，副檔名為 `.bhf`。每一行不得包含前置或尾隨空白。
5. 第一行必須完全等於 `BOOTH_HANDOFF_V1`；第二行格式為 `BOOTH|<booth name>`；其後每行格式為 `ITEM|<id>|<label>|<status>|<note>`。
6. `<booth name>` 長度為 1 至 30 個字元；檔案包含 2 至 20 行 `ITEM` 紀錄。
7. `<id>` 長度為 1 至 12 個字元，只能包含大寫英文字母、數字及連字號；同一個 `<id>` 最多出現兩次。出現兩次時視為一個待解決衝突，出現三次或以上則整份檔案無效。
8. `<label>` 長度為 1 至 30 個字元；`<status>` 只能是 `READY`、`ISSUE` 或 `MISSING`；`<note>` 可為空，最長 60 個字元。欄位不得包含 `|`。
9. 畫面把 `READY`、`ISSUE`、`MISSING` 分別顯示為 "Ready"、"Issue"、"Missing"。
10. 若一份檔案有任何格式問題，不得把其中任何紀錄加入草稿；須顯示所有可判定的問題，並依行號由小至大排列。
11. 成功匯入或解決衝突後建立草稿。草稿包含攤位名稱、已選紀錄、確認狀態、最後所在頁面及已完成的衝突選擇；應用程式重新啟動後仍須存在。
12. 應用程式切到背景再返回時，須停留在原頁面並保留所有選擇與確認進度，不顯示恢復對話框。
13. 應用程式在有未完成草稿的情況下被關閉並重新啟動時，須先顯示 "Resume Draft?" 對話框。
14. 完成交接後，未完成草稿須被清除；最後一份已完成收據須在重新啟動後仍可從首頁開啟，直到下一次交接完成並取代它。
15. 系統選檔或儲存介面被取消時，不得視為匯入或匯出成功，也不得清除現有草稿或收據。
16. 本題不指定作業系統、程式語言、框架、資料結構、演算法、第三方函式庫或實作方式。
17. 線框圖中的 A1、B1 等編號只作規格對照，不是應用程式畫面文字。

## 3. 頁面與流程

1. 首頁 "Booth Handoff"：開始匯入、繼續草稿或查看最後收據。
2. 匯入檢查頁 "Import Review"：顯示檔案摘要、紀錄、重複項目或格式問題。
3. 衝突解決頁 "Resolve Duplicates"：逐一選擇每個重複 ID 要保留的紀錄；只在有重複 ID 時出現。
4. 交接確認頁 "Handoff Check"：逐項標記已確認並完成交接。
5. 收據頁 "Handoff Receipt"：顯示完成結果並匯出文字收據。
6. 確認對話框 "Confirm Handoff"：完成交接前最後確認。
7. 草稿恢復對話框 "Resume Draft?"：重新啟動後選擇恢復或放棄草稿。

正常流程為："Booth Handoff" → 系統選檔介面 → "Import Review" → 必要時 "Resolve Duplicates" → "Handoff Check" → "Confirm Handoff" → "Handoff Receipt"。

## 4. 首頁 "Booth Handoff"

### 介面要求

- **A1**：頁面標題 "Booth Handoff"。
- **A2**：說明文字 "Import a handoff file to review the booth before taking over."。
- **A3**：主要按鈕 "Import File"。
- **A4**：草稿資訊卡；只在有未完成草稿時顯示，內容為動態攤位名稱、`N items` 及 `X of N acknowledged`。
- **A5**：按鈕 "Continue Draft"；只在 A4 顯示時出現。
- **A6**：最後收據資訊卡；只在有已完成收據時顯示，內容為動態攤位名稱及完成日期時間。
- **A7**：按鈕 "View Receipt"；只在 A6 顯示時出現。

### 功能要求

1. 初次啟動且沒有草稿或收據時，只顯示 A1、A2、A3。
2. 點按 "Import File" 必須開啟系統提供的檔案選擇介面，限制使用者選擇可讀取的單一檔案。
3. 使用者取消系統選檔介面後返回本頁；現有草稿與收據保持不變，不顯示成功狀態。
4. 選到可讀取檔案後前往 "Import Review"。檔案不可讀取時亦前往該頁並顯示指定錯誤狀態。
5. 點按 "Continue Draft" 返回草稿最後保存的頁面及進度。
6. 點按 "View Receipt" 開啟最後一份 "Handoff Receipt"。
7. 若草稿與最後收據同時存在，A4 至 A7 均須顯示。

### 線框圖

空白狀態：

```text
+----------------------------------+
| [A1] Booth Handoff               |
|                                  |
| [A2] Import a handoff file to    |
| review the booth before taking   |
| over.                            |
|                                  |
| [A3] [ Import File ]             |
+----------------------------------+
```

有草稿及最後收據狀態：

```text
+----------------------------------+
| [A1] Booth Handoff               |
| [A2] Import a handoff file to    |
| review the booth before taking   |
| over.                            |
|                                  |
| [A4] South Hall                  |
|      3 items                     |
|      2 of 3 acknowledged         |
| [A5] [ Continue Draft ]          |
|                                  |
| [A6] North Gate                  |
|      2026-08-31 12:20            |
| [A7] [ View Receipt ]            |
|                                  |
| [A3] [ Import File ]             |
+----------------------------------+
```

## 5. 匯入檢查頁 "Import Review"

### 介面要求

- **B1**：頁面標題 "Import Review"。
- **B2**：檔名文字，格式為 `File: <file name>`。
- **B3**：攤位文字，格式為 `Booth: <booth name>`；無法取得有效攤位名稱時顯示 `Booth: Unavailable`。
- **B4**：摘要文字；一筆項目顯示 `1 item`，其餘顯示 `N items`；一個重複 ID 顯示 `1 duplicate`，其餘顯示 `D duplicates`，兩者以 ` • ` 連接。有格式錯誤或檔案不可讀取時顯示 "Import unavailable"。
- **B5**：狀態橫幅。有效且無重複時顯示 "Ready to continue"；有效且有重複時顯示 "Resolve duplicates to continue"；有錯誤時顯示 "File needs attention"。
- **B6**：有效檔案的紀錄清單。每列顯示動態 ID、label、"Ready"／"Issue"／"Missing" 及 note；note 為空時顯示 "No note"。重複 ID 的每筆紀錄另顯示 "Duplicate"。
- **B7**：問題區塊；只在有錯誤時顯示。包含標題 "Problems" 及逐行錯誤訊息。
- **B8**：按鈕 "Cancel Import"。
- **B9**：按鈕 "Choose Another File"。
- **B10**：按鈕 "Continue"；有格式錯誤或檔案不可讀取時不顯示。

### 功能要求

1. 頁面開啟時立即顯示 B1、B2、B5、B8、B9，完成讀取後更新 B3、B4，並顯示 B6 或 B7。
2. 檔案不可讀取時，B7 顯示 "File cannot be read."。
3. 第一行錯誤顯示 `Line 1: Expected "BOOTH_HANDOFF_V1".`；第二行格式錯誤顯示 `Line 2: Invalid booth record.`。
4. `ITEM` 欄位數量不符時顯示 `Line X: Expected 4 item fields.`；不支援的狀態顯示 `Line X: Unsupported status "<value>".`。其他不符合共通規格的欄位顯示 `Line X: Invalid <field name>.`，其中 `<field name>` 為 `id`、`label` 或 `note`。
5. 少於 2 筆或多於 20 筆 `ITEM` 紀錄時顯示 "File must contain 2 to 20 items."；同一 ID 出現三次或以上時，從第三次出現的行開始顯示 `Line X: More than two records use "<id>".`。
6. 有多個問題時須同時列出所有可判定的問題，行號問題由小至大顯示，無行號的檔案層級問題最後顯示。
7. 有效且沒有重複 ID 時，點按 "Continue" 建立草稿並前往 "Handoff Check"。
8. 有效且有重複 ID 時，點按 "Continue" 建立草稿並前往 "Resolve Duplicates"。
9. 點按 "Cancel Import" 返回首頁，不建立或變更草稿；若匯入前已有其他草稿，該草稿保持不變。
10. 點按 "Choose Another File" 再次開啟系統選檔介面；取消後仍停留本頁並保留目前檢查結果。
11. 系統返回操作與 "Cancel Import" 的結果相同。

### 線框圖

有效且含重複 ID：

```text
+----------------------------------+
| [B1] Import Review               |
| [B2] File: handoff_conflicts.bhf |
| [B3] Booth: South Hall           |
| [B4] 4 items • 1 duplicate       |
| [B5] Resolve duplicates to       |
|      continue                    |
|                                  |
| [B6] ST-001  Counter tablet      |
|      Ready · Charged             |
|      Duplicate                   |
|      ST-002  Cable box           |
|      Issue · Seal is open        |
|      ST-001  Counter tablet      |
|      Missing · No note           |
|      Duplicate                   |
|      ST-003  Sign holder         |
|      Ready · Clean               |
|                                  |
| [B8] [ Cancel Import ]           |
| [B9] [ Choose Another File ]     |
| [B10] [ Continue ]               |
+----------------------------------+
```

格式錯誤：

```text
+----------------------------------+
| [B1] Import Review               |
| [B2] File: handoff_invalid.bhf   |
| [B3] Booth: East Desk            |
| [B4] Import unavailable          |
| [B5] File needs attention        |
|                                  |
| [B7] Problems                    |
| Line 3: Unsupported status       |
| "BROKEN".                       |
| Line 4: Expected 4 item fields.  |
|                                  |
| [B8] [ Cancel Import ]           |
| [B9] [ Choose Another File ]     |
+----------------------------------+
```

## 6. 衝突解決頁 "Resolve Duplicates"

### 介面要求

- **C1**：頁面標題 "Resolve Duplicates"。
- **C2**：說明文字 "Choose one record for each duplicate ID."。
- **C3**：進度文字，格式為 `Conflict X of N`。
- **C4**：重複 ID 文字，格式為 `ID: <id>`。
- **C5**：選項 "First record"，顯示第一筆紀錄的 label、狀態及 note。
- **C6**：選項 "Later record"，顯示第二筆紀錄的 label、狀態及 note。
- **C7**：選中選項內的文字 "Selected"；尚未選擇時不顯示。
- **C8**：按鈕 "Back"。
- **C9**：按鈕 "Use Selected"；尚未選擇時為不可操作狀態。

### 功能要求

1. 衝突依重複 ID 第一次出現的行號由小至大處理。
2. 點按 C5 或 C6 只選中其中一個選項，並在該選項顯示 "Selected"。
3. 點按 "Use Selected" 保存選中的紀錄。尚有衝突時更新 C3 至 C7；全部衝突完成後，草稿只保留每個 ID 的一筆紀錄並前往 "Handoff Check"。
4. 點按 "Back" 返回 "Import Review"；已用 "Use Selected" 完成的選擇須保留，再次繼續時從第一個未完成衝突開始。
5. 系統返回操作與 "Back" 相同。
6. 切到背景再返回時保留目前衝突及尚未提交的選中項；關閉並重新啟動後，已提交的選擇須存在，尚未提交的選中項可回到未選擇狀態。

### 線框圖

未選擇狀態：

```text
+----------------------------------+
| [C1] Resolve Duplicates          |
| [C2] Choose one record for each  |
| duplicate ID.                    |
| [C3] Conflict 1 of 1             |
| [C4] ID: ST-001                  |
|                                  |
| [C5] First record                |
|      Counter tablet              |
|      Ready · Charged             |
|                                  |
| [C6] Later record                |
|      Counter tablet              |
|      Missing · No note           |
|                                  |
| [C8] [ Back ]                    |
| [C9] [ Use Selected ] (disabled) |
+----------------------------------+
```

已選擇狀態：

```text
+----------------------------------+
| [C1] Resolve Duplicates          |
| [C2] Choose one record for each  |
| duplicate ID.                    |
| [C3] Conflict 1 of 1             |
| [C4] ID: ST-001                  |
|                                  |
| [C5] First record                |
|      Counter tablet              |
|      Ready · Charged             |
|      [C7] Selected               |
|                                  |
| [C6] Later record                |
|      Counter tablet              |
|      Missing · No note           |
|                                  |
| [C8] [ Back ]                    |
| [C9] [ Use Selected ]            |
+----------------------------------+
```

## 7. 交接確認頁 "Handoff Check"

### 介面要求

- **D1**：頁面標題 "Handoff Check"。
- **D2**：攤位與數量，格式為 `Booth: <booth name> • N items`。
- **D3**：說明文字 "Review every item before confirming."。
- **D4**：紀錄清單。每列顯示 ID、label、"Ready"／"Issue"／"Missing"、note，以及可切換的 "Acknowledged" 控制項。
- **D5**：進度文字，格式為 `X of N acknowledged`。
- **D6**：按鈕 "Back"。
- **D7**：按鈕 "Confirm Handoff"；未全部確認時為不可操作狀態。

### 功能要求

1. 紀錄依所保留紀錄在匯入檔中的原始行號由小至大排列。
2. 每次點按一列的 "Acknowledged" 控制項，切換該列的已確認狀態並立即更新 D5。
3. 只有所有列均已確認時，"Confirm Handoff" 才可操作；取消任何一列的確認後須立即再次停用。
4. 確認狀態每次改變後都須保存。切到背景、返回上一頁再回來或應用程式重新啟動並選擇恢復後，已確認的列須保持一致。
5. 點按 "Back" 返回上一個實際經過的頁面，不清除草稿或確認狀態。
6. 點按可用的 "Confirm Handoff" 顯示 "Confirm Handoff" 對話框。
7. 在有草稿時重新匯入另一檔案，只有在新檔案成功通過檢查並點按 "Continue" 後，才以新草稿取代舊草稿。

### 線框圖

部分確認狀態：

```text
+----------------------------------+
| [D1] Handoff Check               |
| [D2] Booth: South Hall • 3 items |
| [D3] Review every item before    |
| confirming.                      |
|                                  |
| [D4] ST-001  Counter tablet      |
|      Ready · Charged             |
|      [x] Acknowledged            |
|      ST-002  Cable box           |
|      Issue · Seal is open        |
|      [x] Acknowledged            |
|      ST-003  Sign holder         |
|      Ready · Clean               |
|      [ ] Acknowledged            |
|                                  |
| [D5] 2 of 3 acknowledged         |
| [D6] [ Back ]                    |
| [D7] [ Confirm Handoff ]         |
|      (disabled)                  |
+----------------------------------+
```

全部確認狀態：

```text
+----------------------------------+
| [D1] Handoff Check               |
| [D2] Booth: South Hall • 3 items |
| [D3] Review every item before    |
| confirming.                      |
|                                  |
| [D4] ST-001 / ST-002 / ST-003    |
|      all show [x] Acknowledged   |
|                                  |
| [D5] 3 of 3 acknowledged         |
| [D6] [ Back ]                    |
| [D7] [ Confirm Handoff ]         |
+----------------------------------+
```

## 8. 確認對話框 "Confirm Handoff"

### 介面要求

- **E1**：對話框標題 "Confirm Handoff"。
- **E2**：說明文字 "This will lock the current handoff."。
- **E3**：按鈕 "Cancel"。
- **E4**：按鈕 "Confirm"。

### 功能要求

1. 點按 "Cancel" 或關閉對話框後返回 "Handoff Check"，草稿及確認狀態保持不變。
2. 點按 "Confirm" 後，以當下本地日期時間完成交接，清除未完成草稿，建立或取代最後收據，並前往 "Handoff Receipt"。
3. 重複快速點按 "Confirm" 只能建立一份收據及一次完成時間。

### 線框圖

```text
+----------------------------------+
| [E1] Confirm Handoff             |
|                                  |
| [E2] This will lock the current  |
| handoff.                         |
|                                  |
| [E3] [ Cancel ]  [E4] [ Confirm ]|
+----------------------------------+
```

## 9. 收據頁 "Handoff Receipt"

### 介面要求

- **F1**：頁面標題 "Handoff Receipt"。
- **F2**：攤位文字，格式為 `Booth: <booth name>`。
- **F3**：完成時間，格式為 `Confirmed: yyyy-MM-dd HH:mm`。
- **F4**：摘要區塊，依序顯示 `Ready: N`、`Issue: N`、`Missing: N` 及 `Total: N`。
- **F5**：標題 "Attention Needed" 及所有 "Issue"、"Missing" 紀錄；每列顯示 ID、label、狀態及 note。沒有這類紀錄時顯示 "No attention needed"。
- **F6**：按鈕 "Export Receipt"。
- **F7**：匯出結果橫幅；成功時顯示 "Receipt exported"，取消時顯示 "Export canceled"，失敗時顯示 "Export failed"。首次進入時不顯示。
- **F8**：按鈕 "Done"。

### 功能要求

1. F4 的各狀態數量須與最終保留的紀錄完全一致；F5 只列出 "Issue" 及 "Missing"，並依原始行號由小至大排列。
2. 點按 "Export Receipt" 開啟系統提供的檔案儲存介面，建議檔名為 `Booth-Handoff-<yyyyMMdd-HHmm>.txt`，其中時間取 F3 的完成時間。
3. 匯出內容採 UTF-8 純文字，依序包含應用名稱、攤位、完成時間、四個摘要數值，以及全部紀錄的 ID、label、狀態與 note。欄位名稱使用畫面上的英文文字；note 為空時輸出 "No note"。
4. 系統儲存完成後顯示 "Receipt exported"；使用者取消時顯示 "Export canceled"；發生寫入失敗時顯示 "Export failed"。三種結果均不得刪除或修改收據。
5. 再次匯出時必須重新開啟系統儲存介面；不得因上一次成功而直接顯示完成。
6. 點按 "Done" 返回首頁。系統返回操作亦返回首頁。
7. 從首頁的 "View Receipt" 開啟時，須顯示相同內容；重新啟動後內容仍須存在。

### 線框圖

含需注意紀錄及匯出成功：

```text
+----------------------------------+
| [F1] Handoff Receipt             |
| [F2] Booth: South Hall           |
| [F3] Confirmed: 2026-08-31 14:05 |
|                                  |
| [F4] Ready: 2                    |
|      Issue: 1                    |
|      Missing: 0                  |
|      Total: 3                    |
|                                  |
| [F5] Attention Needed            |
|      ST-002  Cable box           |
|      Issue · Seal is open        |
|                                  |
| [F7] Receipt exported            |
| [F6] [ Export Receipt ]          |
| [F8] [ Done ]                    |
+----------------------------------+
```

沒有需注意紀錄及匯出取消：

```text
+----------------------------------+
| [F1] Handoff Receipt             |
| [F2] Booth: North Gate           |
| [F3] Confirmed: 2026-08-31 12:20 |
| [F4] Ready: 3                    |
|      Issue: 0                    |
|      Missing: 0                  |
|      Total: 3                    |
| [F5] Attention Needed            |
|      No attention needed         |
| [F7] Export canceled             |
| [F6] [ Export Receipt ]          |
| [F8] [ Done ]                    |
+----------------------------------+
```

## 10. 草稿恢復對話框 "Resume Draft?"

### 介面要求

- **G1**：對話框標題 "Resume Draft?"。
- **G2**：草稿摘要，顯示動態攤位名稱、`N items` 及 `X of N acknowledged`。
- **G3**：按鈕 "Discard"。
- **G4**：按鈕 "Resume"。

### 功能要求

1. 應用程式在有未完成草稿時被關閉並重新啟動，須在首頁內容之上顯示本對話框。
2. 點按 "Resume" 返回草稿最後保存的頁面。已提交的衝突選擇及所有已確認紀錄須存在。
3. 點按 "Discard" 清除草稿並停留首頁；最後收據如存在，必須保留。
4. 系統返回或在對話框外點按不得關閉此對話框；使用者必須選擇 "Discard" 或 "Resume"。

### 線框圖

```text
+----------------------------------+
| [G1] Resume Draft?               |
|                                  |
| [G2] South Hall                  |
|      3 items                     |
|      2 of 3 acknowledged         |
|                                  |
| [G3] [ Discard ] [G4] [ Resume ] |
+----------------------------------+
```

## 11. 驗收情境

### 情境 A：取消選檔

1. 前置狀態：首頁沒有草稿；最後收據可有可無。
2. 評分者點按 "Import File"，在系統選檔介面取消。
3. 預期結果：返回首頁；沒有建立草稿；最後收據保持不變；不顯示任何匯入成功訊息。

### 情境 B：錯誤檔案

1. 前置狀態：使用提供的 `handoff_invalid.bhf`。
2. 評分者匯入該檔案。
3. 預期結果："Import Review" 顯示 `Booth: East Desk`、"Import unavailable"、"File needs attention"，並依序顯示 `Line 3: Unsupported status "BROKEN".` 與 `Line 4: Expected 4 item fields.`；沒有 "Continue"。
4. 評分者點按 "Choose Another File" 後取消系統選檔介面。
5. 預期結果：仍停留錯誤狀態，原有問題列表不消失。

### 情境 C：無重複紀錄的成功匯入

1. 前置狀態：使用提供的 `handoff_valid.bhf`。
2. 評分者匯入檔案並在 "Import Review" 點按 "Continue"。
3. 預期結果：直接開啟 "Handoff Check"，顯示 `Booth: North Gate • 3 items`，順序為 `EQ-101`、`EQ-102`、`EQ-103`，進度為 `0 of 3 acknowledged`。

### 情境 D：解決重複紀錄

1. 前置狀態：使用提供的 `handoff_conflicts.bhf`。
2. 評分者匯入檔案；"Import Review" 應顯示 `4 items • 1 duplicate` 及兩筆帶有 "Duplicate" 的 `ST-001`。
3. 評分者點按 "Continue"，選擇 "First record"，再點按 "Use Selected"。
4. 預期結果："Handoff Check" 只顯示三筆紀錄；`ST-001` 為 "Ready" 且 note 為 `Charged`，其後依序為 `ST-002`、`ST-003`。

### 情境 E：背景化與重新啟動恢復

1. 前置狀態：完成情境 D，將 `ST-001` 與 `ST-002` 標為 "Acknowledged"。
2. 評分者把應用程式切到背景後返回。
3. 預期結果：仍在 "Handoff Check"，顯示 `2 of 3 acknowledged`，不顯示 "Resume Draft?"。
4. 評分者關閉應用程式並重新啟動。
5. 預期結果：顯示 "Resume Draft?"，摘要為 `South Hall`、`3 items`、`2 of 3 acknowledged`。
6. 評分者點按 "Resume"。
7. 預期結果：回到 "Handoff Check" 且兩筆確認狀態保持不變。

### 情境 F：取消及完成確認

1. 前置狀態：三筆紀錄均已標為 "Acknowledged"。
2. 評分者點按 "Confirm Handoff"，再點按 "Cancel"。
3. 預期結果：返回 "Handoff Check"，仍為 `3 of 3 acknowledged`，沒有建立收據。
4. 評分者再次開啟對話框並點按 "Confirm"。
5. 預期結果：開啟 "Handoff Receipt"；摘要數值與三筆紀錄一致；草稿已清除。

### 情境 G：匯出取消、失敗與成功

1. 前置狀態：停留在情境 F 的 "Handoff Receipt"。
2. 評分者點按 "Export Receipt" 並取消系統儲存介面。
3. 預期結果：顯示 "Export canceled"；收據內容保持不變。
4. 評分環境使寫入失敗後再次匯出。
5. 預期結果：顯示 "Export failed"；可再次點按 "Export Receipt"。
6. 評分者選擇可寫入位置完成匯出。
7. 預期結果：顯示 "Receipt exported"；文字檔內容、狀態數量及紀錄與畫面一致。

### 情境 H：放棄草稿但保留收據

1. 前置狀態：已有最後收據，另匯入 `handoff_valid.bhf` 建立未完成草稿後關閉並重新啟動。
2. 評分者在 "Resume Draft?" 點按 "Discard"。
3. 預期結果：停留首頁，不顯示草稿資訊卡或 "Continue Draft"；最後收據資訊卡及 "View Receipt" 仍存在且可正常開啟。

## 12. 評分配額

| 評分部分 | 驗收內容 | 分數 |
|---|---|---:|
| 系統檔案匯入與格式驗證 | 系統選檔、取消、不讀入無效資料、完整錯誤列表 | 3.0 |
| 重複紀錄解決 | 衝突辨識、逐一選擇、只保留指定紀錄、順序正確 | 3.0 |
| 完整交接流程 | 逐項確認、按鈕狀態、確認取消、避免重複完成 | 2.5 |
| 草稿及收據保存 | 背景、返回、重新啟動、恢復、放棄及最後收據保留 | 2.5 |
| 系統檔案匯出 | 建議檔名、內容正確、取消、失敗及再次匯出 | 2.0 |
| 導覽與介面一致性 | 5 頁、2 對話框、動態狀態、固定文字及格式一致 | 1.5 |
| 穩定性 | 無崩潰、不可讀檔案及快速重複操作結果穩定 | 0.5 |
| **總分** |  | **15.0** |

## 13. 「介面要求 ↔ 線框圖」逐項對照

| 頁面／對話框 | 編號 | 線框圖位置及內容 | 檢查 |
|---|---|---|---|
| Booth Handoff | A1 | 頂部 "Booth Handoff" | ✓ |
| Booth Handoff | A2 | 標題下說明文字 | ✓ |
| Booth Handoff | A3 | 底部或主要區域 "Import File" | ✓ |
| Booth Handoff | A4 | 草稿資訊卡 | ✓ |
| Booth Handoff | A5 | 草稿卡下 "Continue Draft" | ✓ |
| Booth Handoff | A6 | 最後收據資訊卡 | ✓ |
| Booth Handoff | A7 | 收據卡下 "View Receipt" | ✓ |
| Import Review | B1 | 頂部 "Import Review" | ✓ |
| Import Review | B2 | 檔名列 | ✓ |
| Import Review | B3 | 攤位列 | ✓ |
| Import Review | B4 | 摘要或不可用文字 | ✓ |
| Import Review | B5 | 狀態橫幅 | ✓ |
| Import Review | B6 | 有效紀錄清單與 "Duplicate" | ✓ |
| Import Review | B7 | 錯誤狀態 "Problems" 區塊 | ✓ |
| Import Review | B8 | "Cancel Import" | ✓ |
| Import Review | B9 | "Choose Another File" | ✓ |
| Import Review | B10 | 有效狀態 "Continue" | ✓ |
| Resolve Duplicates | C1 | 頂部 "Resolve Duplicates" | ✓ |
| Resolve Duplicates | C2 | 標題下說明文字 | ✓ |
| Resolve Duplicates | C3 | 衝突進度 | ✓ |
| Resolve Duplicates | C4 | 重複 ID | ✓ |
| Resolve Duplicates | C5 | "First record" 選項 | ✓ |
| Resolve Duplicates | C6 | "Later record" 選項 | ✓ |
| Resolve Duplicates | C7 | 選中狀態 "Selected" | ✓ |
| Resolve Duplicates | C8 | "Back" | ✓ |
| Resolve Duplicates | C9 | "Use Selected" | ✓ |
| Handoff Check | D1 | 頂部 "Handoff Check" | ✓ |
| Handoff Check | D2 | 攤位與數量 | ✓ |
| Handoff Check | D3 | 確認說明文字 | ✓ |
| Handoff Check | D4 | 紀錄清單及 "Acknowledged" | ✓ |
| Handoff Check | D5 | 確認進度 | ✓ |
| Handoff Check | D6 | "Back" | ✓ |
| Handoff Check | D7 | "Confirm Handoff" | ✓ |
| Confirm Handoff | E1 | 對話框標題 | ✓ |
| Confirm Handoff | E2 | 鎖定說明文字 | ✓ |
| Confirm Handoff | E3 | "Cancel" | ✓ |
| Confirm Handoff | E4 | "Confirm" | ✓ |
| Handoff Receipt | F1 | 頂部 "Handoff Receipt" | ✓ |
| Handoff Receipt | F2 | 攤位文字 | ✓ |
| Handoff Receipt | F3 | 完成時間 | ✓ |
| Handoff Receipt | F4 | 四個摘要數值 | ✓ |
| Handoff Receipt | F5 | "Attention Needed" 與內容 | ✓ |
| Handoff Receipt | F6 | "Export Receipt" | ✓ |
| Handoff Receipt | F7 | 匯出結果橫幅 | ✓ |
| Handoff Receipt | F8 | "Done" | ✓ |
| Resume Draft? | G1 | 對話框標題 | ✓ |
| Resume Draft? | G2 | 草稿摘要 | ✓ |
| Resume Draft? | G3 | "Discard" | ✓ |
| Resume Draft? | G4 | "Resume" | ✓ |

## 14. 出題設計說明

1. **核心選擇：** 系統檔案匯入／匯出、格式驗證及重複項目處理在範圍文件中屬於未見且適合一般比賽環境的能力。題目不需要網絡、帳戶、外部 API 或特殊裝置。
2. **唯一主要難點：** 主要分數集中在選檔後的完整狀態鏈與重複紀錄決策；確認清單、保存及匯出都是配套能力，沒有第二個同級核心。
3. **工作量估算：** 匯入及驗證約 60 分鐘、衝突解決約 35 分鐘、交接與狀態保存約 40 分鐘、匯出約 25 分鐘、頁面導覽約 25 分鐘，主要工作約 185 分鐘，保留約 25 分鐘整合與自測。
4. **可驗收性：** 三個小型固定檔案覆蓋正常、重複及錯誤流程；系統介面的完成與取消結果明確分流。
5. **技術中立：** 題目只規定可見輸入、操作、排序、保存及輸出結果，不提供資料結構、解析方法或平台 API 名稱。
6. **環境穩定：** 所有流程可離線完成；唯一外部介面是評分裝置本身提供的選檔及儲存介面。

## 15. 所需資源檔清單

資源放在本題資料夾的 `resources` 子資料夾：

| 檔名 | 格式 | 用途 | 最小必要內容 |
|---|---|---|---|
| `handoff_valid.bhf` | UTF-8 純文字 | 驗收無重複的正常匯入 | 1 個攤位、3 筆合法紀錄 |
| `handoff_conflicts.bhf` | UTF-8 純文字 | 驗收重複 ID 解決 | 1 個攤位、4 筆合法紀錄，其中 `ST-001` 出現兩次 |
| `handoff_invalid.bhf` | UTF-8 純文字 | 驗收多錯誤顯示 | 1 個攤位、1 筆不支援狀態、1 筆欄位不足 |

除上述三個小型測試檔外，本題不需要其他外部資源、服務或硬體。

## 16. 最終自檢報告

- [x] 共有 5 個主要頁面及 2 個必要對話框；每個均含「介面要求」、「功能要求」及「線框圖」。
- [x] 介面編號 A1–A7、B1–B10、C1–C9、D1–D7、E1–E4、F1–F8、G1–G4 均唯一、連續且全部出現在對照表。
- [x] 線框圖已覆蓋空白、草稿、有效、重複、錯誤、未選、已選、部分確認、全部確認、匯出結果及恢復狀態，沒有加入未要求的功能。
- [x] 所有指定畫面固定文字均為英文，介面要求、功能要求、線框圖及驗收情境中的大小寫一致。
- [x] 成功、取消、失敗、返回、背景化及重新啟動流程均有客觀可見結果。
- [x] 評分配額合計為 15.0 分，核心能力佔最高比重且不只評介面。
- [x] 工作量估算為 185 分鐘主要實作加 25 分鐘整合自測，符合 3 小時 30 分鐘。
- [x] 文件沒有未完成標記、空白欄位、平台限定、框架名稱、資料結構、演算法或主要功能解法。
- [x] 三個必要資源檔均已列明格式、用途及最小內容，且不依賴網絡或不可控服務。
