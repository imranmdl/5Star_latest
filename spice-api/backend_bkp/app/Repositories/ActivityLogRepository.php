<?php

declare(strict_types=1);

namespace App\Repositories;

final class ActivityLogRepository extends BaseRepository
{
    protected function table(): string
    {
        return 'activity_logs';
    }

    protected function fillable(): array
    {
        return [
            'user_id',
            'user_role',
            'module',
            'action',
            'http_method',
            'endpoint',
            'status_code',
            'duration_ms',
            'ip_address',
            'user_agent',
            'request_id',
            'error_message',
        ];
    }

    protected function sortable(): array
    {
        return ['id', 'created_date', 'status_code', 'duration_ms'];
    }
}
