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

test('skill types endpoint returns the exact documented groups', function (): void {
    $response = testApp()->handle('GET', '/api/skills-types');

    assertSameValue(200, $response->status());
    assertSameValue([
        [
            'skillTypeId' => 0,
            'name' => 'Manufacturing and Engineering Technology',
            'skills' => [
                '0000' => 'Industrial Mechanics',
                '0001' => 'Manufacturing Team Challenge',
                '0002' => 'Mechatronics',
                '0003' => 'Mechanical Engineering CAD',
                '0004' => 'CNC Turning',
                '0005' => 'CNC Milling',
            ],
        ],
        [
            'skillTypeId' => 1,
            'name' => 'Information and Communication Technology',
            'skills' => [
                '1000' => 'Information Network Cabling',
                '1001' => 'IT Software Solutions for Business',
            ],
        ],
    ], responseJson($response)['data']);
});

test('skill 1000 endpoint matches the documented example with a dynamic URL', function (): void {
    $response = testApp()->handle('GET', '/api/skills/1000', ['Host' => '10.0.0.8:3000']);

    assertSameValue(200, $response->status());
    assertSameValue([
        'id' => '1000',
        'name' => 'Information Network Cabling',
        'introduction' => 'The occupations related to “Information Network Cabling” are deeply related to the technology that supports modern information societies in which lives can be more comfortable and sustainable.',
        'img' => 'http://10.0.0.8:3000/api/image/skills_images/1000.jpg',
    ], responseJson($response)['data']);
});

test('all eight listed skill IDs have details and a JPEG resource', function (): void {
    $expectedNames = [
        '0000' => 'Industrial Mechanics',
        '0001' => 'Manufacturing Team Challenge',
        '0002' => 'Mechatronics',
        '0003' => 'Mechanical Engineering CAD',
        '0004' => 'CNC Turning',
        '0005' => 'CNC Milling',
        '1000' => 'Information Network Cabling',
        '1001' => 'IT Software Solutions for Business',
    ];

    foreach ($expectedNames as $id => $name) {
        $detail = testApp()->handle('GET', '/api/skills/' . $id);
        assertSameValue(200, $detail->status());
        assertSameValue($name, responseJson($detail)['data']['name']);

        $image = testApp()->handle('GET', '/api/image/skills_images/' . $id . '.jpg');
        assertSameValue(200, $image->status());
        assertSameValue('image/jpeg', $image->headers()['Content-Type']);
        assertTrueValue(strlen($image->body()) > 0);
    }
});

test('unknown skill ID returns a 404 instead of fabricated data', function (): void {
    $response = testApp()->handle('GET', '/api/skills/9999');

    assertSameValue(404, $response->status());
    assertSameValue([
        'code' => 404,
        'msg' => 'Skill not found.',
        'data' => null,
    ], responseJson($response));
});

test('video endpoint returns all expanded records with the documented first video', function (): void {
    $response = testApp()->handle('GET', '/api/video');
    $videos = responseJson($response)['data'];

    assertSameValue(200, $response->status());
    assertSameValue(20, count($videos));
    assertSameValue([
        'uuid' => '2D6A33E7-AE3C-FCFA-5AF1-249C71C1AC57',
        'name' => 'Welcome to WorldSkills 2022 in Shanghai',
        'url' => 'http://192.168.0.199:8080/apivideo/ws_welcome.mp4',
        'length' => 134468,
    ], $videos[0]);

    $ids = [];
    foreach ($videos as $video) {
        assertSameValue(['uuid', 'name', 'url', 'length'], array_keys($video));
        $ids[] = $video['uuid'];
    }
    assertSameValue(20, count(array_unique($ids)));
});

test('corrupt storage returns a generic 500 without exposing its path', function (): void {
    $root = temporaryDirectory();
    $previousErrorLog = (string) ini_get('error_log');
    ini_set('error_log', $root . '/php-error.log');

    try {
        file_put_contents($root . '/videos.json', '{broken');
        $response = testApp($root)->handle('GET', '/api/video');

        assertSameValue(500, $response->status());
        assertSameValue([
            'code' => 500,
            'msg' => 'Internal Server Error',
            'data' => null,
        ], responseJson($response));
        assertTrueValue(!str_contains($response->body(), $root));
    } finally {
        ini_set('error_log', $previousErrorLog);
        removeDirectory($root);
    }
});

