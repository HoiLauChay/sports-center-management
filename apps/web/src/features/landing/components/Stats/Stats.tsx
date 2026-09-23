import { STATS } from '../../data/content';
import { Counter, Stagger, StaggerItem } from '../shared';
import './stats.css';

export function Stats() {
  return (
    <section className="lp-stats">
      <div className="lp-container">
        <Stagger className="lp-stats-grid">
          {STATS.map((stat) => (
            <StaggerItem key={stat.label} className="lp-stat">
              <div className="lp-stat-v">
                <Counter to={stat.value} />
              </div>
              <div className="lp-stat-l">{stat.label}</div>
              <div className="lp-stat-h">{stat.hint}</div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
