# WorldSkills 行動應用程式開發練習題

## Module A：Device Snapshot

**建議作答時間：** 3 小時 30 分鐘  
**總分：** 15 分  
**目標裝置：** 直向手持裝置  
**題目版本：** 原創練習題，並非歷屆試題

---

## 1. 題目背景

一般使用者在儲存大型檔案、進行視訊會議或回報技術問題前，常需要快速確認裝置當下的電量、儲存空間、網絡及顯示資訊。

請建立一個名為 "Device Snapshot" 的應用程式。使用者可以查看裝置目前狀態、儲存一份狀態快照、比較兩份快照，並把單一快照匯出為純文字報告。

本題的核心是裝置能力整合、狀態保存、視覺化比較及系統檔案介面；不以 JSON CRUD、倒數計時或遠端資料列表為主要功能。

---

## 2. 共通規格

1. 題目正文以繁體中文說明；所有應用程式畫面中的固定文字必須使用英文。
2. 本題以半形雙引號標示所有指定的畫面文字，例如 "Refresh"。
3. 應用程式必須保持直向顯示。
4. 數值應以裝置實際可取得的資料顯示，不得把題目線框圖中的示例數值固定寫死。
5. 電量以整數百分比顯示，例如 "68%"。
6. 儲存空間以 GB 顯示並保留一位小數，例如 "76.4 GB used" 及 "51.6 GB free"。
7. 顯示尺寸使用實際像素，例如 "1080 × 2400 px"；系統外觀顯示為 "Light" 或 "Dark"。
8. 日期時間格式固定為 "yyyy-MM-dd HH:mm"，例如 "2026-08-29 14:32"。
9. 網絡狀態顯示為以下其中一組：
   - "Online" 配合 "Wi-Fi"
   - "Online" 配合 "Cellular"
   - "Online" 配合 "Other"
   - "Offline"
10. 如個別資料在目標裝置無法取得，該值顯示 "Unavailable"；其他可取得的資料仍須正常顯示及操作。
11. 使用者建立的快照必須在應用程式重新啟動後仍然存在。
12. 題目不指定作業系統、框架、資料結構、演算法或實作方式。
13. 線框圖只表示內容、層級及控制項，不要求複製其字體、顏色或像素尺寸。
14. 線框圖中的 D、H、S、C 編號只是規格對照標記，不是應用程式畫面文字。

---

## 3. 頁面與流程

應用程式包含以下頁面及對話框：

1. "Dashboard"
2. "Save Snapshot" 對話框
3. "History"
4. "Snapshot Details"
5. "Compare"
6. "Delete Snapshot" 確認對話框

主要流程：

~~~text
"Dashboard" ── "Save Snapshot" ──> "History"
      │                                │
      └──────── bottom navigation ─────┘
                                       │
                                       v
                             "Snapshot Details"
                                 │           │
                                 v           v
                             "Compare"   system file save
~~~

---

## 4. 頁面一："Dashboard"

### 介面要求

- **D1**：頂部顯示頁面標題 "Device Snapshot"。
- **D2**：標題下方顯示最後一次成功讀取資料的時間，前綴為 "Updated"。
- **D3**：顯示 "Battery" 區塊，包含環形圖、電量百分比，以及 "Charging" 或 "Not charging" 狀態。
- **D4**：顯示 "Storage" 區塊，包含已使用／總容量的水平比例條，以及 "used" 和 "free" 數值。
- **D5**：顯示 "Network" 區塊，包含連線狀態及連線類型；離線時只顯示 "Offline"。
- **D6**：顯示 "Display" 區塊，包含像素尺寸及目前系統外觀。
- **D7**：顯示按鈕 "Refresh"。
- **D8**：顯示主要按鈕 "Save Snapshot"。
- **D9**：底部導覽包含 "Dashboard" 與 "History"，並清楚顯示目前選中的 "Dashboard"。

### 功能要求

