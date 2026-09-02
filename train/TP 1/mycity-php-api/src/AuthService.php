<?php

declare(strict_types=1);

final class AuthException extends RuntimeException
{
}

final class AuthService
{
    private FileStore $store;

    public function __construct(FileStore $store)
    {
        $this->store = $store;
    }

    /** @return array{created: bool, auth_token: string} */
    public function signIn(string $email, string $password): array
    {
        $result = null;

        $this->store->update('users.json', function (mixed $storedUsers) use ($email, $password, &$result): array {
            if (!is_array($storedUsers)) {
                throw new RuntimeException('User data is invalid.');
            }

            foreach ($storedUsers as $index => $user) {
                if (!is_array($user) || !isset($user['email']) || !is_string($user['email'])) {
                    throw new RuntimeException('User data is invalid.');
                }

                if (strcasecmp($user['email'], $email) !== 0) {
                    continue;
                }

                $matches = false;
                if (isset($user['password_hash']) && is_string($user['password_hash'])) {
                    $matches = password_verify($password, $user['password_hash']);
                } elseif (isset($user['password']) && is_string($user['password'])) {
                    $matches = hash_equals($user['password'], $password);
                    if ($matches) {
                        $user['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
                        unset($user['password']);
                        $storedUsers[$index] = $user;
                    }
                }

                if (!$matches) {
                    throw new AuthException('Invalid email or password.');
                }

                if (!isset($user['auth_token']) || !is_string($user['auth_token']) || $user['auth_token'] === '') {
                    throw new RuntimeException('User data is invalid.');
                }

                $result = ['created' => false, 'auth_token' => $user['auth_token']];
                return $storedUsers;
            }

            $userId = $this->nextUserId($storedUsers);
            $authToken = $this->uniqueToken($storedUsers);
            $storedUsers[] = [
                'user_id' => $userId,
                'email' => $email,
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'auth_token' => $authToken,
                'created_at' => date('Y-m-d H:i:s'),
            ];
            $result = ['created' => true, 'auth_token' => $authToken];

            return $storedUsers;
        });

        if (!is_array($result)) {
            throw new RuntimeException('Unable to sign in user.');
        }

        return $result;
    }

    /** @return array<string, mixed>|null */
    public function userForToken(?string $token): ?array
    {
        if ($token === null || trim($token) === '') {
            return null;
        }

        $users = $this->store->read('users.json');
        if (!is_array($users)) {
            throw new RuntimeException('User data is invalid.');
        }

        foreach ($users as $user) {
            if (
                is_array($user)
                && isset($user['auth_token'])
                && is_string($user['auth_token'])
                && hash_equals($user['auth_token'], $token)
            ) {
                return $user;
            }
        }

        return null;
    }

    /** @param array<int, mixed> $users */
    private function nextUserId(array $users): string
    {
        $maximum = 0;
        foreach ($users as $user) {
            if (is_array($user) && isset($user['user_id']) && is_string($user['user_id'])) {
                if (preg_match('/^USR-(\d+)$/', $user['user_id'], $matches) === 1) {
                    $maximum = max($maximum, (int) $matches[1]);
                }
            }
        }

        return 'USR-' . str_pad((string) ($maximum + 1), 3, '0', STR_PAD_LEFT);
    }

    /** @param array<int, mixed> $users */
    private function uniqueToken(array $users): string
    {
        $existingTokens = [];
        foreach ($users as $user) {
            if (is_array($user) && isset($user['auth_token']) && is_string($user['auth_token'])) {
                $existingTokens[$user['auth_token']] = true;
            }
        }

        do {
            $token = strtoupper(bin2hex(random_bytes(10)));
        } while (isset($existingTokens[$token]));

        return $token;
    }
}

