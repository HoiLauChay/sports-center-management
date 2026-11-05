import { Link } from '@tanstack/react-router';
import logoMark from '~/assets/brand/logo-mark.svg';
import { PATHS } from '~/constants/paths';

export function Brand() {
  return (
    <Link to={PATHS.home} className="lp-brand">
      <img src={logoMark} width={34} height={34} alt="" className="lp-brand-logo" />
      Sports Center
    </Link>
  );
}
