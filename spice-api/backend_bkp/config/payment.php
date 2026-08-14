<?php

declare(strict_types=1);

use App\Core\Env;

/**
 * Payment configuration.
 *
 * BR-004 makes this a UPI-only platform. The driver decides WHO processes that
 * UPI payment; it never decides WHETHER other tenders are allowed, because no
 * other tender exists anywhere in the codebase.
 *
 * `sandbox` settles payments locally and refuses to construct outside a local or
 * testing environment, so pointing production at it fails loudly at boot rather
 * than silently accepting orders nobody paid for.
 */
return [
    'driver' => Env::get('PAYMENT_DRIVER', 'sandbox'),
    'currency' => Env::get('PAYMENT_CURRENCY', 'INR'),
    'timeout_seconds' => Env::int('PAYMENT_TIMEOUT_SECONDS', 20),

    'razorpay' => [
        'key_id' => Env::get('RAZORPAY_KEY_ID', ''),
        'key_secret' => Env::get('RAZORPAY_KEY_SECRET', ''),
        // Set this in the Razorpay dashboard when creating the webhook. Without
        // it BR-005 cannot be enforced: there is no way to tell a genuine
        // payment notification from a forged one.
        'webhook_secret' => Env::get('RAZORPAY_WEBHOOK_SECRET', ''),
    ],

    'sandbox' => [
        'secret' => Env::get('SANDBOX_PAYMENT_SECRET', 'sandbox-local-secret-change-me'),
    ],
];
