<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$responseFile = __DIR__ . '/../src/Response.php';
$fileStoreFile = __DIR__ . '/../src/FileStore.php';
$authServiceFile = __DIR__ . '/../src/AuthService.php';
$appFile = __DIR__ . '/../src/App.php';
if (is_file($responseFile)) {
    require_once $responseFile;
}
if (is_file($fileStoreFile)) {
    require_once $fileStoreFile;
}
if (is_file($authServiceFile)) {
    require_once $authServiceFile;
}
if (is_file($appFile)) {
    require_once $appFile;
}

test('foundation', 'JSON responses use the required envelope and content type', static function (): void {
    assertTrue(class_exists('Response'), 'Response class is not implemented.');

    $response = Response::json(200, 'Success', ['ok' => true]);
    assertSameValue(200, $response->status, 'JSON response status is incorrect.');
    assertSameValue('application/json; charset=utf-8', $response->headers['Content-Type'] ?? null, 'JSON content type is incorrect.');
    assertSameValue(
        ['msg' => 'Success', 'data' => ['ok' => true]],
        json_decode($response->body, true, 512, JSON_THROW_ON_ERROR),
        'JSON envelope is incorrect.',
    );
});

test('foundation', 'locked updates persist valid JSON', static function (): void {
    assertTrue(class_exists('FileStore'), 'FileStore class is not implemented.');

    $directory = createTemporaryDirectory('mycity-store');
    try {
        file_put_contents($directory . DIRECTORY_SEPARATOR . 'items.json', "[]\n");
        $store = new FileStore($directory);
        $result = $store->update('items.json', static function (array $items): array {
            $items[] = ['id' => 'ONE'];
            return $items;
        });

        assertSameValue([['id' => 'ONE']], $result, 'Update result is incorrect.');
        assertSameValue([['id' => 'ONE']], $store->read('items.json'), 'Stored JSON is incorrect.');
    } finally {
        removeDirectory($directory);
    }
});

test('auth', 'existing user signs in with case-insensitive email and exposes only the token', static function (): void {
    assertTrue(class_exists('AuthService') && class_exists('App'), 'Authentication API is not implemented.');
    $directory = createFixtureData();

    try {
        $response = fixtureApp($directory)->handle(
            'POST',
            '/api/users/signin',
            ['Content-Type' => 'application/json'],
            json_encode([
                'userEmailAddress' => 'ANKIT@example.com',
                'userPassword' => 'ankit123',
            ], JSON_THROW_ON_ERROR),
        );

        assertSameValue(200, $response->status, 'Existing user status is incorrect.');
        assertSameValue('Sign in successful', decodeResponse($response)['msg'], 'Existing user message is incorrect.');
        assertSameValue(
            ['auth_token' => 'TKN-ANKIT-A1B2C3D4E5F6G7H8'],
            decodeResponse($response)['data'],
            'Signin response exposes incorrect data.',
        );
    } finally {
        removeDirectory($directory);
    }
});

test('auth', 'successful legacy login replaces plaintext password with a hash', static function (): void {
    assertTrue(class_exists('AuthService') && class_exists('App'), 'Authentication API is not implemented.');
    $directory = createFixtureData();

    try {
        fixtureApp($directory)->handle(
            'POST',
            '/api/users/signin',
            [],
            json_encode(['userEmailAddress' => 'ankit@example.com', 'userPassword' => 'ankit123'], JSON_THROW_ON_ERROR),
        );
        $users = (new FileStore($directory))->read('users.json');
        assertSameValue(false, array_key_exists('password', $users[0]), 'Plaintext password was retained.');
        assertTrue(password_verify('ankit123', $users[0]['password_hash'] ?? ''), 'Password hash does not verify.');
    } finally {
        removeDirectory($directory);
    }
});

