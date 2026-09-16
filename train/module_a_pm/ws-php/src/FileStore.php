<?php

declare(strict_types=1);

final class FileStore
{
    private string $basePath;
    private string $usersFile;
    private string $favoritesFile;
    private string $diariesFile;

    public function __construct(string $basePath)
    {
        $this->basePath = rtrim($basePath, DIRECTORY_SEPARATOR);
        $this->usersFile = $this->basePath . '/users.json';
        $this->favoritesFile = $this->basePath . '/favorites.json';
        $this->diariesFile = $this->basePath . '/diaries.json';

        $this->initializeFiles();
    }

    public function getDiaries(): array
    {
        return $this->readJsonFile($this->diariesFile);
    }

    public function findDiaryById(string $diaryId): ?array
    {
        foreach ($this->getDiaries() as $diary) {
            if (($diary['diary_id'] ?? '') === $diaryId) {
                return $diary;
            }
        }

        return null;
    }

    public function findUserByEmail(string $email): ?array
    {
        foreach ($this->readJsonFile($this->usersFile) as $user) {
            if (strcasecmp((string) ($user['email'] ?? ''), $email) === 0) {
                return $user;
            }
        }

        return null;
    }

    public function findUserByToken(string $authToken): ?array
    {
        foreach ($this->readJsonFile($this->usersFile) as $user) {
            if (($user['auth_token'] ?? '') === $authToken) {
                return $user;
            }
        }

        return null;
    }

    public function createUser(string $email, string $password): array
    {
        $users = $this->readJsonFile($this->usersFile);
        $user = [
            'id' => $this->generateUuid(),
            'email' => $email,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'auth_token' => $this->generateToken(),
            'created_at' => $this->now(),
        ];
        $users[] = $user;
        $this->writeJsonFile($this->usersFile, $users);

        return $user;
    }

    public function refreshUserToken(string $userId): array
    {
        $users = $this->readJsonFile($this->usersFile);

        foreach ($users as &$user) {
            if (($user['id'] ?? '') === $userId) {
                $user['auth_token'] = $this->generateToken();
                $user['last_signin_at'] = $this->now();
                $this->writeJsonFile($this->usersFile, $users);
                return $user;
            }
        }

        throw new RuntimeException('User not found while refreshing token');
    }

    public function upsertFavorite(string $userId, string $diaryId): array
    {
        $favorites = $this->readJsonFile($this->favoritesFile);
        $favorite = [
            'user_id' => $userId,
            'diary_id' => $diaryId,
            'favorite_datetime' => $this->now(),
        ];
        $updated = false;

        foreach ($favorites as &$item) {
            if (($item['user_id'] ?? '') === $userId && ($item['diary_id'] ?? '') === $diaryId) {
                $item['favorite_datetime'] = $favorite['favorite_datetime'];
                $favorite = $item;
                $updated = true;
                break;
            }
        }

        if (!$updated) {
            $favorites[] = $favorite;
        }

        $this->writeJsonFile($this->favoritesFile, $favorites);

        return [
            'diary_id' => $favorite['diary_id'],
            'favorite_datetime' => $favorite['favorite_datetime'],
        ];
    }

    public function getFavoritesByUserId(string $userId): array
    {
        $favorites = $this->readJsonFile($this->favoritesFile);

        $result = array_values(array_filter(
            $favorites,
            static fn (array $item): bool => ($item['user_id'] ?? '') === $userId
        ));

        usort($result, static function (array $left, array $right): int {
            return strcmp((string) ($right['favorite_datetime'] ?? ''), (string) ($left['favorite_datetime'] ?? ''));
        });

        return array_map(static function (array $item): array {
            return [
                'diary_id' => (string) $item['diary_id'],
                'favorite_datetime' => (string) $item['favorite_datetime'],
            ];
        }, $result);
    }