test('comment endpoint lists the twenty expanded initial comments', function (): void {
    $response = testApp()->handle('GET', '/api/video/comment');
    $comments = responseJson($response)['data'];

    assertSameValue(200, $response->status());
    assertSameValue(20, count($comments));
    assertSameValue('2D6A33E7-AE3C-FCFA-5AF1-249C71C1AC57', $comments[0]['videoUUID']);
});

test('valid video comment is generated, persisted, and visible to a new app instance', function () use ($projectRoot): void {
    $root = temporaryDirectory();

    try {
        copy($projectRoot . '/storage/videos.json', $root . '/videos.json');
        copy($projectRoot . '/storage/comments.json', $root . '/comments.json');
        $text = '  Nice video that make me happy.  ';
        $before = (int) floor(microtime(true) * 1000);
        $response = testApp($root)->handle(
            'POST',
            '/api/video/comment',
            ['Content-Type' => 'application/json'],
            [],
            json_encode([
                'commentText' => $text,
                'videoUUID' => '2D6A33E7-AE3C-FCFA-5AF1-249C71C1AC57',
            ], JSON_THROW_ON_ERROR),
            ['REMOTE_ADDR' => '192.168.1.25']
        );
        $after = (int) floor(microtime(true) * 1000);
        $comment = responseJson($response)['data'];

        assertSameValue(200, $response->status());
        assertSameValue(1, preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $comment['uuid']));
        assertSameValue('192.168.1.25', $comment['ipAddress']);
        assertSameValue($text, $comment['commentText']);
        assertTrueValue($comment['commentTime'] >= $before && $comment['commentTime'] <= $after);
        assertSameValue('2D6A33E7-AE3C-FCFA-5AF1-249C71C1AC57', $comment['videoUUID']);

        assertSameValue(21, count(loadJsonFixture($root . '/comments.json')));
        $freshComments = responseJson(testApp($root)->handle('GET', '/api/video/comment'))['data'];
        assertSameValue($comment, $freshComments[20]);
    } finally {
        removeDirectory($root);
    }
});

test('invalid video comment bodies return 400 without writing', function () use ($projectRoot): void {
    $root = temporaryDirectory();

    try {
        copy($projectRoot . '/storage/videos.json', $root . '/videos.json');
        copy($projectRoot . '/storage/comments.json', $root . '/comments.json');
        $cases = [
            '{broken',
            '"scalar"',
            '{}',
            '{"videoUUID":"2D6A33E7-AE3C-FCFA-5AF1-249C71C1AC57"}',
            '{"commentText":"hello"}',
            '{"commentText":[],"videoUUID":"2D6A33E7-AE3C-FCFA-5AF1-249C71C1AC57"}',
            '{"commentText":"hello","videoUUID":[]}',
            '{"commentText":"   ","videoUUID":"2D6A33E7-AE3C-FCFA-5AF1-249C71C1AC57"}',
        ];

        foreach ($cases as $rawBody) {
            $response = testApp($root)->handle(
                'POST',
                '/api/video/comment',
                ['Content-Type' => 'application/json'],
                [],
                $rawBody
            );
            assertSameValue(400, $response->status(), 'Expected 400 for ' . $rawBody);
            assertSameValue(null, responseJson($response)['data']);
        }

        assertSameValue(20, count(loadJsonFixture($root . '/comments.json')));
    } finally {
        removeDirectory($root);
    }
});

test('comment for an unknown video returns the documented error without writing', function () use ($projectRoot): void {
    $root = temporaryDirectory();

    try {
        copy($projectRoot . '/storage/videos.json', $root . '/videos.json');
        copy($projectRoot . '/storage/comments.json', $root . '/comments.json');
        $response = testApp($root)->handle(
            'POST',
            '/api/video/comment',
            ['Content-Type' => 'application/json'],
            [],
            '{"commentText":"hello","videoUUID":"C80137E8-4FAE-980C-A222-BB5F1A71CE2B"}'
        );

        assertSameValue(400, $response->status());
        assertSameValue([
            'code' => 400,
            'msg' => 'No video of this UUID can be found.',
            'data' => null,
        ], responseJson($response));
        assertSameValue(20, count(loadJsonFixture($root . '/comments.json')));
    } finally {
        removeDirectory($root);
    }
});

runRegisteredTests();
