import { Button, Grid, Tour, type TourProps } from 'antd';
import { ArrowRight, Check, CircleUserRound, Menu, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import logoMark from '~/assets/brand/logo-mark.svg';
import { bottomNavFor, navGroupsFor } from '~/config/navigation';
import { ROLE_LABEL } from '~/constants/roles';
import { ROLE_COLOR_ON_DARK } from '~/styles/antd-theme';
import { ROLE_TOUR, type TourRole, type TourTarget } from '../config/tourSteps';

// On mobile the dashboard link exists both in the bottom bar and in the drawer, so look in the right one.
function resolveTarget(target: TourTarget, inDrawer: boolean) {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`);
  const node =
    Array.from(nodes).find(
      (candidate) => !!candidate.closest('.ant-drawer') === inDrawer && candidate.getClientRects().length > 0,
    ) ?? null;
  // antd only scrolls when the target is outside the window, not when the sidebar's own scroll area hides it.
  node?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  return node;
}

// antd measures the highlight once per step and only again on window resize/scroll, so while the drawer
// slides in we nudge it to re-measure until the drawer has moved and come to rest. Slow devices and
// background tabs can delay the slide by seconds, hence the generous cap; leaving the step cancels it.
const FOLLOW_INTERVAL_MS = 50;
const FOLLOW_MAX_MS = 15000;
const FOLLOW_SETTLED_CHECKS = 4;

function followSlidingTarget(getNode: () => Element | null) {
  const startedAt = Date.now();
  let lastX: number | undefined;
  let moved = false;
  let still = 0;

  const timer = window.setInterval(() => {
    const x = getNode()?.getBoundingClientRect().x;
    if (lastX !== undefined && x !== lastX) {
      moved = true;
      still = 0;
    } else {
      still += 1;
    }
    lastX = x;
    window.dispatchEvent(new Event('resize'));
    if ((moved && still >= FOLLOW_SETTLED_CHECKS) || Date.now() - startedAt > FOLLOW_MAX_MS) {
      window.clearInterval(timer);
    }
  }, FOLLOW_INTERVAL_MS);

  return () => window.clearInterval(timer);
}

interface StepMeta {
  icon: LucideIcon;
  group: string;
}

// Reuse the sidebar's icons and group titles so each step looks like the menu item it points at.
function stepMetaFor(role: TourRole) {
  const meta = new Map<TourTarget, StepMeta>([['account', { icon: CircleUserRound, group: 'Tài khoản' }]]);
  for (const group of navGroupsFor(role)) {
    for (const item of group.items) meta.set(item.path, { icon: item.icon, group: group.title ?? 'Chung' });
  }
  return meta;
}

function firstNameOf(fullName: string) {
  return fullName.trim().split(/\s+/).at(-1) ?? fullName;
}

interface StepCoverProps {
  index: number;
  total: number;
  meta?: StepMeta;
  role: TourRole;
  userName: string;
}

function StepCover({ index, total, meta, role, userName }: StepCoverProps) {
  const Icon = meta?.icon;

  return (
    <div className="bg-sc-ink px-5 pt-5 pb-4 text-left text-white">
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-3 pr-8"
      >
        {Icon ? (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sc-lime text-sc-ink">
            <Icon size={22} strokeWidth={2.2} />
          </span>
        ) : (
          <img src={logoMark} width={44} height={44} alt="" className="block !size-11 shrink-0" />
        )}
        <div className="min-w-0">
          <div className="font-display text-[13px] font-bold tracking-[0.14em] text-white/45 uppercase">
            {meta ? meta.group : `Xin chào, ${firstNameOf(userName)}`}
          </div>
          {meta ? (
            <div className="font-display text-[17px] font-bold text-white tabular-nums">
              {String(index + 1).padStart(2, '0')}
              <span className="text-white/35"> / {String(total).padStart(2, '0')}</span>
            </div>
          ) : (
            <div className="font-display text-[17px] font-bold" style={{ color: ROLE_COLOR_ON_DARK[role] }}>
              {ROLE_LABEL[role]}
            </div>
          )}
        </div>
      </motion.div>
      <div className="mt-4 flex gap-1" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full [transition:background-color_0.3s_var(--sc-ease)] ${i <= index ? 'bg-sc-lime' : 'bg-white/15'}`}
          />
        ))}
      </div>
    </div>
  );
}

function StepDescription({ text, inDrawer }: { text: string; inDrawer: boolean }) {
  return (
    <>
      {text}
      {inDrawer && (
        <span className="mt-3 flex w-fit items-center gap-1.5 rounded-lg bg-sc-paper px-2.5 py-1 text-[13.5px] font-semibold text-sc-ink-2">
          <Menu size={14} /> Mở trong menu “Thêm”
        </span>
      )}
    </>
  );
}

