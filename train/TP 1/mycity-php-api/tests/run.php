<?php

declare(strict_types=1);

$projectDirectory = dirname(__DIR__);
$usersFile = $projectDirectory . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'users.json';
$savedRoutesFile = $projectDirectory . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'saved_routes.json';
$usersBackup = file_get_contents($usersFile);
$savedRoutesBackup = file_get_contents($savedRoutesFile);
if ($usersBackup === false || $savedRoutesBackup === false) {
    fwrite(STDERR, 'Unable to back up mutable test data.' . PHP_EOL);
    exit(1);
}

$process = null;
$pipes = [];
$exitCode = 1;

try {
    passthru(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . DIRECTORY_SEPARATOR . 'unit.php'), $unitExitCode);
    if ($unitExitCode !== 0) {
        throw new RuntimeException('Unit tests failed.');
    }

    $command = [PHP_BINARY, '-S', '127.0.0.1:39081', 'server.php'];
    $process = proc_open(
        $command,
        [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ],
        $pipes,
        $projectDirectory,
    );
    if (!is_resource($process)) {
        throw new RuntimeException('Unable to start the PHP server.');
    }

    $ready = false;
    for ($attempt = 0; $attempt < 50; ++$attempt) {
        $socket = @fsockopen('127.0.0.1', 39081, $errorCode, $errorMessage, 0.1);
        if (is_resource($socket)) {
            fclose($socket);
            $ready = true;
            break;
        }
        usleep(100000);
    }
    if (!$ready) {
        throw new RuntimeException('PHP test server did not become ready.');
    }

    passthru(
        escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . DIRECTORY_SEPARATOR . 'http.php') . ' http://127.0.0.1:39081',
        $httpExitCode,
    );
    if ($httpExitCode !== 0) {
        throw new RuntimeException('HTTP tests failed.');
    }

    $exitCode = 0;
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
} finally {
    if (is_resource($process)) {
        proc_terminate($process);
    }
    foreach ($pipes as $pipe) {
        if (is_resource($pipe)) {
            fclose($pipe);
        }
    }
    if (is_resource($process)) {
        proc_close($process);
    }

    file_put_contents($usersFile, $usersBackup, LOCK_EX);
    file_put_contents($savedRoutesFile, $savedRoutesBackup, LOCK_EX);
}

exit($exitCode);

