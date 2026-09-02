# MyCity Transit PHP API

依照 `MYCITY_PHP_API_SPEC.md` 建立的純 PHP API 伺服器。使用 PHP 8.0 以上版本，不需要框架、Composer 或資料庫。

## 本機啟動

在 `mycity-php-api` 資料夾執行：

```bash
php -S 0.0.0.0:3000 server.php
```

本機 Base URL：

```text
http://127.0.0.1:3000
```

同一區域網路內的手機或其他裝置，請使用電腦的實際區域網路 IP：

```text
http://<電腦區域網路IP>:3000
```

`0.0.0.0` 只用於伺服器監聽，不是客戶端連線網址。若其他裝置無法連線，請確認兩台裝置位於同一網路，並允許防火牆接收 TCP 3000 連線。

## API

| 方法 | 路徑 | 驗證 |
| --- | --- | --- |
| `POST` | `/api/users/signin` | 不需要 |
| `GET` | `/api/transit/routes` | 不需要 |
| `GET` | `/api/weather/current` | 不需要 |
| `PUT` | `/api/routes/save` | request header：`auth_token` |
| `GET` | `/api/alerts` | 不需要 |
| `GET` | `/api/{relative-path}` | 不需要 |
| `GET` | `/api/privacy-policy` | 不需要 |
| `GET` | `/api/routes/saved` | request header：`auth_token` |

請求與回應欄位請以專案根目錄的 `MYCITY_PHP_API_SPEC.md` 為準。

## 測試

```bash
php tests/run.php
```

測試會暫時寫入使用者與收藏資料，結束後自動還原初始 JSON。

