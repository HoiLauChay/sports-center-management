import { Link } from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import { motion, useMotionValueEvent, useScroll } from 'motion/react';
import { useState } from 'react';
import { PATHS } from '~/constants/paths';
import { useAuthContext } from '~/features/auth';
import { NAV_LINKS } from '../../data/content';
import { useActiveSection } from '../../hooks/useActiveSection';
import { Brand, EASE } from '../shared';
import { MobileMenu } from './MobileMenu';
import './navbar.css';

const SECTION_IDS = NAV_LINKS.map((l) => l.href);

export function Navbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const activeSection = useActiveSection(SECTION_IDS);
  const { isLoggedIn } = useAuthContext();

  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 40);
    setHidden(y > 400 && y > prev && !menuOpen);
  });

  return (
    <>
      <motion.header
        className={`lp-nav ${scrolled ? 'scrolled' : ''}`}
        animate={{ y: hidden ? -90 : 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <div className="lp-container lp-nav-inner">
          <Brand />

          <nav className="lp-nav-links">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className={activeSection === link.href ? 'on' : ''}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className="lp-nav-cta">
            {isLoggedIn ? (
              <Link to={PATHS.app} className="lp-btn lp-btn-primary sm">
                Vào ứng dụng
              </Link>
            ) : (
              <>
                <Link to={PATHS.login} className="lp-link">
                  Đăng nhập
                </Link>
                <Link to={PATHS.login} className="lp-btn lp-btn-primary sm">
                  Đặt sân
                </Link>
              </>
            )}
          </div>

          <button type="button" className="lp-burger" onClick={() => setMenuOpen(true)} aria-label="Mở menu">
            <Menu size={18} />
          </button>
        </div>
      </motion.header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
