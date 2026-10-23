/**
 * Where people can support the site (Ko-fi, Buy Me a Coffee, GitHub Sponsors, ...).
 * Leave empty to hide the link everywhere. A PUBLIC_DONATE_URL build variable overrides it, which is handy for previews.
 */
export const DONATE_URL: string = import.meta.env.PUBLIC_DONATE_URL ?? '';

/**
 * Where people can ask for a Reddit-sourced build on the builds board to be taken down (an email link such as mailto:you@example.com,
 * or a form). Leave empty to hide the line. Set it before launch: the board credits other people's posts.
 */
export const CONTACT_URL: string = import.meta.env.PUBLIC_CONTACT_URL ?? '';
