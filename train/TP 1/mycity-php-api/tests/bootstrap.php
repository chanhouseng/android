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

/** @param array<int, array<string, mixed>>|null $users */
function createFixtureData(?array $users = null): string
{
    $directory = createTemporaryDirectory('mycity-fixture');
    mkdir($directory . DIRECTORY_SEPARATOR . 'resources' . DIRECTORY_SEPARATOR . 'maps', 0777, true);

    $files = [
        'users.json' => $users ?? [
            [
                'user_id' => 'USR-001',
                'email' => 'ankit@example.com',
                'password' => 'ankit123',
                'auth_token' => 'TKN-ANKIT-A1B2C3D4E5F6G7H8',
                'created_at' => '2025-01-10 09:00:00',
            ],
        ],
        'routes.json' => [
            [
                'route_id' => 'RTE-BUS-022',
                'route_name' => 'Andheri to Bandra',
                'route_number' => 'BUS-22',
                'route_type' => 'bus',
                'status' => 'on_time',
                'next_departures' => ['2025-04-14 09:45:00', '2025-04-14 09:57:00'],
                'stops' => [
                    ['stop_id' => 'STP-002', 'stop_name' => 'Vile Parle Station', 'sequence' => 2],
                    ['stop_id' => 'STP-001', 'stop_name' => 'Andheri Bus Stand', 'sequence' => 1],
                    ['stop_id' => 'STP-003', 'stop_name' => 'Bandra Station East', 'sequence' => 3],
                ],
            ],
            [
                'route_id' => 'RTE-RAPID-003',
                'route_name' => 'BKC to Thane Rapid',
                'route_number' => 'RAPID-3',
                'route_type' => 'rapid',
                'status' => 'cancelled',
                'next_departures' => [],
                'stops' => [],
            ],
        ],
        'weather.json' => [
            'city' => 'Mumbai',
            'temperature_c' => 32,
            'condition' => 'Partly Cloudy',
            'humidity_pct' => 78,
            'wind_kmh' => 14,
            'country' => 'India',
        ],
        'alerts.json' => [
            [
                'alert_id' => 'ALT-MEDIUM',
                'title' => 'Medium alert',
                'affected_routes' => ['BUS-22'],
                'status' => 'active',
                'severity' => 'medium',
                'description' => 'Medium severity.',
                'created_at' => '2025-04-14 10:00:00',
                'internal_note' => 'must not be exposed',
            ],
            [
                'alert_id' => 'ALT-HIGH-OLD',
                'title' => 'Older high alert',
                'affected_routes' => ['METRO-1'],
                'status' => 'active',
                'severity' => 'high',
                'description' => 'Older high severity.',
                'created_at' => '2025-04-14 08:00:00',
            ],
            [
                'alert_id' => 'ALT-HIGH-NEW',
                'title' => 'Newer high alert',
                'affected_routes' => ['RAPID-3'],
                'status' => 'active',
                'severity' => 'high',
                'description' => 'Newer high severity.',
                'created_at' => '2025-04-14 09:00:00',
            ],
            [
                'alert_id' => 'ALT-LOW',
                'title' => 'Low alert',
                'affected_routes' => [],
                'status' => 'planned',
                'severity' => 'low',
                'description' => 'Low severity.',
                'created_at' => '2025-04-15 12:00:00',
            ],
        ],
        'saved_routes.json' => [],
    ];

    foreach ($files as $file => $data) {
        file_put_contents(
            $directory . DIRECTORY_SEPARATOR . $file,
            json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL,
        );
    }

    return $directory;
}

function fixtureApp(string $directory): App
{
    return new App(
        new FileStore($directory),
        $directory . DIRECTORY_SEPARATOR . 'resources',
    );
}

/** @return array{msg: string, data: mixed} */
function decodeResponse(Response $response): array
{
    $decoded = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
    assertTrue(is_array($decoded), 'Response body is not a JSON object.');

    return $decoded;
}

function runTests(?string $selectedGroup = null): void
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
