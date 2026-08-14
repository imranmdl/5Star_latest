<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Exceptions\HttpException;
use App\Core\Request;
use App\Repositories\SettingRepository;

/**
 * Admin-editable runtime settings.
 *
 * Most configuration in this codebase lives in /config/*.php and is read once
 * at boot from environment variables — right for anything that shouldn't
 * change without a deployment (DB credentials, JWT secret). The handful of
 * settings here are different on purpose: which payment/delivery driver is
 * active, and the manual-payment QR/VPA details, are business decisions an
 * administrator needs to change from a browser while the store is running,
 * not something that should require SSH access. bootstrap/container.php reads
 * these through SettingRepository ahead of the .env default every time a
 * gateway or courier adapter is built, so a change here takes effect on the
 * next request — no redeploy, no restart.
 *
 * NOTE ON DELIVERY ESTIMATES: the customer-facing "delivers in N-M days" text
 * does NOT come from here or from CourierAdapterInterface. It comes from
 * `delivery_zones` (DeliveryZoneRepository / DeliveryChargeService), which is
 * already courier-independent — it is a lookup table, not a live API call —
 * and already returns sensible numbers (e.g. 1-2 days for local Bengaluru,
 * 4-7 for the rest of India) regardless of whether delivery_driver is
 * shiprocket or manual. Switching to manual delivery does not change that
 * estimate at all; it only removes live AWB tracking and label generation.
 * Edit sla_min_days/sla_max_days on the zones themselves (via the delivery
 * zone admin endpoints) to change what customers see.
 */
final class SettingsService
{
    private const PAYMENT_DRIVERS = ['manual', 'sandbox', 'razorpay'];
    private const DELIVERY_DRIVERS = ['manual', 'sandbox', 'shiprocket'];

    /** Keys this service will read/write. Anything else in `settings` is out of scope here. */
    private const MANAGED_KEYS = [
        'payment_driver',
        'delivery_driver',
        'manual_payment_vpa',
        'manual_payment_payee_name',
        'manual_payment_qr_url',
        'manual_payment_qr_path',
    ];

    public function __construct(
        private readonly SettingRepository $settings,
        private readonly FileUploadService $uploads,
        private readonly AuditService $audit,
    ) {
    }

    /** @return array<string, mixed> */
    public function current(): array
    {
        $qrPath = $this->settings->value('manual_payment_qr_path');

        return [
            'payment_driver' => $this->settings->value('payment_driver', 'manual'),
            'delivery_driver' => $this->settings->value('delivery_driver', 'manual'),
            'payment_driver_options' => self::PAYMENT_DRIVERS,
            'delivery_driver_options' => self::DELIVERY_DRIVERS,
            'manual_payment_vpa' => $this->settings->value('manual_payment_vpa', ''),
            'manual_payment_payee_name' => $this->settings->value('manual_payment_payee_name', 'Anjeera Dry Fruits'),
            'manual_payment_qr_url' => $qrPath !== null ? $this->uploads->publicUrl($qrPath) : null,
        ];
    }

    /**
     * Switches the payment driver. Razorpay is allowed to be selected here
     * without live keys present — the RazorpayGateway constructor itself
     * refuses to build without RAZORPAY_KEY_ID/SECRET, so a half-configured
     * switch fails loudly on the very next payment attempt rather than here.
     */
    public function setPaymentDriver(Request $request, string $driver): array
    {
        if (!in_array($driver, self::PAYMENT_DRIVERS, true)) {
            throw new HttpException(
                'Unknown payment driver "' . $driver . '".',
                422,
                ['driver' => ['Must be one of: ' . implode(', ', self::PAYMENT_DRIVERS)]]
            );
        }

        $this->write('payment_driver', $driver, $request);

        return $this->current();
    }

    public function setDeliveryDriver(Request $request, string $driver): array
    {
        if (!in_array($driver, self::DELIVERY_DRIVERS, true)) {
            throw new HttpException(
                'Unknown delivery driver "' . $driver . '".',
                422,
                ['driver' => ['Must be one of: ' . implode(', ', self::DELIVERY_DRIVERS)]]
            );
        }

        $this->write('delivery_driver', $driver, $request);

        return $this->current();
    }

    /**
     * Updates the manual-payment display details: the VPA/payee name shown
     * under the QR code at checkout.
     */
    public function updateManualSettings(Request $request, ?string $vpa, ?string $payeeName): array
    {
        if ($vpa !== null) {
            $this->write('manual_payment_vpa', $vpa, $request);
        }

        if ($payeeName !== null) {
            $this->write('manual_payment_payee_name', $payeeName, $request);
        }

        return $this->current();
    }

    /**
     * Replaces the uploaded manual-payment QR image. Goes through
     * FileUploadService, so the same content-sniffing and path-safety
     * guarantees apply here as to product and category images.
     *
     * @param array<string, mixed> $file
     */
    public function setManualQrImage(Request $request, array $file): array
    {
        $previousPath = $this->settings->value('manual_payment_qr_path');

        $stored = $this->uploads->storeImage($file, 'payments');

        $this->write('manual_payment_qr_path', $stored['file_path'], $request);

        if ($previousPath !== null && $previousPath !== $stored['file_path']) {
            $this->uploads->delete($previousPath);
        }

        return $this->current();
    }

    private function write(string $key, string $value, Request $request): void
    {
        $before = $this->settings->value($key);

        $this->settings->put($key, $value, $request->authUserId());

        $this->audit->log(
            entityName: 'settings',
            entityId: null,
            action: 'setting_updated',
            oldValues: [$key => $before],
            newValues: [$key => $value],
            request: $request,
            entityUuid: null,
            notes: $key,
        );
    }
}
