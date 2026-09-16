<?php

declare(strict_types=1);

require_once __DIR__ . '/FileStore.php';

final class App
{
    private FileStore $store;

    public function __construct(string $storagePath)
    {
        $this->store = new FileStore($storagePath);
    }

    public function handle(): void
    {

        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

        try {
            if ($method === 'POST' && $path === '/api/users/signin') {
                header('Content-Type: application/json; charset=utf-8');
                $this->signIn();
                return;
            }

            if ($method === 'GET' && $path === '/api/diary') {
                header('Content-Type: application/json; charset=utf-8');
                $this->getAllDiaries();
                return;
            }

            if ($method === 'PUT' && $path === '/api/diary/collection') {
                header('Content-Type: application/json; charset=utf-8');
                $this->insertFavorite();
                return;
            }

            if ($method === 'GET' && $path === '/api/diary/collection') {
                header('Content-Type: application/json; charset=utf-8');
                $this->getFavorites();
                return;
            }

            if ($method === 'GET' && $path === '/api/user-agreement') {
                header('Content-Type: text/html; charset=utf-8');
                echo <<<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>User Agreement</title>
</head>
<body>
    <h1 style="color: red;">User Agreement</h1>
</body>
</html>
HTML;
                return;
            }


            if (str_starts_with($path, '/api/')) {
                $this->servePublicFile(urldecode(substr($path, strlen('/api'))));
                return;
            }

            header('Content-Type: application/json; charset=utf-8');
            $this->jsonResponse(404, [
                'msg' => 'Route not found',
            ]);
        } catch (Throwable $exception) {
            $this->jsonResponse(500, [
                'msg' => 'Internal server error',
                'error' => $exception->getMessage(),
            ]);
        }
    }

    private function signIn(): void
    {
        $input = $this->getInput();
        $email = trim((string) ($input['userEmailAddress'] ?? ''));
        $password = trim((string) ($input['userPassword'] ?? ''));

        if ($email === '' || $password === '') {
            $this->jsonResponse(422, [
                'msg' => 'userEmailAddress and userPassword are required',
            ]);
            return;
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->jsonResponse(422, [
                'msg' => 'Invalid email address',
            ]);
            return;
        }

        $user = $this->store->findUserByEmail($email);

        if ($user === null) {
            $user = $this->store->createUser($email, $password);
        } elseif (!password_verify($password, $user['password_hash'])) {
            $this->jsonResponse(401, [
                'msg' => 'Invalid email or password',
            ]);
            return;
        } else {
            $user = $this->store->refreshUserToken($user['id']);
        }

        $this->jsonResponse(200, [
            'msg' => 'Sign in successful',
            'data' => [
                'auth_token' => $user['auth_token'],
            ],
        ]);
    }

    private function getAllDiaries(): void
    {
        $this->jsonResponse(200, [
            'msg' => 'Success',
            'data' => $this->store->getDiaries(),
        ]);
    }

    private function insertFavorite(): void
    {
        $input = $this->getInput();
        $authToken = $this->extractAuthToken($input);
        $diaryId = trim((string) ($input['diary_id'] ?? ''));

        if ($authToken === '') {
            $this->jsonResponse(401, [
                'msg' => 'auth_token is required',
            ]);
            return;
        }

        if ($diaryId === '') {
            $this->jsonResponse(422, [
                'msg' =>  $input,
            ]);
            return;
        }

        $user = $this->store->findUserByToken($authToken);
        if ($user === null) {
            $this->jsonResponse(401, [
                'msg' => 'Invalid auth_token',
            ]);
            return;
        }

        if ($this->store->findDiaryById($diaryId) === null) {
            $this->jsonResponse(404, [
                'msg' => 'Diary not found',
            ]);
            return;
        }

        $favorite = $this->store->upsertFavorite($user['id'], $diaryId);

        $this->jsonResponse(200, [
            'msg' => 'Success',
            'data' => $favorite,
        ]);
    }

