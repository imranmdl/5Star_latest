/** Dashboard: what needs attention, then today's figures. */

import { api, mountConsole, showError, escapeHtml, formatMoney, statCard, badge } from './console.js';

const ATTENTION = [
  ['unassigned_orders', 'Paid orders not yet assigned', 'orders.html?status=confirmed'],
  ['overdue_assignments', 'Assignments past their due time', 'orders.html'],
  ['delivery_problems', 'Deliveries that failed or are returning', 'orders.html'],
  ['bulk_enquiries_waiting', 'Wholesale enquiries awaiting a quote', null],
  ['commission_awaiting_approval', 'Commission entries to approve', null],
  ['expired_unpaid', 'Unpaid orders past their window', null],
];

function attentionPanel(counts) {
  // Only what is actually outstanding. A list of six zeroes trains people to
  // ignore the panel, and then they ignore it on the day it is not zero.
  const live = ATTENTION.filter(([key]) => Number(counts[key] || 0) > 0);

  if (live.length === 0) {
    return `
      <div class="card mb-4">
        <div class="card-body text-center py-4">
          <div class="fw-semibold text-success">Nothing needs attention.</div>
          <div class="small text-muted">No unassigned orders, overdue work or delivery problems.</div>
        </div>
      </div>`;
  }

  return `
    <div class="card mb-4 needs-attention">
      <div class="card-header bg-white fw-semibold">Needs attention</div>
      <ul class="list-group list-group-flush">
        ${live.map(([key, label, href]) => `
          <li class="list-group-item d-flex justify-content-between align-items-center">
            <span>${escapeHtml(label)}</span>
            <span>
              <span class="badge text-bg-danger">${escapeHtml(counts[key])}</span>
              ${href ? `<a class="btn btn-sm btn-outline-secondary ms-2" href="${href}">View</a>` : ''}
            </span>
          </li>`).join('')}
      </ul>
    </div>`;
}

function pipelinePanel(pipeline) {
  if (!pipeline.length) {
    return '<p class="text-muted small">No paid orders in progress.</p>';
  }

  return `
    <table class="table table-tight mb-0">
      <thead><tr><th>Status</th><th class="text-end">Orders</th><th class="text-end">Value</th></tr></thead>
      <tbody>
        ${pipeline.map((row) => `
          <tr>
            <td>${badge(row.status, row.status.replace(/_/g, ' '))}</td>
            <td class="text-end">${escapeHtml(row.count)}</td>
            <td class="text-end">${formatMoney(row.value)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function salesSparkline(series) {
  if (!series.length) return '<p class="text-muted small mb-0">No sales in the last seven days.</p>';

  const max = Math.max(...series.map((d) => Number(d.gross_sales) || 0), 1);

  // A bar per day, drawn with plain markup. A charting library for seven bars
  // would be a dependency, a download and a thing to keep updated.
  return `
    <div class="d-flex align-items-end gap-2" style="height:7rem">
      ${series.map((day) => {
        const height = Math.max(4, Math.round((Number(day.gross_sales) / max) * 100));
        return `
          <div class="flex-fill text-center" title="${escapeHtml(day.date)}: ${formatMoney(day.gross_sales)}">
            <div class="bg-primary rounded-top mx-auto" style="height:${height}%;width:70%"></div>
            <div class="small text-muted mt-1">${escapeHtml(String(day.date).slice(8))}</div>
          </div>`;
      }).join('')}
    </div>`;
}

async function render(root) {
  try {
    const response = await api.get('/admin/dashboard');
    const data = response.data;

    root.innerHTML = `
      <h1 class="h4 mb-4">Dashboard</h1>

      ${attentionPanel(data.needs_attention || {})}

      <div class="row row-cols-2 row-cols-lg-4 g-3 mb-4">
        ${statCard('Orders today', escapeHtml(data.today.orders))}
        ${statCard('Revenue today', formatMoney(data.today.revenue))}
        ${statCard('Delivered today', escapeHtml(data.today.delivered))}
        ${statCard('Cancelled today', escapeHtml(data.today.cancelled),
          '', Number(data.today.cancelled) > 0 ? 'warning' : '')}
      </div>

      <div class="row g-3">
        <div class="col-12 col-lg-6">
          <div class="card h-100">
            <div class="card-header bg-white fw-semibold">In progress</div>
            <div class="card-body p-0">${pipelinePanel(data.pipeline || [])}</div>
          </div>
        </div>
        <div class="col-12 col-lg-6">
          <div class="card h-100">
            <div class="card-header bg-white fw-semibold">Last seven days</div>
            <div class="card-body">${salesSparkline(data.last_7_days || [])}</div>
          </div>
        </div>
      </div>

      <p class="text-muted small mt-4 mb-0">
        Revenue counts confirmed, non-cancelled orders only. An order that has been
        placed but not paid for is not revenue.
      </p>`;
  } catch (error) {
    root.innerHTML = '';
    showError(error, root);
  }
}

const mounted = await mountConsole('index.html');
if (mounted) render(mounted.root);
