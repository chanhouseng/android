# CityCycle 題目中文化實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 CityCycle Word 題目內文統一為繁體中文，並把所有指定的程式可見英文文字以半形雙引號標示，同時保留線框圖、JSON 與 15 分評分邏輯。

**Architecture:** 使用確定性的 python-docx 編輯器，以原段落文字及表格儲存格文字作為鍵套用翻譯清單，避免重建文件造成版面漂移。編輯器保留段落樣式、圖片、表格與頁首頁尾，並以 UI 字串白名單驗證雙引號、以技術識別碼白名單避免錯誤翻譯。

**Tech Stack:** Codex bundled Python、python-docx、OOXML ZIP 檢查、PowerShell SHA-256、文件技能的 a11y 與 render 工具。

## Global Constraints

- 題目敘述、章節、表格描述、圖說、圖例及評分內容使用繁體中文。
- 程式可見字串保持英文，並在題目文字中使用成對半形雙引號。
- 線框圖內的英文 UI 文字不加雙引號，也不重畫線框圖。
- JSON 檔名、欄位名稱、ID、公式及時間格式保持英文，不使用 UI 雙引號。
- 六份 JSON 檔案保持位元組完全不變。
- 評分總分保持 15.0 分。

---

### Task 1: 建立翻譯清單與保護規則

**Files:**
- Create: `C:/tmp/localize_citycycle_docx.py`
- Read: `train/Ai projeect/CityCycle_Functionality_Test_Project_zh-TW.docx`

**Interfaces:**
- Consumes: DOCX 內全部段落、表格儲存格、頁首與頁尾文字。
- Produces: `PARAGRAPH_TRANSLATIONS: dict[str, str]`、`TABLE_TRANSLATIONS: dict[str, str]`、`UI_STRINGS: tuple[str, ...]` 與 `TECHNICAL_TOKENS: tuple[str, ...]`。

- [ ] **Step 1: 匯出完整文字清單**

列出每個段落的索引、樣式與文字，以及每個表格的列、欄與文字；按「一般題目文字、程式可見字串、技術識別碼」分類。

- [ ] **Step 2: 建立段落翻譯清單**

翻譯封面、目錄、章節標題、小節標題、功能敘述、計算規則、測試案例、提交說明、線框圖圖說及圖例。頁面標題採 `1. "Dashboard" 頁面` 格式；UI 字串如 `"Start Rental"` 保持原拼字與大小寫。

- [ ] **Step 3: 建立表格翻譯清單**

翻譯設備與時間、JSON 輸入檔、測試向量、測試案例及評分表中的描述欄；保留檔名、欄位、ID、公式、數值及評分值。

- [ ] **Step 4: 建立保護與驗證清單**

UI 清單至少涵蓋六個頁面名稱、所有指定按鈕、欄位、篩選器、狀態與錯誤訊息。技術清單至少涵蓋六個 JSON 檔名、所有題目提及的 snake_case 欄位及固定 ID。

### Task 2: 原位更新 Word 文字

**Files:**
- Modify: `train/Ai projeect/CityCycle_Functionality_Test_Project_zh-TW.docx`
- Reuse: `C:/tmp/localize_citycycle_docx.py`

**Interfaces:**
- Consumes: Task 1 的翻譯與保護清單。
- Produces: `apply_localization(docx_path: Path) -> None`，以原子替換方式更新文件。

- [ ] **Step 1: 套用段落翻譯**

僅替換翻譯清單中的完整段落文字，保留原段落樣式、對齊、分頁及圖片錨點；保留線框圖圖片內容。

- [ ] **Step 2: 套用表格翻譯**

在原儲存格中替換文字，保持列高、欄寬、底色、框線、評分數值與重複表頭設定。

- [ ] **Step 3: 套用字型規則**

中文題目文字使用文件既有中文字型設定；英文 UI 字串、JSON 欄位與公式保留現有英文字型，不縮小圖片或變更頁面尺寸。

- [ ] **Step 4: 原子儲存**

先儲存至同資料夾的暫存 DOCX，重新開啟並通過 Task 3 結構驗證後才取代原文件。

### Task 3: 驗證語言、結構與資料完整性

**Files:**
- Verify: `train/Ai projeect/CityCycle_Functionality_Test_Project_zh-TW.docx`
- Verify: `train/Ai projeect/media-files/data/*.json`

**Interfaces:**
- Consumes: 更新後 DOCX、UI 字串清單、技術識別碼清單及更新前 JSON 雜湊。
- Produces: 零退出碼的完整驗證報告。

- [ ] **Step 1: 驗證中文章節**

確認一般英文章節名稱已消失，並存在 `目錄`、`簡介`、`一般要求`、`頁面要求`、`資料與計算規則`、`確定性測試案例`、`參賽者說明` 與 `評分標準`。

- [ ] **Step 2: 驗證 UI 字串雙引號**

在題目文字與表格中檢查每個 UI 字串；線框圖替代文字除外，所有敘述中的 UI 字串必須以 `"..."` 出現，不得存在未加引號的指定介面文案。

- [ ] **Step 3: 驗證技術識別碼**

確認六個 JSON 檔名、必要 snake_case 欄位、固定 ID、公式及 15.0 分總分仍存在且未被翻譯。

- [ ] **Step 4: 驗證文件資產**

重新開啟 DOCX，確認仍有六張圖片、六個非空替代文字、七個原有表格，以及六個正確章節內的線框圖圖說。

- [ ] **Step 5: 驗證 JSON 不變性**

比較更新前後六份 JSON 的 SHA-256，必須 6/6 完全相同。

### Task 4: 文件 QA 與交付清理

**Files:**
- Verify: `train/Ai projeect/CityCycle_Functionality_Test_Project_zh-TW.docx`
- Temporary: visualization render directory and `C:/tmp/localize_citycycle_docx.py`

**Interfaces:**
- Consumes: 通過 Task 3 的 DOCX。
- Produces: 最終 Word 題目及 QA 報告。

- [ ] **Step 1: 執行無障礙檢查**

執行文件技能的 `a11y_audit.py`，確認新增或保留的六張圖片皆有替代文字；將原文件既有提示分開記錄。

- [ ] **Step 2: 嘗試逐頁渲染**

執行 `render_docx.py`；若環境仍缺少 LibreOffice，依文件技能允許的 fallback 記錄限制，不宣稱通過逐頁渲染。

- [ ] **Step 3: 最終只讀驗證**

再次執行 Task 3 的全部檢查，輸出 DOCX SHA-256、圖片數量、表格數量、JSON 雜湊結果及未翻譯英文章節掃描結果。

- [ ] **Step 4: 清理暫存檔**

刪除暫存編輯器、暫存 DOCX 及 QA 渲染資料，只保留 Word、JSON、線框圖 PNG、規格與計畫文件。

