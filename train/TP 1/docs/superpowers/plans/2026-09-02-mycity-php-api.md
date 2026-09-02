# MyCity Transit Pure PHP API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally runnable pure PHP server that implements exactly the eight APIs in `MYCITY_PHP_API_SPEC.md`.

**Architecture:** A small front controller passes method, URI, headers, and body to `App`, which returns a `Response`. `App` delegates JSON persistence to `FileStore` and authentication to `AuthService`; both mutable data files are protected by exclusive locks. Tests call the application directly for deterministic coverage and also exercise the PHP built-in server for HTTP-level compatibility.

**Tech Stack:** PHP 8.0+, PHP standard library only, JSON files, PHP built-in web server, custom dependency-free PHP test runner.

**Spec:** `docs/superpowers/specs/2026-09-02-mycity-php-api-design.md`

## Global Constraints

- Implement only the eight documented API routes.
- Do not add framework, Composer package, or database dependencies.
- Match documented methods, paths, header name, status codes, response field names, and field types.
- Do not expose source JSON fields beyond the exact documented output fields.
- Store new passwords with `password_hash()` while accepting and upgrading existing plaintext passwords.
- Use cryptographically secure random tokens and exclusive locks for JSON writes.
- Serve files only from `mycity-php-api/data/resources/` after canonical path-boundary validation.
- Keep initial data limited to copies of files already supplied in this workspace.

---

## File Map

- `mycity-php-api/src/Response.php`: response value object and HTTP emitter.
- `mycity-php-api/src/FileStore.php`: locked JSON reads, writes, and locked read-modify-write transactions.
- `mycity-php-api/src/AuthService.php`: signin/signup, legacy password upgrade, token authentication.
- `mycity-php-api/src/App.php`: exact route table, validation, response mapping, sorting, static-file safety, privacy HTML.
- `mycity-php-api/public/index.php`: bootstrap and request dispatch.
- `mycity-php-api/server.php`: PHP built-in server router.
- `mycity-php-api/data/*.json`: copied initial data.
- `mycity-php-api/data/resources/maps/mumbai_base.png`: copied existing Mumbai map image.
- `mycity-php-api/tests/bootstrap.php`: assertions, fixture-copy helpers, and test application factory.
- `mycity-php-api/tests/unit.php`: direct application and service tests.
- `mycity-php-api/tests/http.php`: real HTTP acceptance tests for all eight APIs.
- `mycity-php-api/tests/run.php`: runs both suites and restores mutable data.
- `mycity-php-api/README.md`: local startup, LAN base URL, API table, and test command.

### Task 1: Response and locked JSON storage

**Files:**
- Create: `mycity-php-api/src/Response.php`
- Create: `mycity-php-api/src/FileStore.php`
- Create: `mycity-php-api/tests/bootstrap.php`
- Create: `mycity-php-api/tests/unit.php`

**Interfaces:**
- Produces: `Response::__construct(int $status, string $body, array $headers = [])`, `Response::json(int $status, string $msg, mixed $data): self`, and `Response::send(): void`.
- Produces: `FileStore::__construct(string $dataDirectory)`, `FileStore::read(string $file): mixed`, `FileStore::write(string $file, mixed $data): void`, and `FileStore::update(string $file, callable $mutator): mixed`.

- [ ] **Step 1: Write failing tests for JSON responses and persistence**

```php
<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/Response.php';
require_once __DIR__ . '/../src/FileStore.php';

function assertSameValue(mixed $expected, mixed $actual, string $message): void {
    if ($expected !== $actual) {
        throw new RuntimeException($message . '\nExpected: ' . var_export($expected, true) . '\nActual: ' . var_export($actual, true));
    }
}

$response = Response::json(200, 'Success', ['ok' => true]);
assertSameValue(200, $response->status, 'JSON response status');
assertSameValue('application/json; charset=utf-8', $response->headers['Content-Type'], 'JSON content type');
assertSameValue(['msg' => 'Success', 'data' => ['ok' => true]], json_decode($response->body, true), 'JSON envelope');

$directory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'mycity-store-' . bin2hex(random_bytes(6));
mkdir($directory, 0777, true);
file_put_contents($directory . DIRECTORY_SEPARATOR . 'items.json', "[]\n");
$store = new FileStore($directory);
$store->update('items.json', static function (array $items): array {
    $items[] = ['id' => 'ONE'];
    return $items;
});
assertSameValue([['id' => 'ONE']], $store->read('items.json'), 'Locked update persists valid JSON');
```

