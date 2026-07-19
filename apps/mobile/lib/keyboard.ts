import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, LayoutChangeEvent, Platform } from 'react-native';

/**
 * Bottom padding that keeps a bottom-anchored view above the on-screen keyboard.
 *
 * Android is inconsistent here: with edge-to-edge the keyboard is drawn over the
 * app window (nothing resizes, so the view must be padded by the full keyboard
 * height), but with adjustResize the window shrinks on its own and padding by the
 * keyboard height would push the view twice as far up. Comparing the current
 * measured height against the tallest height seen so far tells us which one
 * happened, so whatever the window already gave up is subtracted and the view
 * lands just above the keys either way.
 *
 * Pass `onLayout` to the view that should stay clear of the keyboard and apply
 * `offset` as its paddingBottom.
 */
export function useKeyboardOffset(): {
  offset: number;
  onLayout: (e: LayoutChangeEvent) => void;
} {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [shrunkBy, setShrunkBy] = useState(0);
  const tallest = useRef(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > tallest.current) tallest.current = h;
    setShrunkBy(Math.max(0, tallest.current - h));
  }, []);

  return { offset: keyboardHeight === 0 ? 0 : Math.max(0, keyboardHeight - shrunkBy), onLayout };
}
