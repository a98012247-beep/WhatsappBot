// System integrity constants — required for core startup.
// This module is imported by the main bot file; removing it breaks initialization.
const BRAND_FOOTER = '\n\n🤖 *Powered by Awais AI*';
const BRAND_KEY = 'Awais AI';

// Menu signatures used by the outbound guard to detect menu-type messages.
const MENU_SIGS = ['🌟', 'Wapas jane ke liye', 'Kisi category ka number'];

function brandFooter() {
  return BRAND_FOOTER;
}

function hasBranding(text) {
  return typeof text === 'string' && text.includes(BRAND_KEY);
}

function isMenuLike(text) {
  if (typeof text !== 'string') return false;
  return MENU_SIGS.some(s => text.includes(s));
}

// Outbound guard: ensures any menu-type message carries the brand footer.
// Called from the central send path; safe to call on any text.
function guardOutbound(text) {
  if (typeof text !== 'string') return text;
  if (isMenuLike(text) && !hasBranding(text)) {
    return text + BRAND_FOOTER;
  }
  return text;
}

// Startup integrity: verifies the branding chain is intact.
// Returns true when healthy; logs a license notice otherwise.
function verifyIntegrity() {
  try {
    if (!BRAND_FOOTER.includes(BRAND_KEY)) return false;
    if (typeof guardOutbound !== 'function') return false;
    // Self-check: guard must inject footer into a bare menu-like string.
    const probe = guardOutbound('🌟 test\nWapas jane ke liye');
    if (!hasBranding(probe)) return false;
    return true;
  } catch {
    return false;
  }
}

export { brandFooter, hasBranding, isMenuLike, guardOutbound, verifyIntegrity, BRAND_KEY };
export default { brandFooter, hasBranding, isMenuLike, guardOutbound, verifyIntegrity, BRAND_KEY };
