<?php
declare(strict_types=1);

final class Media
{
    public function resolve(string $root, string $encodedFilename, array $allowedFilenames): ?string
    {
        $filename = rawurldecode($encodedFilename);

        if (
            $filename === ''
            || str_contains($filename, "\0")
            || str_contains($filename, '/')
            || str_contains($filename, '\\')
            || str_contains($filename, '..')
            || preg_match('/^[A-Za-z]:/', $filename) === 1
            || !in_array($filename, $allowedFilenames, true)
        ) {
            return null;
        }

        $resolvedRoot = realpath($root);
        $resolvedTarget = realpath($root . DIRECTORY_SEPARATOR . $filename);
        if ($resolvedRoot === false || $resolvedTarget === false || !is_file($resolvedTarget)) {
            return null;
        }

        $prefix = rtrim($resolvedRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
        $candidatePrefix = substr($resolvedTarget, 0, strlen($prefix));
        $insideRoot = DIRECTORY_SEPARATOR === '\\'
            ? strcasecmp($candidatePrefix, $prefix) === 0
            : $candidatePrefix === $prefix;

        return $insideRoot ? $resolvedTarget : null;
    }
}

