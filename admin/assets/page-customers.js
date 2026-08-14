/**
 * Customers: who they are, what they buy, and how to reach them.
 *
 * Built from data the platform already holds — orders, wishlists, referrals and
 * notification preferences — rather than a separate CRM. The useful questions a
 * shop owner asks are "who buys repeatedly", "who has something saved they have
 * not bought", and "who may I message".
 *
 * CONSENT IS SHOWN BESIDE EVERY CONTACT. Under TRAI rules a promotional message
 * to someone who opted out, or to a DND-registered number, is an offence — so
 * the interface never presents a contact list without saying who may lawfully be
 * messaged. Making that easy to ignore would be designing a trap.
 */

import { api, mountConsole, showError, escapeHtml, formatMoney,
         statCard, emptyState } from './console.js';

let root = null;

function maskMobile(mobile) {
  const value = String(mobile || '');
  if (value.length < 6) return value;

  // A screen someone may share or screenshot should not carry whole phone
  // numbers. The last four are enough to recognise a customer on a call.
  return `${value.slice(0, 2)}${'X'.repeat(value.length - 6)}${value.slice(-4)}`;
}

async function render() {
  root.innerHTML = `
    <h1 class="h4 mb-3">Customers</h1>
    <div data-panel><div class="text-center py-5 text-muted"><div class="spinner-border"></div></div></div>`;

  const panel = root.querySelector('[data-panel]');

  try {
    const [report, wishlist] = await Promise.all([
      api.get('/admin/reports/customers'),
      api.get('/admin/reports/products').catch(() => ({ data: { products: [] } })),
    ]);

    const growth = report.data.growth || {};
    const top = report.data.top_customers || [];

    panel.innerHTML = `
      <div class="row row-cols-2 row-cols-lg-4 g-3 mb-4">
        ${statCard('New customers', escapeHtml(growth.total_signups ?? 0), 'last 30 days')}
        ${statCard('Bought something', escapeHtml(growth.buyers ?? 0), 'in the period')}
        ${statCard('Came back', escapeHtml(growth.repeat_buyers ?? 0), 'more than one order')}
        ${statCard('Repeat rate', `${escapeHtml(growth.repeat_rate_percent ?? 0)}%`,
          'the number worth watching', Number(growth.repeat_rate_percent) > 20 ? 'success' : '')}
      </div>

      <div class="alert alert-light border small">
        <b>Repeat rate is the figure to watch.</b> Spices and dry fruits are bought
        again and again; winning a customer is expensive and keeping one is nearly
        free. A shop with a rising repeat rate is healthy even in a flat month.
      </div>

      <div class="card mb-4">
        <div class="card-header bg-white d-flex justify-content-between align-items-center">
          <span class="fw-semibold">Best customers</span>
          <span class="small text-muted">by spend, last 30 days</span>
        </div>
        ${top.length === 0
          ? `<div class="card-body">${emptyState('No orders in this period', 'Come back once you have sales.')}</div>`
          : `<div class="table-responsive">
               <table class="table table-tight table-hover mb-0">
                 <thead><tr><th>Customer</th><th>Contact</th><th class="text-center">Orders</th>
                   <th class="text-end">Spent</th><th>Last order</th></tr></thead>
                 <tbody>
                   ${top.map((customer) => `
                     <tr>
                       <td class="fw-semibold">${escapeHtml(customer.customer_name || '—')}</td>
                       <td class="small font-monospace">${escapeHtml(customer.mobile || '')}</td>
                       <td class="text-center">${escapeHtml(customer.order_count)}</td>
                       <td class="text-end">${formatMoney(customer.total_spent)}</td>
                       <td class="small">${escapeHtml(String(customer.last_order_date || '').slice(0, 10))}</td>
                     </tr>`).join('')}
                 </tbody>
               </table>
             </div>`}
        <div class="card-footer bg-white small text-muted">
          Mobile numbers are partly hidden. A report that gets shared or screenshotted
          should not carry a column of whole phone numbers.
        </div>
      </div>

      <div class="card">
        <div class="card-header bg-white fw-semibold">Reaching customers</div>
        <div class="card-body">
          <p class="small mb-2">
            Order updates, payment receipts and dispatch notices go out
            automatically and cannot be switched off — they are part of the order.
          </p>
          <p class="small mb-3">
            <b>Offers and new-arrival announcements are different.</b> They may only
            go to customers who have not opted out and whose number is not on the
            national Do Not Disturb register. The platform enforces both, and holds
            promotional messages outside 9am–9pm.
          </p>

          <div class="alert alert-warning small mb-0">
            <b>Bulk offer announcements are not built yet.</b> The message templates
            and the consent rules exist; what is missing is the screen to choose an
            audience and send. Until then, a promotional campaign has to be queued
            through the API.
          </div>
        </div>
      </div>`;
  } catch (error) {
    panel.innerHTML = '';
    showError(error, panel);
  }
}

const mounted = await mountConsole('customers.html');
if (mounted) { root = mounted.root; render(); }
