# 練習測試題目

## 模組 A：功能實作

### "CityCycle Operations"

| 項目 | 內容 |
|---|---|
| 比賽時間 | 2.5 小時 |
| 評分裝置 | 平板模擬器 |
| 顯示方向 | 橫向 |
| 開發技術 | 技術中立 |

## 簡介

CityCycle 是一套城市共享單車營運系統。營運人員需要掌握站點狀態、管理單車調度、建立與結束租借、監察進行中的租借，以及查閱過往紀錄。

你的任務是根據本題要求及所提供的 JSON 資料，完成平板版 "CityCycle Operations" 應用程式。

## 專案與任務說明

應用程式必須在沒有網路連線的情況下完成所有核心操作。首次啟動時，應用程式須使用所提供的 JSON 檔案建立初始資料。之後由使用者產生的調度、租借、延長及還車結果，均須儲存在裝置本機。

介面的顏色、字型、圖示及細微位置不作指定，但應用程式必須適合平板橫向操作，讓測試人員能清楚識別資料、狀態及可執行的操作。

## 提供檔案

所有資料檔案位於 `media-files/data`。

| 檔案 | 內容及用途 |
|---|---|
| `stations.json` | 站點 ID、名稱、區域、容量、距離及座標。 |
| `bikes.json` | 單車 ID、類型、狀態、電量及目前所在站點。 |
| `pricing_rules.json` | 貨幣、租借方案、方案時間、收費、延長時間及超時收費。 |
| `members.json` | 會員 ID、姓名、電話、會員等級及折扣率。 |
| `active_rentals.json` | 首次啟動時需要建立的進行中租借。 |
| `rental_history.json` | 已完成租借及其時間與費用資料。 |

## 一般要求

1. 應用程式在作業系統中顯示的名稱必須為 "CityCycle Operations"。
2. 應用程式必須以平板橫向模式顯示。
3. 所有頁面均須顯示固定導覽，包含：
   - "Dashboard"；
   - "Stations"；
   - "Rental Console"；
   - "Active Rentals"；
   - "Smart Assistant"；
   - "Rental History"。
4. 按下導覽項目須前往相應頁面，目前頁面的導覽項目須有清楚的選取狀態。
5. 所有以半形雙引號標示的文字均為程式需要顯示的英文文字，必須依題目指定的拼字及大小寫呈現。
6. 所有頁面均須使用目前本機資料。資料改變後，相關頁面的摘要、列表、狀態、費用及可用操作須同步更新。
7. 所有金額均使用收費資料指定的貨幣，顯示格式為 `CNY 0.00`。完整計算完成後才四捨五入至兩位小數。
8. 所有持續時間均以 `HH:MM:SS` 顯示。少於一小時時，仍須顯示小時部分，例如 `00:08:25`。
9. 無法完成的操作或無效輸入須顯示清楚的應用程式內訊息，並保持操作前的資料不變。
10. 調度、租借、延長、還車及使用者選擇的結果，必須在強制關閉並重新啟動應用程式後保留。
11. 切換頁面、將應用程式移至背景或重新啟動，不得令進行中的租借計時失去正確狀態。
12. 未在本題中提出的功能不需要實作。

## 初始資料處理

1. 首次啟動時讀取六份 JSON 檔案。
2. 進行中租借資料中的每筆租借均提供已經過時間。其開始時間須以目前時間減去該時間建立。
3. 每筆初始租借的預定結束時間，須以開始時間加上所選方案時間建立。
4. 建立後的開始時間及預定結束時間須儲存在本機。再次啟動應用程式時不得重新使用原始的已經過時間。
5. 首次資料匯入完成後，本機資料須成為應用程式的目前狀態來源。重新啟動時不得以原始 JSON 覆蓋使用者已完成的操作。

# 頁面要求

## 1. "Dashboard" 頁面

### 1.1 介面要求

1. 頁面標題 "Dashboard"。
2. 摘要區域包含以下四張摘要卡：
   - "Available Bikes"；
   - "Empty Docks"；
   - "Active Rentals"；
   - "Overtime"。
