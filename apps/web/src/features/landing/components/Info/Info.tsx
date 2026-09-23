import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { PATHS } from '~/constants/paths';
import { CONTACT, INFO_SECTION, OPENING_HOURS } from '../../data/content';
import { Reveal, SectionHeading, Stagger, StaggerItem } from '../shared';
import './info.css';

export function Info() {
  return (
    <section className="lp-section lp-info" id="info">
      <div className="lp-container">
        <SectionHeading eyebrow={INFO_SECTION.eyebrow} title={INFO_SECTION.title} />

        <div className="lp-info-grid">
          <Stagger className="lp-hours">
            {OPENING_HOURS.map((row) => (
              <StaggerItem key={row.name} className="lp-hours-row">
                <b>{row.name}</b>
                <span>{row.time}</span>
                <em>{row.note}</em>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal delay={0.15} className="lp-contact">
            <dl>
              <dt>Địa chỉ</dt>
              <dd>{CONTACT.address}</dd>
              <dt>Điện thoại</dt>
              <dd>{CONTACT.phone}</dd>
              <dt>Email</dt>
              <dd>{CONTACT.email}</dd>
              <dt>Gửi xe</dt>
              <dd>{CONTACT.parking}</dd>
            </dl>
            <Link to={PATHS.login} className="lp-btn lp-btn-ink">
              Xem lịch sân hôm nay <ArrowRight size={16} />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
