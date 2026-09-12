import dayjs from 'dayjs';
import { motion } from 'motion/react';
import { EASE } from '../shared';
import {
  MOCK_BOOKED_SLOTS,
  MOCK_CLASS_SLOTS,
  MOCK_HOURS,
  MOCK_NAV,
  MOCK_STATS,
  MOCK_USER,
  MOCK_WEEK,
} from './mockupData';

export function AppMockup() {
  return (
    <div className="lp-mock">
      <div className="lp-mock-body">
        <MockSidebar />
        <div className="lp-mock-main">
          <MockTopbar />
          <MockHeader />
          <MockStats />
          <div className="lp-mock-row">
            <MockWeekCard />
            <MockSlotsCard />
          </div>
        </div>
      </div>
    </div>
  );
}

function MockSidebar() {
  return (
    <aside className="lp-mock-side">
      <div className="lp-mock-brand">
        <i />
        <div>
          <b>Sports Center</b>
          <small>Management System</small>
        </div>
      </div>
      <div className="lp-mock-role">
        <i />
        Thành viên
        <span>{dayjs().format('dd, DD/MM')}</span>
      </div>
      {MOCK_NAV.map((item) => (
        <div key={item.label} className={`lp-mock-nav ${item.active ? 'on' : ''}`}>
          <i />
          <span>{item.label}</span>
        </div>
      ))}
      <div className="lp-mock-user">
        <i>{MOCK_USER.initials}</i>
        <div>
          <b>{MOCK_USER.name}</b>
          <small>{MOCK_USER.email}</small>
        </div>
      </div>
    </aside>
  );
}

function MockTopbar() {
  return (
    <div className="lp-mock-top">
      <span className="lp-mock-search">
        Tìm thành viên, lớp học, hóa đơn…<kbd>Ctrl K</kbd>
      </span>
      <span className="lp-mock-bell" />
      <span className="lp-mock-me">
        <i>{MOCK_USER.initials}</i>
        {MOCK_USER.name}
      </span>
    </div>
  );
}

function MockHeader() {
  return (
    <div className="lp-mock-head">
      <b>Xin chào, Dung 👋</b>
      <span style={{ textTransform: 'capitalize' }}>{dayjs().format('dddd, DD/MM/YYYY')}</span>
    </div>
  );
}

function MockStats() {
  return (
    <div className="lp-mock-stats">
      {MOCK_STATS.map((stat) => (
        <div key={stat.title} className="lp-mock-stat">
          <i style={{ background: `color-mix(in srgb, ${stat.color} 12%, #fff)`, color: stat.color }} />
          <div>
            <small>{stat.title}</small>
            <b>{stat.value}</b>
            <em>{stat.hint}</em>
          </div>
        </div>
      ))}
    </div>
  );
}

function MockWeekCard() {
  const todayIndex = (dayjs().day() + 6) % 7;
  return (
    <div className="lp-mock-card">
      <div className="lp-mock-card-h">
        Lịch tập tuần này<span>Xem lịch đầy đủ →</span>
      </div>
      <div className="lp-mock-week">
        {MOCK_WEEK.map((day, i) => (
          <motion.div
            key={day.day}
            className={`lp-mock-day ${i === todayIndex ? 'today' : ''}`}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 + i * 0.06, ease: EASE }}
          >
            <b>{day.day}</b>
            {day.events.map((ev) => (
              <span key={ev.name} style={{ borderLeftColor: ev.color }}>
                <i>{ev.time}</i>
                {ev.name}
              </span>
            ))}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function MockSlotsCard() {
  const slotClass = (i: number) => (MOCK_BOOKED_SLOTS.includes(i) ? 'bk' : MOCK_CLASS_SLOTS.includes(i) ? 'cl' : '');
  return (
    <div className="lp-mock-card">
      <div className="lp-mock-card-h">
        Đặt sân nhanh<span>Sân cầu lông 1 · hôm nay</span>
      </div>
      <div className="lp-mock-slots">
        {MOCK_HOURS.map((hour, i) => (
          <motion.b
            key={hour}
            className={slotClass(i)}
            initial={{ opacity: 0, scale: 0.6 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 + i * 0.03 }}
          >
            {hour}
          </motion.b>
        ))}
      </div>
      <div className="lp-mock-legend">
        <i className="f" /> Trống <i className="b" /> Đã có người <i className="c" /> Lớp học
      </div>
    </div>
  );
}
