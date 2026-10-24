import { useNavigate, useRouter, type NavigateOptions } from '@tanstack/react-router';
import type { HTMLAttributes } from 'react';

const ROW_CLASS =
  'cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sc-primary';

/** Table row props that run `open` on a click or on Enter once the row has keyboard focus. */
export function clickableRow(open: () => void): HTMLAttributes<HTMLElement> {
  return {
    className: ROW_CLASS,
    tabIndex: 0,
    onClick: open,
    onKeyDown: (event) => {
      if (event.key === 'Enter' && event.target === event.currentTarget) open();
    },
  };
}

/** `onRow` for rows that lead to a page; Ctrl/⌘-click and middle click open it in a new tab. Null keeps a row inert. */
export function useRowLink<T>(link: (row: T) => NavigateOptions | null) {
  const navigate = useNavigate();
  const router = useRouter();
  return (row: T): HTMLAttributes<HTMLElement> => {
    const target = link(row);
    if (!target) return {};
    const newTab = () => window.open(router.buildLocation(target).href, '_blank', 'noopener');
    return {
      ...clickableRow(() => void navigate(target)),
      onClick: (event) => (event.ctrlKey || event.metaKey ? newTab() : void navigate(target)),
      onAuxClick: (event) => {
        if (event.button === 1) newTab();
      },
    };
  };
}
