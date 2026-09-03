<?php
declare(strict_types=1);

spl_autoload_register(static function (string $class): void {
    $path = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . $class . '.php';
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
        throw new RuntimeException(
            $message !== ''
                ? $message
                : 'Expected ' . var_export($expected, true) . ', got ' . var_export($actual, true)
        );
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

function removeDirectory(string $path): void
{
    if (!is_dir($path)) {
        return;
    }

    $items = scandir($path);
    if ($items === false) {
        throw new RuntimeException('Unable to inspect temporary directory.');
    }

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }

        $target = $path . DIRECTORY_SEPARATOR . $item;
        if (is_dir($target) && !is_link($target)) {
            removeDirectory($target);
        } else {
            unlink($target);
        }
    }

    rmdir($path);
}

function loadJsonFixture(string $path): array
{
    $contents = @file_get_contents($path);
    if ($contents === false) {
        throw new RuntimeException('Fixture is missing: ' . $path);
    }

    $data = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($data)) {
        throw new RuntimeException('Fixture is not an array: ' . $path);
    }

    return $data;
}

function responseJson(Response $response): array
{
    $data = json_decode($response->body(), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($data)) {
        throw new RuntimeException('Response body is not a JSON object.');
    }

    return $data;
}

function testApp(?string $storageRoot = null, ?string $mediaRoot = null): App
{
    $projectRoot = dirname(__DIR__);
    $storageRoot ??= $projectRoot . DIRECTORY_SEPARATOR . 'storage';
    $mediaRoot ??= $projectRoot . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'media';

    return new App(
        new FileStore($storageRoot),
        class_exists('Media') ? new Media() : null,
        $mediaRoot . DIRECTORY_SEPARATOR . 'photos',
        $mediaRoot . DIRECTORY_SEPARATOR . 'skills_images'
    );
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
