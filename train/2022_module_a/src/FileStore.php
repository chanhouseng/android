<?php
declare(strict_types=1);

final class FileStore
{
    public function __construct(private string $root)
    {
    }

    public function read(string $relativePath): array
    {
        $handle = $this->open($relativePath, 'rb');

        try {
            if (!flock($handle, LOCK_SH)) {
                throw new RuntimeException('Unable to lock storage.');
            }

            $contents = stream_get_contents($handle);
            $data = json_decode($contents === false ? '' : $contents, true, 512, JSON_THROW_ON_ERROR);
            $this->assertList($data);

            return $data;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    public function append(string $relativePath, array $record): array
    {
        $handle = $this->open($relativePath, 'c+b');

        try {
            if (!flock($handle, LOCK_EX)) {
                throw new RuntimeException('Unable to lock storage.');
            }

            rewind($handle);
            $contents = stream_get_contents($handle);
            $data = json_decode($contents === false ? '' : $contents, true, 512, JSON_THROW_ON_ERROR);
            $this->assertList($data);
            $data[] = $record;

            $encoded = json_encode(
                $data,
                JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
            ) . PHP_EOL;

            rewind($handle);
            if (!ftruncate($handle, 0)) {
                throw new RuntimeException('Unable to truncate storage.');
            }

            $written = fwrite($handle, $encoded);
            if ($written === false || $written !== strlen($encoded) || !fflush($handle)) {
                throw new RuntimeException('Unable to write storage.');
            }

            return $record;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    private function open(string $relativePath, string $mode)
    {
        if (
            $relativePath === ''
            || str_contains($relativePath, '..')
            || str_contains($relativePath, '/')
            || str_contains($relativePath, '\\')
        ) {
            throw new InvalidArgumentException('Invalid storage name.');
        }

        $handle = @fopen($this->root . DIRECTORY_SEPARATOR . $relativePath, $mode);
        if ($handle === false) {
            throw new RuntimeException('Unable to open storage.');
        }

        return $handle;
    }

    private function assertList(mixed $data): void
    {
        if (!is_array($data) || ($data !== [] && array_keys($data) !== range(0, count($data) - 1))) {
            throw new RuntimeException('Storage must contain a JSON array.');
        }
    }
}

