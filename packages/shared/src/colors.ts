/**
 * Project and label color palette, in the spirit of Todoist's palette.
 * Keys are stored in the database; hex values are rendered by both apps.
 */
export const PALETTE: Record<string, { label: string; hex: string }> = {
  berry_red: { label: 'Berry Red', hex: '#b8255f' },
  red: { label: 'Red', hex: '#db4035' },
  orange: { label: 'Orange', hex: '#ff9933' },
  yellow: { label: 'Yellow', hex: '#fad000' },
  olive_green: { label: 'Olive Green', hex: '#afb83b' },
  lime_green: { label: 'Lime Green', hex: '#7ecc49' },
  green: { label: 'Green', hex: '#299438' },
  mint_green: { label: 'Mint Green', hex: '#6accbc' },
  teal: { label: 'Teal', hex: '#158fad' },
  sky_blue: { label: 'Sky Blue', hex: '#14aaf5' },
  light_blue: { label: 'Light Blue', hex: '#96c3eb' },
  blue: { label: 'Blue', hex: '#4073ff' },
  grape: { label: 'Grape', hex: '#884dff' },
  violet: { label: 'Violet', hex: '#af38eb' },
  lavender: { label: 'Lavender', hex: '#eb96eb' },
  magenta: { label: 'Magenta', hex: '#e05194' },
  salmon: { label: 'Salmon', hex: '#ff8d85' },
  charcoal: { label: 'Charcoal', hex: '#808080' },
  grey: { label: 'Grey', hex: '#b8b8b8' },
  taupe: { label: 'Taupe', hex: '#ccac93' },
};

export const COLOR_KEYS = Object.keys(PALETTE);

export function colorHex(key: string): string {
  return PALETTE[key]?.hex ?? PALETTE.charcoal.hex;
}

/** Brand colors, similar to Todoist's red. */
export const BRAND = {
  primary: '#dc4c3e',
  primaryHover: '#c53727',
  primaryLight: '#fbeeec',
} as const;

/** Priority flag colors: P1 red, P2 orange, P3 blue, P4 neutral. */
export const PRIORITY_COLORS: Record<number, string> = {
  1: '#d1453b',
  2: '#eb8909',
  3: '#246fe0',
  4: '#666666',
};
