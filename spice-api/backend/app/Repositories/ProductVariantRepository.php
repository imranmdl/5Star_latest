<?php

declare(strict_types=1);

namespace App\Repositories;

final class ProductVariantRepository extends BaseRepository
{
    protected function table(): string
    {
        return 'product_variants';
    }

    protected function fillable(): array
    {
        return [
            'product_id', 'sku', 'variant_name', 'weight_grams', 'pack_length_mm', 'pack_width_mm', 'pack_height_mm', 'is_fragile', 'packed_weight_grams',
            'pack_type', 'mrp', 'selling_price', 'offer_price', 'offer_start_date',
            'offer_end_date', 'max_order_quantity', 'is_default', 'display_order',
        ];
    }

    /** @return array<int, array<string, mixed>> */
    public function forProduct(int $productId): array
    {
        return $this->db->select(
            'SELECT * FROM `product_variants`
              WHERE `product_id` = :product_id AND `is_deleted` = 0
              ORDER BY `display_order` ASC, `weight_grams` ASC',
            ['product_id' => $productId]
        );
    }

    /**
     * Priced variant lookup used by cart and checkout in later phases. Reads
     * the effective price from the pricing view rather than recomputing it.
     *
     * @return array<string, mixed>|null
     */
    public function findPricedByUuid(string $uuid): ?array
    {
        return $this->db->selectOne(
            'SELECT vp.*, p.`uuid` AS `product_uuid`, p.`name` AS `product_name`,
                    p.`slug` AS `product_slug`, p.`gst_rate`, p.`status` AS `product_status`
               FROM `vw_variant_pricing` vp
               INNER JOIN `products` p ON p.`id` = vp.`product_id`
              WHERE vp.`uuid` = :uuid AND p.`is_deleted` = 0
              LIMIT 1',
            ['uuid' => $uuid]
        );
    }

    public function skuExists(string $sku, ?int $exceptId = null): bool
    {
        return $this->existsWhere('sku', $sku, $exceptId);
    }

    public function countForProduct(int $productId): int
    {
        return (int) $this->db->scalar(
            'SELECT COUNT(*) FROM `product_variants`
              WHERE `product_id` = :product_id AND `is_deleted` = 0',
            ['product_id' => $productId]
        );
    }

    /**
     * Exactly one variant per product carries is_default. Called inside the
     * same transaction as the insert/update that sets a new default.
     */
    public function clearDefaultFlag(int $productId, ?int $exceptVariantId = null): void
    {
        $sql = 'UPDATE `product_variants`
                   SET `is_default` = 0, `updated_date` = NOW(), `version` = `version` + 1
                 WHERE `product_id` = :product_id AND `is_deleted` = 0';
        $bindings = ['product_id' => $productId];

        if ($exceptVariantId !== null) {
            $sql .= ' AND `id` <> :except_id';
            $bindings['except_id'] = $exceptVariantId;
        }

        $this->db->execute($sql, $bindings);
    }

    /**
     * Promotes the cheapest remaining variant when the default is deleted, so a
     * product is never left without one.
     */
    public function ensureDefaultExists(int $productId): void
    {
        $hasDefault = (int) $this->db->scalar(
            'SELECT COUNT(*) FROM `product_variants`
              WHERE `product_id` = :product_id AND `is_default` = 1 AND `is_deleted` = 0',
            ['product_id' => $productId]
        );

        if ($hasDefault > 0) {
            return;
        }

        $this->db->execute(
            'UPDATE `product_variants`
                SET `is_default` = 1, `updated_date` = NOW(), `version` = `version` + 1
              WHERE `product_id` = :product_id AND `is_deleted` = 0
              ORDER BY `selling_price` ASC, `weight_grams` ASC
              LIMIT 1',
            ['product_id' => $productId]
        );
    }
}
