<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

function copyTestTree(string $source, string $target): void
{
    if (is_link($source)) { return; }
    if (is_file($source)) {
        if (!is_dir(dirname($target))) { mkdir(dirname($target), 0777, true); }
        if (!copy($source, $target)) { throw new RuntimeException('Unable to copy test fixture'); }
        return;
    }
    if (!is_dir($target)) { mkdir($target, 0777, true); }
    foreach (new DirectoryIterator($source) as $entry) {
        if (!$entry->isDot()) { copyTestTree($entry->getPathname(), $target . '/' . $entry->getFilename()); }
    }
}

function startTestServer(string $directory, int $port)
{
    $process = proc_open([PHP_BINARY, '-S', '0.0.0.0:' . $port, 'server.php'], [
        0=>['pipe','r'], 1=>['file',$directory . '/server.log','a'], 2=>['file',$directory . '/server.log','a'],
    ], $pipes, $directory);
    if (!is_resource($process)) { throw new RuntimeException('Unable to start test server'); }
    fclose($pipes[0]);
    for ($attempt = 0; $attempt < 50; ++$attempt) {
        if (!proc_get_status($process)['running']) { proc_close($process); throw new RuntimeException('Test server exited'); }
        $socket = @fsockopen('127.0.0.1', $port, $errno, $message, 0.1);
        if ($socket) { fclose($socket); return $process; }
        usleep(100000);
    }
    stopTestServer($process);
    throw new RuntimeException('Test server did not become ready');
}

function stopTestServer($process): void
{
    if (is_resource($process)) { proc_terminate($process); proc_close($process); }
}

function checkedCommand(string $command): void
{
    passthru($command, $code);
    if ($code !== 0) { throw new RuntimeException('Test command failed with exit code ' . $code); }
}

$directory = createTemporaryDirectory('mycity-http');
$process = null;
$exitCode = 1;
try {
    foreach (['unit.php','postman-contract.php'] as $testFile) {
        checkedCommand(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/' . $testFile));
    }
    $project = dirname(__DIR__);
    foreach (['server.php','src','public','data'] as $entry) { copyTestTree($project . '/' . $entry, $directory . '/' . $entry); }
    foreach (['users.json','saved_routes.json'] as $file) { copy(__DIR__ . '/fixtures/' . $file, $directory . '/data/' . $file); }
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $message);
    if (!$socket) { throw new RuntimeException('Unable to select a free test port'); }
    $address = stream_socket_get_name($socket, false);
    $port = (int) substr(strrchr($address, ':'), 1);
    fclose($socket);
    $process = startTestServer($directory, $port);
    $http = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/http.php') . ' http://127.0.0.1:' . $port;
    checkedCommand($http);
    stopTestServer($process);
    $process = startTestServer($directory, $port);
    checkedCommand($http . ' --persistence');
    if (in_array('--newman', $argv, true)) {
        checkedCommand('npm exec --offline --yes --package=newman -- newman run '
            . escapeshellarg(__DIR__ . '/IS2025_MyCity_Transit.postman_collection.json')
            . ' --env-var BASE_URL=127.0.0.1 --env-var SERVICE_PORT=' . $port
            . ' --reporter-cli-no-console --color off');
    }
    $exitCode = 0;
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
} finally {
    stopTestServer($process);
    // Only the uniquely created temporary test tree is removed.
    removeDirectory($directory);
}
exit($exitCode);
