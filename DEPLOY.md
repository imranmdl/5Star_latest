# Deploying the storefront

Five minutes, two steps.

## 1. Copy the WHOLE folder

Copy this entire directory — not just the `.html` files. The pages are empty
shells; every one of them loads its behaviour from `assets/js/`.

Your web root should end up looking exactly like this:

```
5star/
├── index.html
├── product.html
├── cart.html
├── checkout.html
├── orders.html
├── account.html
├── support.html
├── faq.html
├── page.html
└── assets/
    ├── css/
    │   └── store.css
    └── js/
        ├── config.js          ← the only file you edit
        ├── api.js
        ├── ui.js
        ├── page-catalog.js
        ├── page-product.js
        ├── page-cart.js
        ├── page-checkout.js
        ├── page-orders.js
        ├── page-account.js
        ├── page-support.js
        ├── page-faq.js
        └── page-page.js
```

**Check it worked** by opening this in your browser:

```
http://localhost/5star/assets/js/api.js
```

You should see JavaScript source. If you get "Not Found", the `assets` folder
did not copy and nothing on the site will work.

## 2. Point it at your backend

Edit `assets/js/config.js` — one line:

```js
window.SPICE_API_BASE = 'http://localhost:8081/api/v1';
```

Set this to wherever `backend/public` is being served, with `/api/v1` on the end.
Confirm the address is right by opening it directly:

```
http://localhost:8081/api/v1/health
```

You should get `{"success":true, ...}`.

### Same host or different host?

**Same host** (storefront and API under one domain) is simplest — use a path and
nothing else is needed:

```js
window.SPICE_API_BASE = '/api/v1';
```

**Different host or port** — as above with the full address, and the backend
must send CORS headers allowing your storefront's origin. In `backend/public/.htaccess`:

```apache
Header always set Access-Control-Allow-Origin "http://localhost"
Header always set Access-Control-Allow-Headers "Authorization, Content-Type, X-Cart-Token"
Header always set Access-Control-Allow-Methods "GET, POST, PATCH, DELETE, OPTIONS"
```

Requires `mod_headers`: `sudo a2enmod headers`.

## If the page still looks broken

Open the browser console with **F12**. The storefront now shows a red banner
when it cannot reach the API, but the console has the detail.

| What you see | What it means |
|---|---|
| Page renders but no navbar, "Loading…" never changes | The JavaScript did not load. Check `assets/js/api.js` opens in the browser |
| `Failed to load module script ... MIME type "text/plain"` | Your server sends `.js` as the wrong type. Add `AddType text/javascript .js` to `.htaccess` |
| Red banner: "Cannot reach the shop" | `config.js` points at the wrong address, or the backend is not running |
| `blocked by CORS policy` | Storefront and API are on different origins; add the headers above |
| `404` on `/api/v1/products` | The API base is wrong — probably missing `/api/v1` |

## A note on file:// URLs

Opening `index.html` by double-clicking will **not** work. ES modules require
`http://`, and browsers block them on `file://`. Serve the folder from any web
server — Apache, nginx, or `python3 -m http.server`.
