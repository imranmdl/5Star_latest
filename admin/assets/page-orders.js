/**
 * Orders: the screen staff live in.
 *
 * The actions here are the ones performed dozens of times a day — mark packed,
 * book a courier, look up why something is stuck. Everything rarer is left to
 * the API.
 *
 * BR-005 IS THE SERVER'S RULE, NOT THIS SCREEN'S. An unpaid order cannot be
 * progressed, and the server enforces that regardless of what any client sends.
 * This screen disables the buttons anyway, so staff see the constraint before
 * they hit it rather than as a red error afterwards.
 */

import { api, mountConsole, showError, toast, setBusy, escapeHtml, formatMoney,
         badge, emptyState, queryParam } from './console.js';

const state = {
  status: queryParam('status') || '',
  page: 1,
};

let root = null;

const FILTERS = [
  ['', 'All'],
  ['created', 'Awaiting payment'],
  ['confirmed', 'To pack'],
  ['packed', 'To ship'],
  ['shipped', 'In transit'],
  ['delivered', 'Delivered'],
  ['cancelled', 'Cancelled'],
];

function row(order) {
  const paid = order.payment_status === 'paid' || order.payment_status === 'partially_refunded';

  return `
    <tr>
      <td>
        <a href="orders.html?uuid=${encodeURIComponent(order.uuid)}" class="fw-semibold text-decoration-none">
          ${escapeHtml(order.order_number)}
        </a>
        <div class="small text-muted">${escapeHtml(String(order.placed_date || '').slice(0, 16).replace('T', ' '))}</div>
      </td>
      <td>${escapeHtml(order.customer_name || '—')}</td>
      <td>${badge(order.status, String(order.status).replace(/_/g, ' '))}</td>
      <td>
        ${paid
          ? '<span class="badge text-bg-success">Paid</span>'
          : `<span class="badge text-bg-warning">${escapeHtml(order.payment_status)}</span>`}
      </td>
      <td class="text-end">${formatMoney(order.grand_total)}</td>
      <td class="text-end">
        <a class="btn btn-sm btn-outline-secondary"
           href="orders.html?uuid=${encodeURIComponent(order.uuid)}">Open</a>
      </td>
    </tr>`;
}

