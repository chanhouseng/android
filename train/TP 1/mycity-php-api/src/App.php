<?php

declare(strict_types=1);

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
        if (!is_array($storedRoutes) || !array_is_list($storedRoutes)) {
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
        if (!is_array($storedAlerts) || !array_is_list($storedAlerts)) {
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
}