    private function getFavorites(): void
    {
        $authToken = $this->extractAuthToken([]);

        if ($authToken === '') {
            $this->jsonResponse(401, [
                'msg' => 'auth_token is required',
            ]);
            return;
        }

        $user = $this->store->findUserByToken($authToken);
        if ($user === null) {
            $this->jsonResponse(401, [
                'msg' => 'Invalid auth_token',
            ]);
            return;
        }

        $this->jsonResponse(200, [
            'msg' => 'Success',
            'data' => $this->store->getFavoritesByUserId($user['id']),
        ]);
    }

    private function getInput(): array
    {
        $raw = file_get_contents('php://input');
        $contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
        $data = [];

        if (str_contains($contentType, 'application/json') && is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $data = $decoded;
            }
        } elseif (str_contains($contentType, 'multipart/form-data') && is_string($raw) && $raw !== '') {
            $data = $this->parseMultipart($raw, $contentType);
        } elseif (is_string($raw) && $raw !== '') {
            parse_str($raw, $parsed);
            if (is_array($parsed)) {
                $data = $parsed;
            }
        }

        return array_merge($_GET, $_POST, $data);
    }

    private function parseMultipart(string $raw, string $contentType): array
    {
        if (preg_match('/boundary=(?:"([^"]+)"|([^\s;]+))/i', $contentType, $m) !== 1) {
            return [];
        }

        $boundary = $m[1] !== '' ? $m[1] : $m[2];
        $parts = explode('--' . $boundary, $raw);
        $result = [];

        foreach ($parts as $part) {
            if (!str_contains($part, 'name="')) {
                continue;
            }

            $sections = explode("\r\n\r\n", $part, 2);
            $headerSection = $sections[0];
            $value = $sections[1] ?? '';

            if (preg_match('/name="([^"]+)"/', $headerSection, $nameMatch) === 1) {
                $result[trim($nameMatch[1])] = trim($value);
            }
        }

        return $result;
    }

    private function extractAuthToken(array $input): string
    {
        $authorization = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
        if (preg_match('/Bearer\s+(.+)/i', $authorization, $matches) === 1) {
            return trim($matches[1]);
        }

        $headerToken = (string) ($_SERVER['HTTP_AUTH_TOKEN'] ?? '');
        if ($headerToken !== '') {
            return trim($headerToken);
        }

        $bodyToken = (string) ($input['auth_token'] ?? '');
        if ($bodyToken !== '') {
            return trim($bodyToken);
        }

        return trim((string) ($_GET['auth_token'] ?? ''));
    }

    private function servePublicFile(string $relativePath): void
    {
        $basePath = realpath(__DIR__ . '/../public');
        if ($basePath === false) {
            header('Content-Type: application/json; charset=utf-8');
            $this->jsonResponse(404, ['msg' => 'Public directory not found']);
            return;
        }

        $filePath = realpath($basePath . $relativePath);
        if ($filePath === false || !str_starts_with($filePath, $basePath) || !is_file($filePath)) {
            header('Content-Type: application/json; charset=utf-8');
            $this->jsonResponse(404, ['msg' => 'Resource not found']);
            return;
        }

        $mimeTypes = [
            'jpg'  => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png'  => 'image/png',
            'gif'  => 'image/gif',
            'webp' => 'image/webp',
            'json' => 'application/json',
            'html' => 'text/html',
            'css'  => 'text/css',
            'js'   => 'application/javascript',
            'svg'  => 'image/svg+xml',
            'mp4'  => 'video/mp4',
            'mp3'  => 'audio/mpeg',
            'pdf'  => 'application/pdf',
        ];

        $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        $mime = $mimeTypes[$extension] ?? 'application/octet-stream';

        header('Content-Type: ' . $mime);
        header('Content-Length: ' . filesize($filePath));
        readfile($filePath);
    }

    private function jsonResponse(int $statusCode, array $payload): void
    {
        http_response_code($statusCode);
        echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }
}