- [ ] **Step 2: Run the tests and confirm the missing classes fail**

Run: `php mycity-php-api/tests/unit.php`

Expected: non-zero exit because `Response` and `FileStore` do not exist.

- [ ] **Step 3: Implement the response value object and locked storage**

```php
final class Response
{
    public function __construct(
        public readonly int $status,
        public readonly string $body,
        public readonly array $headers = [],
    ) {}

    public static function json(int $status, string $msg, mixed $data): self
    {
        $body = json_encode(['msg' => $msg, 'data' => $data], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        return new self($status, $body, ['Content-Type' => 'application/json; charset=utf-8']);
    }

    public function send(): void
    {
        http_response_code($this->status);
        foreach ($this->headers as $name => $value) {
            header($name . ': ' . $value);
        }
        echo $this->body;
    }
}
```

`FileStore::update()` must open with `c+`, acquire `flock($handle, LOCK_EX)`, decode the current contents, invoke the mutator, encode the returned value before truncating, rewind, truncate, write all bytes, flush, unlock, and close in `finally`. `read()` accepts shared reads, and every method rejects file names containing `/`, `\\`, or `..`.

- [ ] **Step 4: Run the storage tests**

Run: `php mycity-php-api/tests/unit.php`

Expected: exit code 0 and a success summary.

- [ ] **Step 5: Commit Task 1**

```bash
git add "train/TP 1/mycity-php-api/src/Response.php" "train/TP 1/mycity-php-api/src/FileStore.php" "train/TP 1/mycity-php-api/tests/bootstrap.php" "train/TP 1/mycity-php-api/tests/unit.php"
git commit -m "feat: add MyCity response and JSON storage"
```

### Task 2: Authentication and signin/signup

**Files:**
- Create: `mycity-php-api/src/AuthService.php`
- Create: `mycity-php-api/src/App.php`
- Modify: `mycity-php-api/tests/bootstrap.php`
- Modify: `mycity-php-api/tests/unit.php`

**Interfaces:**
- Consumes: `FileStore::read()` and `FileStore::update()`; `Response::json()`.
- Produces: `AuthService::signIn(string $email, string $password): array{created: bool, auth_token: string}`.
- Produces: `AuthService::userForToken(?string $token): ?array`.
- Produces: `App::__construct(FileStore $store, string $resourceDirectory)` and `App::handle(string $method, string $uri, array $headers, string $body): Response`.

- [ ] **Step 1: Add failing authentication tests**

```php
$existing = $app->handle('POST', '/api/users/signin', ['content-type' => 'application/json'], json_encode([
    'userEmailAddress' => 'ANKIT@example.com',
    'userPassword' => 'ankit123',
]));
assertSameValue(200, $existing->status, 'Existing user signs in case-insensitively');
assertSameValue(['auth_token'], array_keys(json_decode($existing->body, true)['data']), 'Signin exposes only auth_token');

$created = $app->handle('POST', '/api/users/signin', ['content-type' => 'application/json'], json_encode([
    'userEmailAddress' => 'new@example.com',
    'userPassword' => 'newpass1',
]));
assertSameValue(201, $created->status, 'New user is created');

assertSameValue(400, $app->handle('POST', '/api/users/signin', [], '{')->status, 'Malformed JSON');
assertSameValue(400, $app->handle('POST', '/api/users/signin', [], json_encode(['userEmailAddress' => 'bad', 'userPassword' => 'pass123']))->status, 'Invalid email');
assertSameValue(400, $app->handle('POST', '/api/users/signin', [], json_encode(['userEmailAddress' => 'a@b.com', 'userPassword' => 'letters']))->status, 'Password requires letters and digits');
assertSameValue(401, $app->handle('POST', '/api/users/signin', [], json_encode(['userEmailAddress' => 'ankit@example.com', 'userPassword' => 'wrong123']))->status, 'Wrong password');
```