1. 第一次開啟頁面時，自動讀取並顯示電量、充電狀態、儲存空間、網絡及顯示資訊。
2. 在資料讀取完成前，各數值位置顯示 "Loading…"；頁面其他控制項不得造成重複儲存或錯誤。
3. 點選 "Refresh" 後重新讀取所有目前資料；完成後更新 "Updated" 時間。
4. 環形圖的填滿比例必須與目前電量百分比一致。
5. 儲存空間比例條必須與目前已使用容量佔總容量的比例一致。
6. 當連線狀態改變並再次點選 "Refresh" 時，"Network" 區塊必須反映新狀態。
7. 如某個值無法取得，只把該值顯示為 "Unavailable"，不得令整個頁面失效。
8. 點選 "Save Snapshot" 開啟 "Save Snapshot" 對話框，並以目前頁面已顯示的資料作為待儲存內容。
9. 點選底部 "History" 前往 "History" 頁面。

### 線框圖

~~~text
┌──────────────────────────────────┐
│ D1  Device Snapshot              │
│ D2  Updated 2026-08-29 14:32     │
│                                  │
│ ┌──────────── Battery ─────────┐ │
│ │ D3       ◯ 68%              │ │
│ │          Not charging        │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────── Storage ─────────┐ │
│ │ D4  ███████████░░░░░░       │ │
│ │ 76.4 GB used   51.6 GB free │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────── Network ─────────┐ │
│ │ D5  Online        Wi-Fi      │ │
│ └──────────────────────────────┘ │
│ ┌──────────── Display ─────────┐ │
│ │ D6  1080 × 2400 px Dark     │ │
│ └──────────────────────────────┘ │
│                                  │
│ [ D7 Refresh ] [D8 Save Snapshot]│
│                                  │
│ D9  ● Dashboard       History    │
└──────────────────────────────────┘
~~~

---

## 5. 對話框："Save Snapshot"

### 介面要求

- **S1**：顯示對話框標題 "Save Snapshot"。
- **S2**：顯示單行文字輸入欄，標籤為 "Snapshot name"。
- **S3**：輸入欄預設值為 "Snapshot " 加上目前日期時間。
- **S4**：顯示次要按鈕 "Cancel"。
- **S5**：顯示主要按鈕 "Save"。
- **S6**：輸入內容為空白時，在輸入欄附近顯示錯誤文字 "Enter a name"。

### 功能要求

1. 開啟對話框時，輸入欄必須已填入規定的預設名稱，並允許使用者修改。
2. 點選 "Cancel" 關閉對話框，不建立快照。
3. 名稱只有空白字元時，點選 "Save" 不得建立快照，並顯示 "Enter a name"。
4. 有效名稱須移除首尾空白後儲存。
5. 每份快照必須儲存名稱、擷取時間，以及當刻畫面所顯示的電量、充電狀態、儲存空間、網絡及顯示資訊。
6. 儲存成功後關閉對話框、前往 "History"，並顯示短暫訊息 "Snapshot saved"。
7. 儲存快照時不得自行重新整理資料；快照內容必須與使用者點選 "Save Snapshot" 時所看到的內容一致。

### 線框圖

~~~text
┌──────────────────────────────────┐
│          S1 Save Snapshot        │
│                                  │
│ S2 Snapshot name                 │
│ ┌──────────────────────────────┐ │
│ │ S3 Snapshot 2026-08-29 14:32│ │
│ └──────────────────────────────┘ │
│ S6 Enter a name                  │
│                                  │
│       [S4 Cancel]   [S5 Save]    │
└──────────────────────────────────┘
~~~

註：S6 只在驗證失敗時出現。

---

## 6. 頁面二："History"

### 介面要求

- **H1**：頂部顯示頁面標題 "History"。
- **H2**：有快照時，以由新至舊順序顯示快照卡片清單。
- **H3**：每張快照卡片顯示快照名稱及擷取日期時間。
- **H4**：每張快照卡片顯示電量百分比、已使用儲存空間及網絡狀態。
- **H5**：每張快照卡片包含可見的 "Delete" 控制項。
- **H6**：沒有快照時顯示 "No snapshots yet" 及提示 "Save one from Dashboard"。
- **H7**：底部導覽包含 "Dashboard" 與 "History"，並清楚顯示目前選中的 "History"。

### 功能要求