test('auth', 'new valid user is persisted with a unique identifier and secure token', static function (): void {
    assertTrue(class_exists('AuthService') && class_exists('App'), 'Authentication API is not implemented.');
    $directory = createFixtureData();

    try {
        $response = fixtureApp($directory)->handle(
            'POST',
            '/api/users/signin',
            [],
            json_encode(['userEmailAddress' => 'new@example.com', 'userPassword' => 'newpass1'], JSON_THROW_ON_ERROR),
        );
        $data = decodeResponse($response)['data'];
        $users = (new FileStore($directory))->read('users.json');

        assertSameValue(201, $response->status, 'New user status is incorrect.');
        assertSameValue(['auth_token'], array_keys($data), 'New user response fields are incorrect.');
        assertTrue(is_string($data['auth_token']) && strlen($data['auth_token']) === 20, 'Generated token format is incorrect.');
        assertSameValue('USR-002', $users[1]['user_id'] ?? null, 'Generated user identifier is incorrect.');
        assertSameValue('new@example.com', $users[1]['email'] ?? null, 'New user email is incorrect.');
        assertSameValue(false, array_key_exists('password', $users[1]), 'New user contains a plaintext password.');
        assertTrue(password_verify('newpass1', $users[1]['password_hash'] ?? ''), 'New user hash does not verify.');
    } finally {
        removeDirectory($directory);
    }
});

test('auth', 'existing user with a wrong password is rejected', static function (): void {
    assertTrue(class_exists('AuthService') && class_exists('App'), 'Authentication API is not implemented.');
    $directory = createFixtureData();

    try {
        $response = fixtureApp($directory)->handle(
            'POST',
            '/api/users/signin',
            [],
            json_encode(['userEmailAddress' => 'ankit@example.com', 'userPassword' => 'wrong123'], JSON_THROW_ON_ERROR),
        );
        assertSameValue(401, $response->status, 'Wrong password status is incorrect.');
        assertSameValue(null, decodeResponse($response)['data'], 'Wrong password must return null data.');
    } finally {
        removeDirectory($directory);
    }
});

test('auth', 'malformed or invalid signin input is rejected', static function (): void {
    assertTrue(class_exists('AuthService') && class_exists('App'), 'Authentication API is not implemented.');
    $directory = createFixtureData();

    try {
        $app = fixtureApp($directory);
        $requests = [
            '{',
            '[]',
            json_encode(['userEmailAddress' => 'bad', 'userPassword' => 'pass123'], JSON_THROW_ON_ERROR),
            json_encode(['userEmailAddress' => 'a@b.com', 'userPassword' => 'short'], JSON_THROW_ON_ERROR),
            json_encode(['userEmailAddress' => 'a@b.com', 'userPassword' => 'letters'], JSON_THROW_ON_ERROR),
            json_encode(['userEmailAddress' => 'a@b.com', 'userPassword' => '123456'], JSON_THROW_ON_ERROR),
        ];

        foreach ($requests as $body) {
            $response = $app->handle('POST', '/api/users/signin', [], $body);
            assertSameValue(400, $response->status, 'Invalid signin input was accepted: ' . $body);
            assertSameValue(null, decodeResponse($response)['data'], 'Invalid signin must return null data.');
        }
    } finally {
        removeDirectory($directory);
    }
});

test('auth', 'signin endpoint rejects unsupported methods', static function (): void {
    assertTrue(class_exists('AuthService') && class_exists('App'), 'Authentication API is not implemented.');
    $directory = createFixtureData();

    try {
        $response = fixtureApp($directory)->handle('GET', '/api/users/signin', [], '');
        assertSameValue(405, $response->status, 'Unsupported signin method status is incorrect.');
    } finally {
        removeDirectory($directory);
    }
});

test('reads', 'route API exposes exact fields with ordered stop names and singular departure', static function (): void {
    assertTrue(class_exists('App'), 'Read APIs are not implemented.');
    $directory = createFixtureData();

    try {
        $response = fixtureApp($directory)->handle('GET', '/api/transit/routes', [], '');
        $routes = decodeResponse($response)['data'];

        assertSameValue(200, $response->status, 'Route status is incorrect.');
        assertSameValue('Success', decodeResponse($response)['msg'], 'Route message is incorrect.');
        assertSameValue(
            ['route_id', 'route_name', 'route_type', 'status', 'next_departure', 'stops'],
            array_keys($routes[0]),
            'Route fields are not exact.',
        );
        assertSameValue(
            ['Andheri Bus Stand', 'Vile Parle Station', 'Bandra Station East'],
            $routes[0]['stops'],
            'Stops are not ordered by sequence.',
        );
        assertSameValue('2025-04-14 09:45:00', $routes[0]['next_departure'], 'First departure was not selected.');
        assertSameValue(null, $routes[1]['next_departure'], 'Empty departures did not become null.');
    } finally {
        removeDirectory($directory);
    }
});

