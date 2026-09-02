<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$baseUrl = $argv[1] ?? 'http://127.0.0.1:39081';

/**
 * @param list<string> $headers
 * @return array{status: int, contentType: string, body: string}
 */
function httpRequest(string $baseUrl, string $method, string $path, array $headers = [], ?string $body = null): array
{
    $options = [
        'method' => $method,
        'ignore_errors' => true,
        'timeout' => 5,
        'header' => implode("\r\n", $headers),
    ];
    if ($body !== null) {
        $options['content'] = $body;
    }

    $context = stream_context_create(['http' => $options]);
    $responseBody = @file_get_contents($baseUrl . $path, false, $context);
    $responseHeaders = function_exists('http_get_last_response_headers')
        ? http_get_last_response_headers()
        : ($http_response_header ?? null);
    if ($responseBody === false || !is_array($responseHeaders)) {
        throw new TestFailure('HTTP request failed: ' . $method . ' ' . $path);
    }

    $status = 0;
    $contentType = '';
    foreach ($responseHeaders as $index => $header) {
        if ($index === 0 && preg_match('/\s(\d{3})\s/', $header, $matches) === 1) {
            $status = (int) $matches[1];
        }
        if (stripos($header, 'Content-Type:') === 0) {
            $contentType = trim(substr($header, strlen('Content-Type:')));
        }
    }

    return ['status' => $status, 'contentType' => $contentType, 'body' => $responseBody];
}

/** @return array{msg: string, data: mixed} */
function httpJson(array $response): array
{
    assertSameValue('application/json; charset=utf-8', $response['contentType'], 'HTTP JSON content type is incorrect.');
    $decoded = json_decode($response['body'], true, 512, JSON_THROW_ON_ERROR);
    assertTrue(is_array($decoded), 'HTTP response is not a JSON object.');
    return $decoded;
}

