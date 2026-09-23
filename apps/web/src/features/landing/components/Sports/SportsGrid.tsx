import { SPORTS_SECTION } from '../../data/content';
import { SPORTS } from '../../data/sports';
import { SectionHeading, Stagger, StaggerItem } from '../shared';
import { SportCard } from './SportCard';
import './sports.css';

export function SportsGrid() {
  return (
    <section className="lp-section" id="sports">
      <div className="lp-container">
        <SectionHeading
          eyebrow={SPORTS_SECTION.eyebrow}
          title={SPORTS_SECTION.title}
          emphasis={SPORTS_SECTION.emphasis}
          sub={SPORTS_SECTION.sub}
        />

        <Stagger className="lp-bento" amount={0.1}>
          {SPORTS.map((sport, index) => (
            <StaggerItem key={sport.id} className={`lp-bento-cell ${sport.cardSize ?? ''}`}>
              <SportCard sport={sport} index={index} />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
