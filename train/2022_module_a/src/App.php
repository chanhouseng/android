<?php
declare(strict_types=1);

final class App
{
    public function __construct(
        private FileStore $store,
        private ?Media $media,
        private string $photoRoot,
        private string $skillImageRoot
    ) {
    }

    public function handle(
        string $method,
        string $uri,
        array $headers = [],
        array $form = [],
        string $rawBody = '',
        array $server = []
    ): Response {
        $method = strtoupper($method);
        $path = parse_url($uri, PHP_URL_PATH);
        $path = is_string($path) && $path !== '' ? $path : '/';
        $allowedMethods = $this->allowedMethods($path);

        if ($allowedMethods === null) {
            return $this->error(404, 'Not Found');
        }

        if (!in_array($method, $allowedMethods, true)) {
            return $this->error(405, 'Method Not Allowed', [
                'Allow' => implode(', ', $allowedMethods),
            ]);
        }

        return $this->error(404, 'Not Found');
    }

    private function allowedMethods(string $path): ?array
    {
        $routes = [
            '/api/image/photos' => ['POST'],
            '/api/skills-types' => ['GET'],
            '/api/video' => ['GET'],
            '/api/video/comment' => ['GET', 'POST'],
        ];

        if (isset($routes[$path])) {
            return $routes[$path];
        }

        if (preg_match('#^/api/skills/[^/]+$#', $path) === 1) {
            return ['GET'];
        }
        if (preg_match('#^/api/image/photos/[^/]+$#', $path) === 1) {
            return ['GET'];
        }
        if (preg_match('#^/api/image/skills_images/[^/]+$#', $path) === 1) {
            return ['GET'];
        }

        return null;
    }

    private function error(int $status, string $message, array $headers = []): Response
    {
        return Response::json($status, [
            'code' => $status,
            'msg' => $message,
            'data' => null,
        ], $headers);
    }
}