3. 每張摘要卡均須顯示標題及一個整數值。
4. "Station Status" 區域包含：
   - 站點搜尋欄，提示文字為 "Search stations"；
   - 站點名稱；
   - 區域；
   - 可用單車數量；
   - 空車位數量；
   - 健康狀態。
5. "Quick Actions" 區域包含：
   - "Start Rental"；
   - "Manage Stations"；
   - "View Active Rentals"。

### 1.2 功能要求

1. "Available Bikes" 顯示目前可供租借並停放於站點的單車總數。正在維修、已租出或沒有停放於任何站點的單車不計入。沒有符合條件的單車時顯示 `0`。
2. "Empty Docks" 顯示所有站點空車位的總和：
   - 一輛單車只要目前停放於該站點，即佔用一個車位；
   - 正在維修但仍停放於站點的單車仍佔用車位；
   - 沒有停放於任何站點的單車不佔用車位；
   - 每個站點的空車位為站點容量減去目前停放於該站點的單車數量。
3. "Active Rentals" 顯示尚未完成，而且目前時間早於預定結束時間的租借數量。
4. "Overtime" 顯示尚未完成，而且目前時間等於或晚於預定結束時間的租借數量。
5. "Station Status" 須顯示站點資料中的所有站點。每個站點的數值使用目前單車資料計算，不得把可用單車數或空車位數寫成固定內容。
6. 站點健康狀態顯示為 "Critical"、"Low" 或 "Normal"：
   - 可用單車為 `0`，或空車位為 `0`時，顯示 "Critical"；
   - 不屬於 "Critical"，而可用單車不多於站點容量的 25%，或空車位不多於站點容量的 20% 時，顯示 "Low"；
   - 其他情況顯示 "Normal"。
7. 在搜尋欄輸入內容時，按站點名稱及站點 ID 進行不分大小寫的即時篩選。
8. 沒有符合搜尋內容的站點時，在 "Station Status" 區域顯示 "No stations found"。
9. 按下 "Start Rental" 前往 "Rental Console" 頁面。
10. 按下 "Manage Stations" 前往 "Stations" 頁面。
11. 按下 "View Active Rentals" 前往 "Active Rentals" 頁面。
12. 調度、開始租借、延長、租借轉為超時或完成還車後，四張摘要卡及 "Station Status" 須立即反映最新資料。

## 2. "Station Management" 頁面

### 2.1 介面要求

1. 頁面標題 "Station Management"。
2. 搜尋及篩選區域包含：
   - 搜尋欄，提示文字為 "Station name or ID"；
   - "District" 篩選；
   - "Status" 篩選；
   - 排序選擇；
   - "Reset" 按鈕。
3. "District" 篩選包含 "All districts" 及目前資料中所有不同的區域名稱。
4. "Status" 篩選包含 "All statuses"、"Critical"、"Low" 及 "Normal"。
5. 排序選擇包含 "Urgency"、"Available Bikes" 及 "Distance"。
6. "Stations" 清單中的每個項目顯示：
   - 站點 ID；
   - 站點名稱；
   - 可用單車數量；
   - 空車位數量；
   - 健康狀態。
7. "Selected Station" 區域顯示：
   - 站點 ID 及名稱；
   - 區域；
   - 容量；
   - 可用單車數量；
   - 空車位數量；
   - 健康狀態；
   - "Bikes assigned to station" 清單。
8. "Bikes assigned to station" 中每輛單車顯示：
   - 單車 ID；
   - 單車類型；
   - 目前狀態；
   - 電量百分比，只在該單車具有電量資料時顯示。

### 2.2 功能要求

