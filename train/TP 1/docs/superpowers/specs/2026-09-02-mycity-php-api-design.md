# MyCity Transit Pure PHP API Design

## Goal

Build a locally runnable PHP 8.0+ API server in `mycity-php-api/` that implements exactly the eight APIs defined in `MYCITY_PHP_API_SPEC.md`. The implementation must use no framework, Composer package, or database. Existing JSON files under `mycity-api/data/` will be copied as the initial data set, while the original directory remains unchanged.

## Strict Compatibility Boundary

- Implement only the eight documented API routes.
- Match every documented HTTP method, path, request field, `auth_token` header, status code, response envelope, output field name, and output type.
- Do not expose extra fields from source JSON files.
- Do not add an API for `resources.json` or any other undocumented route.
- Do not add generated sample records beyond the copied initial JSON data. New users and saved routes are created only through the documented APIs.
- Use the specified route, weather, alert, and saved-route conversion and sorting rules.

## Directory Structure

```text
mycity-php-api/
├── public/
│   └── index.php
├── src/
│   ├── App.php
│   ├── FileStore.php
│   ├── AuthService.php
│   └── Response.php
├── data/
│   ├── users.json
│   ├── routes.json
│   ├── weather.json
│   ├── alerts.json
│   ├── saved_routes.json
│   ├── resources.json
│   └── resources/
├── tests/
├── server.php
└── README.md
```

## Components

### Request entry points

`server.php` supports `php -S 0.0.0.0:3000 server.php`. It forwards API requests to `public/index.php`. `public/index.php` loads the application classes and dispatches the request.

### App

`App.php` matches the request method and path, invokes the required service operations, and maps stored data into the exact documented response shape. It contains the eight documented routes and no additional application routes.

### FileStore

`FileStore.php` reads and decodes JSON, validates that the decoded top-level structure is usable, encodes updates before writing, and performs writes with an exclusive lock. Failures become safe internal errors without exposing filesystem paths.

### AuthService

`AuthService.php` performs case-insensitive email lookup, validates existing plaintext passwords for compatibility, supports password hashes, upgrades a plaintext password to a hash after successful login, creates unique user IDs and cryptographically secure tokens, and resolves users from the `auth_token` request header. Passwords and tokens are never included in errors or unintended responses.

### Response

`Response.php` sends JSON, HTML, and binary file responses with the required status code and content type. JSON responses always use the documented `msg` and `data` envelope.

## API Behavior

1. `POST /api/users/signin`: validate email and password, sign in an existing user or persist a new user, and return only `auth_token`.
2. `GET /api/transit/routes`: return only the six documented route fields; sort stops by `sequence`, map stops to names, and map the first `next_departures` value to `next_departure` or `null`.
3. `GET /api/weather/current`: return only the five documented weather fields, preserving numeric types.
4. `PUT /api/routes/save`: authenticate by the `auth_token` header, validate the route, reject duplicates, persist the saved route, and return only `route_id` and `saved_at`.
5. `GET /api/alerts`: return only the seven documented fields, sorted by severity `high`, `medium`, `low`, then by newest `created_at`.
6. `GET /api/{relative-path}`: return an existing file under `data/resources/` as binary data with the correct MIME type after strict path validation.
7. `GET /api/privacy-policy`: return a complete HTML privacy policy with a clear `Privacy Policy` title and a button whose ID is `closeBtn`.
8. `GET /api/routes/saved`: authenticate by the `auth_token` header, return only the current user's saved routes, sorted by newest `saved_at`, exposing only `route_id`, `route_name`, and `saved_at`.

Known paths requested with an unsupported method return `405`. Unknown API paths return `404`.

## Validation and Errors

Invalid JSON, missing required fields, incorrect field types, invalid email, and invalid password format return `400`. Missing or invalid authentication and an existing user's wrong password return `401`. Missing routes and invalid or missing static files return `404`. Duplicate saved routes return `409`. Unexpected storage failures return `500` without a path, stack trace, password, or token.

Error responses use:

```json
{
  "msg": "Error description",
  "data": null
}
```

## Static Resource Security

The relative path is URL-decoded and rejected if it contains traversal segments, an absolute path, or a Windows drive prefix. The candidate must exist, and its `realpath()` must stay within the real public resource directory. Invalid paths and missing files both return the same `404` response. MIME types are selected from the actual file extension, with a safe binary fallback.

## Data Persistence

Initial JSON is copied from `mycity-api/data/`. Runtime writes affect only `mycity-php-api/data/users.json` and `mycity-php-api/data/saved_routes.json`. Data is encoded completely before a locked write. API timestamps use `YYYY-MM-DD HH:MM:SS`.

## Testing

Tests use temporary copies of mutable JSON data so the delivered initial data remains stable. Unit-level tests cover validation, authentication, data mapping, ordering, duplicate detection, isolation between users, locked persistence, and static path validation. HTTP acceptance tests start the PHP built-in server on a local test port and verify all eight APIs, methods, headers, response content types, status codes, exact exposed fields, persistence across requests, unknown routes, and path traversal rejection.

## Completion Criteria

The server is complete only when all eight APIs are implemented, the complete acceptance suite passes, PHP syntax checks pass, and the README gives the exact local startup command and base URL guidance from the source specification.
