import { ArrowLeftOutlined, ThunderboltFilled } from '@ant-design/icons';
import { Link, useRouter } from '@tanstack/react-router';
import { ConfigProvider, Grid } from 'antd';
import { motion } from 'motion/react';
import { useLayoutEffect, useRef, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { PATHS } from '~/constants/paths';
import { authCompactTheme, authTheme } from '~/styles/antd-theme';

const EASE = [0.22, 1, 0.36, 1] as const;

export interface AuthVisual {
  image: string;
  imagePosition?: string;
  kicker: string;
  title: string;
  lead: string;
  facts?: { value: string; label: string }[];
  steps?: string[];
}

interface AuthShellProps {
  children: ReactNode;
  visual: AuthVisual;
  width?: number;
}

export function AuthShell({ children, visual, width = 460 }: AuthShellProps) {
  const compact = Grid.useBreakpoint().md === false;
  const router = useRouter();
  const bandRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (!window.matchMedia('(max-width: 56.24rem)').matches) return;
    const skipBand = () => window.scrollTo({ top: bandRef.current?.offsetHeight ?? 0, behavior: 'instant' });
    skipBand();
    return router.subscribe('onRendered', skipBand);
  }, [router]);

  return (
    <ConfigProvider theme={compact ? authCompactTheme : authTheme}>
      <div className="grid min-h-screen grid-cols-1 content-start items-start bg-sc-paper font-body text-sc-ink auth:grid-cols-[1.05fr_1fr]">
        <aside
          ref={bandRef}
          className="relative flex h-[76px] flex-col justify-end overflow-hidden bg-sc-ink px-5 text-white auth:sticky auth:top-0 auth:h-screen auth:justify-between auth:px-12 auth:pt-8 auth:pb-10"
        >
          <motion.img
            src={visual.image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: visual.imagePosition ?? 'center 30%' } as CSSProperties}
            initial={{ scale: 1.08, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.4, ease: EASE }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,19,15,.55)_0%,rgba(20,19,15,.15)_35%,rgba(20,19,15,.75)_70%,rgba(20,19,15,.95)_100%)]" />

          <Link
            to={PATHS.home}
            className="absolute top-1/2 left-5 z-10 inline-flex -translate-y-1/2 items-center gap-2.5 font-display text-[20px] font-extrabold tracking-[.02em] !text-white uppercase no-underline auth:static auth:translate-y-0 auth:self-start auth:text-[22px]"
          >
            <i className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[3px] bg-sc-lime text-[15px] not-italic text-sc-ink">
              <ThunderboltFilled />
            </i>
            Sports Center
          </Link>

          <Link
            to={PATHS.home}
            className="absolute top-1/2 right-5 z-10 -translate-y-1/2 text-[14px] font-medium !text-white/85 no-underline hover:!text-white auth:hidden"
          >
            <ArrowLeftOutlined /> Trang chủ
          </Link>

          <motion.div
            className="relative z-10 hidden auth:block"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
          >
            <p className="mb-3.5 flex items-center gap-3 font-display text-[15px] font-bold tracking-[.12em] text-sc-lime uppercase before:h-0.5 before:w-8 before:bg-sc-lime before:content-['']">
              {visual.kicker}
            </p>
            <h1 className="mb-4 max-w-[12ch] font-display text-[40px] leading-[1.02] font-extrabold text-balance uppercase auth:text-[clamp(44px,4.6vw,72px)]">
              {visual.title}
            </h1>
            <p className="mb-8 hidden max-w-[46ch] text-[17px] leading-[1.55] text-white/80 auth:block">
              {visual.lead}
            </p>

            {visual.facts && (
              <div className="hidden grid-cols-[repeat(3,auto)] justify-start gap-7 border-t border-white/20 pt-[22px] auth:grid">
                {visual.facts.map((f) => (
                  <div key={f.label}>
                    <b className="block font-display text-[28px] leading-none font-extrabold tabular-nums">{f.value}</b>
                    <small className="mt-1 block text-[14.5px] text-white/65">{f.label}</small>
                  </div>
                ))}
              </div>
            )}

            {visual.steps && (
              <ol className="m-0 hidden list-none gap-2.5 border-t border-white/20 p-0 pt-[22px] auth:grid">
                {visual.steps.map((s, i) => (
                  <li key={s} className="flex items-baseline gap-3.5 text-[15px] text-white/85">
                    <b className="font-display text-[22px] font-extrabold text-sc-lime">{i + 1}</b>
                    {s}
                  </li>
                ))}
              </ol>
            )}
          </motion.div>
        </aside>

        <main className="flex min-h-screen flex-col px-5 pt-7 pb-10 auth:px-8 auth:py-7">
          <div className="hidden justify-end auth:flex">
            <Link
              to={PATHS.home}
              className="text-[15px] font-medium text-sc-muted no-underline transition-colors hover:text-sc-ink"
            >
              <ArrowLeftOutlined /> Về trang chủ
            </Link>
          </div>
          <motion.div
            className="mx-auto w-full auth:my-auto auth:py-6"
            style={{ maxWidth: width }}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </ConfigProvider>
  );
}

export function AuthHeading({ title, description }: { title: string; description: ReactNode }) {
  return (
    <>
      <h2 className="mb-2 font-display text-[32px] leading-none font-extrabold text-sc-ink uppercase auth:text-[42px]">
        {title}
      </h2>
      <p className="mb-6 text-[15px] leading-normal text-sc-muted auth:mb-7 auth:text-[17px]">{description}</p>
    </>
  );
}

export function AuthAlt({ children }: { children: ReactNode }) {
  return <div className="mt-5 text-center text-[15px] text-sc-muted auth:text-[16px]">{children}</div>;
}

export function AuthLink({ to, children }: { to: ComponentProps<typeof Link>['to']; children: ReactNode }) {
  return (
    <Link to={to} className="font-semibold text-sc-primary hover:underline">
      {children}
    </Link>
  );
}
