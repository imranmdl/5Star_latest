/** Catalogue: what is on sale, and switching things on and off. */

import { api, mountConsole, showError, toast, setBusy, escapeHtml, formatMoney,
         badge, emptyState } from './console.js';
import { mountProductEditor } from './product-editor.js';

let root = null;
let search = '';

function row(product) {
  // Same nesting as the public list: `pricing.min_price`, `rating.average`.
  const pricing = product.pricing || {};
  const rating = product.rating || {};
  const categoryName = (product.category && product.category.name) || product.category_name;

  return `
    <tr data-product="${escapeHtml(product.uuid)}">
      <td>
        <span class="fw-semibold">${escapeHtml(product.name)}</span>
        <div class="small text-muted">${escapeHtml(product.slug)}</div>
      </td>
      <td class="small">${escapeHtml(categoryName || '—')}</td>
      <td class="text-end">${formatMoney(pricing.min_price)}</td>
      <td class="text-center small">${escapeHtml(pricing.variant_count ?? '—')}</td>
      <td class="text-center small">
        ${Number(rating.count) > 0
          ? `★ ${escapeHtml(Number(rating.average).toFixed(1))} (${escapeHtml(rating.count)})`
          : '<span class="text-muted">—</span>'}
      </td>
      <td>${badge(product.status === 'published' ? 'approved' : 'pending', product.status)}</td>
      <td class="text-end text-nowrap">
        <a class="btn btn-sm btn-outline-secondary"
           href="products.html?edit=${encodeURIComponent(product.uuid)}">Edit</a>
        <button class="btn btn-sm btn-outline-secondary" data-toggle="${escapeHtml(product.status)}">
          ${product.status === 'published' ? 'Unpublish' : 'Publish'}
        </button>
      </td>
    </tr>`;
}

async function render() {
  root.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
      <h1 class="h4 mb-0">Products</h1>
      <div class="d-flex gap-2 align-items-center">
        <a class="btn btn-sm btn-dark" href="products.html?new">Add a product</a>
      <form class="d-flex gap-2" data-search-form>
        <input class="form-control form-control-sm" name="q" value="${escapeHtml(search)}"
               placeholder="Search the catalogue" style="width:14rem">
        <button class="btn btn-sm btn-outline-secondary" type="submit">Search</button>
      </form>
      </div>
    </div>

    <div class="card"><div class="card-body p-0" data-list>
      <div class="text-center py-5 text-muted"><div class="spinner-border"></div></div>
    </div></div>

    <p class="text-muted small mt-3 mb-0">
      This platform does not track stock. Unpublishing hides a product from the shop;
      it does not represent running out.
    </p>`;

  root.querySelector('[data-search-form]').addEventListener('submit', (event) => {
    event.preventDefault();
    search = new FormData(event.currentTarget).get('q') || '';
    render();
  });

  const list = root.querySelector('[data-list]');

  try {
    const response = await api.get('/admin/products', { q: search, per_page: 50 });
    const products = response.data || [];

    if (products.length === 0) {
      list.innerHTML = emptyState(
        search ? 'Nothing matched' : 'No products yet',
        search ? 'Try a different term.' : 'Use "Add a product" to list your first item.'
      );
      return;
    }

    list.innerHTML = `
      <div class="table-responsive">
        <table class="table table-tight table-hover mb-0">
          <thead>
            <tr>
              <th>Product</th><th>Category</th><th class="text-end">From</th>
              <th class="text-center">Packs</th><th class="text-center">Rating</th>
              <th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>${products.map(row).join('')}</tbody>
        </table>
      </div>`;

    list.querySelectorAll('[data-toggle]').forEach((button) => {
      button.addEventListener('click', async () => {
        const uuid = button.closest('[data-product]').dataset.product;
        const next = button.dataset.toggle === 'published' ? 'draft' : 'published';

        setBusy(button, true, 'Saving');

        try {
          await api.patch(`/admin/products/${encodeURIComponent(uuid)}`, { status: next });
          toast(next === 'published' ? 'Product is now on sale.' : 'Product hidden from the shop.');
          render();
        } catch (error) {
          setBusy(button, false);
          showError(error);
        }
      });
    });
  } catch (error) {
    list.innerHTML = '';
    showError(error, list);
  }
}

const mounted = await mountConsole('products.html');

if (mounted) {
  root = mounted.root;

  // The editor takes over the page when ?edit= or ?new is present, so the list
  // and the form never fight over the same container.
  const editing = await mountProductEditor(root);
  if (!editing) render();
}
