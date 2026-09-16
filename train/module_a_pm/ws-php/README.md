# PHP Diary API

最小可跑的純 PHP API，使用 JSON 檔案保存資料，不需要資料庫。

## API

### 1. Sign in or Sign up

- `POST /api/users/signin`
- 支援 `application/json`、`x-www-form-urlencoded`、query string

Request example:

```json
{
    "userEmailAddress": "username@email.com",
    "userPassword": "123abc"
}
```

Response example:

```json
{
    "msg": "Sign in successful",
    "data": {
        "auth_token": "XHJ0VF1GJXHQMTP2PVWP6EXZS"
    }
}
```

說明：

- 使用者不存在時會自動註冊
- 使用者存在且密碼正確時會重新簽發 `auth_token`
- 密碼錯誤回傳 `401`

### 2. Get all diaries

- `GET /api/diary`

### 3. Insert new favorite

- `PUT /api/diary/collection`
- 需要 `auth_token`
- 需要 `diary_id`

Request example:

```json
{
    "auth_token": "VS0Z7OR9ZTGYQTTJ4A5RCR4S6",
    "diary_id": "BA23617D-42DA-8C4A-F569-C1915B9B55B1"
}
```

說明：

- 你的規格裡沒有列出 `diary_id`，但收藏特定 diary 時實際上一定需要它，所以這裡已補上
- `auth_token` 可放在 body、query string、`auth_token` header，或 `Authorization: Bearer <token>`

### 4. Get my all favorites

- `GET /api/diary/collection`
- 需要 `auth_token`

Example:

```bash
curl "http://127.0.0.1:8000/api/diary/collection?auth_token=VS0Z7OR9ZTGYQTTJ4A5RCR4S6"
```

## Run

如果本機已安裝 PHP：

```bash
php -S 127.0.0.1:8000 server.php
```

Base URL:

```text
http://127.0.0.1:8000
```

## Data files

- `storage/data/diaries.json`
- `storage/data/users.json`
- `storage/data/favorites.json`
