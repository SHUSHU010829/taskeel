import type { KeyboardEvent } from 'react';

// Returns input props so pressing Enter submits — but never the Enter that only
// confirms an IME (Chinese/Japanese/…) candidate. This is a plain function, NOT
// a hook, so it is safe to spread inside conditionally-rendered JSX.
//   <input {...enterSubmit(() => doThing())} />
export function enterSubmit(onEnter: () => void) {
  return {
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      // isComposing (and legacy keyCode 229) is true while an IME candidate is
      // being confirmed — don't submit then.
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      onEnter();
    },
  };
}
