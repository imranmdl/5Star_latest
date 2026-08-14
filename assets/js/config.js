/**
 * Storefront settings.
 *
 * THIS IS THE ONLY FILE YOU NEED TO EDIT.
 */

/**
 * Where your backend answers. Must end in /api/v1.
 * Same host as the shop → a path is enough and no CORS is needed.
 */
window.SPICE_API_BASE = 'https://chocolate-deer-714353.hostingersite.com/spice-api/backend/public/api/v1';

/**
 * Your brand.
 *
 * `logoUrl` is drawn in the header. Leave it as the placeholder until your own
 * mark is ready — it is drawn in the shop's colours, so the header looks
 * deliberate rather than unfinished.
 *
 * To use your own: drop the file into assets/img/ and point logoUrl at it.
 * Roughly 4:1 works best (about 320x80). PNG, SVG and WebP all work; SVG stays
 * sharp on every screen.
 *
 * Set logoUrl to null to show the name as text instead.
 */
window.SPICE_BRAND = {
  name: 'Spice & Dry Fruits',
  logoUrl: 'assets/img/logo.svg',
  logoAlt: 'Spice & Dry Fruits',
  // How tall the logo sits in the header, in pixels. The width follows.
  logoHeight: 38,
};