1. 站點清單使用所提供的站點資料；站點內的單車及數量使用目前的單車資料顯示。
2. 可用單車數量只包含目前停放於該站點並可供租借的單車。
3. 空車位計算及健康狀態判斷須與 "Dashboard" 頁面使用相同規則。
4. 預設選取清單中的第一個站點。選擇另一個站點時，"Selected Station" 及 "Bikes assigned to station" 須更新為該站點的資料。
5. 搜尋按站點名稱及站點 ID 進行不分大小寫的即時篩選。
6. "District"、"Status" 及搜尋條件須同時套用。
7. "Urgency" 排序依 "Critical"、"Low"、"Normal" 的順序排列；狀態相同時按站點名稱升冪排列。
8. "Available Bikes" 排序按可用單車數量降冪排列；數量相同時按站點名稱升冪排列。
9. "Distance" 排序按站點距離升冪排列；距離相同時按站點名稱升冪排列。
10. 按下 "Reset" 清除搜尋內容，選取 "All districts"、"All statuses" 及 "Urgency"，並返回篩選後清單的第一個站點。
11. 沒有符合所有條件的站點時顯示 "No stations found"，並清除 "Selected Station" 的站點內容。
12. 使用者可把目前可供租借的單車拖放至另一個站點，以完成單車調度。
13. 調度目的站只可使用與起點不同，而且目前至少有一個空車位的站點。
14. 成功調度後：
    - 將該單車的目前所在站點更新為目的站；
    - 保持單車為可供租借狀態；
    - 更新起點及目的站的可用單車、空車位及健康狀態；
    - 更新 "Dashboard" 及其他顯示站點資料的頁面；
    - 重新啟動後仍須保留新的站點位置。
15. 把單車拖放至沒有空車位的站點時，顯示 "Destination station is full"，並取消整個操作。
16. 不是可供租借狀態的單車不可調度。嘗試調度時顯示 "Bike is not available for transfer"，並保持資料不變。

## 3. "Rental Console" 頁面

### 3.1 介面要求

1. 頁面標題 "Rental Console"。
2. "Rental Setup" 區域包含：
   - "Member" 選擇；
   - "Bike" 選擇；
   - "Plan" 選擇；
   - "Add insurance" 開關。
3. "Member" 的每個選項顯示會員 ID、姓名及會員等級。
4. "Bike" 的每個選項顯示單車 ID、單車類型及目前站點 ID。
5. "Plan" 的每個選項顯示方案名稱及方案時間。
6. "Rental Summary" 顯示：
   - 會員姓名；
   - 單車 ID；
   - 起點站名稱；
   - "Unlock fee"；
   - "Base price"；
   - "Discount"；
   - "Insurance"。
7. 顯示 "Estimated total" 及其金額。
8. 顯示驗證訊息區域。
9. 提供 "Reset" 及 "Start Rental" 按鈕。

### 3.2 功能要求

1. "Member" 選項來自目前會員資料。
2. "Bike" 只列出目前可供租借並停放於站點的單車。單車被租借或調度後，選項須反映最新資料。
3. "Plan" 選項使用所提供的租借方案資料。
4. 選擇單車後，"Start station" 顯示該單車目前所在站點的名稱。
5. 選擇會員、單車或方案後，"Rental Summary" 須立即更新。
6. "Unlock fee" 顯示所選方案的解鎖費。
7. "Base price" 按以下規則顯示：
   - 使用方案的計費時間作為本次預估租借時間；
   - 每開始一個 30 分鐘區塊均計作一個完整區塊；
   - 區塊數乘以方案的每 30 分鐘基本價格。
8. "Discount" 顯示基本價格乘以所選會員的折扣率。沒有折扣時顯示 `CNY 0.00`。
9. "Insurance" 在 "Add insurance" 開啟時顯示所選方案的保險費；關閉時顯示 `CNY 0.00`。
10. "Estimated total" 顯示解鎖費、基本價格及保險費的總和，再減去會員折扣。
11. 每位會員最多可同時擁有兩筆未完成租借。未完成租借包括 "Active" 及 "Overtime"。
12. 按下 "Start Rental" 時依序驗證：
    - 已選擇會員；
    - 已選擇單車；
    - 已選擇方案；
    - 會員未達未完成租借上限；
    - 所選單車目前仍可供租借，而且仍位於原來站點。