    private function initializeFiles(): void
    {
        if (!is_dir($this->basePath)) {
            mkdir($this->basePath, 0777, true);
        }

        if (!file_exists($this->usersFile)) {
            $this->writeJsonFile($this->usersFile, []);
        }

        if (!file_exists($this->favoritesFile)) {
            $this->writeJsonFile($this->favoritesFile, []);
        }

        if (!file_exists($this->diariesFile)) {
            $this->writeJsonFile($this->diariesFile, $this->seedDiaries());
        }
    }

    private function readJsonFile(string $file): array
    {
        $content = file_get_contents($file);
        if ($content === false || trim($content) === '') {
            return [];
        }

        $decoded = json_decode($content, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function writeJsonFile(string $file, array $data): void
    {
        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            throw new RuntimeException('Failed to encode JSON');
        }

        file_put_contents($file, $json . PHP_EOL, LOCK_EX);
    }

    private function generateToken(): string
    {
        return strtoupper(substr(bin2hex(random_bytes(16)), 0, 25));
    }

    private function generateUuid(): string
    {
        $bytes = random_bytes(16);
        $hex = strtoupper(bin2hex($bytes));

        return sprintf(
            '%s-%s-%s-%s-%s',
            substr($hex, 0, 8),
            substr($hex, 8, 4),
            substr($hex, 12, 4),
            substr($hex, 16, 4),
            substr($hex, 20, 12)
        );
    }

    private function now(): string
    {
        return date('Y-m-d H:i:s');
    }

    private function seedDiaries(): array
    {
        return [
            [
                'diary_id' => 'BA23617D-42DA-8C4A-F569-C1915B9B55B1',
                'diary_title' => 'Brushstrokes of Time',
                'diary_main_text' => 'resources/Musee d Orsay/d1.json',
                'diary_upload_datetime' => '2023-03-01 12:30:30',
                'diary_image' => 'resources/Musee d Orsay/1.jpg',
                'diary_upload_username' => 'Zachary Butler',
            ],
            [
                'diary_id' => '17B9C94E-F829-6088-FA92-9A07EEA00A8E',
                'diary_title' => 'Journey Through the Splendor of French Art',
                'diary_main_text' => 'resources/Musee d Orsay/d2.json',
                'diary_upload_datetime' => '2023-04-25 09:50:30',
                'diary_image' => 'resources/Musee d Orsay/3.jpg',
                'diary_upload_username' => 'Jake Clarke',
            ],
            [
                'diary_id' => '5D502A3E-6AF2-4D5F-9D8D-B6351F42C901',
                'diary_title' => 'Echoes Beneath the Marble Sky',
                'diary_main_text' => 'resources/Musee d Orsay/d3.json',
                'diary_upload_datetime' => '2023-07-11 18:05:22',
                'diary_image' => 'resources/Musee d Orsay/5.jpg',
                'diary_upload_username' => 'Amelia Hayes',
            ],
            [
                'diary_id' => 'A1F8D3C9-7E44-4E8E-9A31-8E9D1F2A1001',
                'diary_title' => 'Morning Notes in Blue',
                'diary_main_text' => 'resources/demo/d4.json',
                'diary_upload_datetime' => '2023-08-02 08:15:10',
                'diary_image' => 'resources/demo/4.jpg',
                'diary_upload_username' => 'Noah Bennett',
            ],
            [
                'diary_id' => 'C7B2E0A1-0B4D-4D7A-8A1A-9F4D6E3B1002',
                'diary_title' => 'The Quiet Museum Hall',
                'diary_main_text' => 'resources/demo/d5.json',
                'diary_upload_datetime' => '2023-08-18 14:40:55',
                'diary_image' => 'resources/demo/5.jpg',
                'diary_upload_username' => 'Sophia Clarke',
            ],
            [
                'diary_id' => 'D3E91F6A-5C22-4F9A-9C0A-2B7E4F910003',
                'diary_title' => 'Sunday at the Gallery',
                'diary_main_text' => 'resources/demo/d6.json',
                'diary_upload_datetime' => '2023-09-01 10:05:30',
                'diary_image' => 'resources/demo/6.jpg',
                'diary_upload_username' => 'Ethan Walker',
            ],
            [
                'diary_id' => 'E5A7B0D2-8F13-4A4D-90B7-1D3E7A920004',
                'diary_title' => 'Ink, Light, and Silence',
                'diary_main_text' => 'resources/demo/d7.json',
                'diary_upload_datetime' => '2023-09-12 19:22:08',
                'diary_image' => 'resources/demo/7.jpg',
                'diary_upload_username' => 'Mia Johnson',
            ],
            [
                'diary_id' => 'F8C12A4B-3D5E-4C9D-88B7-6A2F8A930005',
                'diary_title' => 'Late Autumn Sketches',
                'diary_main_text' => 'resources/demo/d8.json',
                'diary_upload_datetime' => '2023-10-03 16:12:41',
                'diary_image' => 'resources/demo/8.jpg',
                'diary_upload_username' => 'Liam Turner',
            ],
            [
                'diary_id' => '0B7D8E19-2F4A-4B7A-9F6C-4A1B9B940006',
                'diary_title' => 'Fragments of a Rainy Day',
                'diary_main_text' => 'resources/demo/d9.json',
                'diary_upload_datetime' => '2023-10-21 11:50:20',
                'diary_image' => 'resources/demo/9.jpg',
                'diary_upload_username' => 'Olivia Harris',
            ],
            [
                'diary_id' => '1C9A2E7F-6B4D-4E2F-A1C9-7D8E9C950007',
                'diary_title' => 'Sketchbook of Shadows',
                'diary_main_text' => 'resources/demo/d10.json',
                'diary_upload_datetime' => '2023-11-05 09:33:12',
                'diary_image' => 'resources/demo/10.jpg',
                'diary_upload_username' => 'Lucas Martin',
            ],
            [
                'diary_id' => '2D1F3C8A-9E5B-4A21-B8D7-5C9E1D960008',
                'diary_title' => 'Walking Past Old Frames',
                'diary_main_text' => 'resources/demo/d11.json',
                'diary_upload_datetime' => '2023-11-19 13:08:44',
                'diary_image' => 'resources/demo/11.jpg',
                'diary_upload_username' => 'Emma Wilson',
            ],
            [
                'diary_id' => '3E2A4B9C-1F6D-4C3B-8A5E-8B1F2E970009',
                'diary_title' => 'A Small Room of Color',
                'diary_main_text' => 'resources/demo/d12.json',
                'diary_upload_datetime' => '2023-12-02 17:25:36',
                'diary_image' => 'resources/demo/12.jpg',
                'diary_upload_username' => 'James Brown',
            ],
            [
                'diary_id' => '4F3B5C0D-2A7E-4D4C-9B6F-9C2A3F980010',
                'diary_title' => 'Notes from the Quiet Wing',
                'diary_main_text' => 'resources/demo/d13.json',
                'diary_upload_datetime' => '2024-01-14 08:48:19',
                'diary_image' => 'resources/demo/13.jpg',
                'diary_upload_username' => 'Charlotte Lee',
            ],
            [
                'diary_id' => '5A4C6D1E-3B8F-4E5D-AC70-AD3B4F990011',
                'diary_title' => 'After Hours in the Archive',
                'diary_main_text' => 'resources/demo/d14.json',
                'diary_upload_datetime' => '2024-02-06 21:10:03',
                'diary_image' => 'resources/demo/14.jpg',
                'diary_upload_username' => 'Benjamin Scott',
            ],
            [
                'diary_id' => '6B5D7E2F-4C90-4F6E-BD81-BE4C5A9A0012',
                'diary_title' => 'Fifteen Minutes Before Closing',
                'diary_main_text' => 'resources/demo/d15.json',
                'diary_upload_datetime' => '2024-03-09 18:55:27',
                'diary_image' => 'resources/demo/15.jpg',
                'diary_upload_username' => 'Ava King',
            ],
        ];
    }
}
