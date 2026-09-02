<?php

declare(strict_types=1);

final class TestFailure extends RuntimeException
{
}

/** @var array<string, array<string, Closure>> */
$GLOBALS['tests'] = [];

function test(string $group, string $name, Closure $test): void
{
    $GLOBALS['tests'][$group][$name] = $test;
}

function assertSameValue(mixed $expected, mixed $actual, string $message = ''): void
{
    if ($expected !== $actual) {
        throw new TestFailure(
            ($message !== '' ? $message . PHP_EOL : '')
            . 'Expected: ' . var_export($expected, true) . PHP_EOL
            . 'Actual:   ' . var_export($actual, true)
        );
    }
}

function assertTrue(bool $condition, string $message): void
{
    if (!$condition) {
        throw new TestFailure($message);
    }
}

function createTemporaryDirectory(string $prefix): string
{
    $directory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . $prefix . '-' . bin2hex(random_bytes(6));
    if (!mkdir($directory, 0777, true) && !is_dir($directory)) {
        throw new RuntimeException('Unable to create test directory.');
    }

    return $directory;
}

function removeDirectory(string $directory): void
{
    if (!is_dir($directory)) {
        return;
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST,
    );

    foreach ($iterator as $entry) {
        if ($entry->isDir()) {
            rmdir($entry->getPathname());
        } else {
            unlink($entry->getPathname());
        }
    }

    rmdir($directory);
}

function runTests(?string $selectedGroup = null): never
{
    $passed = 0;
    $failed = 0;

    foreach ($GLOBALS['tests'] as $group => $tests) {
        if ($selectedGroup !== null && $selectedGroup !== $group) {
            continue;
        }

        foreach ($tests as $name => $test) {
            try {
                $test();
                ++$passed;
                fwrite(STDOUT, "PASS [$group] $name" . PHP_EOL);
            } catch (Throwable $error) {
                ++$failed;
                fwrite(STDERR, "FAIL [$group] $name" . PHP_EOL . $error->getMessage() . PHP_EOL);
            }
        }
    }

    fwrite(STDOUT, "Tests: $passed passed, $failed failed" . PHP_EOL);
    exit($failed === 0 ? 0 : 1);
}