test('http', 'all eight documented APIs use the exact HTTP contracts', static function () use ($baseUrl): void {
    $existingSignin = httpRequest(
        $baseUrl,
        'POST',
        '/api/users/signin',
        ['Content-Type: application/json'],
        json_encode(['userEmailAddress' => 'ankit@example.com', 'userPassword' => 'ankit123'], JSON_THROW_ON_ERROR),
    );
    assertSameValue(200, $existingSignin['status'], 'Existing signin HTTP status is incorrect.');
    assertSameValue(['auth_token'], array_keys(httpJson($existingSignin)['data']), 'Existing signin fields are incorrect.');

    $newSignin = httpRequest(
        $baseUrl,
        'POST',
        '/api/users/signin',
        ['Content-Type: application/json'],
        json_encode(['userEmailAddress' => 'competition@example.com', 'userPassword' => 'practice123'], JSON_THROW_ON_ERROR),
    );
    assertSameValue(201, $newSignin['status'], 'New signin HTTP status is incorrect.');
    $token = httpJson($newSignin)['data']['auth_token'] ?? null;
    assertTrue(is_string($token) && $token !== '', 'New signin token is missing.');

    $routesResponse = httpRequest($baseUrl, 'GET', '/api/transit/routes');
    $routes = httpJson($routesResponse)['data'];
    assertSameValue(200, $routesResponse['status'], 'Routes HTTP status is incorrect.');
    assertSameValue(['route_id', 'route_name', 'route_type', 'status', 'next_departure', 'stops'], array_keys($routes[0]), 'Routes HTTP fields are incorrect.');
    assertTrue(is_string($routes[0]['stops'][0]), 'Routes HTTP stops are not strings.');

    $weatherResponse = httpRequest($baseUrl, 'GET', '/api/weather/current');
    $weather = httpJson($weatherResponse)['data'];
    assertSameValue(200, $weatherResponse['status'], 'Weather HTTP status is incorrect.');
    assertSameValue(['city', 'temperature_c', 'condition', 'humidity_pct', 'wind_kmh'], array_keys($weather), 'Weather HTTP fields are incorrect.');

    $saveResponse = httpRequest(
        $baseUrl,
        'PUT',
        '/api/routes/save',
        ['Content-Type: application/json', 'auth_token: ' . $token],
        json_encode(['route_id' => 'RTE-RAPID-003'], JSON_THROW_ON_ERROR),
    );
    assertSameValue(200, $saveResponse['status'], 'Save HTTP status is incorrect.');
    assertSameValue(['route_id', 'saved_at'], array_keys(httpJson($saveResponse)['data']), 'Save HTTP fields are incorrect.');

    $duplicateResponse = httpRequest(
        $baseUrl,
        'PUT',
        '/api/routes/save',
        ['Content-Type: application/json', 'auth_token: ' . $token],
        json_encode(['route_id' => 'RTE-RAPID-003'], JSON_THROW_ON_ERROR),
    );
    assertSameValue(409, $duplicateResponse['status'], 'Duplicate HTTP status is incorrect.');
    assertSameValue(null, httpJson($duplicateResponse)['data'], 'Duplicate HTTP data is not null.');

    $alertsResponse = httpRequest($baseUrl, 'GET', '/api/alerts');
    $alerts = httpJson($alertsResponse)['data'];
    assertSameValue(200, $alertsResponse['status'], 'Alerts HTTP status is incorrect.');
    assertSameValue(['alert_id', 'title', 'affected_routes', 'status', 'severity', 'description', 'created_at'], array_keys($alerts[0]), 'Alerts HTTP fields are incorrect.');
    assertSameValue('high', $alerts[0]['severity'], 'Alerts HTTP severity order is incorrect.');

    $mapResponse = httpRequest($baseUrl, 'GET', '/api/resources/maps/mumbai_base.png');
    assertSameValue(200, $mapResponse['status'], 'Static map HTTP status is incorrect.');
    assertSameValue('image/png', $mapResponse['contentType'], 'Static map HTTP type is incorrect.');
    assertSameValue("\x89PNG", substr($mapResponse['body'], 0, 4), 'Static map HTTP bytes are incorrect.');

    $privacyResponse = httpRequest($baseUrl, 'GET', '/api/privacy-policy');
    assertSameValue(200, $privacyResponse['status'], 'Privacy HTTP status is incorrect.');
    assertSameValue('text/html; charset=utf-8', $privacyResponse['contentType'], 'Privacy HTTP type is incorrect.');
    assertTrue(str_contains($privacyResponse['body'], 'Privacy Policy'), 'Privacy HTTP title is missing.');
    assertTrue(str_contains($privacyResponse['body'], 'id="closeBtn"'), 'Privacy HTTP close button is missing.');

    $savedResponse = httpRequest($baseUrl, 'GET', '/api/routes/saved', ['auth_token: ' . $token]);
    $savedRoutes = httpJson($savedResponse)['data'];
    assertSameValue(200, $savedResponse['status'], 'Saved-list HTTP status is incorrect.');
    assertSameValue([['route_id' => 'RTE-RAPID-003', 'route_name' => 'BKC to Thane Rapid', 'saved_at' => $savedRoutes[0]['saved_at']]], $savedRoutes, 'Saved-list HTTP data is incorrect.');
});

test('http', 'HTTP errors use the documented statuses and safe response shape', static function () use ($baseUrl): void {
    $unauthorized = httpRequest($baseUrl, 'GET', '/api/routes/saved');
    assertSameValue(401, $unauthorized['status'], 'Missing token HTTP status is incorrect.');
    assertSameValue(null, httpJson($unauthorized)['data'], 'Missing token HTTP data is not null.');

    $traversal = httpRequest($baseUrl, 'GET', '/api/resources/%2e%2e/users.json');
    assertSameValue(404, $traversal['status'], 'Traversal HTTP status is incorrect.');
    assertSameValue(['msg' => 'Not Found', 'data' => null], httpJson($traversal), 'Traversal HTTP response exposes information.');

    assertSameValue(405, httpRequest($baseUrl, 'POST', '/api/alerts')['status'], 'Wrong method HTTP status is incorrect.');
    assertSameValue(404, httpRequest($baseUrl, 'GET', '/api/unknown')['status'], 'Unknown API HTTP status is incorrect.');
});

runTests('http');