async function renderList() {
  root.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
      <h1 class="h4 mb-0">Orders</h1>
      <div class="btn-group btn-group-sm" role="group" aria-label="Filter orders">
        ${FILTERS.map(([value, label]) => `
          <button type="button" class="btn ${state.status === value ? 'btn-dark' : 'btn-outline-secondary'}"
                  data-filter="${value}">${escapeHtml(label)}</button>`).join('')}
      </div>
    </div>
    <div class="card"><div class="card-body p-0" data-list>
      <div class="text-center py-5 text-muted"><div class="spinner-border"></div></div>
    </div></div>`;

  root.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      state.status = button.dataset.filter;
      state.page = 1;
      renderList();
    });
  });

  const list = root.querySelector('[data-list]');

  try {
    const response = await api.get('/admin/orders', {
      status: state.status,
      page: state.page,
      per_page: 25,
    });

    const orders = response.data || [];

    if (orders.length === 0) {
      list.innerHTML = emptyState('No orders here',
        state.status ? 'Nothing currently has that status.' : 'No orders have been placed yet.');
      return;
    }

    list.innerHTML = `
      <div class="table-responsive">
        <table class="table table-tight table-hover mb-0">
          <thead>
            <tr>
              <th>Order</th><th>Customer</th><th>Status</th><th>Payment</th>
              <th class="text-end">Total</th><th></th>
            </tr>
          </thead>
          <tbody>${orders.map(row).join('')}</tbody>
        </table>
      </div>
      ${(response.meta && response.meta.total_pages > 1) ? `
        <div class="p-3 border-top d-flex justify-content-between align-items-center">
          <span class="small text-muted">
            Page ${escapeHtml(response.meta.page)} of ${escapeHtml(response.meta.total_pages)},
            ${escapeHtml(response.meta.total)} order(s)
          </span>
          <span>
            <button class="btn btn-sm btn-outline-secondary" data-page-prev
                    ${response.meta.page <= 1 ? 'disabled' : ''}>Previous</button>
            <button class="btn btn-sm btn-outline-secondary" data-page-next
                    ${response.meta.page >= response.meta.total_pages ? 'disabled' : ''}>Next</button>
          </span>
        </div>` : ''}`;

    const prev = list.querySelector('[data-page-prev]');
    const next = list.querySelector('[data-page-next]');
    if (prev) prev.addEventListener('click', () => { state.page -= 1; renderList(); });
    if (next) next.addEventListener('click', () => { state.page += 1; renderList(); });
  } catch (error) {
    list.innerHTML = '';
    showError(error, list);
  }
}

/** The actions available, given what the server will actually allow. */
function actionsFor(order, detail) {
  const paid = order.payment_status === 'paid' || order.payment_status === 'partially_refunded';
  const shipped = Boolean(detail.shipping && detail.shipping.tracking_number);
  const buttons = [];

  if (!paid) {
    return `
      <div class="alert alert-warning small mb-0">
        <div class="fw-semibold">Nothing can be done until this is paid for.</div>
        Orders do not progress without a verified payment, and that applies to staff
        actions too. If the customer has paid, the confirmation arrives by webhook —
        it is not something to force through here.
      </div>`;
  }

  if (order.status === 'confirmed') {
    buttons.push(['packed', 'Mark as packed', 'btn-dark']);
  }

  if (['confirmed', 'packed'].includes(order.status) && !shipped) {
    buttons.push(['__ship', 'Book a courier', 'btn-primary']);
  }

  if (['confirmed', 'packed'].includes(order.status)) {
    buttons.push(['cancelled', 'Cancel order', 'btn-outline-danger']);
  }

  if (buttons.length === 0) {
    return `<p class="text-muted small mb-0">No actions available at this status.</p>`;
  }

  return `<div class="d-flex flex-wrap gap-2">${buttons.map(([value, label, cls]) => `
    <button class="btn btn-sm ${cls}" data-action="${escapeHtml(value)}">${escapeHtml(label)}</button>`).join('')}</div>`;
}

async function renderDetail(uuid) {
  try {
    const response = await api.get(`/admin/orders/${encodeURIComponent(uuid)}`);
    const detail = response.data;
    const order = detail.order;

    root.innerHTML = `
      <a class="small text-decoration-none" href="orders.html">← All orders</a>

      <div class="d-flex flex-wrap justify-content-between align-items-start mt-2 mb-3 gap-2">
        <div>
          <h1 class="h4 mb-1">${escapeHtml(order.order_number)}</h1>
          <div>
            ${badge(order.status, String(order.status).replace(/_/g, ' '))}
            <span class="ms-2">${badge(order.payment_status, order.payment_status)}</span>
            ${order.invoice_number
              ? `<span class="ms-2 small text-muted">Invoice ${escapeHtml(order.invoice_number)}</span>`
              : ''}
          </div>
        </div>
        <div class="text-end">
          <div class="fs-5 fw-semibold">${formatMoney(order.grand_total)}</div>
          <div class="small text-muted">incl. ${formatMoney(detail.pricing.tax_total)} GST</div>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header bg-white fw-semibold">Actions</div>
        <div class="card-body" data-actions>${actionsFor(order, detail)}</div>
      </div>

      <div class="row g-3">
        <div class="col-12 col-lg-7">
          <div class="card mb-3">
            <div class="card-header bg-white fw-semibold">Items</div>
            <div class="table-responsive">
              <table class="table table-tight mb-0">
                <tbody>
                  ${detail.items.map((item) => `
                    <tr>
                      <td>
                        ${escapeHtml(item.product_name)}
                        <div class="small text-muted">${escapeHtml(item.variant_name)} · ${escapeHtml(item.sku || '')}</div>
                      </td>
                      <td class="text-end">× ${escapeHtml(item.quantity)}</td>
                      <td class="text-end">${formatMoney(item.line_payable)}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <div class="card-header bg-white fw-semibold">Timeline</div>
            <ul class="list-group list-group-flush">
              ${(detail.timeline || []).map((entry) => `
                <li class="list-group-item py-2">
                  <div class="fw-semibold small">${escapeHtml(entry.title)}</div>
                  ${entry.note ? `<div class="small text-muted">${escapeHtml(entry.note)}</div>` : ''}
                  <div class="small text-muted">${escapeHtml(String(entry.date || '').slice(0, 16).replace('T', ' '))}</div>
                </li>`).join('')}
            </ul>
          </div>
        </div>

        <div class="col-12 col-lg-5">
          <div class="card mb-3">
            <div class="card-header bg-white fw-semibold">Deliver to</div>
            <div class="card-body small">
              <div class="fw-semibold">${escapeHtml(detail.shipping.name || '')}</div>
              <div>${escapeHtml(detail.shipping.address || '')}</div>
              <div class="mt-2">${escapeHtml(detail.shipping.mobile || '')}</div>
              ${detail.shipping.tracking_number ? `
                <hr>
                <div>${escapeHtml(detail.shipping.courier_name || 'Courier')}</div>
                <div class="font-monospace">${escapeHtml(detail.shipping.tracking_number)}</div>` : ''}
            </div>
          </div>

          <div class="card">
            <div class="card-header bg-white fw-semibold">Payment</div>
            <div class="card-body small">
              <dl class="row mb-0">
                <dt class="col-7 fw-normal">Items</dt>
                <dd class="col-5 text-end">${formatMoney(detail.pricing.items_subtotal)}</dd>
                <dt class="col-7 fw-normal">Discount</dt>
                <dd class="col-5 text-end">${formatMoney(detail.pricing.order_discount)}</dd>
                <dt class="col-7 fw-normal">Delivery</dt>
                <dd class="col-5 text-end">${formatMoney(detail.pricing.delivery_charge)}</dd>
                <dt class="col-7 fw-semibold">Total</dt>
                <dd class="col-5 text-end fw-semibold">${formatMoney(detail.pricing.grand_total)}</dd>
                ${Number(detail.pricing.wallet_applied) > 0 ? `
                  <dt class="col-7 fw-normal">Paid by wallet</dt>
                  <dd class="col-5 text-end">${formatMoney(detail.pricing.wallet_applied)}</dd>` : ''}
              </dl>
            </div>
          </div>
        </div>
      </div>`;

    root.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => performAction(uuid, button));
    });
  } catch (error) {
    root.innerHTML = '<a class="small" href="orders.html">← All orders</a>';
    showError(error, root);
  }
}

