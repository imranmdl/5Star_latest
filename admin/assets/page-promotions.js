/** Coupons and offers: what is live, and switching campaigns on and off. */

import { api, mountConsole, showError, toast, setBusy, escapeHtml, formatMoney,
         badge, emptyState } from './console.js';

let root = null;

function couponRow(coupon) {
  const used = Number(coupon.total_redeemed || 0);
  const limit = coupon.total_usage_limit;

  return `
    <tr data-coupon="${escapeHtml(coupon.uuid)}">
      <td>
        <span class="font-monospace fw-semibold">${escapeHtml(coupon.code)}</span>
        <div class="small text-muted">${escapeHtml(coupon.title || '')}</div>
      </td>
      <td class="small">
        ${coupon.discount_type === 'percentage'
          ? `${escapeHtml(coupon.discount_value)}% off`
          : `${formatMoney(coupon.discount_value)} off`}
      </td>
      <td class="text-center small">
        ${escapeHtml(used)}${limit ? ` / ${escapeHtml(limit)}` : ''}
        ${limit && used >= limit ? '<div class="text-danger">Exhausted</div>' : ''}
      </td>
      <td class="small">${escapeHtml(String(coupon.valid_to || '—').slice(0, 10))}</td>
      <td>${badge(coupon.status === 'active' ? 'approved' : 'pending', coupon.status)}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-secondary" data-status="${escapeHtml(coupon.status)}">
          ${coupon.status === 'active' ? 'Pause' : 'Activate'}
        </button>
      </td>
    </tr>`;
}

