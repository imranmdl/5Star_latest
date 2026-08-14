/**
 * Reports: what came in, what it cost, and where it went.
 *
 * The question a shop owner asks at the end of a day is not "what is my
 * revenue" — it is "how much money actually reached me, and how much of what I
 * am holding is not mine". Tax collected and refunds owed are both in that
 * second category, so they are shown next to the takings rather than buried.
 *
 * Field names come from the API's own sales series. Every one was checked
 * against a live response before this file was written, because a report that
 * silently shows ₹0.00 for a column nobody reads is worse than no report.
 */

import { api, mountConsole, showError, escapeHtml, formatMoney,
         statCard, badge, emptyState } from './console.js';

let root = null;
let days = 30;

function money(value) {
  return formatMoney(Number(value) || 0);
}

/** Adds up a column across the series. */
function total(series, key) {
  return series.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
}

function dailyTable(series) {
  if (series.length === 0) {
    return emptyState('No sales in this period', 'Try a longer range.');
  }

  // Newest first: the day someone wants is almost always today or yesterday.
  const rows = [...series].reverse();

  return `
    <div class="table-responsive">
      <table class="table table-tight table-hover mb-0">
        <thead>
          <tr>
            <th>Date</th>
            <th class="text-center">Orders</th>
            <th class="text-end">Taken</th>
            <th class="text-end">Of which GST</th>
            <th class="text-end">Discounts</th>
            <th class="text-end">Delivery</th>
            <th class="text-end">Refunded</th>
            <th class="text-end">Yours</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => {
            // What the shop actually keeps: money in, less the tax it is holding
            // for the government, less anything refunded.
            const kept = (Number(row.gross_sales) || 0)
              - (Number(row.tax_collected) || 0)
              - (Number(row.refunded) || 0);

            return `
              <tr>
                <td class="fw-semibold">${escapeHtml(row.date)}</td>
                <td class="text-center">${escapeHtml(row.orders)}</td>
                <td class="text-end">${money(row.gross_sales)}</td>
                <td class="text-end text-muted">${money(row.tax_collected)}</td>
                <td class="text-end text-muted">${money(row.discount_given)}</td>
                <td class="text-end text-muted">${money(row.delivery_collected)}</td>
                <td class="text-end ${Number(row.refunded) > 0 ? 'text-danger' : 'text-muted'}">
                  ${money(row.refunded)}
                </td>
                <td class="text-end fw-semibold">${money(kept)}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function pipelineTable(pipeline) {
  if (!pipeline || pipeline.length === 0) {
    return '<p class="text-muted small mb-0">No paid orders in progress.</p>';
  }

  return `
    <table class="table table-tight mb-0">
      <thead><tr><th>Status</th><th class="text-end">Orders</th><th class="text-end">Value</th></tr></thead>
      <tbody>
        ${pipeline.map((row) => `
          <tr>
            <td>${badge(row.status, String(row.status).replace(/_/g, ' '))}</td>
            <td class="text-end">${escapeHtml(row.count)}</td>
            <td class="text-end">${money(row.value)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

async function render() {
  root.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
      <h1 class="h4 mb-0">Reports</h1>
      <div class="btn-group btn-group-sm">
        ${[[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']].map(([value, label]) => `
          <button type="button" class="btn ${days === value ? 'btn-dark' : 'btn-outline-secondary'}"
                  data-days="${value}">${escapeHtml(label)}</button>`).join('')}
      </div>
    </div>
    <div data-panel><div class="text-center py-5 text-muted"><div class="spinner-border"></div></div></div>`;

  root.querySelectorAll('[data-days]').forEach((button) => {
    button.addEventListener('click', () => { days = Number(button.dataset.days); render(); });
  });

  const panel = root.querySelector('[data-panel]');

  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  const iso = (date) => date.toISOString().slice(0, 10);

  try {
    const [sales, dashboard, cancellations] = await Promise.all([
      api.get('/admin/reports/sales', { from: iso(from), to: iso(to) }),
      api.get('/admin/dashboard'),
      api.get('/admin/reports/cancellations', { from: iso(from), to: iso(to) }),
    ]);

    const series = sales.data.series || [];
    const today = dashboard.data.today || {};
    const refunds = cancellations.data.refunds || {};

    const taken = total(series, 'gross_sales');
    const tax = total(series, 'tax_collected');
    const refunded = total(series, 'refunded');
    const orders = total(series, 'orders');
    const kept = taken - tax - refunded;

    panel.innerHTML = `
      <div class="row row-cols-2 row-cols-lg-4 g-3 mb-3">
        ${statCard('Orders today', escapeHtml(today.orders ?? 0))}
        ${statCard('Taken today', money(today.revenue))}
        ${statCard('Delivered today', escapeHtml(today.delivered ?? 0))}
        ${statCard('Cancelled today', escapeHtml(today.cancelled ?? 0), '',
          Number(today.cancelled) > 0 ? 'warning' : '')}
      </div>

      <div class="card mb-4">
        <div class="card-header bg-white fw-semibold">
          Cash flow — last ${escapeHtml(days)} days
        </div>
        <div class="card-body">
          <div class="row row-cols-2 row-cols-lg-4 g-3">
            ${statCard('Money in', money(taken), `${escapeHtml(orders)} order(s)`)}
            ${statCard('GST collected', money(tax), 'held for the government')}
            ${statCard('Refunded', money(refunded), '', refunded > 0 ? 'danger' : '')}
            ${statCard('Yours to keep', money(kept), 'after tax and refunds', 'success')}
          </div>

          <p class="small text-muted mt-3 mb-0">
            <b>GST is not income.</b> Indian prices include tax, so a share of every
            rupee taken is money you are holding on behalf of the government until
            you file. "Yours to keep" is takings less that tax and less anything
            refunded — the figure to plan against.
          </p>
        </div>
      </div>

      <div class="row g-3 mb-4">
        <div class="col-12 col-lg-7">
          <div class="card h-100">
            <div class="card-header bg-white fw-semibold">Day by day</div>
            <div class="card-body p-0">${dailyTable(series)}</div>
          </div>
        </div>

        <div class="col-12 col-lg-5">
          <div class="card mb-3">
            <div class="card-header bg-white fw-semibold">Orders in progress</div>
            <div class="card-body p-0">${pipelineTable(dashboard.data.pipeline)}</div>
          </div>

          <div class="card">
            <div class="card-header bg-white fw-semibold">Refunds</div>
            <div class="card-body small">
              <dl class="row mb-0">
                <dt class="col-7 fw-normal">Refunds issued</dt>
                <dd class="col-5 text-end">${escapeHtml(refunds.count ?? 0)}</dd>
                <dt class="col-7 fw-normal">Back to the payer</dt>
                <dd class="col-5 text-end">${money(refunds.to_gateway)}</dd>
                <dt class="col-7 fw-normal">Back to wallet</dt>
                <dd class="col-5 text-end">${money(refunds.to_wallet)}</dd>
                ${Number(refunds.failed) > 0 ? `
                  <dt class="col-7 fw-normal text-danger">Failed</dt>
                  <dd class="col-5 text-end text-danger">${escapeHtml(refunds.failed)}</dd>` : ''}
              </dl>
              ${Number(refunds.failed) > 0
                ? '<div class="alert alert-danger small mt-2 mb-0">A failed refund is a customer waiting for money. Chase these first.</div>'
                : ''}
            </div>
          </div>
        </div>
      </div>

      <p class="text-muted small mb-0">
        Only confirmed, non-cancelled orders count. An order placed but never paid
        for is not revenue and never appears here.
      </p>`;
  } catch (error) {
    panel.innerHTML = '';
    showError(error, panel);
  }
}

const mounted = await mountConsole('reports.html');
if (mounted) { root = mounted.root; render(); }
