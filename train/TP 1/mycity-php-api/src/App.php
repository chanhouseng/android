<?php
declare(strict_types=1);

final class ApiException extends RuntimeException
{
    public int $status;
    public function __construct(int $status, string $message)
    {
        parent::__construct($message);
        $this->status = $status;
    }
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

    public function handle(string $method, string $uri, array $headers, string $body): Response
    {
        try {
            $parts = parse_url($uri);
            if ($parts === false) { return Response::json(404, 'Not Found', null); }
            $path = rawurldecode($parts['path'] ?? '/');
            parse_str($parts['query'] ?? '', $query);
            $headers = array_change_key_case($headers, CASE_LOWER);
            $method = strtoupper($method);
            $routes = [
                '/api/users/signin'=>'POST', '/api/transit/routes'=>'GET',
                '/api/transit/stops/nearby'=>'GET', '/api/weather/current'=>'GET',
                '/api/alerts'=>'GET', '/api/routes/save'=>'PUT', '/api/routes/saved'=>'GET',
                '/api/resources/list'=>'GET', '/api/resource'=>'GET', '/api/privacy-policy'=>'GET',
            ];
            $singleRoute = preg_match('~^/api/transit/routes/([^/]+)$~', $path, $routeMatch) === 1;
            $deleteSave = preg_match('~^/api/routes/saved/([^/]+)$~', $path, $saveMatch) === 1;
            $staticFile = str_starts_with($path, '/api/resources/');
            $allowed = $routes[$path] ?? ($singleRoute ? 'GET' : ($deleteSave ? 'DELETE' : ($staticFile ? 'GET' : null)));
            if ($allowed === null) { return Response::json(404, 'Not Found', null); }
            if ($method !== $allowed) {
                $response = Response::json(405, 'Method Not Allowed', null);
                $response->headers['Allow'] = $allowed;
                return $response;
            }
            if ($singleRoute) {
                $route = $this->findRoute($routeMatch[1]);
                return Response::json($route === null ? 404 : 200, $route === null ? 'Route not found' : 'Success', $route);
            }
            if ($deleteSave) { return $this->deleteSavedRoute($headers, $saveMatch[1]); }
            switch ($path) {
                case '/api/users/signin': return $this->signIn($body);
                case '/api/transit/routes':
                    return Response::json(200, 'Success', $this->filter($this->records('routes.json'), $query, ['type'=>'route_type', 'status'=>'status']));
                case '/api/transit/stops/nearby': return $this->nearby($query);
                case '/api/weather/current': return Response::json(200, 'Success', $this->store->read('weather.json'));
                case '/api/alerts': return $this->alerts($query);
                case '/api/routes/save': return $this->saveRoute($headers, $body);
                case '/api/routes/saved': return $this->savedRoutes($headers);
                case '/api/resources/list': return Response::json(200, 'Success', $this->store->read('resources.json'));
                case '/api/resource':
                    $resource = $query['path'] ?? '';
                    if (!is_string($resource) || !str_starts_with($resource, 'resources/')) {
                        return Response::json(404, 'Resource not found', null);
                    }
                    return $this->serveResource(substr($resource, strlen('resources/')), 'Resource not found');
                case '/api/privacy-policy': return $this->privacyPolicy();
            }
            return $this->serveResource(substr($path, strlen('/api/resources/')));
        } catch (ApiException $error) {
            return Response::json($error->status, $error->getMessage(), null);
        } catch (Throwable $error) {
            return Response::json(500, 'Internal Server Error', null);
        }
    }

    private function objectBody(string $body): array
    {
        try { $value = json_decode($body, false, 512, JSON_THROW_ON_ERROR); }
        catch (JsonException $error) { throw new ApiException(400, 'Bad Request: invalid JSON body'); }
        if (!$value instanceof stdClass) { throw new ApiException(400, 'Bad Request: JSON body must be an object'); }
        return get_object_vars($value);
    }

