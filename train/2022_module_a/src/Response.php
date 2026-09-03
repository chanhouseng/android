<?php
declare(strict_types=1);

final class Response
{
    public function __construct(
        private int $status,
        private string $body,
        private array $headers = []
    ) {
    }

    public static function json(int $status, array $payload, array $headers = []): self
    {
        $headers = ['Content-Type' => 'application/json;charset=UTF-8'] + $headers;
        $body = json_encode(
            $payload,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
        );

        return new self($status, $body, $headers);
    }

    public static function binary(int $status, string $body, string $contentType): self
    {
        return new self($status, $body, [
            'Content-Type' => $contentType,
            'Content-Length' => (string) strlen($body),
        ]);
    }

    public function status(): int
    {
        return $this->status;
    }

    public function body(): string
    {
        return $this->body;
    }

    public function headers(): array
    {
        return $this->headers;
    }

    public function send(): void
    {
        http_response_code($this->status);
        foreach ($this->headers as $name => $value) {
            header($name . ': ' . $value);
        }
        echo $this->body;
    }
}

