<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$responseFile = __DIR__ . '/../src/Response.php';
$fileStoreFile = __DIR__ . '/../src/FileStore.php';
if (is_file($responseFile)) {
    require_once $responseFile;
}
if (is_file($fileStoreFile)) {
    require_once $fileStoreFile;
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

runTests($argv[1] ?? null);

