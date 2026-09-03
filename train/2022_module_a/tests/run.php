<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$projectRoot = dirname(__DIR__);

test('file store reads a JSON array', function (): void {
    $root = temporaryDirectory();

    try {
        file_put_contents($root . DIRECTORY_SEPARATOR . 'items.json', "[{\"id\":1}]\n");
        $store = new FileStore($root);
        assertSameValue([['id' => 1]], $store->read('items.json'));
    } finally {
        removeDirectory($root);
    }
});

test('file store append survives a new store instance', function (): void {
    $root = temporaryDirectory();

    try {
        file_put_contents($root . DIRECTORY_SEPARATOR . 'comments.json', "[]\n");
        $record = ['uuid' => 'new-comment', 'commentText' => 'Persist me'];
        (new FileStore($root))->append('comments.json', $record);

        assertSameValue([$record], (new FileStore($root))->read('comments.json'));
    } finally {
        removeDirectory($root);
    }
});

test('committed fixtures are complete and relationally valid', function () use ($projectRoot): void {
    $storage = $projectRoot . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR;
    $photos = loadJsonFixture($storage . 'photos.json');
    $skillTypes = loadJsonFixture($storage . 'skill-types.json');
    $skills = loadJsonFixture($storage . 'skills.json');
    $videos = loadJsonFixture($storage . 'videos.json');
    $comments = loadJsonFixture($storage . 'comments.json');

    assertSameValue(18, count($photos));
    assertSameValue(2, count($skillTypes));
    assertSameValue(8, count($skills));
    assertSameValue(20, count($videos));
    assertSameValue(20, count($comments));

    $videoIds = array_column($videos, 'uuid');
    assertSameValue(count($videoIds), count(array_unique($videoIds)), 'Video UUIDs must be unique.');

    foreach ($comments as $comment) {
        assertTrueValue(in_array($comment['videoUUID'], $videoIds, true), 'Every comment must reference an existing video.');
    }
});

test('every seeded image filename has a local JPEG', function () use ($projectRoot): void {
    $photos = loadJsonFixture($projectRoot . '/storage/photos.json');
    $skills = loadJsonFixture($projectRoot . '/storage/skills.json');

    foreach ($photos as $photo) {
        assertTrueValue(is_file($projectRoot . '/public/media/photos/' . $photo['filename']));
    }

    foreach ($skills as $skill) {
        assertTrueValue(is_file($projectRoot . '/public/media/skills_images/' . $skill['image']));
    }
});

test('JSON response preserves Unicode and slashes', function (): void {
    $response = Response::json(200, ['url' => 'http://host/路徑']);

    assertSameValue(200, $response->status());
    assertSameValue('application/json;charset=UTF-8', $response->headers()['Content-Type']);
    assertSameValue('{"url":"http://host/路徑"}', $response->body());
});

test('unknown route returns the standard 404 envelope', function (): void {
    $response = testApp()->handle('GET', '/api/missing');

    assertSameValue(404, $response->status());
    assertSameValue(
        ['code' => 404, 'msg' => 'Not Found', 'data' => null],
        json_decode($response->body(), true, 512, JSON_THROW_ON_ERROR)
    );
});

test('known route rejects an unsupported method', function (): void {
    $response = testApp()->handle('DELETE', '/api/video');

    assertSameValue(405, $response->status());
    assertSameValue('GET', $response->headers()['Allow']);
    assertSameValue(
        ['code' => 405, 'msg' => 'Method Not Allowed', 'data' => null],
        json_decode($response->body(), true, 512, JSON_THROW_ON_ERROR)
    );
});

test('photo endpoint returns documented metadata when page number is absent or empty', function (): void {
    foreach ([[], ['pageNumber' => '']] as $form) {
        $response = testApp()->handle('POST', '/api/image/photos', [], $form);
        assertSameValue(200, $response->status());
        assertSameValue([
            'code' => 200,
            'msg' => 'Success',
            'data' => [
                'firstPageNumber' => 0,
                'totalPhotos' => 18,
                'totalPage' => 2,
            ],
        ], responseJson($response));
    }
});

