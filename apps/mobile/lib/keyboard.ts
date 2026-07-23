import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  LayoutAnimation,
  LayoutChangeEvent,
  Platform,
  TextInput,
  UIManager,
} from 'react-native';

// LayoutAnimation is opt-in on Android; enable it once so the keyboard offset
// below can animate the content up rather than snapping.
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Glide the layout to its new size over the keyboard's own show/hide duration
// so a sheet or composer rises and falls smoothly with the keys instead of
// jumping the instant the offset changes.
function animateKeyboardShift() {
  LayoutAnimation.configureNext({
    duration: 220,
    update: { type: LayoutAnimation.Types.easeInEaseOut },
  });
}

/**
 * Raise the soft keyboard for a text field when a sheet or dialog opens, so the
 * user can type right away instead of tapping the field first. Call from the
 * Modal's onShow (and leave autoFocus off, which does not raise the IME inside
 * an Android Modal anyway).
 *
 * A single focus() once the sheet's slide-in has settled: the field starts
 * unfocused, so one focus is enough to raise the IME, and it lets the OS
 * animate the keyboard up in one smooth motion. Earlier versions repeated
 * blur()+focus(), which re-triggered the IME mid-animation and made it stutter.
 */
export function raiseSoftKeyboard(input: TextInput | null): void {
  setTimeout(() => input?.focus(), FOCUS_DELAY_MS);
}

// Focus almost immediately once the modal window exists. The sheets open with
// animationType="none", so there is no slide to wait out: the keyboard's own
// rise is the entrance, and it lifts the docked sheet up with it (the same
// smooth, OS-driven motion an already-on-screen input gets on tap). A tiny
// delay lets the just-shown window accept IME focus.
const FOCUS_DELAY_MS = 40;

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
    const show = Keyboard.addListener(showEvent, (e) => {
      animateKeyboardShift();
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      animateKeyboardShift();
      setKeyboardHeight(0);
    });
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
