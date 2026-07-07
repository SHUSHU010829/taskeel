import { useRef } from 'react';

// Spread the returned props onto an <input> so pressing Enter submits — but
// never the Enter that only confirms an IME (Chinese/Japanese/…) candidate.
// Usage: <input {...useEnterSubmit(() => doThing())} />
export function useEnterSubmit(onEnter: () => void) {
  const composing = useRef(false);
  return {
    onCompositionStart: () => {
      composing.current = true;
    },
    onCompositionEnd: () => {
      composing.current = false;
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (composing.current || e.nativeEvent.isComposing) return;
      e.preventDefault();
      onEnter();
    },
  };
}
