# WS-MAD Pure PHP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dependency-free PHP 8.0+ implementation of the supplied WS-MAD API with local image resources and JSON-persistent video comments.

**Architecture:** PHP's built-in server forwards requests through `server.php` to a small application object. `App` returns testable `Response` values, `FileStore` owns locked JSON access, and `Media` owns safe file resolution; the HTTP entry point only translates globals to and from those objects.

**Tech Stack:** PHP 8.0+, JSON files, PHP built-in web server, dependency-free PHP test runner, PowerShell HTTP integration test.

**Spec:** `docs/superpowers/specs/2026-09-03-ws-mad-php-server-design.md`

## Global Constraints

- Use PHP 8.0 or above with no framework, Composer dependency, or database.
- Leave the existing `server.py` and unrelated user files unchanged.
- Listen with `php -S 0.0.0.0:3000 server.php`.
- Preserve added comments in JSON using `LOCK_EX`; use `LOCK_SH` for reads.
- Encode JSON with `JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES`.
- Implement only the documented JSON endpoints and the image resources referenced by their responses.
- Generate resource URLs from the validated current request host.
- Do not claim LAN-device verification unless it is performed from another device.

## File map

- `server.php`: PHP built-in-server router.
- `public/index.php`: HTTP adapter and application bootstrap.
- `src/Response.php`: response value and HTTP emission.
- `src/FileStore.php`: locked JSON reads and appends.
- `src/Media.php`: allowlisted, canonical media-path resolution.
- `src/App.php`: route matching, validation, and response construction.
- `storage/photos.json`: 18 photo metadata records split over pages 0 and 1.
- `storage/skill-types.json`: the two documented skill groups.
- `storage/skills.json`: the eight documented skill details.
- `storage/videos.json`: the 20 expanded videos with the corrected first UUID.
- `storage/comments.json`: the 20 expanded initial comments.
- `public/media/photos/*.jpg`: the 18 allowed photo resources.
- `public/media/skills_images/*.jpg`: the eight allowed skill-image resources.
- `tests/bootstrap.php`: autoloading, assertions, temporary-fixture helpers, and test registration.
- `tests/run.php`: behavior tests for application, persistence, and media safety.
- `tests/integration.ps1`: real-server HTTP contract tests and fixture restoration.
- `README.md`: operation, API, persistence, assumptions, and LAN instructions.

---

### Task 1: Test harness, JSON storage, and seed fixtures

**Files:**
- Create: `tests/bootstrap.php`
- Create: `tests/run.php`
- Create: `src/FileStore.php`
- Create: `storage/photos.json`
- Create: `storage/skill-types.json`
- Create: `storage/skills.json`
- Create: `storage/videos.json`
- Create: `storage/comments.json`
- Create: `public/media/photos/No_00000.jpg` through `No_00017.jpg`
- Create: `public/media/skills_images/0000.jpg`, `0001.jpg`, `0002.jpg`, `0003.jpg`, `0004.jpg`, `0005.jpg`, `1000.jpg`, and `1001.jpg`
- Source assets: `PM/media-files/banner/0.jpg`, `1.jpg`, and `2.jpg`

**Interfaces:**
- Consumes: committed Postman examples and the literal expanded records in `server.py`.
- Produces: `FileStore::__construct(string $root)`, `FileStore::read(string $relativePath): array`, and `FileStore::append(string $relativePath, array $record): array`.

- [ ] **Step 1: Create the dependency-free test harness and failing storage tests**

Use this registration API in `tests/bootstrap.php`:

```php
<?php
declare(strict_types=1);

spl_autoload_register(static function (string $class): void {
    $path = dirname(__DIR__) . '/src/' . $class . '.php';
    if (is_file($path)) {
        require_once $path;
    }
});

$tests = [];

function test(string $name, callable $callback): void
{
    global $tests;
    $tests[$name] = $callback;
}

function assertSameValue(mixed $expected, mixed $actual, string $message = ''): void
{
    if ($expected !== $actual) {
        throw new RuntimeException($message !== '' ? $message : 'Expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
    }
}

function assertTrueValue(bool $actual, string $message = ''): void
{
    assertSameValue(true, $actual, $message);
}

function temporaryDirectory(): string
{
    $path = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ws-mad-' . bin2hex(random_bytes(6));
    if (!mkdir($path, 0777, true) && !is_dir($path)) {
        throw new RuntimeException('Unable to create temporary directory.');
    }
    return $path;
}

function runRegisteredTests(): void
{
    global $tests;
    $failed = 0;
    foreach ($tests as $name => $callback) {
        try {
            $callback();
            echo "PASS {$name}\n";
        } catch (Throwable $error) {
            $failed++;
            fwrite(STDERR, "FAIL {$name}: {$error->getMessage()}\n");
        }
    }
    echo count($tests) . " tests, {$failed} failures\n";
    exit($failed === 0 ? 0 : 1);
}
```

