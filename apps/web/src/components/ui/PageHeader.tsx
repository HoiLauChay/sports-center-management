import { Link, type LinkProps } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  extra?: ReactNode;
  back?: Pick<LinkProps, 'to' | 'params'> & { label: string };
}

export function PageHeader({ title, description, extra, back }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      {back && (
        <Link
          to={back.to}
          params={back.params}
          className="hidden items-center gap-1.5 self-start text-[15px] font-semibold !text-sc-muted no-underline hover:!text-sc-ink md:inline-flex"
        >
          <ChevronLeft size={18} />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 items-center gap-1">
            {back && (
              <Link
                to={back.to}
                params={back.params}
                aria-label={back.label}
                className="-ml-2.5 flex size-10 shrink-0 items-center justify-center !text-sc-ink md:hidden"
              >
                <ChevronLeft size={26} />
              </Link>
            )}
            <h1 className="m-0 font-display text-[27px] leading-[1.05] font-extrabold [overflow-wrap:anywhere] uppercase md:text-[38px]">
              {title}
            </h1>
          </div>
          {description && <div className="text-[15px] text-sc-muted md:text-base">{description}</div>}
        </div>
        {extra}
      </div>
    </div>
  );
}
