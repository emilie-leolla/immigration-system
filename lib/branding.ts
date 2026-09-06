/**
 * BRANDING / LOGO CONFIG
 * ----------------------
 * Every logo used anywhere in the app is listed here, pointing at a fixed
 * filename under /public/logos/. Components import from this file instead
 * of hardcoding a path — so swapping in a new logo design is just:
 *
 *   1. Drop the new image into public/logos/, using the EXACT same
 *      filename as the one it's replacing (e.g. "logo-horizontal.png").
 *   2. Refresh the app. Every place that logo appears updates automatically.
 *
 * No code changes needed for a routine logo swap. Only touch this file if
 * you're adding a brand-new logo *slot* (a new spot in the UI that needs
 * its own logo), not when you're just testing a different design for an
 * existing slot.
 */

export const LOGOS = {
    /** Sidebar / top bar across all dashboards (admin, agent, super-admin). Horizontal lockup — icon + wordmark side by side. */
    sidebar: "/logos/logo-horizontal.png",

    /** Sign-in page. Vertical lockup — icon on top, wordmark + tagline below. */
    login: "/logos/logo-vertical.png",

    /** Square icon only, no wordmark. Used for app icons, avatars, anywhere a compact square mark is needed. */
    icon: "/logos/logo-icon.png",

    /** Browser tab favicon. */
    favicon: "/logos/favicon.png",
} as const;

export type LogoSlot = keyof typeof LOGOS;