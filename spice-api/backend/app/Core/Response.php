<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Every API response uses the contract fixed by the SRS:
 *   { "success": bool, "message": string, "data": object|array, "errors": array }
 */
final class Response
{
    /** @param array<string, string> $headers */
    private function __construct(
        private readonly int $status,
        private readonly array $payload,
        private array $headers = [],
    ) {
    }

    public static function success(
        mixed $data = [],
        string $message = '',
        int $status = 200,
        array $meta = [],
    ): self {
        $payload = [
            'success' => true,
            'message' => $message,
            'data' => $data === null ? [] : $data,
            'errors' => [],
        ];

        if ($meta !== []) {
            $payload['meta'] = $meta;
        }

        return new self($status, $payload);
    }

    public static function created(mixed $data = [], string $message = 'Created successfully'): self
    {
        return self::success($data, $message, 201);
    }

    /** @param array<string, array<int, string>>|array<int, string> $errors */
    public static function error(string $message, int $status = 400, array $errors = []): self
    {
        return new self($status, [
            'success' => false,
            'message' => $message,
            'data' => [],
            'errors' => $errors,
        ]);
    }

    public function withHeader(string $name, string $value): self
    {
        $this->headers[$name] = $value;

        return $this;
    }

    public function status(): int
    {
        return $this->status;
    }

    public function send(): void
    {
        if (!headers_sent()) {
            http_response_code($this->status);
            header('Content-Type: application/json; charset=utf-8');
            header('X-Content-Type-Options: nosniff');
            header('X-Frame-Options: DENY');
            header('Referrer-Policy: no-referrer');

            foreach ($this->headers as $name => $value) {
                header($name . ': ' . $value);
            }
        }

        echo json_encode(
            $this->payload,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION
        );
    }
}
