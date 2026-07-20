import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Bottom clearance for content that sits against the bottom of the screen.
 *
 * The app draws edge to edge, so without this the system navigation sits on
 * top of whatever is down there: the Save row of a sheet, the comment box on a
 * task. Three button navigation reports roughly 48dp and gesture navigation
 * around 16dp, but some devices report nothing at all, hence the floor.
 *
 * Pass the keyboard offset when a surface already shifts up for the keyboard:
 * the navigation bar is behind the keyboard at that point, so adding the inset
 * as well would leave a visible gap.
 */
export function useBottomInset(keyboardOffset = 0): number {
  const insets = useSafeAreaInsets();
  if (keyboardOffset > 0) return 0;
  return Math.max(insets.bottom, 8);
}

/**
 * Tallest a bottom sheet may grow before its body scrolls, keeping the action
 * row on screen. Proportional to the window so small phones and landscape do
 * not end up with the buttons pushed off the bottom.
 */
export function useSheetMaxHeight(fraction = 0.55): number {
  const { height } = useWindowDimensions();
  return Math.round(height * fraction);
}
