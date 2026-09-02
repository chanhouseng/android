<?php

declare(strict_types=1);

final class DuplicateSavedRouteException extends RuntimeException
{
}

final class App
{
    private FileStore $store;

    private AuthService $auth;

    private string $resourceDirectory;

    public function __construct(FileStore $store, string $resourceDirectory)
    {
        $this->store = $store;
        $this->auth = new AuthService($store);
        $this->resourceDirectory = $resourceDirectory;
    }

    /** @param array<string, mixed> $headers */
    public function handle(string $method, string $uri, array $headers, string $body): Response
    {
        $path = parse_url($uri, PHP_URL_PATH);
        $path = is_string($path) ? rawurldecode($path) : '/';
        $method = strtoupper($method);
        $headers = $this->normalizeHeaders($headers);

        try {
            if ($path === '/api/users/signin') {
                if ($method !== 'POST') {
                    return Response::json(405, 'Method Not Allowed', null);
                }

                return $this->signIn($body);
            }

            if ($path === '/api/transit/routes') {
                if ($method !== 'GET') {
                    return Response::json(405, 'Method Not Allowed', null);
                }

                return $this->getRoutes();
            }

            if ($path === '/api/weather/current') {
                if ($method !== 'GET') {
                    return Response::json(405, 'Method Not Allowed', null);
                }

                return $this->getWeather();
            }

            if ($path === '/api/alerts') {
                if ($method !== 'GET') {
                    return Response::json(405, 'Method Not Allowed', null);
                }

                return $this->getAlerts();
            }

            if ($path === '/api/routes/save') {
                if ($method !== 'PUT') {
                    return Response::json(405, 'Method Not Allowed', null);
                }

                return $this->saveRoute($headers, $body);
            }

            if ($path === '/api/routes/saved') {
                if ($method !== 'GET') {
                    return Response::json(405, 'Method Not Allowed', null);
                }

                return $this->getSavedRoutes($headers);
            }

            if ($path === '/api/privacy-policy') {
                if ($method !== 'GET') {
                    return Response::json(405, 'Method Not Allowed', null);
                }

                return $this->privacyPolicy();
            }

            if (str_starts_with($path, '/api/resources/')) {
                if ($method !== 'GET') {
                    return Response::json(405, 'Method Not Allowed', null);
                }

                return $this->serveResource(substr($path, strlen('/api/resources/')));
            }

            return Response::json(404, 'Not Found', null);
        } catch (RuntimeException $error) {
            return Response::json(500, 'Internal Server Error', null);
        }
    }

    private function signIn(string $body): Response
    {
        try {
            $decoded = json_decode($body, false, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            return Response::json(400, 'Bad Request: invalid JSON body', null);
        }

        if (!$decoded instanceof stdClass) {
            return Response::json(400, 'Bad Request: JSON body must be an object', null);
        }

        $input = get_object_vars($decoded);
        $email = $input['userEmailAddress'] ?? null;
        $password = $input['userPassword'] ?? null;
        if (!is_string($email) || !is_string($password)) {
            return Response::json(400, 'Bad Request: userEmailAddress and userPassword are required strings', null);
        }

        $email = trim($email);
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            return Response::json(400, 'Bad Request: invalid email address', null);
        }

        if (strlen($password) < 6 || preg_match('/[A-Za-z]/', $password) !== 1 || preg_match('/\d/', $password) !== 1) {
            return Response::json(400, 'Bad Request: password must be at least 6 characters and contain letters and numbers', null);
        }

        try {
            $result = $this->auth->signIn($email, $password);
        } catch (AuthException $error) {
            return Response::json(401, 'Unauthorized: invalid email or password', null);
        }

        return Response::json(
            $result['created'] ? 201 : 200,
            'Sign in successful',
            ['auth_token' => $result['auth_token']],
        );
    }

