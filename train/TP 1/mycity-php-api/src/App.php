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
}

