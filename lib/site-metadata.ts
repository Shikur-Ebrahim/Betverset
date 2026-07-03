/** Canonical site URL for metadata / Open Graph (set on Vercel: NEXT_PUBLIC_SITE_URL). */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') || 'https://www.betverset.bet';

export const SITE_NAME = 'Betvers Betting';

export const SITE_DESCRIPTION =
  'Betvers Betting — the most trusted sports betting platform. Live football odds, secure deposits, and fast withdrawals.';

/** Official Betvers brand logo (public/logo.jpg). */
export const SITE_LOGO_PATH = '/logo.jpg';

/** Absolute URL for crawlers (WhatsApp, Telegram, etc.). */
export const SITE_OG_IMAGE_URL = `${SITE_URL}${SITE_LOGO_PATH}`;