    private function getRoutes(): Response
    {
        $storedRoutes = $this->store->read('routes.json');
        if (!is_array($storedRoutes) || !self::isList($storedRoutes)) {
            throw new RuntimeException('Route data is invalid.');
        }

        $routes = [];
        foreach ($storedRoutes as $route) {
            if (!is_array($route)) {
                throw new RuntimeException('Route data is invalid.');
            }

            foreach (['route_id', 'route_name', 'route_type', 'status'] as $field) {
                if (!isset($route[$field]) || !is_string($route[$field])) {
                    throw new RuntimeException('Route data is invalid.');
                }
            }

            $departures = $route['next_departures'] ?? null;
            $stops = $route['stops'] ?? null;
            if (!is_array($departures) || !is_array($stops)) {
                throw new RuntimeException('Route data is invalid.');
            }

            usort($stops, static function (mixed $left, mixed $right): int {
                if (!is_array($left) || !is_array($right)) {
                    throw new RuntimeException('Route stop data is invalid.');
                }

                return ($left['sequence'] ?? 0) <=> ($right['sequence'] ?? 0);
            });

            $stopNames = [];
            foreach ($stops as $stop) {
                if (!is_array($stop) || !isset($stop['stop_name']) || !is_string($stop['stop_name'])) {
                    throw new RuntimeException('Route stop data is invalid.');
                }
                $stopNames[] = $stop['stop_name'];
            }

            $nextDeparture = $departures[0] ?? null;
            if ($nextDeparture !== null && !is_string($nextDeparture)) {
                throw new RuntimeException('Route departure data is invalid.');
            }

            $routes[] = [
                'route_id' => $route['route_id'],
                'route_name' => $route['route_name'],
                'route_type' => $route['route_type'],
                'status' => $route['status'],
                'next_departure' => $nextDeparture,
                'stops' => $stopNames,
            ];
        }

        return Response::json(200, 'Success', $routes);
    }

    private function getWeather(): Response
    {
        $weather = $this->store->read('weather.json');
        if (!is_array($weather)) {
            throw new RuntimeException('Weather data is invalid.');
        }

        foreach (['city', 'condition'] as $field) {
            if (!isset($weather[$field]) || !is_string($weather[$field])) {
                throw new RuntimeException('Weather data is invalid.');
            }
        }

        foreach (['temperature_c', 'humidity_pct', 'wind_kmh'] as $field) {
            if (!isset($weather[$field]) || !is_int($weather[$field]) && !is_float($weather[$field])) {
                throw new RuntimeException('Weather data is invalid.');
            }
        }

        return Response::json(200, 'Success', [
            'city' => $weather['city'],
            'temperature_c' => $weather['temperature_c'],
            'condition' => $weather['condition'],
            'humidity_pct' => $weather['humidity_pct'],
            'wind_kmh' => $weather['wind_kmh'],
        ]);
    }

    private function getAlerts(): Response
    {
        $storedAlerts = $this->store->read('alerts.json');
        if (!is_array($storedAlerts) || !self::isList($storedAlerts)) {
            throw new RuntimeException('Alert data is invalid.');
        }

        $severityRanks = ['high' => 3, 'medium' => 2, 'low' => 1];
        usort($storedAlerts, static function (mixed $left, mixed $right) use ($severityRanks): int {
            if (!is_array($left) || !is_array($right)) {
                throw new RuntimeException('Alert data is invalid.');
            }

            $leftRank = $severityRanks[$left['severity'] ?? ''] ?? 0;
            $rightRank = $severityRanks[$right['severity'] ?? ''] ?? 0;
            if ($leftRank !== $rightRank) {
                return $rightRank <=> $leftRank;
            }

            return strcmp((string) ($right['created_at'] ?? ''), (string) ($left['created_at'] ?? ''));
        });

        $alerts = [];
        foreach ($storedAlerts as $alert) {
            if (!is_array($alert)) {
                throw new RuntimeException('Alert data is invalid.');
            }

            foreach (['alert_id', 'title', 'status', 'severity', 'description', 'created_at'] as $field) {
                if (!isset($alert[$field]) || !is_string($alert[$field])) {
                    throw new RuntimeException('Alert data is invalid.');
                }
            }
            if (!isset($alert['affected_routes']) || !is_array($alert['affected_routes'])) {
                throw new RuntimeException('Alert data is invalid.');
            }
            foreach ($alert['affected_routes'] as $affectedRoute) {
                if (!is_string($affectedRoute)) {
                    throw new RuntimeException('Alert data is invalid.');
                }
            }

            $alerts[] = [
                'alert_id' => $alert['alert_id'],
                'title' => $alert['title'],
                'affected_routes' => array_values($alert['affected_routes']),
                'status' => $alert['status'],
                'severity' => $alert['severity'],
                'description' => $alert['description'],
                'created_at' => $alert['created_at'],
            ];
        }

        return Response::json(200, 'Success', $alerts);
    }

