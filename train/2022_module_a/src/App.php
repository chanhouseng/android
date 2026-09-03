<?php
declare(strict_types=1);

final class App
{
    public function __construct(
        private FileStore $store,
        private Media $media,
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

        try {
            if ($path === '/api/image/photos') {
                return $this->photos($form, $headers, $server);
            }

            if (preg_match('#^/api/image/photos/([^/]+)$#', $path, $matches) === 1) {
                return $this->photoFile($matches[1]);
            }

            if ($path === '/api/skills-types') {
                return $this->success($this->store->read('skill-types.json'));
            }

            if (preg_match('#^/api/skills/([^/]+)$#', $path, $matches) === 1) {
                return $this->skill(rawurldecode($matches[1]), $headers, $server);
            }

            if (preg_match('#^/api/image/skills_images/([^/]+)$#', $path, $matches) === 1) {
                return $this->skillImage($matches[1]);
            }

            if ($path === '/api/video') {
                return $this->success($this->store->read('videos.json'));
            }

            if ($path === '/api/video/comment') {
                return $method === 'GET'
                    ? $this->success($this->store->read('comments.json'))
                    : $this->createComment($rawBody, $server);
            }

            return $this->error(404, 'Not Found');
        } catch (Throwable $error) {
            error_log('WS-MAD request failed: ' . $error->getMessage());
            return $this->error(500, 'Internal Server Error');
        }
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

    private function photos(array $form, array $headers, array $server): Response
    {
        $pageNumber = $form['pageNumber'] ?? null;
        if ($pageNumber === null || $pageNumber === '') {
            return $this->success([
                'firstPageNumber' => 0,
                'totalPhotos' => 18,
                'totalPage' => 2,
            ]);
        }

        if ($pageNumber !== 0 && $pageNumber !== 1 && $pageNumber !== '0' && $pageNumber !== '1') {
            return $this->error(400, 'PageNumber out of limit.');
        }

        $page = (int) $pageNumber;
        $baseUrl = $this->baseUrl($headers, $server);
        $result = [];

        foreach ($this->store->read('photos.json') as $photo) {
            if (($photo['pageNumber'] ?? null) !== $page) {
                continue;
            }

            $result[] = [
                'visit-count' => (string) $photo['visit-count'],
                'heat' => (string) $photo['heat'],
                'url' => $baseUrl . '/api/image/photos/' . rawurlencode((string) $photo['filename']),
            ];
        }

        return $this->success($result);
    }

    private function photoFile(string $encodedFilename): Response
    {
        $allowed = array_map(
            static fn (array $photo): string => (string) $photo['filename'],
            $this->store->read('photos.json')
        );
        $path = $this->media->resolve($this->photoRoot, $encodedFilename, $allowed);

        if ($path === null) {
            return $this->error(404, 'Not Found');
        }

        return $this->jpeg($path);
    }

    private function skill(string $id, array $headers, array $server): Response
    {
        foreach ($this->store->read('skills.json') as $skill) {
            if (($skill['id'] ?? null) !== $id) {
                continue;
            }

            return $this->success([
                'id' => (string) $skill['id'],
                'name' => (string) $skill['name'],
                'introduction' => (string) $skill['introduction'],
                'img' => $this->baseUrl($headers, $server)
                    . '/api/image/skills_images/'
                    . rawurlencode((string) $skill['image']),
            ]);
        }

        return $this->error(404, 'Skill not found.');
    }

    private function skillImage(string $encodedFilename): Response
    {
        $allowed = array_map(
            static fn (array $skill): string => (string) $skill['image'],
            $this->store->read('skills.json')
        );
        $path = $this->media->resolve($this->skillImageRoot, $encodedFilename, $allowed);

        if ($path === null) {
            return $this->error(404, 'Not Found');
        }

        return $this->jpeg($path);
    }

    private function createComment(string $rawBody, array $server): Response
    {
        try {
            $payload = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return $this->error(400, 'Invalid request body.');
        }

        if (!is_array($payload) || $this->isList($payload)) {
            return $this->error(400, 'Invalid request body.');
        }

        $commentText = $payload['commentText'] ?? null;
        $videoUuid = $payload['videoUUID'] ?? null;
        if (
            !is_string($commentText)
            || trim($commentText) === ''
            || !is_string($videoUuid)
            || $videoUuid === ''
        ) {
            return $this->error(400, 'Invalid comment data.');
        }

        $knownVideo = false;
        foreach ($this->store->read('videos.json') as $video) {
            if (($video['uuid'] ?? null) === $videoUuid) {
                $knownVideo = true;
                break;
            }
        }

        if (!$knownVideo) {
            return $this->error(400, 'No video of this UUID can be found.');
        }

        $remoteAddress = $server['REMOTE_ADDR'] ?? null;
        $comment = [
            'uuid' => $this->uuidV4(),
            'ipAddress' => is_string($remoteAddress) && $remoteAddress !== '' ? $remoteAddress : '127.0.0.1',
            'commentText' => $commentText,
            'commentTime' => (int) floor(microtime(true) * 1000),
            'videoUUID' => $videoUuid,
        ];

        $this->store->append('comments.json', $comment);

        return $this->success($comment);
    }

    private function isList(array $value): bool
    {
        return $value === [] || array_keys($value) === range(0, count($value) - 1);
    }

    private function uuidV4(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }

    private function jpeg(string $path): Response
    {
        $bytes = file_get_contents($path);
        if ($bytes === false) {
            throw new RuntimeException('Unable to read media file.');
        }

        $imageInfo = @getimagesize($path);
        $contentType = is_array($imageInfo) ? ($imageInfo['mime'] ?? null) : null;
        if ($contentType !== 'image/jpeg') {
            throw new RuntimeException('Unexpected media type.');
        }

        return Response::binary(200, $bytes, $contentType);
    }

    private function baseUrl(array $headers, array $server): string
    {
        $host = $this->header($headers, 'host');
        if ($host === null || !$this->validHost($host)) {
            $host = 'localhost:3000';
        }

        $https = $server['HTTPS'] ?? '';
        $scheme = is_string($https) && $https !== '' && strtolower($https) !== 'off' ? 'https' : 'http';

        return $scheme . '://' . $host;
    }

    private function header(array $headers, string $wanted): ?string
    {
        foreach ($headers as $name => $value) {
            if (is_string($name) && strtolower($name) === $wanted && is_string($value)) {
                return $value;
            }
        }

        return null;
    }

    private function validHost(string $host): bool
    {
        if (preg_match('~[\x00-\x20\x7f\\/]~', $host) === 1) {
            return false;
        }

        if (preg_match('/^\[([^]]+)](?::([0-9]+))?$/', $host, $matches) === 1) {
            return filter_var($matches[1], FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false
                && $this->validPort($matches[2] ?? null);
        }

        $parts = explode(':', $host);
        if (count($parts) > 2) {
            return false;
        }

        $hostname = $parts[0];
        $validName = $hostname === 'localhost'
            || filter_var($hostname, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false
            || filter_var($hostname, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME) !== false;

        return $validName && $this->validPort($parts[1] ?? null);
    }

    private function validPort(?string $port): bool
    {
        if ($port === null) {
            return true;
        }

        return preg_match('/^[0-9]+$/', $port) === 1 && (int) $port >= 1 && (int) $port <= 65535;
    }

    private function success(array $data): Response
    {
        return Response::json(200, [
            'code' => 200,
            'msg' => 'Success',
            'data' => $data,
        ]);
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
