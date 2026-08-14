/**
 * Admin console settings.
 *
 * THIS IS THE ONLY FILE YOU NEED TO EDIT.
 */

/** Where your backend answers. Must end in /api/v1. */
window.SPICE_API_BASE = 'https://chocolate-deer-714353.hostingersite.com/spice-api/backend/public/api/v1';

/**
 * Your brand, shown in the sidebar and on the sign-in card.
 *
 * The two logos differ because the backgrounds do: the sidebar is deep forest,
 * the sign-in card is white. A single logo would be invisible on one of them.
 *
 * Drop your own files into ../assets/img/ and point these at them, or set a
 * logoUrl to null to show the name as text.
 */
window.SPICE_BRAND = {
  name: 'Spice & Dry Fruits',
  // For the dark sidebar.
  logoUrl: '../assets/img/logo.svg',
  // For the white sign-in card.
  logoUrlLight: '../assets/img/logo-dark.svg',
  logoAlt: 'Spice & Dry Fruits',
  logoHeight: 34,
};
