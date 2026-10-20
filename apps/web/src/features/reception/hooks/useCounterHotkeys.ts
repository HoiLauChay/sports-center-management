import { useEffect, useRef } from 'react';

interface CounterHotkeys {
  /** Ctrl+K: jump to the customer search. */
  onSearch?: () => void;
  /** Ctrl+Enter: collect payment (the caller decides whether it is allowed right now). */
  onPay?: () => void;
  /** Alt+1/2/3: pick a payment method by position. */
  onMethod?: (index: number) => void;
}

/** Keyboard shortcuts of the counter screen; handlers are read fresh on every key press. */
export function useCounterHotkeys(handlers: CounterHotkeys) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { onSearch, onPay, onMethod } = ref.current;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && onSearch) {
        event.preventDefault();
        onSearch();
      } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && onPay) {
        event.preventDefault();
        onPay();
      } else if (event.altKey && !event.ctrlKey && /^[1-3]$/.test(event.key) && onMethod) {
        event.preventDefault();
        onMethod(Number(event.key) - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
