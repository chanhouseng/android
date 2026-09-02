<?php

declare(strict_types=1);

final class Response
{
    public int $status;

    public string $body;

    /** @var array<string, string> */
    public array $headers;

    /** @param array<string, string> $headers */
    public function __construct(int $status, string $body, array $headers = [])
    {
        $this->status = $status;
        $this->body = $body;
        $this->headers = $headers;
    }

    public static function json(int $status, string $msg, mixed $data): self
    {
        $body = json_encode(
            ['msg' => $msg, 'data' => $data],
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR,
        );

        return new self(
            $status,
            $body,
            ['Content-Type' => 'application/json; charset=utf-8'],
        );
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

