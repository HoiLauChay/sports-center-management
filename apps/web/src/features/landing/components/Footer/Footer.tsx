import { Link } from '@tanstack/react-router';
import { FOOTER, type FooterLink } from '../../data/content';
import { Brand } from '../shared';
import './footer.css';

export function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-container lp-footer-grid">
        <div>
          <Brand />
          <p>{FOOTER.tagline}</p>
        </div>

        {FOOTER.columns.map((column) => (
          <div key={column.title}>
            <b>{column.title}</b>
            {column.links.map((link) => (
              <FooterLinkItem key={link.label} link={link} />
            ))}
          </div>
        ))}
      </div>

      <div className="lp-container lp-footer-bottom">
        <span>{FOOTER.copyright}</span>
        <span>{FOOTER.project}</span>
      </div>

      <div className="lp-footer-mark" aria-hidden>
        Sports Center
      </div>
    </footer>
  );
}

function FooterLinkItem({ link }: { link: FooterLink }) {
  if (!link.href) return <span>{link.label}</span>;
  if (link.href.startsWith('/')) return <Link to={link.href}>{link.label}</Link>;
  return <a href={link.href}>{link.label}</a>;
}