    private function signIn(string $body): Response
    {
        $input = $this->objectBody($body);
        $email = $input['userEmailAddress'] ?? null;
        $password = $input['userPassword'] ?? null;
        if (!is_string($email) || !is_string($password)) {
            throw new ApiException(400, 'Bad Request: userEmailAddress and userPassword are required strings');
        }
        $email = trim($email);
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) { throw new ApiException(400, 'Bad Request: Invalid email format'); }
        if (strlen($password) < 6 || !preg_match('/[A-Za-z]/', $password) || !preg_match('/[0-9]/', $password)) {
            throw new ApiException(400, 'Bad Request: Password must be at least 6 characters and include letters and numbers');
        }
        try { $result = $this->auth->signIn($email, $password); }
        catch (AuthException $error) {
            throw new ApiException(401, 'Sign in failed: Incorrect password. Please check your credentials and try again.');
        }
        return Response::json($result['created'] ? 201 : 200, $result['created'] ? 'Sign up successful' : 'Sign in successful', ['auth_token'=>$result['auth_token']]);
    }

    private function records(string $file): array
    {
        $records = $this->store->read($file);
        if (!is_array($records)) { throw new RuntimeException('Invalid data'); }
        foreach ($records as $index => $record) {
            if (!is_int($index) || !is_array($record)) { throw new RuntimeException('Invalid data'); }
        }
        return array_values($records);
    }

    private function filter(array $records, array $query, array $fields): array
    {
        foreach ($fields as $parameter => $field) {
            if (!isset($query[$parameter])) { continue; }
            if (!is_string($query[$parameter])) { throw new ApiException(400, 'Bad Request: invalid ' . $parameter); }
            $records = array_values(array_filter($records, static fn (array $record): bool => ($record[$field] ?? null) === $query[$parameter]));
        }
        return $records;
    }

    private function findRoute(string $id): ?array
    {
        foreach ($this->records('routes.json') as $route) {
            if (($route['route_id'] ?? null) === $id) { return $route; }
        }
        return null;
    }

    private function alerts(array $query): Response
    {
        $alerts = $this->filter($this->records('alerts.json'), $query, ['status'=>'status', 'severity'=>'severity']);
        $rank = ['high'=>3, 'medium'=>2, 'low'=>1];
        usort($alerts, static function (array $a, array $b) use ($rank): int {
            return (($rank[$b['severity']] ?? 0) <=> ($rank[$a['severity']] ?? 0)) ?: strcmp($b['created_at'], $a['created_at']);
        });
        return Response::json(200, 'Success', $alerts);
    }

    private function nearby(array $query): Response
    {
        foreach (['lat'=>90, 'lng'=>180] as $key => $bound) {
            if (!isset($query[$key])) { throw new ApiException(400, 'Bad Request: lat and lng query parameters are required'); }
            if (!is_string($query[$key]) || !is_numeric($query[$key]) || !is_finite((float) $query[$key]) || abs((float) $query[$key]) > $bound) {
                throw new ApiException(400, 'Bad Request: invalid ' . $key);
            }
        }
        $limit = $query['limit'] ?? '3';
        if (!is_string($limit) || !ctype_digit($limit) || (int) $limit < 1) { throw new ApiException(400, 'Bad Request: limit must be a positive integer'); }
        $lat = deg2rad((float) $query['lat']);
        $lng = deg2rad((float) $query['lng']);
        $stops = [];
        foreach ($this->records('routes.json') as $route) {
            foreach ($route['stops'] as $stop) {
                $id = $stop['stop_id'];
                if (isset($stops[$id])) { continue; }
                $stopLat = deg2rad((float) $stop['latitude']);
                $stopLng = deg2rad((float) $stop['longitude']);
                $a = sin(($stopLat - $lat) / 2) ** 2 + cos($lat) * cos($stopLat) * sin(($stopLng - $lng) / 2) ** 2;
                $distance = 6371000 * 2 * asin(sqrt(max(0.0, min(1.0, $a))));
                $stops[$id] = $stop + [
                    'distance_m'=>(int) round($distance), 'route_id'=>$route['route_id'],
                    'route_number'=>$route['route_number'], 'route_type'=>$route['route_type'],
                    'next_arrival'=>$stop['arrival_time'],
                ];
            }
        }
        $stops = array_values($stops);
        usort($stops, static fn (array $a, array $b): int => ($a['distance_m'] <=> $b['distance_m']) ?: strcmp($a['stop_id'], $b['stop_id']));
        return Response::json(200, 'Success', array_slice($stops, 0, (int) $limit));
    }

    private function user(array $headers): array
    {
        if (!isset($headers['auth_token']) || $headers['auth_token'] === '') { throw new ApiException(401, 'Unauthorised: auth_token header missing'); }
        $token = $headers['auth_token'];
        $user = is_string($token) ? $this->auth->userForToken(trim($token)) : null;
        if ($user === null) { throw new ApiException(401, 'Unauthorised: invalid auth_token'); }
        return $user;
    }

    // Fill only absent fields; existing snapshots and notes keep their source values.
    private function savedRecord(array $saved, array $route): array
    {
        $stops = $route['stops'] ?? [];
        usort($stops, static fn (array $a, array $b): int => $a['sequence'] <=> $b['sequence']);
        return $saved + [
            'save_id'=>'SAV-LEGACY-' . substr(hash('sha256', $saved['user_id'] . '|' . $saved['route_id'] . '|' . $saved['saved_at']), 0, 16),
            'route_number'=>$route['route_number'] ?? '', 'route_name'=>$route['route_name'] ?? '',
            'route_type'=>$route['route_type'] ?? '', 'origin_stop'=>$stops[0]['stop_name'] ?? '',
            'destination_stop'=>count($stops) ? $stops[count($stops)-1]['stop_name'] : '', 'note'=>'',
        ];
    }

    private function saveRoute(array $headers, string $body): Response
    {
        $user = $this->user($headers);
        $input = $this->objectBody($body);
        $id = $input['route_id'] ?? null;
        if (!is_string($id) || trim($id) === '') { throw new ApiException(400, 'Bad Request: route_id is required'); }
        $route = $this->findRoute(trim($id));
        if ($route === null) { throw new ApiException(404, 'Route not found'); }
        $response = null;
        $this->store->update('saved_routes.json', function (array $records) use ($user, $route, &$response): array {
            foreach ($records as $record) {
                if ($record['user_id'] === $user['user_id'] && $record['route_id'] === $route['route_id']) {
                    $record = $this->savedRecord($record, $route);
                    $response = Response::json(409, 'Route already saved', ['save_id'=>$record['save_id'], 'saved_at'=>$record['saved_at']]);
                    return $records;
                }
            }
            do { $saveId = 'SAV-' . strtoupper(bin2hex(random_bytes(8))); }
            while (in_array($saveId, array_column($records, 'save_id'), true));
            $record = $this->savedRecord(['save_id'=>$saveId, 'user_id'=>$user['user_id'], 'route_id'=>$route['route_id'], 'saved_at'=>date('Y-m-d H:i:s')], $route);
            $records[] = $record;
            $response = Response::json(200, 'Success', ['save_id'=>$saveId, 'route_id'=>$record['route_id'], 'saved_at'=>$record['saved_at']]);
            return $records;
        });
        return $response;
    }

    private function savedRoutes(array $headers): Response
    {
        $user = $this->user($headers);
        $routes = array_column($this->records('routes.json'), null, 'route_id');
        $mine = [];
        foreach ($this->records('saved_routes.json') as $saved) {
            if ($saved['user_id'] === $user['user_id']) { $mine[] = $this->savedRecord($saved, $routes[$saved['route_id']] ?? []); }
        }
        usort($mine, static fn (array $a, array $b): int => strcmp($b['saved_at'], $a['saved_at']));
        return Response::json(200, 'Success', $mine);
    }

    private function deleteSavedRoute(array $headers, string $id): Response
    {
        $user = $this->user($headers);
        $found = false;
        $this->store->update('saved_routes.json', function (array $records) use ($user, $id, &$found): array {
            foreach ($records as $index => $record) {
                if ($record['user_id'] === $user['user_id'] && $this->savedRecord($record, [])['save_id'] === $id) {
                    unset($records[$index]);
                    $found = true;
                    break;
                }
            }
            return array_values($records);
        });
        return $found ? Response::json(200, 'Deleted successfully', ['save_id'=>$id]) : Response::json(404, 'Saved route not found', null);
    }

    private function privacyPolicy(): Response
    {
        $html = <<<'HTML'
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Privacy Policy</title></head>
<body><main><h1>Privacy Policy</h1>
<p>MyCity Transit uses your sign-in information to identify your account and keep your saved routes.</p>
<p>Transit, weather, and service alert information is provided for travel planning. This local practice server does not sell personal information.</p>
<p>You may stop using the service at any time. Keep your authentication token private.</p>
<button id="closeBtn" type="button" style="background:#c62828;color:white;padding:12px 20px;border:0" onclick="window.close()">Close ✕</button>
</main></body></html>
HTML;
        return new Response(200, $html, ['Content-Type'=>'text/html; charset=utf-8']);
    }

    private function serveResource(string $relativePath, string $missingMessage = 'Not Found'): Response
    {
        if ($relativePath === '' || str_contains($relativePath, "\0") || str_contains($relativePath, '\\') || str_contains($relativePath, ':') || str_starts_with($relativePath, '/')) {
            return Response::json(404, $missingMessage, null);
        }
        foreach (explode('/', $relativePath) as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..') { return Response::json(404, $missingMessage, null); }
        }
        $root = realpath($this->resourceDirectory);
        $file = $root === false ? false : realpath($root . DIRECTORY_SEPARATOR . $relativePath);
        $prefix = $root . DIRECTORY_SEPARATOR;
        $inside = $file !== false && (DIRECTORY_SEPARATOR === '\\' ? strncasecmp($file, $prefix, strlen($prefix)) === 0 : str_starts_with($file, $prefix));
        if (!$inside || !is_file($file)) { return Response::json(404, $missingMessage, null); }
        $body = @file_get_contents($file);
        if ($body === false) { throw new RuntimeException('Unable to read resource'); }
        $types = ['png'=>'image/png','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','gif'=>'image/gif','svg'=>'image/svg+xml','json'=>'application/json','mp3'=>'audio/mpeg','webp'=>'image/webp','txt'=>'text/plain; charset=utf-8'];
        return new Response(200, $body, ['Content-Type'=>$types[strtolower(pathinfo($file, PATHINFO_EXTENSION))] ?? 'application/octet-stream']);
    }
}
