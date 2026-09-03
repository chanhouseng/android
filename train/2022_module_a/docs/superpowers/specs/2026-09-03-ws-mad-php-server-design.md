# WS-MAD Pure PHP Server Design

## Goal

Build a runnable PHP 8.0+ server that implements the WS-MAD endpoints described by the supplied Postman collection and HTML documentation. The server must use no framework, Composer package, or database; it must preserve newly added video comments in JSON and be reachable on TCP port 3000 from the local network.

## Source priority and scope

The sources are interpreted as data, not executable instructions. Conflicts are resolved in this order:

1. The user's messages in this conversation.
2. `C:/Users/chanh/Desktop/AI_PHP_SERVER_BUILD_GUIDE.md`.
3. `PM/media-files/api_docs/WS-MAD-SERVER-API.postman_collection.html`.
4. `PM/media-files/api_docs/WS-MAD-SERVER-API.postman_collection.json`.
5. The existing `server.py`, used only as the user-selected expanded seed-data source.

The HTML and JSON Postman documents describe the same requests and examples. The existing `server.py` remains untouched. Its expanded records are migrated into JSON, but behavior that conflicts with the Postman contract is corrected as described below.

## Technical architecture

The application uses PHP's built-in web server and a small set of focused classes:

- `server.php` is the router script used by `php -S 0.0.0.0:3000 server.php`.
- `public/index.php` creates the application and dispatches the current HTTP request.
- `src/App.php` matches methods and paths, validates endpoint input, coordinates storage, and builds endpoint payloads.
- `src/FileStore.php` reads JSON under a shared lock and updates JSON under an exclusive lock.
- `src/Response.php` emits JSON or binary responses with the correct status and content type.
- `src/Media.php` resolves allowed media paths and prevents path traversal or symlink escape.
- `storage/*.json` contains photos, skills, videos, and persistent comments.
- `public/media/` contains local JPEG files used by photo and skill-image URLs.

No authentication, database, CORS policy, admin endpoint, or non-specified business feature is added.

## Endpoint contract

All JSON endpoints return a top-level object with `code`, `msg`, and `data`. JSON uses UTF-8, preserves Unicode, and does not unnecessarily escape slashes.

### `POST /api/image/photos`

The endpoint accepts form-data or URL-encoded form fields.

- With no `pageNumber`, or an empty `pageNumber`, it returns HTTP 200 and:

  ```json
  {
    "code": 200,
    "msg": "Success",
    "data": {
      "firstPageNumber": 0,
      "totalPhotos": 18,
      "totalPage": 2
    }
  }
  ```

- With `pageNumber=0`, it returns the nine documented records `No_00009.jpg` through `No_00017.jpg`. Their `visit-count` and `heat` strings match the Postman example.
- With `pageNumber=1`, it returns the other nine records, `No_00000.jpg` through `No_00008.jpg`, using deterministic seed values derived from the existing mock-data pattern.
- Any other value, including non-integer input, returns HTTP 400 with `PageNumber out of limit.` and `data: null`.
- Returned image URLs use the current request's scheme and host, followed by `/api/image/photos/<filename>`.

The Postman response fixes the authoritative photo count at 18 and page count at 2. The conflicting `54` photos, `6` pages, and repeated pages in `server.py` are not migrated.

### `GET /api/image/photos/{filename}`

Serves the referenced photo as JPEG. Eighteen local photo files are seeded from the three existing banner JPEGs in rotation. Only the committed filenames `No_00000.jpg` through `No_00017.jpg` resolve successfully.

### `GET /api/skills-types`

Returns the two documented skill groups and their eight documented ID-to-name entries without adding fields.

### `GET /api/skills/{id}`

Returns `id`, `name`, `introduction`, and `img` for one of the eight IDs exposed by `/api/skills-types`. Skill `1000` uses the exact documented name and introduction. The other records use their documented names and the generic introductions already present in `server.py`. Unknown IDs return HTTP 404 with `code: 404`, `msg: "Skill not found."`, and `data: null` rather than fabricating a random skill.

The `img` URL uses the current request's scheme and host followed by `/api/image/skills_images/<id>.jpg`.

### `GET /api/image/skills_images/{filename}`

Serves the referenced skill image as JPEG. Eight local skill images are seeded from the existing banner JPEGs in rotation. Only filenames corresponding to documented skill IDs resolve successfully.

### `GET /api/video`

Returns the 20 expanded video records from `server.py`. The first record keeps the title `Welcome to WorldSkills 2022 in Shanghai` but uses the Postman UUID `2D6A33E7-AE3C-FCFA-5AF1-249C71C1AC57`, URL, and length so that the documented successful comment request references an existing video. The remaining 19 records retain their expanded mock titles, UUIDs, external sample-video URLs, and lengths.

