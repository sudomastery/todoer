import { useColorScheme } from 'react-native';
import { BRAND } from '@todoer/shared';

export const light = {
  bg: '#ffffff',
  bgElevated: '#fcfaf8',
  bgPressed: '#f2efed',
  fg: '#202020',
  fgSecondary: '#666666',
  fgFaint: '#999999',
  border: '#eeeeee',
  brand: BRAND.primary,
};

export const dark = {
  bg: '#1e1e1e',
  bgElevated: '#282828',
  bgPressed: '#333333',
  fg: '#ffffff',
  fgSecondary: '#b3b3b3',
  fgFaint: '#808080',
  border: '#333333',
  brand: BRAND.primary,
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
