<?php
declare(strict_types=1);

$projectRoot = dirname(__DIR__);

spl_autoload_register(static function (string $class) use ($projectRoot): void {
    $path = $projectRoot . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . $class . '.php';
    if (is_file($path)) {
        require_once $path;
    }
});

$headers = [];
if (function_exists('getallheaders')) {
    $detectedHeaders = getallheaders();
    if (is_array($detectedHeaders)) {
        $headers = $detectedHeaders;
    }
} else {
    foreach ($_SERVER as $name => $value) {
        if (str_starts_with($name, 'HTTP_') && is_string($value)) {
            $headerName = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))));
            $headers[$headerName] = $value;
        }
    }
}

$app = new App(
    new FileStore($projectRoot . DIRECTORY_SEPARATOR . 'storage'),
    new Media(),
    $projectRoot . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'media' . DIRECTORY_SEPARATOR . 'photos',
    $projectRoot . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'media' . DIRECTORY_SEPARATOR . 'skills_images'
);

$rawBody = file_get_contents('php://input');
$response = $app->handle(
    is_string($_SERVER['REQUEST_METHOD'] ?? null) ? $_SERVER['REQUEST_METHOD'] : 'GET',
    is_string($_SERVER['REQUEST_URI'] ?? null) ? $_SERVER['REQUEST_URI'] : '/',
    $headers,
    is_array($_POST) ? $_POST : [],
    $rawBody === false ? '' : $rawBody,
    $_SERVER
);
$response->send();

