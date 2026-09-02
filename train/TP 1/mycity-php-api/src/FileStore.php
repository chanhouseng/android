<?php

declare(strict_types=1);

final class FileStore
{
    private string $dataDirectory;

    public function __construct(string $dataDirectory)
    {
        if (!is_dir($dataDirectory)) {
            throw new RuntimeException('Data directory is unavailable.');
        }

        $resolved = realpath($dataDirectory);
        if ($resolved === false) {
            throw new RuntimeException('Data directory is unavailable.');
        }

        $this->dataDirectory = $resolved;
    }

    public function read(string $file): mixed
    {
        $handle = $this->open($file, 'rb');

        try {
            if (!flock($handle, LOCK_SH)) {
                throw new RuntimeException('Unable to lock data file.');
            }

            $contents = stream_get_contents($handle);
            if ($contents === false) {
                throw new RuntimeException('Unable to read data file.');
            }

            return $this->decode($contents);
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    public function write(string $file, mixed $data): void
    {
        $encoded = $this->encode($data);
        $handle = $this->open($file, 'c+b');

        try {
            if (!flock($handle, LOCK_EX)) {
                throw new RuntimeException('Unable to lock data file.');
            }

            $this->replaceContents($handle, $encoded);
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    public function update(string $file, callable $mutator): mixed
    {
        $handle = $this->open($file, 'c+b');

        try {
            if (!flock($handle, LOCK_EX)) {
                throw new RuntimeException('Unable to lock data file.');
            }

            rewind($handle);
            $contents = stream_get_contents($handle);
            if ($contents === false) {
                throw new RuntimeException('Unable to read data file.');
            }

            $current = $this->decode($contents);
            $updated = $mutator($current);
            $encoded = $this->encode($updated);
            $this->replaceContents($handle, $encoded);

            return $updated;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    /** @return resource */
    private function open(string $file, string $mode)
    {
        if (
            $file === ''
            || str_contains($file, '..')
            || str_contains($file, '/')
            || str_contains($file, '\\')
            || basename($file) !== $file
        ) {
            throw new RuntimeException('Invalid data file name.');
        }

        $handle = @fopen($this->dataDirectory . DIRECTORY_SEPARATOR . $file, $mode);
        if ($handle === false) {
            throw new RuntimeException('Unable to open data file.');
        }

        return $handle;
    }

    private function decode(string $contents): mixed
    {
        if (trim($contents) === '') {
            throw new RuntimeException('Data file contains invalid JSON.');
        }

        try {
            return json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            throw new RuntimeException('Data file contains invalid JSON.', 0, $error);
        }
    }

    private function encode(mixed $data): string
    {
        try {
            return json_encode(
                $data,
                JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR,
            ) . PHP_EOL;
        } catch (JsonException $error) {
            throw new RuntimeException('Unable to encode data.', 0, $error);
        }
    }

    /** @param resource $handle */
    private function replaceContents($handle, string $contents): void
    {
        rewind($handle);
        if (!ftruncate($handle, 0)) {
            throw new RuntimeException('Unable to write data file.');
        }

        $remaining = $contents;
        while ($remaining !== '') {
            $written = fwrite($handle, $remaining);
            if ($written === false || $written === 0) {
                throw new RuntimeException('Unable to write data file.');
            }
            $remaining = substr($remaining, $written);
        }

        if (!fflush($handle)) {
            throw new RuntimeException('Unable to write data file.');
        }
    }
}