13. 會員達租借上限時顯示 "Rental limit reached"。
14. 單車在確認前已不可租借時顯示 "Bike is no longer available"。
15. 成功開始租借後：
    - 建立一個不與現有資料重複的租借 ID；
    - 儲存會員、單車、起點站、方案及保險選擇；
    - 開始時間使用目前時間；
    - 預定結束時間為開始時間加上方案時間；
    - 將單車狀態改為已租出；
    - 清除單車的目前所在站點；
    - 顯示 "Rental started"；
    - 前往 "Active Rentals" 頁面。
16. 按下 "Reset" 清除所有選擇、驗證訊息及費用摘要，並關閉 "Add insurance"。
17. 任何驗證失敗均不得建立租借或改變單車及站點資料。

## 4. "Active Rentals" 頁面

### 4.1 介面要求

1. 頁面標題 "Active Rentals"。
2. 搜尋及篩選區域包含：
   - 搜尋欄，提示文字為 "Member, bike or rental ID"；
   - "Status" 篩選；
   - 排序選擇；
   - "Reset" 按鈕；
   - 目前符合條件的租借數量。
3. "Status" 篩選包含 "All active"、"Active" 及 "Overtime"。
4. 排序選擇包含 "Ending Soon"、"Newest" 及 "Rental ID"。
5. 每筆租借顯示：
   - 租借 ID；
   - 會員 ID 及姓名；
   - 單車 ID 及單車類型；
   - 方案名稱；
   - 起點站名稱；
   - "Active" 或 "Overtime" 狀態；
   - 剩餘時間或超時時間；
   - 目前費用；
   - "Extend" 按鈕；
   - "Return" 按鈕。
6. "Active" 租借顯示剩餘時間及剩餘進度。
7. "Overtime" 租借顯示超時時間，並使用與 "Active" 不同的清楚狀態樣式。

### 4.2 功能要求

1. 清單只顯示尚未完成的租借。
2. 租借狀態以目前時間及預定結束時間判斷：
   - 目前時間早於預定結束時間時顯示 "Active"；
   - 目前時間等於或晚於預定結束時間時顯示 "Overtime"。
3. "Active" 的剩餘時間為預定結束時間減去目前時間，每秒更新。
4. "Active" 的剩餘進度以目前剩餘時間佔目前方案總時間的百分比顯示，範圍限制在 0% 至 100%。
5. 剩餘時間到達零時，租借須在不重新開啟頁面的情況下轉為 "Overtime"。
6. "Overtime" 的超時時間為目前時間減去預定結束時間，每秒向上更新。
7. 超時費按以下規則計算：
   - 每開始一個方案指定的超時收費區塊均計作一個完整區塊；
   - 超時區塊數乘以方案的每個超時區塊收費；
   - 尚未超時時，超時費為 `CNY 0.00`。
8. 目前費用顯示本次租借的解鎖費、折扣後基本價格、保險費及目前超時費的總和。
9. 搜尋按租借 ID、會員 ID、會員姓名及單車 ID 進行不分大小寫的即時篩選。
10. "Status" 與搜尋條件須同時套用。
11. "Ending Soon" 排序：
    - "Active" 租借按預定結束時間升冪排列；
    - "Overtime" 租借按超時時間降冪排列；
    - "Active" 顯示在 "Overtime" 之前。
12. "Newest" 按開始時間降冪排列。
13. "Rental ID" 按租借 ID 升冪排列。
14. 按下 "Reset" 清除搜尋內容，選取 "All active" 及 "Ending Soon"。
15. 沒有符合條件的租借時顯示 "No active rentals"。
16. 按下 "Extend" 後：
    - 預定結束時間增加所選方案的延長時間；
    - 基本價格增加一個 30 分鐘收費區塊，再套用會員折扣；
    - 重新以目前時間判斷租借狀態；
    - 更新剩餘或超時時間及目前費用；
    - 重新啟動後仍須保留延長結果。
