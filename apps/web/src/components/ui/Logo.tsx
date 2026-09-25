import logoMark from '~/assets/brand/logo-mark.svg';

interface LogoProps {
  size?: number;
  withText?: boolean;
  className?: string;
}

export function Logo({ size = 32, withText = false, className }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <img src={logoMark} width={size} height={size} alt={withText ? '' : 'Sports Center'} className="block shrink-0" />
      {withText && (
        <span className="font-display text-[20px] leading-none font-extrabold tracking-[.02em] uppercase">
          Sports Center
        </span>
      )}
    </span>
  );
}