Start `tests/run.php` with tests that instantiate `FileStore`, read a JSON array, append a record, recreate `FileStore`, and verify the record remains. Add fixture assertions for 18 photos, 2 skill groups, 8 skills, 20 videos, 20 comments, unique video UUIDs, and every comment referencing a video UUID.

- [ ] **Step 2: Run the storage tests and verify the expected failure**

Run: `php tests/run.php`

Expected: FAIL because class `FileStore` and the storage fixtures do not exist.

- [ ] **Step 3: Implement locked JSON storage**

Implement `src/FileStore.php` with this shape:

```php
<?php
declare(strict_types=1);

final class FileStore
{
    public function __construct(private string $root) {}

    public function read(string $relativePath): array
    {
        $handle = $this->open($relativePath, 'rb');
        try {
            if (!flock($handle, LOCK_SH)) {
                throw new RuntimeException('Unable to lock storage.');
            }
            $contents = stream_get_contents($handle);
            $data = json_decode($contents === false ? '' : $contents, true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($data) || ($data !== [] && array_keys($data) !== range(0, count($data) - 1))) {
                throw new RuntimeException('Storage must contain a JSON array.');
            }
            return $data;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    public function append(string $relativePath, array $record): array
    {
        $handle = $this->open($relativePath, 'c+b');
        try {
            if (!flock($handle, LOCK_EX)) {
                throw new RuntimeException('Unable to lock storage.');
            }
            rewind($handle);
            $contents = stream_get_contents($handle);
            $data = json_decode($contents === false ? '' : $contents, true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($data) || ($data !== [] && array_keys($data) !== range(0, count($data) - 1))) {
                throw new RuntimeException('Storage must contain a JSON array.');
            }
            $data[] = $record;
            $encoded = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
            rewind($handle);
            if (!ftruncate($handle, 0) || fwrite($handle, $encoded) === false || !fflush($handle)) {
                throw new RuntimeException('Unable to write storage.');
            }
            return $record;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    private function open(string $relativePath, string $mode)
    {
        if ($relativePath === '' || str_contains($relativePath, '..') || str_contains($relativePath, '/') || str_contains($relativePath, '\\')) {
            throw new InvalidArgumentException('Invalid storage name.');
        }
        $handle = @fopen($this->root . DIRECTORY_SEPARATOR . $relativePath, $mode);
        if ($handle === false) {
            throw new RuntimeException('Unable to open storage.');
        }
        return $handle;
    }
}
```

Create the five JSON arrays. Preserve the exact two Postman skill groups. Build the eight skill details from those names, using the exact Postman introduction for `1000` and the existing generic introductions for the others. Migrate the 20 videos and 20 comments literally from `server.py`, then make only these compatibility corrections:

```text
videos[0].uuid = 2D6A33E7-AE3C-FCFA-5AF1-249C71C1AC57
videos[0].url = http://192.168.0.199:8080/apivideo/ws_welcome.mp4
videos[0].length = 134468
comments[0].videoUUID = 2D6A33E7-AE3C-FCFA-5AF1-249C71C1AC57
```

Create photo page 0 with the exact Postman records `No_00009.jpg` through `No_00017.jpg`. Create page 1 with `No_00000.jpg` through `No_00008.jpg`, using visit-count strings `300`, `311`, `322`, `333`, `344`, `355`, `366`, `377`, `388` and heat strings `1000`, `1200`, `1400`, `1600`, `1800`, `2000`, `2200`, `2400`, `2600`.

Copy banner `0.jpg`, `1.jpg`, and `2.jpg` in rotation to the 18 photo filenames and eight skill filenames. This is a mechanical binary copy; do not alter the source banners.

- [ ] **Step 4: Run the storage and fixture tests**

Run: `php tests/run.php`

Expected: all Task 1 tests pass with zero failures.

- [ ] **Step 5: Commit the storage foundation**

```powershell
git add train/2022_module_a/tests train/2022_module_a/src/FileStore.php train/2022_module_a/storage train/2022_module_a/public/media
git commit -m "feat: add WS-MAD JSON storage and fixtures"
```

---

