<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Response.php';
require_once dirname(__DIR__) . '/src/FileStore.php';
require_once dirname(__DIR__) . '/src/AuthService.php';
require_once dirname(__DIR__) . '/src/App.php';

$dataDirectory = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data';
$headers = function_exists('getallheaders') ? getallheaders() : [];
if (!is_array($headers)) {
    $headers = [];
}

$app = new App(
    new FileStore($dataDirectory),
    $dataDirectory . DIRECTORY_SEPARATOR . 'resources',
);

$response = $app->handle(
    $_SERVER['REQUEST_METHOD'] ?? 'GET',
    $_SERVER['REQUEST_URI'] ?? '/',
    $headers,
    file_get_contents('php://input') ?: '',
);
$response->send();