1. 快照清單必須在應用程式重新啟動後保留。
2. 新建立的快照顯示於清單最上方。
3. 點選卡片中除 "Delete" 以外的區域，前往該項目的 "Snapshot Details"。
4. 點選 "Delete" 開啟 "Delete Snapshot" 確認對話框。
5. 清單為空時顯示空白狀態，不顯示任何虛構快照卡片。
6. 點選底部 "Dashboard" 返回 "Dashboard" 頁面；頁面重新顯示目前裝置資料。

### 線框圖：有資料

~~~text
┌──────────────────────────────────┐
│ H1 History                       │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ H3 Before meeting           │ │
│ │    2026-08-29 14:32         │ │
│ │ H4 68%  · 76.4 GB · Online  │ │
│ │                       H5 Delete│
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ H2 Morning check            │ │
│ │    2026-08-29 09:10         │ │
│ │    91%  · 74.9 GB · Online  │ │
│ │                          Delete│
│ └──────────────────────────────┘ │
│                                  │
│ H7    Dashboard       ● History  │
└──────────────────────────────────┘
~~~

### 線框圖：空白狀態

~~~text
┌──────────────────────────────────┐
│ H1 History                       │
│                                  │
│                                  │
│       H6 No snapshots yet        │
│          Save one from Dashboard │
│                                  │
│                                  │
│ H7    Dashboard       ● History  │
└──────────────────────────────────┘
~~~

---

## 7. 對話框："Delete Snapshot"

### 介面要求

- **X1**：顯示標題 "Delete Snapshot"。
- **X2**：顯示訊息 "This cannot be undone."。
- **X3**：顯示按鈕 "Cancel"。
- **X4**：顯示按鈕 "Delete"。

### 功能要求

1. 點選 "Cancel" 關閉對話框，快照保持不變。
2. 點選 "Delete" 永久移除所選快照，關閉對話框並更新清單。
3. 刪除後顯示短暫訊息 "Snapshot deleted"。
4. 如刪除最後一份快照，立即顯示 "History" 的空白狀態。

### 線框圖

~~~text
┌──────────────────────────────────┐
│       X1 Delete Snapshot         │
│                                  │
│       X2 This cannot be undone.  │
│                                  │
│       [X3 Cancel]   [X4 Delete]  │
└──────────────────────────────────┘
~~~

---

## 8. 頁面三："Snapshot Details"

### 介面要求

- **T1**：頂部顯示返回控制項及頁面標題 "Snapshot Details"。
- **T2**：顯示快照名稱及擷取日期時間。
- **T3**：顯示 "Battery" 區塊，包含已儲存的百分比及充電狀態。
- **T4**：顯示 "Storage" 區塊，包含已儲存的已使用、可用及總容量。
- **T5**：顯示 "Network" 區塊，包含已儲存的連線狀態及連線類型。
- **T6**：顯示 "Display" 區塊，包含已儲存的像素尺寸及系統外觀。
- **T7**：顯示按鈕 "Compare"。
- **T8**：顯示按鈕 "Export Report"。

### 功能要求

1. 本頁顯示快照建立時保存的資料，不得以裝置目前資料取代。
2. 任何保存為 "Unavailable" 的值，在本頁仍須顯示為 "Unavailable"。
3. 點選返回控制項回到 "History"，並保留原本清單位置。
4. 只有一份快照時，"Compare" 不可操作；其餘內容仍可正常使用。
5. 有兩份或以上快照時，點選 "Compare" 前往 "Compare"，並把目前快照設為基準快照。
6. 點選 "Export Report" 開啟系統提供的檔案儲存介面，建議檔名為快照名稱加上 ".txt"。
7. 匯出的純文字報告依次包含以下英文欄位：
   - "Device Snapshot"
   - "Name:"
   - "Captured:"
   - "Battery:"
   - "Storage:"
   - "Network:"
   - "Display:"
8. 使用者成功完成匯出後顯示短暫訊息 "Report exported"。
9. 使用者取消系統檔案儲存介面時，不顯示成功訊息，亦不得導致應用程式錯誤。

### 線框圖

~~~text
┌──────────────────────────────────┐
│ T1 ‹  Snapshot Details           │
│                                  │
│ T2 Before meeting                │
│    2026-08-29 14:32              │
│                                  │
│ T3 Battery                       │
│    68% · Not charging            │
│ ──────────────────────────────── │
│ T4 Storage                       │
│    76.4 GB used                  │
│    51.6 GB free · 128.0 GB total │
│ ──────────────────────────────── │
│ T5 Network                       │
│    Online · Wi-Fi                │
│ ──────────────────────────────── │
│ T6 Display                       │
│    1080 × 2400 px · Dark         │
│                                  │
│ [T7 Compare] [T8 Export Report]  │
└──────────────────────────────────┘
~~~