17. 按下 "Return" 開啟還車流程。
18. 還車站選項只列出目前至少有一個空車位的站點，並顯示站點名稱及空車位數量。
19. 使用者確認還車後：
    - 使用目前時間作為完成時間；
    - 計算並儲存實際租借時間、基本費、保險費、超時費及總額；
    - 將租借狀態改為已完成；
    - 將單車狀態改為可供租借；
    - 將單車的目前所在站點改為所選還車站；
    - 把完成紀錄加入 "Rental History"；
    - 更新相關站點及 "Dashboard" 頁面。
20. 取消還車流程時不得改變任何資料。
21. 應用程式進入背景或重新啟動後，須根據已儲存時間重新顯示正確的狀態、剩餘或超時時間、進度及費用。

## 5. "Smart Assistant" 頁面

### 5.1 介面要求

1. 頁面標題 "Smart Assistant"。
2. "Trip Preferences" 區域包含：
   - "Origin" 選擇；
   - "Destination" 選擇；
   - "Nearest bike"；
   - "Maximum availability"；
   - "Lowest estimated cost"；
   - "Find Recommendation" 按鈕。
3. "Origin" 包含 "Current location" 及所有站點。
4. "Destination" 包含所有站點。
5. "Recommended Trip" 區域顯示：
   - "Start station"；
   - "Return station"；
   - "Suggested bike"；
   - "Plan"；
   - "Walking distance"；
   - "Estimated fee"；
   - 警告或無結果訊息；
   - "Apply Recommendation" 按鈕。

### 5.2 功能要求

1. 預設 "Origin" 為 "Current location"，預設推薦方式為 "Nearest bike"。
2. 必須選擇 "Destination" 後才可取得推薦。
3. 只有目前至少有一輛可供租借單車的站點可作為起點站。
4. 只有目前至少有一個空車位的站點可作為還車站。
5. 起點站及還車站不可是同一站點。
6. "Origin" 為指定站點時，只可從該站點的可用單車產生推薦；該站點沒有可用單車時顯示 "No bike available at the selected origin"。
7. "Origin" 為 "Current location" 時，使用資料中每個站點的距離作為步行距離。
8. 選擇 "Nearest bike" 時，推薦具有可用單車而距離最小的起點站。距離相同時按站點 ID 升冪選擇。
9. 選擇 "Maximum availability" 時，推薦可用單車數量最多的起點站。數量相同時，先選擇距離較小的站點，再按站點 ID 升冪選擇。
10. 選擇 "Lowest estimated cost" 時，從所有方案中選擇預估費用最低的方案。預估費用不包括會員折扣及保險。費用相同時按方案 ID 升冪選擇。
11. "Nearest bike" 及 "Maximum availability" 使用計費時間最短的方案。時間相同時按方案 ID 升冪選擇。
12. 推薦的單車為所選起點站中單車 ID 最小的可供租借單車。
13. "Start station" 顯示推薦起點站名稱。
14. "Return station" 顯示所選 "Destination" 的站點名稱。
15. "Suggested bike" 顯示單車 ID 及單車類型。
16. "Plan" 顯示推薦方案名稱。
17. "Walking distance" 顯示推薦起點站的距離，格式為一位小數及 `km`，例如 `1.2 km`。
18. "Estimated fee" 使用與 "Rental Console" 相同的解鎖費及基本價格規則，但不包括會員折扣及保險。
19. 找不到同時符合起點、可用單車及還車空位條件的結果時，顯示 "No recommendation available"，並停用 "Apply Recommendation"。
20. 按下 "Find Recommendation" 時須使用目前最新資料。先前推薦的單車已不可用時，不得繼續顯示為有效結果。
21. 按下 "Apply Recommendation" 前須再次確認建議單車仍可租借，以及還車站仍有空車位。
22. 成功套用後，前往 "Rental Console"，並預先選取推薦的單車及方案。會員及保險由使用者在 "Rental Console" 選擇。