async function render() {
  root.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h1 class="h4 mb-0">Promotions</h1>
      <span>
        <button class="btn btn-sm btn-outline-dark me-2" data-new-offer type="button">Create an offer</button>
        <button class="btn btn-sm btn-dark" data-new-coupon type="button">Create a coupon</button>
      </span>
    </div>

    <div class="card mb-4 d-none" data-coupon-editor>
      <div class="card-header bg-white fw-semibold">New coupon</div>
      <div class="card-body">
        <form class="row g-3" data-coupon-form>
          <div class="col-md-3">
            <label class="form-label small" for="code">Code <span class="text-danger">*</span></label>
            <input class="form-control form-control-sm text-uppercase" id="code" name="code"
                   required minlength="3" maxlength="30" placeholder="DIWALI20">
            <div class="form-text small">What the customer types at checkout.</div>
          </div>

          <div class="col-md-5">
            <label class="form-label small" for="title">Title <span class="text-danger">*</span></label>
            <input class="form-control form-control-sm" id="title" name="title"
                   required minlength="3" placeholder="Diwali festival discount">
          </div>

          <div class="col-md-4">
            <label class="form-label small" for="discount_type">Type <span class="text-danger">*</span></label>
            <select class="form-select form-select-sm" id="discount_type" name="discount_type" required>
              <option value="percentage">Percentage off</option>
              <option value="flat">Fixed amount off</option>
              <option value="free_delivery">Free delivery</option>
            </select>
          </div>

          <div class="col-md-3" data-value-field>
            <label class="form-label small" for="discount_value">Value <span class="text-danger">*</span></label>
            <input class="form-control form-control-sm" id="discount_value" name="discount_value"
                   type="number" step="0.01" min="0" placeholder="20">
            <div class="form-text small" data-value-hint>Percent, e.g. 20 for 20% off.</div>
          </div>

          <div class="col-md-3" data-cap-field>
            <label class="form-label small" for="max_discount_amount">Cap the discount at</label>
            <input class="form-control form-control-sm" id="max_discount_amount"
                   name="max_discount_amount" type="number" step="0.01" min="1" placeholder="500">
            <div class="form-text small">
              Strongly advised on a percentage coupon, or a large order gives away a
              large amount.
            </div>
          </div>

          <div class="col-md-3">
            <label class="form-label small" for="min_order_value">Minimum order value</label>
            <input class="form-control form-control-sm" id="min_order_value" name="min_order_value"
                   type="number" step="0.01" min="0" placeholder="199">
          </div>

          <div class="col-md-3">
            <label class="form-label small" for="valid_to">Expires on</label>
            <input class="form-control form-control-sm" id="valid_to" name="valid_to" type="date">
            <div class="form-text small">Leave blank to run indefinitely.</div>
          </div>

          <div class="col-md-3">
            <label class="form-label small" for="total_usage_limit">Total uses allowed</label>
            <input class="form-control form-control-sm" id="total_usage_limit"
                   name="total_usage_limit" type="number" min="1" placeholder="100">
            <div class="form-text small">Blank means unlimited.</div>
          </div>

          <div class="col-md-3">
            <label class="form-label small" for="per_customer_limit">Uses per customer</label>
            <input class="form-control form-control-sm" id="per_customer_limit"
                   name="per_customer_limit" type="number" min="1" value="1">
          </div>

          <div class="col-md-6">
            <label class="form-label small" for="audience">Who can use it</label>
            <select class="form-select form-select-sm" id="audience" name="audience">
              <option value="all">Anyone</option>
              <option value="new_customers">First-time customers only</option>
            </select>
          </div>

          <div class="col-12">
            <button class="btn btn-sm btn-dark" type="submit">Create coupon</button>
            <button class="btn btn-sm btn-outline-secondary" data-cancel-coupon type="button">Cancel</button>
            <span class="small text-muted ms-2">
              Created paused, so nothing goes live by accident. Activate it when ready.
            </span>
          </div>
        </form>
      </div>
    </div>

    <div class="card mb-4 d-none" data-offer-editor>
      <div class="card-header bg-white fw-semibold">New automatic offer</div>
      <div class="card-body">
        <p class="text-muted small">
          An offer applies on its own, with no code to type. One coupon and one
          offer can both apply to an order — whichever offer is best for the
          customer wins.
        </p>
        <form class="row g-3" data-offer-form>
          <div class="col-md-3">
            <label class="form-label small" for="offer_code">Reference <span class="text-danger">*</span></label>
            <input class="form-control form-control-sm text-uppercase" id="offer_code" name="code"
                   required minlength="3" maxlength="40" placeholder="DIWALIBOGO">
            <div class="form-text small">Internal. Customers never type it.</div>
          </div>

          <div class="col-md-5">
            <label class="form-label small" for="offer_title">What the customer sees <span class="text-danger">*</span></label>
            <input class="form-control form-control-sm" id="offer_title" name="title"
                   required minlength="3" placeholder="Buy one get one free on spices">
          </div>

          <div class="col-md-4">
            <label class="form-label small" for="offer_discount_type">Benefit <span class="text-danger">*</span></label>
            <select class="form-select form-select-sm" id="offer_discount_type" name="discount_type" required>
              <option value="free_items">Buy X get Y free</option>
              <option value="percentage">Percentage off</option>
              <option value="flat">Fixed amount off</option>
              <option value="free_delivery">Free delivery</option>
            </select>
          </div>

          <div class="col-md-2 d-none" data-offer-value>
            <label class="form-label small" for="offer_discount_value">Value</label>
            <input class="form-control form-control-sm" id="offer_discount_value"
                   name="discount_value" type="number" step="0.01" min="0">
          </div>

          <div class="col-md-2" data-bogo-buy>
            <label class="form-label small" for="buy_quantity">Buy <span class="text-danger">*</span></label>
            <input class="form-control form-control-sm" id="buy_quantity" name="buy_quantity"
                   type="number" min="1" max="100" value="1">
          </div>

          <div class="col-md-2" data-bogo-get>
            <label class="form-label small" for="get_quantity">Get free <span class="text-danger">*</span></label>
            <input class="form-control form-control-sm" id="get_quantity" name="get_quantity"
                   type="number" min="1" max="100" value="1">
          </div>

          <div class="col-md-4" data-bogo-scope>
            <label class="form-label small" for="free_item_scope">Which items are free</label>
            <select class="form-select form-select-sm" id="free_item_scope" name="free_item_scope">
              <option value="cheapest_eligible">The cheapest in the basket</option>
              <option value="same_variant">Same pack the customer bought</option>
            </select>
            <div class="form-text small">
              Cheapest is the usual choice — giving away the dearest item on a
              mixed basket costs far more than intended.
            </div>
          </div>

          <div class="col-md-3" data-bogo-cap>
            <label class="form-label small" for="max_free_items_per_order">Free items per order</label>
            <input class="form-control form-control-sm" id="max_free_items_per_order"
                   name="max_free_items_per_order" type="number" min="1" max="1000" value="4">
            <div class="form-text small">
              Without a limit, a fifty-unit order claims twenty-five free.
            </div>
          </div>

          <div class="col-md-3">
            <label class="form-label small" for="offer_min_order">Minimum order value</label>
            <input class="form-control form-control-sm" id="offer_min_order" name="min_order_value"
                   type="number" step="0.01" min="0">
          </div>

          <div class="col-md-3">
            <label class="form-label small" for="offer_starts">Starts</label>
            <input class="form-control form-control-sm" id="offer_starts" name="starts_date" type="date">
          </div>

          <div class="col-md-3">
            <label class="form-label small" for="offer_ends">Ends</label>
            <input class="form-control form-control-sm" id="offer_ends" name="ends_date" type="date">
          </div>

          <div class="col-12">
            <button class="btn btn-sm btn-dark" type="submit">Create offer</button>
            <button class="btn btn-sm btn-outline-secondary" data-cancel-offer type="button">Cancel</button>
            <span class="small text-muted ms-2">Created paused. Activate it when ready.</span>
          </div>
        </form>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-header bg-white fw-semibold">Coupons</div>
      <div class="card-body p-0" data-coupons>
        <div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm"></div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header bg-white fw-semibold">Automatic offers</div>
      <div class="card-body p-0" data-offers>
        <div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm"></div></div>
      </div>
    </div>

    <p class="text-muted small mt-3 mb-0">
      One coupon per order, plus one automatic offer — whichever is best for the
      customer. Wallet credit applies on top of both.
    </p>`;

  const offerEditor = root.querySelector('[data-offer-editor]');
  const offerForm = root.querySelector('[data-offer-form]');

  root.querySelector('[data-new-offer]').addEventListener('click', () => {
    offerEditor.classList.toggle('d-none');
  });

  root.querySelector('[data-cancel-offer]').addEventListener('click', () => {
    offerEditor.classList.add('d-none');
    offerForm.reset();
  });

  // Buy-X-get-Y needs quantities; the others need a value. Showing both at once
  // invites an offer that reads one way and behaves another — which the database
  // CHECK would reject anyway, but with a worse message.
  const offerType = offerForm.querySelector('#offer_discount_type');

  const syncOfferFields = () => {
    const isBogo = offerType.value === 'free_items';
    const needsValue = offerType.value === 'percentage' || offerType.value === 'flat';

    ['[data-bogo-buy]', '[data-bogo-get]', '[data-bogo-scope]', '[data-bogo-cap]']
      .forEach((selector) => offerForm.querySelector(selector).classList.toggle('d-none', !isBogo));

    offerForm.querySelector('[data-offer-value]').classList.toggle('d-none', !needsValue);
    offerForm.querySelector('#offer_discount_value').required = needsValue;
    offerForm.querySelector('#buy_quantity').required = isBogo;
    offerForm.querySelector('#get_quantity').required = isBogo;
  };

  offerType.addEventListener('change', syncOfferFields);
  syncOfferFields();

  offerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = offerForm.querySelector('button[type="submit"]');
    const payload = { offer_type: offerType.value === 'free_items' ? 'bogo' : 'festival' };

    new FormData(offerForm).forEach((value, key) => {
      if (value !== '') payload[key] = value;
    });

    payload.code = String(payload.code || '').toUpperCase();

    // Dates come from a date input; the API expects a datetime.
    if (payload.starts_date) payload.starts_date = `${payload.starts_date} 00:00:00`;
    if (payload.ends_date) payload.ends_date = `${payload.ends_date} 23:59:59`;

    if (payload.discount_type !== 'free_items') {
      delete payload.buy_quantity;
      delete payload.get_quantity;
      delete payload.free_item_scope;
      delete payload.max_free_items_per_order;
    }

    setBusy(button, true, 'Creating');

    try {
      await api.post('/admin/offers', payload);
      toast(`Offer ${payload.code} created. Activate it when you are ready.`);
      offerEditor.classList.add('d-none');
      offerForm.reset();
      render();
    } catch (error) {
      setBusy(button, false);
      showError(error);
    }
  });

  const editor = root.querySelector('[data-coupon-editor]');
  const couponForm = root.querySelector('[data-coupon-form]');

  root.querySelector('[data-new-coupon]').addEventListener('click', () => {
    editor.classList.toggle('d-none');
    if (!editor.classList.contains('d-none')) couponForm.querySelector('#code').focus();
  });

  root.querySelector('[data-cancel-coupon]').addEventListener('click', () => {
    editor.classList.add('d-none');
    couponForm.reset();
  });

  // Free delivery has no amount, and a flat discount cannot be capped.
  const typeSelect = couponForm.querySelector('#discount_type');

  const syncTypeFields = () => {
    const type = typeSelect.value;
    couponForm.querySelector('[data-value-field]').classList.toggle('d-none', type === 'free_delivery');
    couponForm.querySelector('[data-cap-field]').classList.toggle('d-none', type !== 'percentage');
    couponForm.querySelector('[data-value-hint]').textContent = type === 'percentage'
      ? 'Percent, e.g. 20 for 20% off.'
      : 'Amount in rupees off the order.';
    couponForm.querySelector('#discount_value').required = type !== 'free_delivery';
  };

  typeSelect.addEventListener('change', syncTypeFields);
  syncTypeFields();

  couponForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = couponForm.querySelector('button[type="submit"]');
    const payload = {};

    new FormData(couponForm).forEach((value, key) => {
      if (value !== '') payload[key] = value;
    });

    payload.code = String(payload.code || '').toUpperCase();

    if (payload.discount_type === 'free_delivery') {
      payload.discount_value = 0;
    }

    if (payload.discount_type === 'percentage' && Number(payload.discount_value) > 100) {
      toast('A percentage discount cannot be more than 100%.', 'danger');
      return;
    }

    setBusy(button, true, 'Creating');

    try {
      await api.post('/admin/coupons', payload);
      toast(`Coupon ${payload.code} created. Activate it when you are ready.`);
      editor.classList.add('d-none');
      couponForm.reset();
      render();
    } catch (error) {
      setBusy(button, false);
      showError(error);
    }
  });

  const couponsEl = root.querySelector('[data-coupons]');
  const offersEl = root.querySelector('[data-offers]');

  try {
    const response = await api.get('/admin/coupons', { per_page: 50 });
    const coupons = response.data || [];

    couponsEl.innerHTML = coupons.length === 0
      ? emptyState('No coupons', 'Create one through the API.')
      : `<div class="table-responsive">
           <table class="table table-tight mb-0">
             <thead><tr><th>Code</th><th>Discount</th><th class="text-center">Used</th>
               <th>Expires</th><th>Status</th><th></th></tr></thead>
             <tbody>${coupons.map(couponRow).join('')}</tbody>
           </table>
         </div>`;

    couponsEl.querySelectorAll('[data-status]').forEach((button) => {
      button.addEventListener('click', async () => {
        const uuid = button.closest('[data-coupon]').dataset.coupon;
        const next = button.dataset.status === 'active' ? 'paused' : 'active';

        setBusy(button, true, 'Saving');

        try {
          await api.post(`/admin/coupons/${encodeURIComponent(uuid)}/status`, { status: next });
          toast(next === 'active' ? 'Coupon is live.' : 'Coupon paused.');
          render();
        } catch (error) {
          setBusy(button, false);
          showError(error);
        }
      });
    });
  } catch (error) {
    couponsEl.innerHTML = '';
    showError(error, couponsEl);
  }

  try {
    const response = await api.get('/admin/offers', { per_page: 50 });
    const offers = response.data || [];

    offersEl.innerHTML = offers.length === 0
      ? emptyState('No offers', 'Automatic offers apply without a code.')
      : `<div class="table-responsive">
           <table class="table table-tight mb-0">
             <thead><tr><th>Offer</th><th>Discount</th><th>Runs until</th><th>Status</th></tr></thead>
             <tbody>
               ${offers.map((offer) => `
                 <tr>
                   <td>
                     <span class="fw-semibold">${escapeHtml(offer.title)}</span>
                     <div class="small text-muted">${escapeHtml(offer.code || '')}</div>
                   </td>
                   <td class="small">
                     ${(offer.discount && offer.discount.summary)
                       ? escapeHtml(offer.discount.summary)
                       : (offer.discount_type === 'percentage'
                           ? `${escapeHtml(offer.discount_value)}%`
                           : formatMoney(offer.discount_value))}
                   </td>
                   <td class="small">${escapeHtml(String(offer.ends_date || '—').slice(0, 10))}</td>
                   <td>${badge(offer.status === 'active' ? 'approved' : 'pending', offer.status)}</td>
                 </tr>`).join('')}
             </tbody>
           </table>
         </div>`;
  } catch (error) {
    offersEl.innerHTML = '';
    showError(error, offersEl);
  }
}

const mounted = await mountConsole('promotions.html');
if (mounted) { root = mounted.root; render(); }
