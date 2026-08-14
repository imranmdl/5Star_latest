<?php

declare(strict_types=1);

namespace App\Repositories;

final class RefundRepository extends BaseRepository
{
    protected function table(): string
    {
        return 'refunds';
    }

    protected function fillable(): array
    {
        return [
            'order_id', 'payment_id', 'gateway', 'gateway_refund_id', 'total_amount',
            'gateway_amount', 'wallet_amount', 'reason', 'status', 'failure_reason',
            'completed_date', 'idempotency_key', 'gateway_response',
        ];
    }

    /** @return array<string, mixed>|null */
    public function findByIdempotencyKey(string $key): ?array
    {
        return $this->findOneBy('idempotency_key', $key);
    }

    /** @return array<int, array<string, mixed>> */
    public function forOrder(int $orderId): array
    {
        return $this->db->select(
            'SELECT * FROM `refunds` WHERE `order_id` = :order_id AND `is_deleted` = 0 ORDER BY `id`',
            ['order_id' => $orderId]
        );
    }

    public function totalRefundedFor(int $orderId): string
    {
        return (string) ($this->db->scalar(
            "SELECT COALESCE(SUM(`total_amount`), 0) FROM `refunds`
              WHERE `order_id` = :order_id AND `status` = 'completed' AND `is_deleted` = 0",
            ['order_id' => $orderId]
        ) ?? '0.00');
    }
}
