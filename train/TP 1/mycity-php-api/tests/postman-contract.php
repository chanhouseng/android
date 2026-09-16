<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
foreach (['Response', 'FileStore', 'AuthService', 'App'] as $class) {
    require_once __DIR__ . '/../src/' . $class . '.php';
}

function withOriginalData(Closure $check): void
{
    $directory = createTemporaryDirectory('mycity-contract');
    try {
        foreach (glob(__DIR__ . '/fixtures/*.json') as $file) {
            if (substr(basename($file), 0, 2) !== '._') {
                copy($file, $directory . '/' . basename($file));
            }
        }
        $store = new FileStore($directory);
        $app = new App($store, dirname(__DIR__) . '/data/resources');
        $check($app, $store);
    } finally { removeDirectory($directory); }
}

test('contract', 'routes and nested stops retain every original field and value', static function (): void {
    withOriginalData(static function (App $app, FileStore $store): void {
        assertSameValue($store->read('routes.json'), decodeResponse($app->handle('GET', '/api/transit/routes', [], ''))['data']);
        $single = $app->handle('GET', '/api/transit/routes/RTE-BUS-022', [], '');
        assertSameValue(200, $single->status);
        assertSameValue($store->read('routes.json')[0], decodeResponse($single)['data']);
        assertSameValue(404, $app->handle('GET', '/api/transit/routes/unknown', [], '')->status);
    });
});
test('contract', 'route filters compose and empty filters return an empty result', static function (): void {
    withOriginalData(static function (App $app): void {
        foreach ([['type=bus', ['RTE-BUS-022', 'RTE-BUS-045']], ['type=metro', ['RTE-METRO-001']], ['status=cancelled', ['RTE-RAPID-003']], ['type=bus&status=delayed', ['RTE-BUS-045']], ['type=unknown', []]] as [$query, $ids]) {
            assertSameValue($ids, array_column(decodeResponse($app->handle('GET', '/api/transit/routes?' . $query, [], ''))['data'], 'route_id'));
        }
    });
});
test('contract', 'weather retains all source values including ten forecast hours', static function (): void {
    withOriginalData(static function (App $app, FileStore $store): void {
        assertSameValue($store->read('weather.json'), decodeResponse($app->handle('GET', '/api/weather/current', [], ''))['data']);
    });
});
test('contract', 'alerts retain all fields with sorting and compound filtering', static function (): void {
    withOriginalData(static function (App $app, FileStore $store): void {
        $alerts = decodeResponse($app->handle('GET', '/api/alerts', [], ''))['data'];
        assertSameValue(['ALT-001','ALT-003','ALT-002','ALT-004','ALT-007','ALT-006','ALT-005'], array_column($alerts, 'alert_id'));
        $original = array_column($store->read('alerts.json'), null, 'alert_id');
        foreach ($alerts as $alert) { assertSameValue($original[$alert['alert_id']], $alert); }
        assertSameValue(['ALT-001','ALT-003'], array_column(decodeResponse($app->handle('GET', '/api/alerts?status=active&severity=high', [], ''))['data'], 'alert_id'));
        assertSameValue(['ALT-004','ALT-005'], array_column(decodeResponse($app->handle('GET', '/api/alerts?status=planned', [], ''))['data'], 'alert_id'));
    });
});
test('contract', 'nearby stops calculate distance from coordinates and enforce parameters', static function (): void {
    withOriginalData(static function (App $app, FileStore $store): void {
        $r = $app->handle('GET', '/api/transit/stops/nearby?lat=19.1197&lng=72.8468&limit=3', [], '');
        assertSameValue(200, $r->status);
        $stops = decodeResponse($r)['data'];
        assertSameValue(3, count($stops));
        assertSameValue(['STP-001','STP-023'], array_column(array_slice($stops, 0, 2), 'stop_id'));
        assertSameValue(0, $stops[0]['distance_m']);
        assertSameValue('09:45', $stops[0]['next_arrival']);
        assertSameValue('BUS-22', $stops[0]['route_number']);
        assertTrue($stops[1]['distance_m'] <= $stops[2]['distance_m'], 'Distances must ascend');
        foreach (['', '?lat=abc&lng=72', '?lat=91&lng=0', '?lat=0&lng=0&limit=-1', '?lat[]=1&lng=2'] as $query) {
            assertSameValue(400, $app->handle('GET', '/api/transit/stops/nearby' . $query, [], '')->status);
        }
        $routes = $store->read('routes.json');
        $routes[1]['stops'][] = $routes[0]['stops'][0];
        $store->write('routes.json', $routes);
        $all = decodeResponse($app->handle('GET', '/api/transit/stops/nearby?lat=0&lng=0&limit=100', [], ''))['data'];
        assertSameValue(count($all), count(array_unique(array_column($all, 'stop_id'))));
    });
});
test('contract', 'saved lists preserve source records and save delete enforce ownership', static function (): void {
    withOriginalData(static function (App $app, FileStore $store): void {
        $one = ['auth_token' => $store->read('users.json')[0]['auth_token']];
        $two = ['auth_token' => $store->read('users.json')[1]['auth_token']];
        $original = $store->read('saved_routes.json');
        $list = decodeResponse($app->handle('GET', '/api/routes/saved', $one, ''))['data'];
        assertSameValue([$original[2], $original[1], $original[0]], $list);
        $duplicate = $app->handle('PUT', '/api/routes/save', $one, '{"route_id":"RTE-BUS-022"}');
        assertSameValue(409, $duplicate->status);
        assertSameValue(['save_id'=>'SAV-001','saved_at'=>'2025-04-10 08:30:00'], decodeResponse($duplicate)['data']);
        $saved = $app->handle('PUT', '/api/routes/save', $one, '{"route_id":"RTE-RAPID-003"}');
        assertSameValue(200, $saved->status);
        $id = decodeResponse($saved)['data']['save_id'] ?? null;
        assertTrue(is_string($id) && $id !== '', 'save_id required');
        $records = $store->read('saved_routes.json');
        assertSameValue('BKC Bus Terminal', end($records)['origin_stop']);
        assertSameValue('Thane Station', end($records)['destination_stop']);
        assertSameValue(array_slice($records, 0, 5), $original);
        assertSameValue(401, $app->handle('DELETE', '/api/routes/saved/' . $id, [], '')->status);
        assertSameValue(404, $app->handle('DELETE', '/api/routes/saved/' . $id, $two, '')->status);
        assertSameValue(200, $app->handle('DELETE', '/api/routes/saved/' . $id, $one, '')->status);
        assertSameValue(404, $app->handle('DELETE', '/api/routes/saved/' . $id, $one, '')->status);
        assertSameValue($original, $store->read('saved_routes.json'));
    });
});
test('contract', 'resource manifest and every referenced binary are served', static function (): void {
    withOriginalData(static function (App $app, FileStore $store): void {
        $r = $app->handle('GET', '/api/resources/list', [], '');
        assertSameValue(200, $r->status);
        assertSameValue($store->read('resources.json'), decodeResponse($r)['data']);
        foreach ($store->read('resources.json') as $entries) {
            foreach ($entries as $entry) {
                $r = $app->handle('GET', '/api/resource?path=' . rawurlencode($entry['file']), [], '');
                assertSameValue(200, $r->status, $entry['file']);
                assertSameValue($r->body, $app->handle('GET', '/api/' . $entry['file'], [], '')->body);
                assertTrue(strlen($r->body) > 100, 'Resource is empty');
            }
        }
    });
});
test('contract', 'authentication messages match Postman and credentials stay private', static function (): void {
    withOriginalData(static function (App $app): void {
        $bad = $app->handle('POST', '/api/users/signin', [], '{"userEmailAddress":"ankit@example.com","userPassword":"wrongpass1"}');
        assertSameValue(401, $bad->status);
        assertTrue(str_contains(decodeResponse($bad)['msg'], 'Incorrect password'), 'Postman error text missing');
        $new = $app->handle('POST', '/api/users/signin', [], '{"userEmailAddress":"new@example.com","userPassword":"pass123"}');
        assertSameValue(201, $new->status);
        assertSameValue('Sign up successful', decodeResponse($new)['msg']);
        assertSameValue(['auth_token'], array_keys(decodeResponse($new)['data']));
    });
});
test('contract', 'resource aliases block traversal and methods stay constrained', static function (): void {
    withOriginalData(static function (App $app): void {
        foreach (['../../server.php','resources/../users.json','resources/%2e%2e/users.json','resources/C:/Windows/win.ini','resources/..%5cusers.json'] as $path) {
            assertSameValue(404, $app->handle('GET', '/api/resource?path=' . rawurlencode($path), [], '')->status);
        }
        foreach (['/api/resources/list','/api/resource?path=resources/maps/mumbai_base.png','/api/transit/routes/RTE-BUS-022','/api/transit/stops/nearby'] as $path) {
            assertSameValue(405, $app->handle('POST', $path, [], '')->status);
        }
        assertSameValue(404, $app->handle('GET', '/api/users.json', [], '')->status);
        assertSameValue(404, $app->handle('GET', '/api/unknown', [], '')->status);
    });
});
runTests();