- [ ] **Step 2: Run only the authentication group and verify failure**

Run: `php mycity-php-api/tests/unit.php auth`

Expected: FAIL because `AuthService` and `App` are missing.

- [ ] **Step 3: Implement exact signin behavior**

`App` must reject any non-object JSON body and validate that both request fields are strings. It must use `filter_var($email, FILTER_VALIDATE_EMAIL)`, require a password length of at least six bytes, `/[A-Za-z]/`, and `/\d/`. `AuthService` searches with `strcasecmp()`, validates `password_hash` via `password_verify()`, accepts legacy `password` via `hash_equals()`, and upgrades legacy data inside `FileStore::update()`. A new user uses `USR-` plus an unused zero-padded numeric suffix and `strtoupper(bin2hex(random_bytes(10)))` for the token; its stored record has `password_hash` but no plaintext `password`.

```php
public function handle(string $method, string $uri, array $headers, string $body): Response
{
    $path = rawurldecode(parse_url($uri, PHP_URL_PATH) ?: '/');
    if ($path === '/api/users/signin') {
        if ($method !== 'POST') {
            return Response::json(405, 'Method Not Allowed', null);
        }
        return $this->signIn($body);
    }
    return Response::json(404, 'Not Found', null);
}
```

- [ ] **Step 4: Run authentication tests**

Run: `php mycity-php-api/tests/unit.php auth`

Expected: all authentication cases pass, and rereading `users.json` confirms the new hash and legacy hash upgrade.

- [ ] **Step 5: Commit Task 2**

```bash
git add "train/TP 1/mycity-php-api/src/AuthService.php" "train/TP 1/mycity-php-api/src/App.php" "train/TP 1/mycity-php-api/tests"
git commit -m "feat: implement MyCity signin API"
```

### Task 3: Routes, weather, and alert read APIs

**Files:**
- Modify: `mycity-php-api/src/App.php`
- Modify: `mycity-php-api/tests/unit.php`

**Interfaces:**
- Consumes: `FileStore::read(string $file): mixed` and `Response::json()`.
- Extends: `App::handle()` with `GET /api/transit/routes`, `GET /api/weather/current`, and `GET /api/alerts`.

- [ ] **Step 1: Add failing exact-shape and ordering tests**

```php
$routes = decodeData($app->handle('GET', '/api/transit/routes', [], ''));
assertSameValue(['route_id', 'route_name', 'route_type', 'status', 'next_departure', 'stops'], array_keys($routes[0]), 'Route fields are exact');
assertSameValue(['Andheri Bus Stand', 'Vile Parle Station', 'Santacruz Depot', 'Khar Road Junction', 'Bandra Station East'], $routes[0]['stops'], 'Stops follow sequence');
assertSameValue('2025-04-14 09:45:00', $routes[0]['next_departure'], 'First departure is singular');
assertSameValue(null, $routes[3]['next_departure'], 'Empty departures become null');

$weather = decodeData($app->handle('GET', '/api/weather/current', [], ''));
assertSameValue(['city', 'temperature_c', 'condition', 'humidity_pct', 'wind_kmh'], array_keys($weather), 'Weather fields are exact');
assertSameValue(true, is_int($weather['temperature_c']) || is_float($weather['temperature_c']), 'Temperature is numeric');

$alerts = decodeData($app->handle('GET', '/api/alerts', [], ''));
assertSameValue(['alert_id', 'title', 'affected_routes', 'status', 'severity', 'description', 'created_at'], array_keys($alerts[0]), 'Alert fields are exact');
assertSameValue(['ALT-001', 'ALT-003'], array_column(array_slice($alerts, 0, 2), 'alert_id'), 'High alerts are newest first');
```

- [ ] **Step 2: Run the read-API tests and verify failure**

Run: `php mycity-php-api/tests/unit.php reads`

Expected: FAIL with `404` responses.

- [ ] **Step 3: Implement only documented transformations**

