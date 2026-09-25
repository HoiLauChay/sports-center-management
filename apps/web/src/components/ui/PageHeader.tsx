import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  extra?: ReactNode;
}

export function PageHeader({ title, description, extra }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="m-0 font-display text-[28px] leading-tight font-extrabold uppercase md:text-[32px]">{title}</h1>
        {description && <p className="mt-1 mb-0 text-sc-muted">{description}</p>}
      </div>
      {extra}
    </div>
  );
}