### Task 2: Response object and base route handling

**Files:**
- Create: `src/Response.php`
- Create: `src/App.php`
- Modify: `tests/run.php`

**Interfaces:**
- Consumes: `FileStore` from Task 1.
- Produces: `Response::json(int $status, array $payload, array $headers = []): Response`, `Response::binary(int $status, string $body, string $contentType): Response`, getters `status(): int`, `headers(): array`, `body(): string`, `App::__construct(FileStore $store, Media $media, string $photoRoot, string $skillImageRoot)`, and `App::handle(string $method, string $uri, array $headers = [], array $form = [], string $rawBody = '', array $server = []): Response`.

- [ ] **Step 1: Add failing tests for JSON encoding, unknown routes, and method rejection**

Add tests equivalent to:

```php
test('json response preserves unicode and slashes', function (): void {
    $response = Response::json(200, ['url' => 'http://host/路徑']);
    assertSameValue(200, $response->status());
    assertSameValue('application/json;charset=UTF-8', $response->headers()['Content-Type']);
    assertSameValue('{"url":"http://host/路徑"}', $response->body());
});

test('unknown route returns 404 envelope', function (): void {
    $app = testApp();
    $response = $app->handle('GET', '/api/missing');
    assertSameValue(404, $response->status());
    assertSameValue(['code' => 404, 'msg' => 'Not Found', 'data' => null], json_decode($response->body(), true));
});

test('known route rejects unsupported method', function (): void {
    $response = testApp()->handle('DELETE', '/api/video');
    assertSameValue(405, $response->status());
    assertSameValue('GET', $response->headers()['Allow']);
});

test('storage failures return a generic 500 response', function (): void {
    $root = temporaryDirectory();
    file_put_contents($root . DIRECTORY_SEPARATOR . 'videos.json', '{broken');
    $response = testApp($root)->handle('GET', '/api/video');
    assertSameValue(500, $response->status());
    assertSameValue(['code' => 500, 'msg' => 'Internal Server Error', 'data' => null], json_decode($response->body(), true));
    assertTrueValue(!str_contains($response->body(), $root));
});
```

Define `testApp(?string $storageRoot = null, ?string $mediaRoot = null): App` in `tests/bootstrap.php`. It constructs `FileStore` from the supplied storage root or committed `storage/`, creates `Media`, and passes photo and skill-image directories below the supplied media root or committed `public/media/` to `App`.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `php tests/run.php`

Expected: FAIL because `Response` and `App` do not exist.

- [ ] **Step 3: Implement Response and the route table skeleton**

`Response` stores encoded bytes, not an unencoded payload. `Response::json()` must call:

```php
json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)
```

`App` receives `FileStore`, storage root filenames, and both media roots in its constructor. Start `handle()` with an exact known-route map:

```php
$allowed = [
    '/api/image/photos' => ['POST'],
    '/api/skills-types' => ['GET'],
    '/api/video' => ['GET'],
    '/api/video/comment' => ['GET', 'POST'],
];
```

Treat `/api/skills/<single-segment-id>`, `/api/image/photos/<single-segment-name>`, and `/api/image/skills_images/<single-segment-name>` as known GET route patterns. Return 405 before endpoint dispatch when the path is known but the method is not in its allowlist. Return the 404 envelope for every other path.

Wrap endpoint dispatch in one top-level `try/catch (Throwable $error)`. Log only `WS-MAD request failed: ` plus the exception message through `error_log()`, then return the generic 500 envelope without exposing a path, trace, or fixture contents.

- [ ] **Step 4: Run the suite and confirm the base behavior passes**

Run: `php tests/run.php`

Expected: all Task 1 and Task 2 tests pass.

- [ ] **Step 5: Commit the response and routing base**

```powershell
git add train/2022_module_a/src/App.php train/2022_module_a/src/Response.php train/2022_module_a/tests
git commit -m "feat: add WS-MAD response and routing core"
```

---

### Task 3: Photo metadata, paging, and safe media delivery

**Files:**
- Create: `src/Media.php`
- Modify: `src/App.php`
- Modify: `tests/run.php`

**Interfaces:**
- Consumes: `storage/photos.json`, photo media directory, `Response`, and `FileStore`.
- Produces: `Media::resolve(string $root, string $encodedFilename, array $allowedFilenames): ?string`, photo POST responses, and photo JPEG responses.

- [ ] **Step 1: Add failing photo and traversal tests**

