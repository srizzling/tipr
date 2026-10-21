/** Original line icons as SVG path data (24x24 viewBox, stroked). Shared by the page and the share image. */
export const ICON_PATHS = {
  speed: ['M4 17a8 8 0 1 1 16 0', 'M12 17l4-5'],
  afterburner: ['M6 9l6-5 6 5', 'M6 14l6-5 6 5', 'M6 19l6-5 6 5'],
  ramjet: ['M12 3c3 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z'],
  cornering: ['M5 20c0-8 3-12 12-12', 'M13 4l4 4-4 4'],
  resilience: ['M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z'],
  battery: ['M4.5 8h12a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 3 14.5v-5A1.5 1.5 0 0 1 4.5 8z', 'M20.5 10.5v3', 'M7 11v2M10 11v2'],
  maneuvering: ['M4 8c4-4 9 0 14-2', 'M4 18c4-4 9 0 14-2', 'M15 3l3 3-3 3'],
  ability: ['M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z'],
  part: ['M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9z'],
  fault: ['M12 4l9 16H3z', 'M12 10v4M12 17v.5'],
} as const;

export type IconName = keyof typeof ICON_PATHS;
