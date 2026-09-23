import { Link } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { PATHS } from '~/constants/paths';
import { useAuthContext } from '~/features/auth';
import { NAV_LINKS } from '../../data/content';

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { y: 30, opacity: 0 },
  show: { y: 0, opacity: 1 },
};

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export function MobileMenu({ open, onClose }: MobileMenuProps) {
  const { isLoggedIn } = useAuthContext();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="lp-mobile-menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <button type="button" className="lp-burger close" onClick={onClose} aria-label="Đóng menu">
            <X size={18} />
          </button>

          <motion.nav initial="hidden" animate="show" exit="hidden" variants={listVariants}>
            {NAV_LINKS.map((link) => (
              <motion.a key={link.href} href={link.href} onClick={onClose} variants={itemVariants}>
                {link.label}
              </motion.a>
            ))}

            <motion.div variants={itemVariants} className="lp-mobile-menu-actions">
              {isLoggedIn ? (
                <Link to={PATHS.app} className="lp-btn lp-btn-primary">
                  Vào ứng dụng
                </Link>
              ) : (
                <>
                  <Link to={PATHS.login} className="lp-btn lp-btn-ghost light">
                    Đăng nhập
                  </Link>
                  <Link to={PATHS.register} className="lp-btn lp-btn-primary">
                    Đăng ký
                  </Link>
                </>
              )}
            </motion.div>
          </motion.nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
