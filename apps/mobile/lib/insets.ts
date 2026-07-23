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
 * Kept when the keyboard is open too: the keyboard height Android reports to
 * React Native comes up short of the real overlap by about the navigation
 * inset, which left the send button half buried under the IME (verified on
 * the emulator). Padding by inset plus keyboard offset lands the control just
 * above the keys on every nav mode; the worst case is a few spare pixels.
 */
export function useBottomInset(): number {
  const insets = useSafeAreaInsets();
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