test('reads', 'route API returns an empty array when no routes exist', static function (): void {
    assertTrue(class_exists('App'), 'Read APIs are not implemented.');
    $directory = createFixtureData();

    try {
        (new FileStore($directory))->write('routes.json', []);
        $response = fixtureApp($directory)->handle('GET', '/api/transit/routes', [], '');
        assertSameValue([], decodeResponse($response)['data'], 'Empty route data is incorrect.');
    } finally {
        removeDirectory($directory);
    }
});

test('reads', 'weather API exposes only the five documented fields with numeric values', static function (): void {
    assertTrue(class_exists('App'), 'Read APIs are not implemented.');
    $directory = createFixtureData();

    try {
        $response = fixtureApp($directory)->handle('GET', '/api/weather/current', [], '');
        $weather = decodeResponse($response)['data'];

        assertSameValue(200, $response->status, 'Weather status is incorrect.');
        assertSameValue(
            ['city', 'temperature_c', 'condition', 'humidity_pct', 'wind_kmh'],
            array_keys($weather),
            'Weather fields are not exact.',
        );
        assertTrue(is_int($weather['temperature_c']) || is_float($weather['temperature_c']), 'Temperature is not numeric.');
        assertTrue(is_int($weather['humidity_pct']) || is_float($weather['humidity_pct']), 'Humidity is not numeric.');
        assertTrue(is_int($weather['wind_kmh']) || is_float($weather['wind_kmh']), 'Wind speed is not numeric.');
    } finally {
        removeDirectory($directory);
    }
});

test('reads', 'alert API orders severity then newest time and exposes exact fields', static function (): void {
    assertTrue(class_exists('App'), 'Read APIs are not implemented.');
    $directory = createFixtureData();

    try {
        $response = fixtureApp($directory)->handle('GET', '/api/alerts', [], '');
        $alerts = decodeResponse($response)['data'];

        assertSameValue(200, $response->status, 'Alert status is incorrect.');
        assertSameValue(
            ['ALT-HIGH-NEW', 'ALT-HIGH-OLD', 'ALT-MEDIUM', 'ALT-LOW'],
            array_column($alerts, 'alert_id'),
            'Alert ordering is incorrect.',
        );
        assertSameValue(
            ['alert_id', 'title', 'affected_routes', 'status', 'severity', 'description', 'created_at'],
            array_keys($alerts[0]),
            'Alert fields are not exact.',
        );
    } finally {
        removeDirectory($directory);
    }
});

test('reads', 'read APIs reject unsupported methods', static function (): void {
    assertTrue(class_exists('App'), 'Read APIs are not implemented.');
    $directory = createFixtureData();

    try {
        $app = fixtureApp($directory);
        foreach (['/api/transit/routes', '/api/weather/current', '/api/alerts'] as $path) {
            assertSameValue(405, $app->handle('POST', $path, [], '')->status, 'Unsupported method accepted for ' . $path);
        }
    } finally {
        removeDirectory($directory);
    }
});

test('saved', 'save and saved-list APIs require a valid auth_token header', static function (): void {
    assertTrue(class_exists('App'), 'Saved-route APIs are not implemented.');
    $directory = createFixtureData();

    try {
        $app = fixtureApp($directory);
        $body = json_encode(['route_id' => 'RTE-BUS-022'], JSON_THROW_ON_ERROR);
        assertSameValue(401, $app->handle('PUT', '/api/routes/save', [], $body)->status, 'Save without token was accepted.');
        assertSameValue(401, $app->handle('PUT', '/api/routes/save', ['auth_token' => 'invalid'], $body)->status, 'Save with invalid token was accepted.');
        assertSameValue(401, $app->handle('GET', '/api/routes/saved', [], '')->status, 'Saved list without token was accepted.');
        assertSameValue(401, $app->handle('GET', '/api/routes/saved', ['AUTH_TOKEN' => 'invalid'], '')->status, 'Saved list with invalid token was accepted.');
    } finally {
        removeDirectory($directory);
    }
});

