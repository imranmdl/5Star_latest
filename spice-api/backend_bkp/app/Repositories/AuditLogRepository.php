<?php

declare(strict_types=1);

namespace App\Repositories;

final class AuditLogRepository extends BaseRepository
{
    protected function table(): string
    {
        return 'audit_logs';
    }

    protected function fillable(): array
    {
        return [
            'entity_name',
            'entity_id',
            'entity_uuid',
            'action',
            'old_values',
            'new_values',
            'performed_by_user_id',
            'performed_by_role',
            'ip_address',
            'user_agent',
            'request_id',
            'notes',
        ];
    }

    /**
     * @param array{page:int, per_page:int, offset:int, sort:string, direction:string} $params
     *
     * @return array{items:array<int, array<string, mixed>>, total:int}
     */
    public function paginateForEntity(string $entityName, int $entityId, array $params): array
    {
        return $this->paginateWhere(
            ['entity_name' => $entityName, 'entity_id' => $entityId],
            $params
        );
    }
}