---

## 9. 頁面四："Compare"

### 介面要求

- **C1**：頂部顯示返回控制項及頁面標題 "Compare"。
- **C2**：顯示基準快照名稱，標籤為 "Base snapshot"。
- **C3**：顯示選擇另一份快照的控制項，標籤為 "Compare with"；選項不包含基準快照。
- **C4**：顯示 "Battery" 比較區塊，包含兩個百分比、兩條視覺比例及差值。
- **C5**：顯示 "Storage used" 比較區塊，包含兩個數值、兩條視覺比例及差值。
- **C6**：顯示 "Network" 比較結果，文字為 "Same" 或 "Changed"。
- **C7**：顯示 "Display" 比較結果，文字為 "Same" 或 "Changed"。
- **C8**：未選擇比較快照前，C4 至 C7 的位置顯示 "Select a snapshot"。

### 功能要求

1. 進入頁面後顯示基準快照，並等待使用者選擇另一份快照。
2. "Compare with" 的選項按由新至舊排序，且不得包含基準快照。
3. 選擇快照後立即更新所有比較結果。
4. 電量的每條視覺比例必須與對應百分比一致。
5. 儲存空間的每條視覺比例必須以各自快照的已使用容量佔總容量計算。
6. 電量差值以「比較快照減去基準快照」顯示，正值加入 "+"，例如 "+12%"；負值例如 "-7%"；相同顯示 "0%"。
7. 儲存空間差值同樣以「比較快照減去基準快照」顯示，保留一位小數並使用 "GB"，例如 "+1.5 GB"。
8. 網絡狀態及類型均相同時顯示 "Same"，否則顯示 "Changed"。
9. 顯示像素尺寸及系統外觀均相同時顯示 "Same"，否則顯示 "Changed"。
10. 如某項比較所需的任一值為 "Unavailable"，該項結果顯示 "Unavailable"，其他項目繼續比較。
11. 點選返回控制項回到原本的 "Snapshot Details"。

### 線框圖：尚未選擇

~~~text
┌──────────────────────────────────┐
│ C1 ‹  Compare                    │
│                                  │
│ C2 Base snapshot                 │
│    Before meeting                │
│ C3 Compare with                  │
│    [ Select a snapshot       ▾ ] │
│                                  │
│ C8 Battery       Select a snapshot│
│    Storage used  Select a snapshot│
│    Network       Select a snapshot│
│    Display       Select a snapshot│
└──────────────────────────────────┘
~~~

### 線框圖：完成選擇

~~~text
┌──────────────────────────────────┐
│ C1 ‹  Compare                    │
│                                  │
│ C2 Base snapshot                 │
│    Before meeting                │
│ C3 Compare with                  │
│    [ Morning check           ▾ ] │
│                                  │
│ C4 Battery                 +23%  │
│    Base     ███████████░  68%    │
│    Compare  ███████████████ 91%  │
│                                  │
│ C5 Storage used           -1.5 GB│
│    Base     ██████████  76.4 GB  │
│    Compare  █████████░  74.9 GB  │
│                                  │
│ C6 Network                  Same │
│ C7 Display                  Same │
└──────────────────────────────────┘
~~~

---

## 10. 驗收情境

評分前至少準備兩個可區分的裝置狀態，或使用目標環境可提供的狀態模擬能力。

### 情境 A：初次啟動與重新整理

1. 清除應用程式資料後啟動。
2. 確認 "Dashboard" 先顯示 "Loading…"，然後顯示實際資料。
3. 改變網絡連線狀態。
4. 點選 "Refresh"。
5. 確認網絡資訊及 "Updated" 時間已更新。

### 情境 B：建立與保留快照

1. 點選 "Save Snapshot"。
2. 清空名稱並點選 "Save"，確認顯示 "Enter a name"。
3. 輸入 "Before meeting" 並儲存。
4. 建立第二份名為 "Morning check" 的快照。
5. 關閉並重新啟動應用程式。
6. 確認兩份快照仍存在，且較新的項目在最上方。

