import { motion } from 'motion/react';
import type { LandingSport } from '../../data/sports';
import { useHoverParallax } from '../../hooks/useHoverParallax';

interface SportCardProps {
  sport: LandingSport;
  index: number;
}

export function SportCard({ sport, index }: SportCardProps) {
  const parallax = useHoverParallax(12);
  const { venue, openClasses, coaches } = sport;
  const isCourt = venue.type === 'COURT';

  const venueLabel = `${venue.count} ${isCourt ? 'sân' : 'phòng'}`;
  const priceLabel = isCourt && venue.minHourlyRate ? ` · từ ${venue.minHourlyRate / 1000}k/giờ` : '';

  return (
    <div className="lp-sport" onMouseMove={parallax.onMouseMove} onMouseLeave={parallax.onMouseLeave}>
      <motion.img
        className="lp-sport-img"
        src={sport.image}
        alt={sport.name}
        loading="lazy"
        style={{ x: parallax.x, y: parallax.y }}
      />
      <div className="lp-sport-shade" />

      <span className="lp-sport-idx">{String(index + 1).padStart(2, '0')}</span>
      <span className="lp-sport-type">{isCourt ? 'Thuê theo giờ' : 'Theo lớp'}</span>

      <div className="lp-sport-body">
        <div className="lp-sport-name">{sport.name}</div>
        <div className="lp-sport-desc">{sport.description}</div>
        <div className="lp-sport-meta">
          <span>
            {venueLabel}
            {priceLabel}
          </span>
          {openClasses > 0 && <span>{openClasses} lớp đang mở</span>}
          {coaches > 0 && <span>{coaches} HLV</span>}
        </div>
      </div>
    </div>
  );
}
