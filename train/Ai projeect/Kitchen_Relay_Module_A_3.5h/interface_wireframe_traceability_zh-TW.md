# 介面要求 ↔ 線框圖逐項對照表

可見介面要求共 49 項；每項均對應至少一張線框圖。

| ID | 頁面 | 介面要求 | 線框圖 | 圖中標示 |
|---|---|---|---|---|
| T-01 | Timers | 頁面標題 "Timers" | Timers - Empty / Active | Timers |
| T-02 | Timers | 新增按鈕 "Add Timer" | Timers - Empty / Active | Add Timer |
| T-03 | Timers | 計時器清單 | Timers - Active | Timer list |
| T-04 | Timers | 各項目的計時器名稱 | Timers - Active | Pasta / Soup |
| T-05 | Timers | 各項目的剩餘時間 | Timers - Active | 12:40 / 03:15 |
| T-06 | Timers | 各項目的狀態 "Running" 或 "Paused" | Timers - Active | Running / Paused |
| T-07 | Timers | 各項目的進度指示 | Timers - Active | Progress bar |
| T-08 | Timers | 空白狀態 "No active timers" | Timers - Empty | No active timers |
| T-09 | Timers | 上限提示 "Maximum 3 timers" | Timers - Maximum | Maximum 3 timers |
| T-10 | Timers | 底部導航 "Timers" 和 "History" | Timers - Empty / Active | Timers / History |
| N-01 | New Timer | 返回按鈕 | New Timer - Valid / Error | Back |
| N-02 | New Timer | 頁面標題 "New Timer" | New Timer - Valid / Error | New Timer |
| N-03 | New Timer | 名稱欄位 "Timer name" | New Timer - Valid / Error | Timer name |
| N-04 | New Timer | 分鐘欄位 "Minutes" | New Timer - Valid / Error | Minutes |
| N-05 | New Timer | 秒數欄位 "Seconds" | New Timer - Valid / Error | Seconds |
| N-06 | New Timer | 提示音選擇器 | New Timer - Valid / Error | Sound selector |
| N-07 | New Timer | 提示音選項 "Bell" | New Timer - Valid / Error | Bell |
| N-08 | New Timer | 提示音選項 "Chime" | New Timer - Valid / Error | Chime |
| N-09 | New Timer | 提示音選項 "Digital" | New Timer - Valid / Error | Digital |
| N-10 | New Timer | 按鈕 "Preview Sound" | New Timer - Valid / Error | Preview Sound |
| N-11 | New Timer | 按鈕 "Start Timer" | New Timer - Valid / Error | Start Timer |
| N-12 | New Timer | 欄位下方的英文錯誤訊息 | New Timer - Error | Required / Invalid duration |
| D-01 | Timer Details | 返回按鈕 | Details - Running / Paused / Finished | Back |
| D-02 | Timer Details | 計時器名稱 | Details - Running / Paused / Finished | Pasta |
| D-03 | Timer Details | 圓形進度指示 | Details - Running / Paused / Finished | Circular progress |
| D-04 | Timer Details | 剩餘時間 | Details - Running / Paused / Finished | 12:40 / 08:20 / 00:00 |
| D-05 | Timer Details | 狀態 "Running"、"Paused" 或 "Finished" | Details - Running / Paused / Finished | Running / Paused / Finished |
| D-06 | Timer Details | 運行控制 "Pause" | Details - Running | Pause |
| D-07 | Timer Details | 暫停控制 "Resume" | Details - Paused | Resume |
| D-08 | Timer Details | 延長控制 "+1 Minute" | Details - Running / Paused | +1 Minute |
| D-09 | Timer Details | 停止控制 "Stop" | Details - Running / Paused | Stop |
| D-10 | Timer Details | 完成訊息 "Time's up!" | Details - Finished | Time's up! |
| D-11 | Timer Details | 靜音控制 "Silence" | Details - Finished | Silence |
| D-12 | Timer Details | 完成控制 "Done" | Details - Finished | Done |
| D-13 | Timer Details | 停止確認文字 "Stop this timer?" | Details - Stop Dialog | Stop this timer? |
| D-14 | Timer Details | 停止確認取消控制 "Cancel" | Details - Stop Dialog | Cancel |
| D-15 | Timer Details | 停止確認控制 "Stop" | Details - Stop Dialog | Stop |
| H-01 | History | 頁面標題 "History" | History - Empty / Records | History |
| H-02 | History | 清除控制 "Clear All" | History - Empty / Records | Clear All |
| H-03 | History | 歷史紀錄清單 | History - Records | History list |
| H-04 | History | 各紀錄的計時器名稱 | History - Records | Pasta / Soup |
| H-05 | History | 各紀錄的原始時間 | History - Records | 15:00 / 05:00 |
| H-06 | History | 各紀錄的完成時間 | History - Records | 18:42 / 18:20 |
| H-07 | History | 各紀錄的狀態 "Completed" 或 "Stopped" | History - Records | Completed / Stopped |
| H-08 | History | 空白狀態 "No history" | History - Empty | No history |
| H-09 | History | 底部導航 "Timers" 和 "History" | History - Empty / Records | Timers / History |
| H-10 | History | 清除確認文字 "Clear all history?" | History - Clear Dialog | Clear all history? |
| H-11 | History | 清除確認取消控制 "Cancel" | History - Clear Dialog | Cancel |
| H-12 | History | 清除確認控制 "Clear" | History - Clear Dialog | Clear |

## 自檢結論

- 缺少線框圖對應：0
- 重複介面要求 ID：0
- 線框圖額外功能：0
- 所有頁面均分列介面要求與功能要求。
