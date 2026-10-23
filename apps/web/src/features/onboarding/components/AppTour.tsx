import { Tour, type TourProps } from 'antd';
import { useMemo, useState } from 'react';
import { ROLE_TOUR, type TourRole, type TourTarget } from '../config/tourSteps';

// The sidebar is also rendered inside the (hidden) mobile drawer, so pick the copy that is on screen.
function findVisible(target: TourTarget) {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`);
  return Array.from(nodes).find((node) => node.getClientRects().length > 0) ?? null;
}

// On mobile most nav items live behind the "Thêm" button; with no anchor at all the step is centered.
function resolveTarget(target?: TourTarget) {
  if (!target) return null;
  const node = findVisible(target) ?? findVisible('more');
  // antd only scrolls when the target is outside the window, not when the sidebar's own scroll area hides it.
  node?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  return node;
}

interface AppTourProps {
  role: TourRole;
  open: boolean;
  onClose: () => void;
}

export function AppTour({ role, open, onClose }: AppTourProps) {
  const [current, setCurrent] = useState(0);

  const steps = useMemo<TourProps['steps']>(
    () =>
      ROLE_TOUR[role].map(({ target, title, description }) => ({
        title,
        description,
        // antd centers the step when the target resolves to null; its typings just don't allow the union.
        target: target ? () => resolveTarget(target) as HTMLElement : null,
      })),
    [role],
  );

  const close = () => {
    setCurrent(0);
    onClose();
  };

  return (
    <Tour
      open={open}
      current={current}
      onChange={setCurrent}
      onClose={close}
      onFinish={close}
      steps={steps}
      zIndex={1100}
      indicatorsRender={(index, total) => (
        <span className="text-[13px] text-sc-muted">
          {index + 1}/{total}
        </span>
      )}
    />
  );
}
