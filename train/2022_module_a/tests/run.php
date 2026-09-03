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

runRegisteredTests();

