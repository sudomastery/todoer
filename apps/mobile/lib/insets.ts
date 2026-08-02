import { useEffect, useState } from 'react';
import { Keyboard, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Bottom clearance for content that sits against the bottom of the screen.
 *
 * The app draws edge to edge, so without this the system navigation sits on
 * top of whatever is down there: the Save row of a sheet, the comment box on a
 * task. Three button navigation reports roughly 48dp and gesture navigation
 * around 16dp, but some devices report nothing at all, hence the floor.
 *
 * Dropped to a small fixed gap while the keyboard is open: that used to add
 * to the keyboard offset to compensate for Android under-reporting it, back
 * when the offset was hand-tracked. Now KeyboardAvoidingView (from
 * react-native-keyboard-controller) already lands the sheet flush above the
 * keys on its own, so stacking the nav-bar inset on top of that just left a
 * dead gray gap between the sheet and the keyboard.
 */
export function useBottomInset(): number {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  return keyboardVisible ? 8 : Math.max(insets.bottom, 8);
}

function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
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
