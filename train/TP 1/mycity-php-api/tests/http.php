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

test('http', 'original APIs return complete Postman data over HTTP', static function () use ($baseUrl): void {
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
    assertSameValue(json_decode(file_get_contents(dirname(__DIR__) . '/data/routes.json'), true), $routes, 'Routes HTTP data must retain every source field.');

    $weatherResponse = httpRequest($baseUrl, 'GET', '/api/weather/current');
    $weather = httpJson($weatherResponse)['data'];
    assertSameValue(200, $weatherResponse['status'], 'Weather HTTP status is incorrect.');
    assertSameValue(json_decode(file_get_contents(dirname(__DIR__) . '/data/weather.json'), true), $weather, 'Weather HTTP data must retain every source field.');

    $saveResponse = httpRequest(
        $baseUrl,
        'PUT',
        '/api/routes/save',
        ['Content-Type: application/json', 'auth_token: ' . $token],
        json_encode(['route_id' => 'RTE-RAPID-003'], JSON_THROW_ON_ERROR),
    );
    assertSameValue(200, $saveResponse['status'], 'Save HTTP status is incorrect.');
    assertSameValue(['save_id', 'route_id', 'saved_at'], array_keys(httpJson($saveResponse)['data']), 'Save HTTP fields are incorrect.');

    $duplicateResponse = httpRequest(
        $baseUrl,
        'PUT',
        '/api/routes/save',
        ['Content-Type: application/json', 'auth_token: ' . $token],
        json_encode(['route_id' => 'RTE-RAPID-003'], JSON_THROW_ON_ERROR),
    );
    assertSameValue(409, $duplicateResponse['status'], 'Duplicate HTTP status is incorrect.');
    assertSameValue(httpJson($saveResponse)['data']['save_id'], httpJson($duplicateResponse)['data']['save_id'], 'Duplicate must reference the existing save.');

    $alertsResponse = httpRequest($baseUrl, 'GET', '/api/alerts');
    $alerts = httpJson($alertsResponse)['data'];
    assertSameValue(200, $alertsResponse['status'], 'Alerts HTTP status is incorrect.');
    $originalAlerts = array_column(json_decode(file_get_contents(dirname(__DIR__) . '/data/alerts.json'), true), null, 'alert_id');
    foreach ($alerts as $alert) { assertSameValue($originalAlerts[$alert['alert_id']], $alert); }
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
    assertSameValue(1, count($savedRoutes), 'Saved-list ownership isolation failed.');
    assertSameValue('BKC to Thane Rapid', $savedRoutes[0]['route_name']);
    assertSameValue(httpJson($saveResponse)['data']['save_id'], $savedRoutes[0]['save_id']);
    assertSameValue('BKC Bus Terminal', $savedRoutes[0]['origin_stop']);
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

test('persistence', 'new account and saved route survive a real server restart', static function () use ($baseUrl): void {
    $login = httpRequest($baseUrl, 'POST', '/api/users/signin', ['Content-Type: application/json'], json_encode(['userEmailAddress'=>'competition@example.com','userPassword'=>'practice123']));
    assertSameValue(200, $login['status']);
    $token = httpJson($login)['data']['auth_token'];
    $saved = httpJson(httpRequest($baseUrl, 'GET', '/api/routes/saved', ['auth_token: ' . $token]))['data'];
    assertSameValue(1, count($saved));
    assertSameValue('RTE-RAPID-003', $saved[0]['route_id']);
    assertTrue(is_string($saved[0]['save_id']), 'Saved identifier did not persist');
});
runTests(($argv[2] ?? '') === '--persistence' ? 'persistence' : 'http');