Cover metadata with absent and empty page numbers; page 0 exact first/last URLs and nine-item count; page 1 filenames and count; invalid values `-1`, `2`, `100`, `1.0`, and `abc`; dynamic host `192.168.1.50:3000`; JPEG bytes and headers; and rejection of these paths:

```text
/api/image/photos/../skills.json
/api/image/photos/%2e%2e%2fskills.json
/api/image/photos/C:%5cWindows%5cwin.ini
/api/image/photos/%2fetc%2fpasswd
/api/image/photos/No_99999.jpg
```

For a symlink test, create a link under a temporary media root only when the platform permits symlink creation; verify `Media::resolve()` returns `null` for a target outside that root.

- [ ] **Step 2: Run the photo tests and verify the missing behavior**

Run: `php tests/run.php`

Expected: FAIL because `Media` and photo dispatch are not implemented.

- [ ] **Step 3: Implement photo routing and canonical media checks**

`Media::resolve()` must decode once with `rawurldecode`, reject NUL, slash, backslash, `..`, drive-prefix, and names outside the supplied allowlist, then apply this boundary check:

```php
$resolvedRoot = realpath($root);
$resolvedTarget = realpath($root . DIRECTORY_SEPARATOR . $filename);
$prefix = $resolvedRoot === false ? '' : rtrim($resolvedRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
if ($resolvedTarget === false || $prefix === '' || !str_starts_with($resolvedTarget, $prefix) || !is_file($resolvedTarget)) {
    return null;
}
```

After resolution, read the bytes with `file_get_contents()`, determine MIME type with `finfo(FILEINFO_MIME_TYPE)->file($path)`, require the result to equal `image/jpeg`, and return a binary `Response`. A read or MIME failure is an internal storage failure; an unsafe or missing path remains a 404.

In `App`, an absent or empty `pageNumber` returns the fixed metadata object. Only string or integer `0` and `1` are accepted. Read `photos.json`, select records whose `pageNumber` matches, remove the internal `pageNumber` and `filename` fields, and replace stored filenames with a URL built by `baseUrl($headers, $server)`.

`baseUrl()` must accept DNS names, IPv4 plus optional port, bracketed IPv6 plus optional port, and reject all other Host values. Its fallback is `http://localhost:3000`.

- [ ] **Step 4: Run the suite and verify photo behavior**

Run: `php tests/run.php`

Expected: all tests pass; valid media body bytes equal the corresponding committed JPEG.

- [ ] **Step 5: Commit photo behavior**

```powershell
git add train/2022_module_a/src train/2022_module_a/tests
git commit -m "feat: add paged photos and safe media delivery"
```

---

### Task 4: Skill groups and skill details

**Files:**
- Modify: `src/App.php`
- Modify: `tests/run.php`

**Interfaces:**
- Consumes: `storage/skill-types.json`, `storage/skills.json`, skill media directory, and `Media::resolve()`.
- Produces: skills-type list, known skill detail, skill JPEG response, and unknown-skill error.

- [ ] **Step 1: Add failing skill contract tests**

Assert that `/api/skills-types` exactly matches the committed two-group fixture, `/api/skills/1000` exactly returns the documented ID, name, introduction, and dynamic image URL, each of the eight group IDs has a matching detail record and accessible JPEG, and `/api/skills/9999` returns:

```json
{"code":404,"msg":"Skill not found.","data":null}
```

- [ ] **Step 2: Run the skill tests and verify they fail**

Run: `php tests/run.php`

Expected: FAIL because skill dispatch is not implemented.

- [ ] **Step 3: Implement exact skill lookup and skill-image delivery**

Read both fixtures through `FileStore`. Return the type fixture without transformation. Locate details using strict string ID comparison. Replace the stored image filename with `<base-url>/api/image/skills_images/<filename>`. Never synthesize a random skill for an unknown ID. Resolve skill JPEGs through `Media` with the eight filenames from `skills.json` as the allowlist.

- [ ] **Step 4: Run the suite and verify skill behavior**

Run: `php tests/run.php`

Expected: all tests pass with zero failures.

- [ ] **Step 5: Commit skill behavior**

```powershell
git add train/2022_module_a/src/App.php train/2022_module_a/tests/run.php
git commit -m "feat: add WS-MAD skill endpoints"
```

---

### Task 5: Expanded video list

**Files:**
- Modify: `src/App.php`
- Modify: `tests/run.php`

**Interfaces:**
- Consumes: `storage/videos.json`.
- Produces: `GET /api/video` returning the 20-record array.

- [ ] **Step 1: Add a failing video-list test**