test('photo page zero matches the Postman example and uses the request host', function (): void {
    $response = testApp()->handle(
        'POST',
        '/api/image/photos',
        ['Host' => '192.168.1.50:3000'],
        ['pageNumber' => '0']
    );
    $body = responseJson($response);

    assertSameValue(200, $response->status());
    assertSameValue(9, count($body['data']));
    assertSameValue([
        'visit-count' => '389',
        'heat' => '1004',
        'url' => 'http://192.168.1.50:3000/api/image/photos/No_00009.jpg',
    ], $body['data'][0]);
    assertSameValue('http://192.168.1.50:3000/api/image/photos/No_00017.jpg', $body['data'][8]['url']);
});

test('photo page one returns the other nine seeded photos', function (): void {
    $body = responseJson(testApp()->handle(
        'POST',
        '/api/image/photos',
        ['host' => 'localhost:3000'],
        ['pageNumber' => 1]
    ));

    assertSameValue(9, count($body['data']));
    assertSameValue('http://localhost:3000/api/image/photos/No_00000.jpg', $body['data'][0]['url']);
    assertSameValue('http://localhost:3000/api/image/photos/No_00008.jpg', $body['data'][8]['url']);
});

test('photo endpoint rejects every out-of-range page value', function (): void {
    foreach (['-1', '2', '100', '1.0', 'abc', [], true] as $pageNumber) {
        $response = testApp()->handle('POST', '/api/image/photos', [], ['pageNumber' => $pageNumber]);
        assertSameValue(400, $response->status());
        assertSameValue([
            'code' => 400,
            'msg' => 'PageNumber out of limit.',
            'data' => null,
        ], responseJson($response));
    }
});

test('photo endpoint rejects an invalid Host header and uses the safe fallback', function (): void {
    $body = responseJson(testApp()->handle(
        'POST',
        '/api/image/photos',
        ['Host' => "evil.example/path\r\nX-Test: injected"],
        ['pageNumber' => '0']
    ));

    assertSameValue('http://localhost:3000/api/image/photos/No_00009.jpg', $body['data'][0]['url']);
});

test('photo resource returns the original JPEG bytes and headers', function () use ($projectRoot): void {
    $response = testApp()->handle('GET', '/api/image/photos/No_00000.jpg');
    $expected = file_get_contents($projectRoot . '/public/media/photos/No_00000.jpg');

    assertSameValue(200, $response->status());
    assertSameValue('image/jpeg', $response->headers()['Content-Type']);
    assertSameValue((string) strlen((string) $expected), $response->headers()['Content-Length']);
    assertSameValue($expected, $response->body());
});

test('photo resource blocks missing files and path traversal', function (): void {
    $paths = [
        '/api/image/photos/../skills.json',
        '/api/image/photos/%2e%2e%2fskills.json',
        '/api/image/photos/C:%5cWindows%5cwin.ini',
        '/api/image/photos/%2fetc%2fpasswd',
        '/api/image/photos/No_99999.jpg',
    ];

    foreach ($paths as $path) {
        $response = testApp()->handle('GET', $path);
        assertSameValue(404, $response->status(), 'Expected 404 for ' . $path);
    }
});

test('media resolver blocks a symlink that escapes its root when symlinks are available', function (): void {
    $root = temporaryDirectory();
    $outside = temporaryDirectory();

    try {
        file_put_contents($outside . '/outside.jpg', 'outside');
        $link = $root . '/linked.jpg';
        if (!@symlink($outside . '/outside.jpg', $link)) {
            return;
        }

        assertSameValue(null, (new Media())->resolve($root, 'linked.jpg', ['linked.jpg']));
    } finally {
        removeDirectory($root);
        removeDirectory($outside);
    }
});

runRegisteredTests();