    /** @param array<string, string> $headers */
    private function saveRoute(array $headers, string $body): Response
    {
        $user = $this->authenticatedUser($headers);
        if ($user === null) {
            return Response::json(401, 'Unauthorized: missing or invalid auth_token', null);
        }

        try {
            $decoded = json_decode($body, false, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            return Response::json(400, 'Bad Request: invalid JSON body', null);
        }

        if (!$decoded instanceof stdClass) {
            return Response::json(400, 'Bad Request: JSON body must be an object', null);
        }

        $input = get_object_vars($decoded);
        $routeId = $input['route_id'] ?? null;
        if (!is_string($routeId) || trim($routeId) === '') {
            return Response::json(400, 'Bad Request: route_id is required', null);
        }
        $routeId = trim($routeId);

        $routes = $this->store->read('routes.json');
        if (!is_array($routes) || !self::isList($routes)) {
            throw new RuntimeException('Route data is invalid.');
        }

        $routeExists = false;
        foreach ($routes as $route) {
            if (is_array($route) && ($route['route_id'] ?? null) === $routeId) {
                $routeExists = true;
                break;
            }
        }
        if (!$routeExists) {
            return Response::json(404, 'Not Found: route does not exist', null);
        }

        $userId = $user['user_id'] ?? null;
        if (!is_string($userId) || $userId === '') {
            throw new RuntimeException('User data is invalid.');
        }
        $savedAt = date('Y-m-d H:i:s');

        try {
            $this->store->update('saved_routes.json', static function (mixed $savedRoutes) use ($userId, $routeId, $savedAt): array {
                if (!is_array($savedRoutes) || !self::isList($savedRoutes)) {
                    throw new RuntimeException('Saved route data is invalid.');
                }

                foreach ($savedRoutes as $savedRoute) {
                    if (
                        is_array($savedRoute)
                        && ($savedRoute['user_id'] ?? null) === $userId
                        && ($savedRoute['route_id'] ?? null) === $routeId
                    ) {
                        throw new DuplicateSavedRouteException('Route is already saved.');
                    }
                }

                $savedRoutes[] = [
                    'user_id' => $userId,
                    'route_id' => $routeId,
                    'saved_at' => $savedAt,
                ];

                return $savedRoutes;
            });
        } catch (DuplicateSavedRouteException $error) {
            return Response::json(409, 'Conflict: route is already saved', null);
        }

        return Response::json(200, 'Success', [
            'route_id' => $routeId,
            'saved_at' => $savedAt,
        ]);
    }

    /** @param array<string, string> $headers */
    private function getSavedRoutes(array $headers): Response
    {
        $user = $this->authenticatedUser($headers);
        if ($user === null) {
            return Response::json(401, 'Unauthorized: missing or invalid auth_token', null);
        }

        $userId = $user['user_id'] ?? null;
        if (!is_string($userId) || $userId === '') {
            throw new RuntimeException('User data is invalid.');
        }

        $routes = $this->store->read('routes.json');
        $storedSavedRoutes = $this->store->read('saved_routes.json');
        if (!is_array($routes) || !self::isList($routes) || !is_array($storedSavedRoutes) || !self::isList($storedSavedRoutes)) {
            throw new RuntimeException('Saved route data is invalid.');
        }

        $routeNames = [];
        foreach ($routes as $route) {
            if (
                !is_array($route)
                || !isset($route['route_id'], $route['route_name'])
                || !is_string($route['route_id'])
                || !is_string($route['route_name'])
            ) {
                throw new RuntimeException('Route data is invalid.');
            }
            $routeNames[$route['route_id']] = $route['route_name'];
        }

        $mine = [];
        foreach ($storedSavedRoutes as $savedRoute) {
            if (!is_array($savedRoute) || ($savedRoute['user_id'] ?? null) !== $userId) {
                continue;
            }

            $routeId = $savedRoute['route_id'] ?? null;
            $savedAt = $savedRoute['saved_at'] ?? null;
            if (!is_string($routeId) || !is_string($savedAt) || !isset($routeNames[$routeId])) {
                throw new RuntimeException('Saved route data is invalid.');
            }

            $mine[] = [
                'route_id' => $routeId,
                'route_name' => $routeNames[$routeId],
                'saved_at' => $savedAt,
            ];
        }

        usort($mine, static fn (array $left, array $right): int => strcmp($right['saved_at'], $left['saved_at']));

        return Response::json(200, 'Success', $mine);
    }

    /** @param array<string, string> $headers
     *  @return array<string, mixed>|null
     */
    private function authenticatedUser(array $headers): ?array
    {
        return $this->auth->userForToken($headers['auth_token'] ?? null);
    }

    /** @param array<string, mixed> $headers
     *  @return array<string, string>
     */
    private function normalizeHeaders(array $headers): array
    {
        $normalized = [];
        foreach ($headers as $name => $value) {
            if (is_string($name) && (is_string($value) || is_numeric($value))) {
                $normalized[strtolower($name)] = trim((string) $value);
            }
        }

        return $normalized;
    }

    private static function isList(array $values): bool
    {
        $expectedKey = 0;
        foreach ($values as $key => $value) {
            if ($key !== $expectedKey) {
                return false;
            }
            ++$expectedKey;
        }

        return true;
    }

    private function privacyPolicy(): Response
    {
        $html = <<<'HTML'
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Privacy Policy</title>
</head>
<body>
    <main>
        <h1>Privacy Policy</h1>
        <p>MyCity Transit uses your sign-in information only to identify your account and keep your saved routes.</p>
        <p>Transit, weather, and service alert information is provided for travel planning. This local practice server does not sell personal information.</p>
        <p>You may stop using the service at any time. Keep your authentication token private.</p>
        <button id="closeBtn" type="button" onclick="window.close()">Close</button>
    </main>
</body>
</html>
HTML;

        return new Response(200, $html, ['Content-Type' => 'text/html; charset=utf-8']);
    }

    private function serveResource(string $relativePath): Response
    {
        if (
            $relativePath === ''
            || str_contains($relativePath, "\0")
            || str_contains($relativePath, '\\')
            || str_starts_with($relativePath, '/')
            || preg_match('/^[A-Za-z]:/', $relativePath) === 1
        ) {
            return Response::json(404, 'Not Found', null);
        }

        $segments = explode('/', $relativePath);
        foreach ($segments as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..') {
                return Response::json(404, 'Not Found', null);
            }
        }

        $root = realpath($this->resourceDirectory);
        if ($root === false) {
            throw new RuntimeException('Resource directory is unavailable.');
        }

        $candidate = $root . DIRECTORY_SEPARATOR . implode(DIRECTORY_SEPARATOR, $segments);
        $file = realpath($candidate);
        if ($file === false || !is_file($file)) {
            return Response::json(404, 'Not Found', null);
        }

        $rootPrefix = rtrim($root, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
        if (strncasecmp($file, $rootPrefix, strlen($rootPrefix)) !== 0) {
            return Response::json(404, 'Not Found', null);
        }

        $contents = file_get_contents($file);
        if ($contents === false) {
            throw new RuntimeException('Unable to read resource file.');
        }

        $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        $mimeTypes = [
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'svg' => 'image/svg+xml',
            'json' => 'application/json',
            'mp3' => 'audio/mpeg',
            'webp' => 'image/webp',
            'txt' => 'text/plain; charset=utf-8',
        ];

        return new Response(200, $contents, ['Content-Type' => $mimeTypes[$extension] ?? 'application/octet-stream']);
    }
}