Assert HTTP 200, JSON content type, 20 records, exact keys `uuid`, `name`, `url`, and `length` on every item, unique UUIDs, and this exact first record:

```php
[
    'uuid' => '2D6A33E7-AE3C-FCFA-5AF1-249C71C1AC57',
    'name' => 'Welcome to WorldSkills 2022 in Shanghai',
    'url' => 'http://192.168.0.199:8080/apivideo/ws_welcome.mp4',
    'length' => 134468,
]
```

- [ ] **Step 2: Run the video test and verify it fails**

Run: `php tests/run.php`

Expected: FAIL because the video route has no handler.

- [ ] **Step 3: Implement the video handler**

Read `videos.json` through `FileStore` and return it unchanged inside the standard success envelope. Do not create or proxy a video-file endpoint.

- [ ] **Step 4: Run the suite and verify the list**

Run: `php tests/run.php`

Expected: all tests pass and the video count is exactly 20.

- [ ] **Step 5: Commit the video endpoint**

```powershell
git add train/2022_module_a/src/App.php train/2022_module_a/tests/run.php
git commit -m "feat: add expanded WS-MAD video list"
```

---

### Task 6: Persistent video comments

**Files:**
- Modify: `src/App.php`
- Modify: `tests/run.php`

**Interfaces:**
- Consumes: `storage/videos.json`, `storage/comments.json`, and `FileStore::append()`.
- Produces: comment listing and validated persistent comment creation.

- [ ] **Step 1: Add failing comment-list and creation tests**

Use a copied temporary storage root so committed fixtures remain unchanged. Cover the initial count, reference integrity, and a successful request:

```php
$response = $app->handle(
    'POST',
    '/api/video/comment',
    ['Content-Type' => 'application/json'],
    [],
    json_encode([
        'commentText' => 'Nice video that make me happy.',
        'videoUUID' => '2D6A33E7-AE3C-FCFA-5AF1-249C71C1AC57',
    ], JSON_THROW_ON_ERROR),
    ['REMOTE_ADDR' => '192.168.1.25']
);
```

Assert status 200, UUID-v4 format, exact IP and text, millisecond timestamp within the test interval, correct video UUID, a 21-item stored array, and visibility after constructing a new `App` over the same temporary root.

Add separate 400 tests for malformed JSON, JSON scalar, missing `commentText`, missing `videoUUID`, array/object values instead of strings, whitespace-only text, and unknown video UUID. The unknown UUID response must have message `No video of this UUID can be found.`

- [ ] **Step 2: Run the comment tests and verify they fail**

Run: `php tests/run.php`

Expected: FAIL because comment GET and POST dispatch are not implemented.

- [ ] **Step 3: Implement comment validation and persistence**

Decode with `JSON_THROW_ON_ERROR`; require a JSON object represented as a non-list associative array. Preserve valid `commentText` exactly but use `trim()` only to reject empty input. Validate UUID membership against `videos.json` before writing.

Generate fields with:

```php
private function uuidV4(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

$commentTime = (int) floor(microtime(true) * 1000);
$ipAddress = is_string($server['REMOTE_ADDR'] ?? null) ? $server['REMOTE_ADDR'] : '127.0.0.1';
```

Append through `FileStore::append('comments.json', $comment)` and return the appended record in the success envelope.

- [ ] **Step 4: Run the suite and verify restart-equivalent persistence**

Run: `php tests/run.php`

Expected: all tests pass; a newly created `App` reads the appended record from disk.

- [ ] **Step 5: Commit comment behavior**

```powershell
git add train/2022_module_a/src/App.php train/2022_module_a/tests/run.php
git commit -m "feat: persist validated video comments"
```

---

### Task 7: HTTP adapter and real-server integration coverage

**Files:**
- Create: `server.php`
- Create: `public/index.php`
- Create: `tests/integration.ps1`
- Modify: `src/Response.php`

**Interfaces:**
- Consumes: `App::handle()` and the PHP request globals.
- Produces: a runnable server on `0.0.0.0:3000` and an integration test with process cleanup and fixture restoration.

- [ ] **Step 1: Create the failing integration test**

`tests/integration.ps1` must:

1. Copy `storage/comments.json` to a temporary backup.
2. Start `php -S 0.0.0.0:3000 server.php` hidden with the repository task directory as the working directory.
3. Wait up to ten seconds for `http://127.0.0.1:3000/api/video`.
4. Use `Invoke-WebRequest -SkipHttpErrorCheck` to test every JSON endpoint, a valid photo JPEG, a valid skill JPEG, an invalid page, unknown skill, unknown video UUID, traversal attempts, unknown route, and wrong method.
5. POST one unique comment, confirm it through GET, stop and restart the server, and confirm the comment still exists.
6. In a `finally` block, stop the exact child process and restore the comments backup with `Copy-Item -LiteralPath`.
7. Exit nonzero on any failed assertion and print a final numeric pass count.

