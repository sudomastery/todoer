import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, LayoutChangeEvent, Platform, TextInput } from 'react-native';

/**
 * Raise the soft keyboard for a text field when a sheet or dialog opens, so the
 * user can type right away instead of tapping the field first.
 *
 * autoFocus does not raise the IME inside an Android Modal, and a plain focus()
 * is a no-op once the field already holds focus, so blur()+focus() is used to
 * force it. Retried past the sheet's slide-in because the moment the modal
 * window can accept IME focus varies by device; the checks stop once the
 * keyboard is up. Call from the Modal's onShow.
 */
export function raiseSoftKeyboard(input: TextInput | null): void {
  [80, 250, 500].forEach((delay) => {
    setTimeout(() => {
      if (Keyboard.isVisible()) return;
      input?.blur();
      input?.focus();
    }, delay);
  });
}

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