### 情境 C：快照內容與比較

1. 開啟其中一份 "Snapshot Details"。
2. 確認內容是保存時的資料，而非目前裝置資料。
3. 進入 "Compare" 並選擇另一份快照。
4. 核對電量與儲存空間的比例、數值及差值方向。
5. 核對網絡和顯示的 "Same"／"Changed" 結果。

### 情境 D：匯出與取消

1. 在 "Snapshot Details" 點選 "Export Report"。
2. 取消系統檔案儲存介面，確認沒有成功訊息或錯誤。
3. 再次操作並完成儲存。
4. 確認顯示 "Report exported"，而且文字檔含有規定欄位及該快照內容。

### 情境 E：刪除

1. 在 "History" 點選一份快照的 "Delete"。
2. 先點選 "Cancel"，確認資料仍存在。
3. 再次開啟確認對話框並點選 "Delete"。
4. 確認項目消失且重新啟動後不再出現。

---

## 11. 評分配額

| 評分部分 | 分數 |
|---|---:|
| "Dashboard" 的裝置資料取得、狀態與視覺比例 | 4.0 |
| 快照命名、驗證、保存與重新啟動後保留 | 2.5 |
| "History" 清單、空白狀態、導覽及刪除流程 | 2.0 |
| "Snapshot Details" 的已保存資料與狀態處理 | 1.5 |
| "Compare" 的選擇、兩組視覺比例及比較結果 | 2.5 |
| 純文字報告匯出、完成與取消流程 | 1.5 |
| 介面一致性、可讀性及整體穩定性 | 1.0 |
| **總分** | **15.0** |

---

## 12. 「介面要求 ↔ 線框圖」逐項對照

| 頁面／對話框 | 介面要求編號 | 線框圖位置 | 檢查 |
|---|---|---|---|
| Dashboard | D1–D2 | 頂部標題及更新時間 | ✓ |
| Dashboard | D3 | Battery 卡片、環形圖、百分比、充電狀態 | ✓ |
| Dashboard | D4 | Storage 卡片、比例條、used/free | ✓ |
| Dashboard | D5 | Network 卡片、狀態與類型 | ✓ |
| Dashboard | D6 | Display 卡片、像素及方向 | ✓ |
| Dashboard | D7–D8 | Refresh、Save Snapshot 按鈕 | ✓ |
| Dashboard | D9 | Dashboard、History 底部導覽 | ✓ |
| Save Snapshot | S1–S6 | 標題、輸入欄、預設值、錯誤、兩按鈕 | ✓ |
| History | H1 | 頂部標題 | ✓ |
| History | H2–H5 | 兩張示例卡片及 Delete | ✓ |
| History | H6 | 獨立空白狀態線框圖 | ✓ |
| History | H7 | Dashboard、History 底部導覽 | ✓ |
| Delete Snapshot | X1–X4 | 標題、警告、Cancel、Delete | ✓ |
| Snapshot Details | T1–T2 | 返回、標題、名稱、時間 | ✓ |
| Snapshot Details | T3–T6 | Battery、Storage、Network、Display | ✓ |
| Snapshot Details | T7–T8 | Compare、Export Report 按鈕 | ✓ |
| Compare | C1–C3 | 返回、標題、基準與選擇器 | ✓ |
| Compare | C4–C7 | Battery、Storage、Network、Display 結果 | ✓ |
| Compare | C8 | 未選擇狀態線框圖 | ✓ |

---

## 13. 出題設計說明

本題刻意沒有沿用四份參考題已出現的倒數、旅遊地圖、相簿瀏覽、錄音、影片播放、登入收藏或遊戲碰撞。題目改用 WSOS 明列的以下能力：

- 取得行動終端效能及系統參數；
- 把數值以圖形方式視覺化；
- 保存及比較應用程式狀態；
- 與系統檔案介面整合；
- 處理資料不可用、取消操作及重新啟動後的狀態；
- 在不同裝置資料條件下保持相容及穩定。

這些功能屬於一般使用者可理解的日常工具能力，同時能在 3.5 小時內檢驗完整功能、狀態及裝置整合。
