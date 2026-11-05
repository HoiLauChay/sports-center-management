import dayjs from 'dayjs';
import { Ellipsis } from 'lucide-react';
import { motion } from 'motion/react';
import logoMark from '~/assets/brand/logo-mark.svg';
import { DAY_LABEL } from '~/lib/time';
import { EASE } from '../shared';
import { MOCK_KIND_LABEL, MOCK_NAV, MOCK_QUICK_LINKS, MOCK_STATS, MOCK_UPCOMING, MOCK_USER } from './mockupData';

/** Scaled-down replica of the member's `/dashboard`: sidebar, greeting, stat cards, quick links, upcoming list. */
export function AppMockup() {
  return (
    <div className="lp-mock">
      <div className="lp-mock-bar">
        <i />
        <i />
        <i />
        <span>app.sportscenter.vn/dashboard</span>
      </div>
      <div className="lp-mock-body">
        <MockSidebar />
        <div className="lp-mock-main">
          <b className="lp-mock-title">Xin chào, {MOCK_USER.name}</b>
          <MockStats />
          <MockQuickLinks />
          <MockUpcoming />
        </div>
      </div>
    </div>
  );
}

function MockSidebar() {
  return (
    <aside className="lp-mock-side">
      <div className="lp-mock-brand">
        <img src={logoMark} width={24} height={24} alt="" />
        <div>
          <b>Sports Center</b>
          <small>Management System</small>
        </div>
      </div>
      <nav className="lp-mock-nav">
        {MOCK_NAV.map((group, g) => (
          <div key={group.title ?? g} className="lp-mock-group">
            {group.title && <small>{group.title}</small>}
            {group.items.map(({ label, icon: Icon, active }) => (
              <div key={label} className={`lp-mock-link ${active ? 'on' : ''}`}>
                <i>
                  <Icon size={11} strokeWidth={2.2} />
                </i>
                {label}
              </div>
            ))}
          </div>
        ))}
      </nav>
      <div className="lp-mock-account">
        <i>{MOCK_USER.initials}</i>
        <div>
          <b>{MOCK_USER.name}</b>
          <small>{MOCK_USER.role}</small>
        </div>
        <Ellipsis size={12} />
      </div>
    </aside>
  );
}

function MockStats() {
  return (
    <div className="lp-mock-stats">
      {MOCK_STATS.map(({ label, value, unit, icon: Icon }) => (
        <div key={label} className="lp-mock-stat">
          <div>
            <i>
              <Icon size={11} />
            </i>
            {label}
          </div>
          <b>
            {value}
            {unit && <span>{unit}</span>}
          </b>
        </div>
      ))}
    </div>
  );
}

function MockQuickLinks() {
  return (
    <div className="lp-mock-links">
      {MOCK_QUICK_LINKS.map(({ label, icon: Icon }) => (
        <div key={label}>
          <i>
            <Icon size={12} />
          </i>
          {label}
        </div>
      ))}
    </div>
  );
}

function MockUpcoming() {
  const today = dayjs();
  return (
    <div className="lp-mock-card">
      <b className="lp-mock-section">Lịch sắp tới</b>
      {MOCK_UPCOMING.map((event, i) => {
        const date = today.add(event.dayOffset, 'day');
        return (
          <motion.div
            key={event.title}
            className="lp-mock-event"
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 + i * 0.08, ease: EASE }}
          >
            <i className={event.kind === 'BOOKING' ? 'bk' : 'cl'} />
            <div>
              <b>{event.title}</b>
              <small>
                {DAY_LABEL[date.day()]}, {date.format('DD/MM/YYYY')} · {event.time} · {event.subtitle}
              </small>
            </div>
            <em>{MOCK_KIND_LABEL[event.kind]}</em>
          </motion.div>
        );
      })}
    </div>
  );
}
