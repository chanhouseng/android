<?php

declare(strict_types=1);

$publicPath = __DIR__ . '/public';
$requestedPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$filePath = realpath($publicPath . $requestedPath);

if ($filePath !== false && str_starts_with($filePath, realpath($publicPath)) && is_file($filePath)) {
    return false;
}

require $publicPath . '/index.php';
