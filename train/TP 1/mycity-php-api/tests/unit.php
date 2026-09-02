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

runTests($argv[1] ?? null);