async function performAction(uuid, button) {
  const action = button.dataset.action;

  if (action === 'cancelled') {
    const reason = window.prompt('Why is this order being cancelled? The customer is told.');
    if (!reason) return;

    setBusy(button, true, 'Cancelling');

    try {
      await api.post(`/admin/orders/${encodeURIComponent(uuid)}/cancel`, { reason });
      toast('Order cancelled. Any payment will be refunded.');
      renderDetail(uuid);
    } catch (error) {
      setBusy(button, false);
      showError(error);
    }

    return;
  }

  if (action === '__ship') {
    setBusy(button, true, 'Booking');

    try {
      // No courier named: automatic selection by weight, destination, cost and
      // speed, with the reasoning recorded against the order.
      const response = await api.post(`/admin/orders/${encodeURIComponent(uuid)}/ship`, {});
      toast(`Booked with ${response.data.courier_name || 'a courier'}.`);
      renderDetail(uuid);
    } catch (error) {
      setBusy(button, false);
      showError(error);
    }

    return;
  }

  setBusy(button, true, 'Updating');

  try {
    await api.post(`/admin/orders/${encodeURIComponent(uuid)}/status`, { status: action });
    toast('Order updated.');
    renderDetail(uuid);
  } catch (error) {
    setBusy(button, false);
    showError(error);
  }
}

const mounted = await mountConsole('orders.html');

if (mounted) {
  root = mounted.root;
  const uuid = queryParam('uuid');
  if (uuid) renderDetail(uuid); else renderList();
}
