<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/App.php';

$app = new App(__DIR__ . '/../storage/data');
$app->handle();