For routes, copy each `stops` array, sort using `($a['sequence'] ?? 0) <=> ($b['sequence'] ?? 0)`, map to `stop_name`, and build a new six-key array. For weather, build a new five-key object and reject non-numeric values as storage errors. For alerts, sort with severity ranks `high => 3`, `medium => 2`, `low => 1`; if ranks match, compare timestamps descending, then build seven-key arrays. Empty input arrays return successful empty data arrays.

- [ ] **Step 4: Run read-API tests**

Run: `php mycity-php-api/tests/unit.php reads`

Expected: all route, weather, alert, empty-array, and exact-key tests pass.

- [ ] **Step 5: Commit Task 3**

```bash
git add "train/TP 1/mycity-php-api/src/App.php" "train/TP 1/mycity-php-api/tests/unit.php"
git commit -m "feat: add MyCity public data APIs"
```

### Task 4: Save route and list the authenticated user's saves

**Files:**
- Modify: `mycity-php-api/src/App.php`
- Modify: `mycity-php-api/tests/unit.php`

**Interfaces:**
- Consumes: `AuthService::userForToken()`, `FileStore::read()`, and `FileStore::update()`.
- Extends: `App::handle()` with `PUT /api/routes/save` and `GET /api/routes/saved`.

- [ ] **Step 1: Add failing saved-route tests**

```php
assertSameValue(401, $app->handle('PUT', '/api/routes/save', [], json_encode(['route_id' => 'RTE-RAPID-003']))->status, 'Save requires token');
assertSameValue(400, $app->handle('PUT', '/api/routes/save', ['auth_token' => $token], '{}')->status, 'Save requires route_id');
assertSameValue(404, $app->handle('PUT', '/api/routes/save', ['auth_token' => $token], json_encode(['route_id' => 'MISSING']))->status, 'Route must exist');

$saved = $app->handle('PUT', '/api/routes/save', ['auth_token' => $token], json_encode(['route_id' => 'RTE-RAPID-003']));
assertSameValue(200, $saved->status, 'Route saved');
assertSameValue(['route_id', 'saved_at'], array_keys(decodeData($saved)), 'Save response fields are exact');
assertSameValue(409, $app->handle('PUT', '/api/routes/save', ['auth_token' => $token], json_encode(['route_id' => 'RTE-RAPID-003']))->status, 'Duplicate rejected');

$mine = decodeData($app->handle('GET', '/api/routes/saved', ['auth_token' => $token], ''));
assertSameValue(['route_id', 'route_name', 'saved_at'], array_keys($mine[0]), 'Saved-list fields are exact');
assertSameValue('RTE-RAPID-003', $mine[0]['route_id'], 'Newest saved route first');
assertSameValue(false, in_array('RTE-BUS-022', array_column($mine, 'route_id'), true), 'Another user data is excluded for a fresh fixture user');
```

- [ ] **Step 2: Run saved-route tests and verify failure**

Run: `php mycity-php-api/tests/unit.php saved`

Expected: FAIL with `404` responses.

- [ ] **Step 3: Implement authorization and transactional duplicate checking**

Normalize request header names to lowercase once. Return `401` if `auth_token` is absent, blank, or unknown. Validate `route_id` as a non-empty string, find the route before writing, and use one `FileStore::update('saved_routes.json', ...)` transaction to reject a duplicate and append `{user_id, route_id, saved_at}`. The successful response contains only `route_id` and `saved_at`. Listing joins current saved records to `routes.json` by `route_id`, excludes other users, sorts `saved_at` descending, and emits only the three documented fields.

- [ ] **Step 4: Run saved-route and persistence tests**

Run: `php mycity-php-api/tests/unit.php saved`

Expected: authentication, route validation, duplicate conflict, exact fields, user isolation, ordering, and reread persistence all pass.

- [ ] **Step 5: Commit Task 4**

```bash
git add "train/TP 1/mycity-php-api/src/App.php" "train/TP 1/mycity-php-api/tests/unit.php"
git commit -m "feat: add authenticated saved route APIs"
```

### Task 5: Privacy HTML, static files, routing, and HTTP bootstrap

**Files:**
- Modify: `mycity-php-api/src/App.php`
- Create: `mycity-php-api/public/index.php`
- Create: `mycity-php-api/server.php`
- Modify: `mycity-php-api/tests/unit.php`