interface AppTourProps {
  role: TourRole;
  userName: string;
  open: boolean;
  onClose: () => void;
  // Given only on mobile, where most nav items sit in the drawer behind the "Thêm" button.
  onNavMenuChange?: (open: boolean) => void;
}

export function AppTour({ role, userName, open, onClose, onNavMenuChange }: AppTourProps) {
  const [current, setCurrent] = useState(0);
  const isMobile = Grid.useBreakpoint().md === false;
  const total = ROLE_TOUR[role].length;

  const inDrawer = useMemo(() => {
    const bottomPaths = new Set<TourTarget>(bottomNavFor(role).map((item) => item.path));
    return ROLE_TOUR[role].map(({ target }) => !!onNavMenuChange && !!target && !bottomPaths.has(target));
  }, [role, onNavMenuChange]);

  const steps = useMemo<TourProps['steps']>(() => {
    const meta = stepMetaFor(role);
    return ROLE_TOUR[role].map(({ target, title, description }, index) => ({
      title,
      description: <StepDescription text={description} inDrawer={inDrawer[index]} />,
      cover: (
        <StepCover
          index={index}
          total={total}
          meta={target ? meta.get(target) : undefined}
          role={role}
          userName={userName}
        />
      ),
      // Sidebar items get the card beside them; on mobile the card sits above the bottom bar or below drawer items.
      placement: isMobile ? (inDrawer[index] ? 'bottom' : 'top') : 'right',
      // antd centers the step when the target resolves to null; its typings just don't allow the union.
      target: target ? () => resolveTarget(target, inDrawer[index]) as HTMLElement : null,
    }));
  }, [role, total, userName, isMobile, inDrawer]);

  const stopFollowing = useRef<() => void>(undefined);

  const goTo = (index: number) => {
    setCurrent(index);
    if (!onNavMenuChange || inDrawer[index] === inDrawer[current]) return;
    onNavMenuChange(inDrawer[index]);
    stopFollowing.current?.();
    // Bottom-bar targets never move, so only the drawer opening needs following.
    if (inDrawer[index]) {
      stopFollowing.current = followSlidingTarget(() => document.querySelector('.ant-drawer-content-wrapper'));
    }
  };

  const close = () => {
    stopFollowing.current?.();
    setCurrent(0);
    onNavMenuChange?.(false);
    onClose();
  };

  const isLast = current === total - 1;

  return (
    <Tour
      open={open}
      current={current}
      onChange={goTo}
      onClose={close}
      onFinish={close}
      steps={steps}
      zIndex={1100}
      arrow={false}
      gap={{ offset: 6, radius: 12 }}
      mask={{ color: 'rgba(20, 19, 15, 0.62)' }}
      classNames={{
        // `root` also lands on the mask, so only size the popup itself.
        root: '[&.ant-tour]:!w-[380px] [&.ant-tour]:!max-w-[calc(100vw-32px)]',
        section:
          '!overflow-hidden !rounded-2xl !p-0 !shadow-[0_24px_60px_-12px_rgba(20,19,15,0.5),0_0_0_1px_rgba(20,19,15,0.06)]',
        cover: '!m-0 !p-0',
        close:
          '!top-4 !right-4 !size-8 !rounded-lg !text-white/55 hover:!bg-white/10 hover:!text-white [&_svg]:!size-4',
        header: '!mb-1.5 !px-5 !pt-4',
        title: '!font-display !text-[23px] !leading-tight !font-extrabold !tracking-[0.01em] !uppercase',
        description: '!px-5 !text-[15px] !leading-relaxed !text-sc-ink-2',
        footer: '!mt-0 !flex !items-center !justify-between !gap-2 !px-5 !pt-5 !pb-5',
        indicators: '!m-0',
        actions: '!m-0 !flex !gap-2',
      }}
      indicatorsRender={() =>
        isLast ? null : (
          <Button type="text" onClick={close} className="!h-9 !px-2 !text-sc-muted hover:!text-sc-ink">
            Bỏ qua
          </Button>
        )
      }
      actionsRender={() => (
        <>
          {current > 0 && (
            <Button onClick={() => goTo(current - 1)} className="!h-9 !px-4">
              Trước
            </Button>
          )}
          <Button type="primary" onClick={isLast ? close : () => goTo(current + 1)} className="!h-9 !gap-1.5 !px-4">
            {current === 0 ? 'Bắt đầu' : isLast ? 'Hoàn tất' : 'Tiếp'}
            {isLast ? <Check size={16} /> : <ArrowRight size={16} />}
          </Button>
        </>
      )}
    />
  );
}
