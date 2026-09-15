import { ArrowLeftOutlined, ThunderboltFilled } from '@ant-design/icons';
import { Link } from '@tanstack/react-router';
import { ConfigProvider } from 'antd';
import { motion } from 'motion/react';
import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import { PATHS } from '~/constants/paths';
import { authTheme } from '~/styles/antd-theme';

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

export function AuthShell({ children, visual, width = 420 }: AuthShellProps) {
  return (
    <ConfigProvider theme={authTheme}>
      <div className="grid min-h-screen grid-cols-1 items-start bg-sc-paper font-body text-sc-ink auth:grid-cols-[1.05fr_1fr]">
        <aside className="relative flex h-[300px] flex-col justify-end overflow-hidden bg-sc-ink px-6 pt-5 pb-7 text-white auth:sticky auth:top-0 auth:h-screen auth:justify-between auth:px-12 auth:pt-8 auth:pb-10">
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
            className="absolute top-5 left-6 z-10 inline-flex items-center gap-2.5 font-display text-[22px] font-extrabold tracking-[.02em] text-white uppercase no-underline hover:text-white auth:static auth:self-start"
          >
            <i className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[3px] bg-sc-lime text-[15px] not-italic text-sc-ink">
              <ThunderboltFilled />
            </i>
            Sports Center
          </Link>

          <motion.div
            className="relative z-10"
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
                    <small className="mt-1 block text-[13px] text-white/65">{f.label}</small>
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

        <main className="flex min-h-screen flex-col px-5 pt-5 pb-8 auth:px-8 auth:py-7">
          <div className="flex justify-end">
            <Link
              to={PATHS.home}
              className="text-sm font-medium text-sc-muted no-underline transition-colors hover:text-sc-ink"
            >
              <ArrowLeftOutlined /> Về trang chủ
            </Link>
          </div>
          <motion.div
            className="m-auto w-full py-3 auth:py-6"
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

export function AuthHeading({ title, description }: { title: string; description: string }) {
  return (
    <>
      <h2 className="mb-2 font-display text-[34px] leading-none font-extrabold text-sc-ink uppercase auth:text-[42px]">
        {title}
      </h2>
      <p className="mb-[26px] text-[15px] leading-normal text-sc-muted">{description}</p>
    </>
  );
}

export function AuthAlt({ children }: { children: ReactNode }) {
  return <div className="mt-[18px] text-center text-[14.5px] text-sc-muted">{children}</div>;
}

export function AuthLink({ to, children }: { to: ComponentProps<typeof Link>['to']; children: ReactNode }) {
  return (
    <Link to={to} className="font-semibold text-sc-primary hover:underline">
      {children}
    </Link>
  );
}
