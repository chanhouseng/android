#!/bin/bash
pkill -f 'php -S' 2>/dev/null
sleep 1
cd /var/www/ws
php -S 127.0.0.1:8000 server.php > /tmp/php_server.log 2>&1 &
SERVER_PID=$!
sleep 2

echo "=== Test 1: /api/resources/demo/5.jpg ==="
curl -s -o /dev/null -w "HTTP %{http_code}, Content-Type: %{content_type}, Size: %{size_download}\n" http://127.0.0.1:8000/api/resources/demo/5.jpg

echo "=== Test 2: /api/diary ==="
curl -s -o /dev/null -w "HTTP %{http_code}, Content-Type: %{content_type}, Size: %{size_download}\n" http://127.0.0.1:8000/api/diary

echo "=== Test 3: /api/nonexistent ==="
curl -s http://127.0.0.1:8000/api/nonexistent

echo ""
echo "=== Server log ==="
cat /tmp/php_server.log

kill $SERVER_PID 2>/dev/null