test('saved', 'save API validates JSON and route_id before writing', static function (): void {
    assertTrue(class_exists('App'), 'Saved-route APIs are not implemented.');
    $directory = createFixtureData();

    try {
        $app = fixtureApp($directory);
        $headers = ['auth_token' => 'TKN-ANKIT-A1B2C3D4E5F6G7H8'];
        assertSameValue(400, $app->handle('PUT', '/api/routes/save', $headers, '{')->status, 'Malformed JSON was accepted.');
        assertSameValue(400, $app->handle('PUT', '/api/routes/save', $headers, '{}')->status, 'Missing route_id was accepted.');
        assertSameValue(400, $app->handle('PUT', '/api/routes/save', $headers, json_encode(['route_id' => 22], JSON_THROW_ON_ERROR))->status, 'Non-string route_id was accepted.');
        assertSameValue(404, $app->handle('PUT', '/api/routes/save', $headers, json_encode(['route_id' => 'MISSING'], JSON_THROW_ON_ERROR))->status, 'Unknown route was accepted.');
        assertSameValue([], (new FileStore($directory))->read('saved_routes.json'), 'Invalid request changed saved data.');
    } finally {
        removeDirectory($directory);
    }
});

test('saved', 'save API persists exactly one route and rejects a duplicate', static function (): void {
    assertTrue(class_exists('App'), 'Saved-route APIs are not implemented.');
    $directory = createFixtureData();

    try {
        $app = fixtureApp($directory);
        $headers = ['Auth_Token' => 'TKN-ANKIT-A1B2C3D4E5F6G7H8'];
        $body = json_encode(['route_id' => 'RTE-RAPID-003'], JSON_THROW_ON_ERROR);
        $response = $app->handle('PUT', '/api/routes/save', $headers, $body);
        $data = decodeResponse($response)['data'];

        assertSameValue(200, $response->status, 'Save status is incorrect.');
        assertSameValue('Success', decodeResponse($response)['msg'], 'Save message is incorrect.');
        assertSameValue(['route_id', 'saved_at'], array_keys($data), 'Save response fields are not exact.');
        assertSameValue('RTE-RAPID-003', $data['route_id'], 'Saved route identifier is incorrect.');
        assertTrue(preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $data['saved_at']) === 1, 'saved_at format is incorrect.');

        $stored = (new FileStore($directory))->read('saved_routes.json');
        assertSameValue(
            ['user_id' => 'USR-001', 'route_id' => 'RTE-RAPID-003', 'saved_at' => $data['saved_at']],
            $stored[0],
            'Persisted saved route is incorrect.',
        );
        assertSameValue(409, $app->handle('PUT', '/api/routes/save', $headers, $body)->status, 'Duplicate save was accepted.');
        assertSameValue(1, count((new FileStore($directory))->read('saved_routes.json')), 'Duplicate changed saved data.');
    } finally {
        removeDirectory($directory);
    }
});

test('saved', 'saved-list API returns only the current user with newest records first and exact fields', static function (): void {
    assertTrue(class_exists('App'), 'Saved-route APIs are not implemented.');
    $directory = createFixtureData([
        [
            'user_id' => 'USR-001',
            'email' => 'ankit@example.com',
            'password' => 'ankit123',
            'auth_token' => 'TOKEN-ONE',
            'created_at' => '2025-01-10 09:00:00',
        ],
        [
            'user_id' => 'USR-002',
            'email' => 'other@example.com',
            'password' => 'other123',
            'auth_token' => 'TOKEN-TWO',
            'created_at' => '2025-01-11 09:00:00',
        ],
    ]);

    try {
        (new FileStore($directory))->write('saved_routes.json', [
            ['user_id' => 'USR-001', 'route_id' => 'RTE-BUS-022', 'saved_at' => '2025-04-10 08:30:00'],
            ['user_id' => 'USR-002', 'route_id' => 'RTE-RAPID-003', 'saved_at' => '2025-04-15 10:00:00'],
            ['user_id' => 'USR-001', 'route_id' => 'RTE-RAPID-003', 'saved_at' => '2025-04-12 10:15:00'],
        ]);

        $response = fixtureApp($directory)->handle('GET', '/api/routes/saved', ['auth_token' => 'TOKEN-ONE'], '');
        $savedRoutes = decodeResponse($response)['data'];
        assertSameValue(200, $response->status, 'Saved-list status is incorrect.');
        assertSameValue(['RTE-RAPID-003', 'RTE-BUS-022'], array_column($savedRoutes, 'route_id'), 'Saved-list filtering or ordering is incorrect.');
        assertSameValue(
            ['route_id', 'route_name', 'saved_at'],
            array_keys($savedRoutes[0]),
            'Saved-list fields are not exact.',
        );
        assertSameValue('BKC to Thane Rapid', $savedRoutes[0]['route_name'], 'Saved route name was not joined from routes data.');
    } finally {
        removeDirectory($directory);
    }
});