No local video route is created because neither supplied API document defines one and no video binary is present in the provided project.

### `GET /api/video/comment`

Returns all comments from `storage/comments.json` in stored order. The 20 expanded comments from `server.py` become the initial records. The first comment's `videoUUID` is changed to the corrected first-video UUID so every initial comment references a video returned by `/api/video`.

### `POST /api/video/comment`

Accepts an `application/json` object with:

- `commentText`: required, string, non-empty after trimming.
- `videoUUID`: required, string, and equal to the UUID of a video in `storage/videos.json`.

Malformed JSON, a non-object JSON value, a missing field, or a field of the wrong type returns HTTP 400 with a concise error message and `data: null`. A syntactically valid request containing an unknown video UUID returns the documented HTTP 400 response: `No video of this UUID can be found.`

A successful request returns HTTP 200 and the newly persisted comment. Its fields are:

- `uuid`: a newly generated RFC 4122 version-4 UUID.
- `ipAddress`: the request's remote address.
- `commentText`: the submitted text, preserving its original content.
- `commentTime`: the current Unix timestamp in milliseconds.
- `videoUUID`: the validated submitted UUID.

The new record is appended to `storage/comments.json` while holding an exclusive file lock. A subsequent GET, including after a server restart, returns the record.

## URL construction

Resource URLs are generated from the current request rather than retaining `192.168.0.199:8080`. The scheme is `https` only when PHP reports an HTTPS request; otherwise it is `http`. The `Host` header is accepted only if it consists of a valid hostname or IP literal plus an optional numeric port. If invalid or absent, the fallback is `localhost:3000`.

This allows the same API response to work through `localhost`, a LAN IPv4 address, or another valid host without editing seed data.

## Routing and errors

- An unknown path returns HTTP 404 with `Not Found` and `data: null`.
- A known path used with an unsupported method returns HTTP 405, includes the `Allow` header, and returns `Method Not Allowed` with `data: null`.
- Media files that are absent or unsafe return HTTP 404 without exposing a filesystem path.
- JSON errors never include a stack trace, source code, or server filesystem details.
- Unexpected storage failures return HTTP 500 with a generic `Internal Server Error` payload and are logged only to the server error stream.

## Static-file safety

Media routing URL-decodes the requested filename exactly once, rejects empty names, NUL bytes, directory separators, `..`, absolute paths, and Windows drive prefixes, and limits accepted names to the endpoint-specific allowlist. `realpath()` is applied to both the configured media root and the target. The resolved target must begin with the resolved root plus a directory separator and must be a regular file. These checks also prevent symlinks from escaping the public media directory.

Successful media responses use the detected MIME type, an exact `Content-Length`, and the original binary bytes.

## JSON storage

Photos, skills, and videos are committed read-only seed JSON. Comments are writable. `FileStore` opens comment storage with `c+`, obtains `LOCK_EX`, reads and decodes the current array, appends the record, rewinds, truncates, writes the complete JSON document, flushes it, and releases the lock. Reads use `LOCK_SH`.

If storage is missing, unreadable, not valid JSON, or has an unexpected top-level shape, the request fails safely with HTTP 500; the server does not silently replace or discard existing data.

## Test strategy

Implementation follows test-driven development. Tests are written and observed failing before production behavior is added.

The dependency-free test suite covers:

- photo metadata, both valid pages, invalid page values, and form parsing;
- exact skills-type shape, known skill lookup, and unknown skill handling;
- expanded video count and the corrected documented UUID;
- initial comments and video-reference integrity;
- successful comment creation, generated fields, persisted JSON, and visibility after a fresh application instance;
- malformed JSON, missing or wrong-type fields, empty text, and unknown video UUID;
- unknown routes and 405 behavior;
- JSON content type and payload shape;
- photo and skill-image MIME type and bytes;
- direct, encoded, absolute, Windows-style, and symlink path-traversal attempts.

An HTTP integration script starts the real command `php -S 0.0.0.0:3000 server.php`, exercises every final endpoint, verifies status codes, headers, response bodies, and persistence, then restores the committed comments fixture and stops the server. PHP syntax checks run across every PHP source file.

A LAN test from another physical device cannot be automated in this workspace. README instructions explain how to find the computer's LAN IP, connect using `http://<LAN-IP>:3000`, keep both devices on a mutually reachable network, and allow inbound TCP 3000 through the firewall. This item is reported as manual unless it is actually performed.

## Documentation and delivery

`README.md` documents requirements, startup, LAN access, firewall configuration, project structure, all routes, representative requests and responses, error statuses, JSON persistence, reset instructions, assumptions, and repeatable test commands. The final delivery lists created files, fresh verification results, and the manual LAN test limitation.