**Interfaces:**
- Extends: `App::handle()` with `GET /api/privacy-policy` and safe `GET /api/{relative-path}` fallback.
- Produces: HTTP bootstrap that passes `$_SERVER['REQUEST_METHOD']`, `$_SERVER['REQUEST_URI']`, `getallheaders()`, and `php://input` to `App`.

- [ ] **Step 1: Add failing privacy, static-file, and method tests**

```php
$privacy = $app->handle('GET', '/api/privacy-policy', [], '');
assertSameValue(200, $privacy->status, 'Privacy page exists');
assertSameValue('text/html; charset=utf-8', $privacy->headers['Content-Type'], 'Privacy HTML type');
assertSameValue(true, str_contains($privacy->body, 'Privacy Policy'), 'Privacy title');
assertSameValue(true, str_contains($privacy->body, 'id="closeBtn"'), 'Close button');

$map = $app->handle('GET', '/api/resources/maps/mumbai_base.png', [], '');
assertSameValue(200, $map->status, 'Map file served');
assertSameValue('image/png', $map->headers['Content-Type'], 'PNG type');
assertSameValue("\x89PNG", substr($map->body, 0, 4), 'Original PNG bytes');

assertSameValue(404, $app->handle('GET', '/api/resources/maps/missing.png', [], '')->status, 'Missing file');
assertSameValue(404, $app->handle('GET', '/api/%2e%2e/server.php', [], '')->status, 'Encoded traversal');
assertSameValue(405, $app->handle('POST', '/api/alerts', [], '')->status, 'Known path wrong method');
assertSameValue(404, $app->handle('GET', '/api/not-a-route', [], '')->status, 'Unknown path');
```

- [ ] **Step 2: Run privacy/static/routing tests and verify failure**

Run: `php mycity-php-api/tests/unit.php transport`

Expected: FAIL because the handlers and bootstraps are missing.

- [ ] **Step 3: Implement exact HTML and safe file handling**

Route all seven concrete paths before the static fallback. Static handling accepts only a decoded path beginning `/api/resources/`, rejects NUL, `..` path segments, a leading slash after `resources/`, and `^[A-Za-z]:`; obtains the public root and candidate via `realpath()`, and requires the candidate prefix to equal `$root . DIRECTORY_SEPARATOR`. Return `404` for every invalid case. Map `png`, `jpg/jpeg`, `gif`, `svg`, `json`, `mp3`, `webp`, and `txt` to their correct MIME types, otherwise `application/octet-stream`.

The privacy page is a complete HTML document with `<h1>Privacy Policy</h1>`, meaningful privacy terms, and `<button id="closeBtn" type="button" onclick="window.close()">Close</button>`. No extra API data is embedded.

- [ ] **Step 4: Implement bootstraps and run syntax plus unit tests**

```php
// public/index.php
$dataDirectory = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data';
$app = new App(new FileStore($dataDirectory), $dataDirectory . DIRECTORY_SEPARATOR . 'resources');
$response = $app->handle(
    $_SERVER['REQUEST_METHOD'] ?? 'GET',
    $_SERVER['REQUEST_URI'] ?? '/',
    function_exists('getallheaders') ? getallheaders() : [],
    file_get_contents('php://input') ?: '',
);
$response->send();
```

`server.php` must require `public/index.php` for every request so the router controls all paths.

Run: `php -l mycity-php-api/src/App.php; php -l mycity-php-api/public/index.php; php -l mycity-php-api/server.php; php mycity-php-api/tests/unit.php`

Expected: every syntax check reports no errors and all unit groups pass.

- [ ] **Step 5: Commit Task 5**

```bash
git add "train/TP 1/mycity-php-api/src/App.php" "train/TP 1/mycity-php-api/public/index.php" "train/TP 1/mycity-php-api/server.php" "train/TP 1/mycity-php-api/tests/unit.php"
git commit -m "feat: complete MyCity HTTP routes and resources"
```

### Task 6: Initial data, complete HTTP acceptance suite, and local instructions