test('saved', 'saved-route endpoints reject unsupported methods', static function (): void {
    assertTrue(class_exists('App'), 'Saved-route APIs are not implemented.');
    $directory = createFixtureData();

    try {
        $app = fixtureApp($directory);
        assertSameValue(405, $app->handle('GET', '/api/routes/save', [], '')->status, 'Save endpoint accepted GET.');
        assertSameValue(405, $app->handle('PUT', '/api/routes/saved', [], '')->status, 'Saved-list endpoint accepted PUT.');
    } finally {
        removeDirectory($directory);
    }
});

test('transport', 'privacy policy returns HTML with the required title and close button', static function (): void {
    assertTrue(class_exists('App'), 'Privacy policy API is not implemented.');
    $directory = createFixtureData();

    try {
        $response = fixtureApp($directory)->handle('GET', '/api/privacy-policy', [], '');
        assertSameValue(200, $response->status, 'Privacy status is incorrect.');
        assertSameValue('text/html; charset=utf-8', $response->headers['Content-Type'] ?? null, 'Privacy content type is incorrect.');
        assertTrue(str_contains($response->body, 'Privacy Policy'), 'Privacy title is missing.');
        assertTrue(str_contains($response->body, 'id="closeBtn"'), 'Privacy close button is missing.');
    } finally {
        removeDirectory($directory);
    }
});

test('transport', 'static resource returns original PNG bytes and MIME type', static function (): void {
    assertTrue(class_exists('App'), 'Static resource API is not implemented.');
    $directory = createFixtureData();

    try {
        $png = "\x89PNG\r\n\x1a\nfixture";
        file_put_contents($directory . DIRECTORY_SEPARATOR . 'resources' . DIRECTORY_SEPARATOR . 'maps' . DIRECTORY_SEPARATOR . 'mumbai_base.png', $png);
        $response = fixtureApp($directory)->handle('GET', '/api/resources/maps/mumbai_base.png', [], '');
        assertSameValue(200, $response->status, 'Static resource status is incorrect.');
        assertSameValue('image/png', $response->headers['Content-Type'] ?? null, 'Static resource MIME type is incorrect.');
        assertSameValue($png, $response->body, 'Static resource bytes changed.');
    } finally {
        removeDirectory($directory);
    }
});

test('transport', 'static resource cannot escape the public resource directory', static function (): void {
    assertTrue(class_exists('App'), 'Static resource API is not implemented.');
    $directory = createFixtureData();

    try {
        $app = fixtureApp($directory);
        $paths = [
            '/api/resources/../users.json',
            '/api/resources/%2e%2e/users.json',
            '/api/resources/%252e%252e/users.json',
            '/api/resources/C:%5CWindows%5Cwin.ini',
            '/api/resources/%2Fetc%2Fpasswd',
            '/api/resources/maps/missing.png',
        ];

        foreach ($paths as $path) {
            $response = $app->handle('GET', $path, [], '');
            assertSameValue(404, $response->status, 'Unsafe or missing path did not return 404: ' . $path);
            assertSameValue(['msg' => 'Not Found', 'data' => null], decodeResponse($response), '404 response differs for ' . $path);
        }
    } finally {
        removeDirectory($directory);
    }
});

test('transport', 'privacy and static paths reject unsupported methods and unknown APIs return 404', static function (): void {
    assertTrue(class_exists('App'), 'Final routing is not implemented.');
    $directory = createFixtureData();

    try {
        $app = fixtureApp($directory);
        assertSameValue(405, $app->handle('POST', '/api/privacy-policy', [], '')->status, 'Privacy endpoint accepted POST.');
        assertSameValue(405, $app->handle('POST', '/api/resources/maps/mumbai_base.png', [], '')->status, 'Resource endpoint accepted POST.');
        assertSameValue(404, $app->handle('GET', '/api/unknown', [], '')->status, 'Unknown API did not return 404.');
    } finally {
        removeDirectory($directory);
    }
});

runTests($argv[1] ?? null);
