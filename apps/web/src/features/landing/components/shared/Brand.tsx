import { Link } from '@tanstack/react-router';
import { Zap } from 'lucide-react';
import { PATHS } from '~/constants/paths';

export function Brand() {
  return (
    <Link to={PATHS.home} className="lp-brand">
      <span className="lp-brand-logo">
        <Zap size={15} fill="currentColor" />
      </span>
      Sports Center
    </Link>
  );
}
