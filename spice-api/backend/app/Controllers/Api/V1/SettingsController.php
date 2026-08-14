<?php

declare(strict_types=1);

namespace App\Controllers\Api\V1;

use App\Core\BaseController;
use App\Core\Exceptions\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Services\SettingsService;

/**
 * Administrator-only: the payment/delivery driver toggle and manual-mode
 * configuration (QR image, VPA, delivery estimate window).
 *
 * This is what lets a store move manual -> razorpay/shiprocket, or back, from
 * the admin console instead of SSH. Restricted to `role:administrator` in
 * routes/api_v1.php — a supervisor or executive has no reason to change which
 * payment gateway the entire store is running on.
 */
final class SettingsController extends BaseController
{
    public function __construct(private readonly SettingsService $settings)
    {
    }

    /** GET /api/v1/admin/settings */
    public function index(Request $request): Response
    {
        return Response::success($this->settings->current(), 'Settings loaded');
    }

    /** PATCH /api/v1/admin/settings/payment-driver */
    public function setPaymentDriver(Request $request): Response
    {
        $data = Validator::make($request->all(), [
            'driver' => 'required|string',
        ]);

        return Response::success(
            $this->settings->setPaymentDriver($request, $data['driver']),
            'Payment driver updated'
        );
    }

    /** PATCH /api/v1/admin/settings/delivery-driver */
    public function setDeliveryDriver(Request $request): Response
    {
        $data = Validator::make($request->all(), [
            'driver' => 'required|string',
        ]);

        return Response::success(
            $this->settings->setDeliveryDriver($request, $data['driver']),
            'Delivery driver updated'
        );
    }

    /** PATCH /api/v1/admin/settings/manual */
    public function updateManual(Request $request): Response
    {
        $data = Validator::make($request->all(), [
            'manual_payment_vpa' => 'nullable|string|max:120',
            'manual_payment_payee_name' => 'nullable|string|max:120',
        ]);

        return Response::success(
            $this->settings->updateManualSettings(
                $request,
                $data['manual_payment_vpa'] ?? null,
                $data['manual_payment_payee_name'] ?? null,
            ),
            'Manual settings updated'
        );
    }

    /** POST /api/v1/admin/settings/manual/qr-image */
    public function setManualQrImage(Request $request): Response
    {
        if (!isset($request->files['image'])) {
            throw new HttpException('No image was received.', 422, [
                'image' => ['Attach the file as a multipart field named "image".'],
            ]);
        }

        return Response::success(
            $this->settings->setManualQrImage($request, $request->files['image']),
            'Manual payment QR code updated'
        );
    }
}