## 6. "Rental History" 頁面

### 6.1 介面要求

1. 頁面標題 "Rental History"。
2. 搜尋及篩選區域包含：
   - 搜尋欄，提示文字為 "Rental, member or bike"；
   - "Date range" 篩選；
   - "Member" 篩選；
   - "Status" 篩選；
   - "Reset" 按鈕。
3. "Date range" 包含 "All dates"、"Today"、"Last 7 days" 及 "Last 30 days"。
4. "Member" 包含 "All members" 及目前所有會員。
5. "Status" 包含 "All"、"Completed" 及 "Overtime"。
6. "Completed Rentals" 列表中的每筆紀錄顯示：
   - 租借 ID；
   - 會員 ID；
   - 單車 ID；
   - 實際租借時間；
   - 狀態；
   - 總額。
7. 列表每頁最多顯示五筆紀錄。
8. 分頁區域顯示目前顯示範圍及總紀錄數，並提供 "Previous" 及 "Next" 按鈕。
9. "Rental Detail" 顯示所選紀錄的：
   - 租借 ID；
   - 起點站；
   - 還車站；
   - 實際租借時間；
   - "Unlock fee"；
   - "Base price"；
   - "Insurance"；
   - "Overtime"；
   - "Total charge"。

### 6.2 功能要求

1. 清單須包含所提供的已完成租借紀錄，以及使用者在應用程式內新完成的租借。
2. 紀錄按完成時間降冪排列。完成時間相同時按租借 ID 降冪排列。
3. 紀錄的顯示狀態按費用資料判斷：
   - 超時費大於 `0` 時顯示 "Overtime"；
   - 其他紀錄顯示 "Completed"。
4. 搜尋按租借 ID、會員 ID、會員姓名及單車 ID 進行不分大小寫的即時篩選。
5. "Date range" 使用紀錄的完成時間篩選：
   - "Today" 顯示本機日期為今天的紀錄；
   - "Last 7 days" 包含今天及之前六個本機日期；
   - "Last 30 days" 包含今天及之前二十九個本機日期。
6. "Member"、"Status"、"Date range" 及搜尋條件須同時套用。
7. 改變任何搜尋或篩選條件後返回第一頁。
8. 按下 "Reset" 清除搜尋內容，選取 "All dates"、"All members" 及 "All"，並返回第一頁。
9. "Previous" 在第一頁停用；"Next" 在最後一頁停用。
10. 沒有符合條件的紀錄時顯示 "No rental records"，清除 "Rental Detail"，並停用兩個分頁按鈕。
11. 預設選取目前頁面的第一筆紀錄。按下其他紀錄時，"Rental Detail" 須顯示該紀錄的資料。
12. 起點及還車站須以站點名稱顯示，而不是只顯示站點 ID。
13. 實際租借時間使用紀錄中的實際持續時間，並按一般要求的持續時間格式顯示。
14. "Unlock fee" 顯示該紀錄所選方案的解鎖費。
15. "Base price" 顯示紀錄中的基本費減去解鎖費後的金額。
16. "Insurance" 顯示紀錄中的保險費。
17. "Overtime" 顯示紀錄中的超時費。
18. "Total charge" 顯示紀錄中的總額。
19. 新租借完成後，須立即出現在正確排序位置，並在重新啟動後保留。

# 參賽者說明

1. 建立套件名稱或組織識別碼 `org.citycycle.functionality.xx`。
2. 將完整專案儲存在 `XX_CityCycle_Functionality` 資料夾。
3. Android 可執行檔命名為 `XX_CityCycle_Functionality.apk`；iOS 可執行檔命名為 `XX_CityCycle_Functionality.app`。
4. 將可執行檔放在專案資料夾根目錄，並保留題目提供的六份 JSON 資料。
5. 將完整資料夾提交至指定位置。只有截止時間前完成的版本會被評分。
6. `XX` 代表工作站代碼。