Run: `powershell -ExecutionPolicy Bypass -File tests/integration.ps1`

Expected: FAIL because `server.php` and `public/index.php` do not exist.

- [ ] **Step 2: Implement the router and HTTP adapter**

Use this router:

```php
<?php
declare(strict_types=1);
require __DIR__ . '/public/index.php';
```

In `public/index.php`, register the same `src/<Class>.php` autoloader as the tests, construct `FileStore`, `Media`, and `App` with absolute paths based on `dirname(__DIR__)`, collect request headers case-insensitively, and call `App::handle()` with `$_SERVER['REQUEST_METHOD']`, `$_SERVER['REQUEST_URI']`, `$_POST`, `file_get_contents('php://input')`, and `$_SERVER`.

Add `Response::send(): void` that calls `http_response_code()`, sends every stored header, echoes the body, and returns. Binary responses include `Content-Type` and `Content-Length`; JSON responses include `Content-Type: application/json;charset=UTF-8`.

- [ ] **Step 3: Run syntax checks before starting the server**

Run:

```powershell
Get-ChildItem -Recurse -Filter *.php | ForEach-Object { php -l $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
```

Expected: every file reports `No syntax errors detected`.

- [ ] **Step 4: Run the unit and integration suites**

Run:

```powershell
php tests/run.php
powershell -ExecutionPolicy Bypass -File tests/integration.ps1
```

Expected: both commands exit 0, integration output reports the exact number of passed HTTP assertions, and port 3000 is released afterward.

- [ ] **Step 5: Commit the runnable HTTP server**

```powershell
git add train/2022_module_a/server.php train/2022_module_a/public/index.php train/2022_module_a/src/Response.php train/2022_module_a/tests/integration.ps1
git commit -m "feat: expose WS-MAD PHP HTTP server"
```

---

### Task 8: README and final requirements verification

**Files:**
- Create: `README.md`
- Modify: `tests/integration.ps1` only if documentation review exposes an uncovered contract assertion.

**Interfaces:**
- Consumes: all implemented behavior and fresh command output.
- Produces: complete operating documentation and an evidence-backed delivery report.

- [ ] **Step 1: Write README with exact operating instructions**

Include these commands and facts:

```powershell
php -v
php -S 0.0.0.0:3000 server.php
ipconfig
php tests/run.php
powershell -ExecutionPolicy Bypass -File tests/integration.ps1
```

Explain that clients use `http://<actual-LAN-IP>:3000`, not `0.0.0.0`; devices must be mutually reachable; Windows Firewall must allow inbound TCP 3000; writable comments live at `storage/comments.json`; restoring the committed initial comments resets data; and external sample-video URLs require internet access. Document all eight routed operations, including the two image resource patterns, with request/response examples and 200, 400, 404, 405, and 500 behavior.

- [ ] **Step 2: Verify the documented API list against the approved spec**

Run:

```powershell
Select-String -Path README.md -Pattern '/api/image/photos','/api/skills-types','/api/skills/','/api/image/skills_images/','/api/video','/api/video/comment'
```

Expected: every final route appears and no authentication or database route is documented.

- [ ] **Step 3: Run the complete fresh verification set**

Run:

```powershell
Get-ChildItem -Recurse -Filter *.php | ForEach-Object { php -l $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
php tests/run.php
powershell -ExecutionPolicy Bypass -File tests/integration.ps1
git diff --check
git status --short
```

Expected: syntax checks pass, both test suites exit 0 with zero failures, `git diff --check` emits no whitespace errors, and status contains only the intended task files plus the user's pre-existing unrelated changes.

- [ ] **Step 4: Inspect the implemented route surface**

Compare `src/App.php` line by line with the endpoint-contract section of the approved spec. Confirm there are no additional JSON endpoints, that the two media patterns are GET-only, and that every known path returns 405 for an unsupported method.

- [ ] **Step 5: Commit documentation and report the manual limitation**

```powershell
git add train/2022_module_a/README.md
git commit -m "docs: document WS-MAD PHP server"
```

The final report must list changed files, exact test commands and pass counts, and state that cross-device LAN connectivity remains a manual check unless it was actually performed.
