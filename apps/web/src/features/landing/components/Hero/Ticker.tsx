import { SPORTS } from '../../data/sports';
import { Marquee } from '../shared';

export function Ticker() {
  return (
    <div className="lp-ticker">
      <Marquee speed={40}>
        {SPORTS.map((sport) => (
          <span key={sport.id} className="lp-marquee-item">
            {sport.name}
            <i />
          </span>
        ))}
      </Marquee>
    </div>
  );
}