**Files:**
- Create: `mycity-php-api/data/users.json`
- Create: `mycity-php-api/data/routes.json`
- Create: `mycity-php-api/data/weather.json`
- Create: `mycity-php-api/data/alerts.json`
- Create: `mycity-php-api/data/saved_routes.json`
- Create: `mycity-php-api/data/resources.json`
- Create: `mycity-php-api/data/resources/maps/mumbai_base.png`
- Create: `mycity-php-api/tests/http.php`
- Create: `mycity-php-api/tests/run.php`
- Create: `mycity-php-api/README.md`

**Interfaces:**
- Consumes: all eight application routes through `http://127.0.0.1:<test-port>`.
- Produces: `php tests/run.php` as the single complete verification command.

- [ ] **Step 1: Copy only supplied initial data and the supplied Mumbai map**

Copy the six JSON files byte-for-byte from `mycity-api/data/` to `mycity-php-api/data/`. Copy `resources/maps/Mumbai Map.png` to `mycity-php-api/data/resources/maps/mumbai_base.png`. Verify the image starts with the PNG signature and do not generate any additional records or assets.

- [ ] **Step 2: Write the failing real-HTTP acceptance runner**

`tests/run.php` first copies `users.json` and `saved_routes.json` to temporary backups, starts `php -S 127.0.0.1:39081 server.php` with `proc_open()`, waits up to five seconds for the port, runs `tests/http.php`, stops the process in `finally`, and restores both mutable files.

`tests/http.php` must issue all of these checks with `file_get_contents()` stream contexts:

```php
request('POST', '/api/users/signin', ['Content-Type: application/json'], $existingCredentials, 200);
request('POST', '/api/users/signin', ['Content-Type: application/json'], $newCredentials, 201);
request('GET', '/api/transit/routes', [], null, 200);
request('GET', '/api/weather/current', [], null, 200);
request('PUT', '/api/routes/save', ['Content-Type: application/json', 'auth_token: ' . $newToken], json_encode(['route_id' => 'RTE-BUS-022']), 200);
request('PUT', '/api/routes/save', ['Content-Type: application/json', 'auth_token: ' . $newToken], json_encode(['route_id' => 'RTE-BUS-022']), 409);
request('GET', '/api/alerts', [], null, 200);
request('GET', '/api/resources/maps/mumbai_base.png', [], null, 200, 'image/png');
request('GET', '/api/privacy-policy', [], null, 200, 'text/html; charset=utf-8');
request('GET', '/api/routes/saved', ['auth_token: ' . $newToken], null, 200);
request('GET', '/api/%2e%2e/server.php', [], null, 404);
request('POST', '/api/alerts', [], null, 405);
request('GET', '/api/unknown', [], null, 404);
```

For every JSON success, assert the exact `msg` value and exact key sets specified in `MYCITY_PHP_API_SPEC.md`. For every JSON error, assert `data === null`. Recreate the `App` in the unit suite after writes to demonstrate disk persistence rather than in-memory state.

- [ ] **Step 3: Run the suite and confirm any missing integration behavior fails**

Run from `mycity-php-api/`: `php tests/run.php`

Expected before final fixes: at least one failing HTTP assertion identifying the exact integration mismatch.

- [ ] **Step 4: Make the smallest integration fixes and write README**

README must include:

```text
Requirements: PHP 8.0+
Start: php -S 0.0.0.0:3000 server.php
Local base URL: http://127.0.0.1:3000
LAN base URL: http://<computer-LAN-IP>:3000
Test: php tests/run.php
```

It must list exactly the eight methods and paths from the source specification, explain that `auth_token` is a request header for APIs 4 and 8, and mention firewall access for TCP port 3000. Do not document an undocumented endpoint.

- [ ] **Step 5: Run full verification**

Run from `mycity-php-api/`:

```bash
php -l server.php
php -l public/index.php
php -l src/Response.php
php -l src/FileStore.php
php -l src/AuthService.php
php -l src/App.php
php tests/run.php
```

Expected: every syntax check reports `No syntax errors detected`, all unit tests pass, all HTTP acceptance tests pass, and the test runner restores initial mutable JSON data.

- [ ] **Step 6: Commit Task 6**

```bash
git add "train/TP 1/mycity-php-api"
git commit -m "test: verify complete MyCity PHP API server"
```

