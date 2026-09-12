import { Reveal } from './Reveal';
import { SplitWords } from './SplitWords';

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  emphasis?: string;
  sub?: string;
  light?: boolean;
}

export function SectionHeading({ eyebrow, title, emphasis, sub, light = false }: SectionHeadingProps) {
  const lightClass = light ? 'light' : '';
  return (
    <>
      <Reveal>
        <span className={`lp-eyebrow ${lightClass}`}>{eyebrow}</span>
      </Reveal>
      <SplitWords as="h2" onView className={`lp-h2 ${lightClass}`} text={title} emphasis={emphasis} />
      {sub && (
        <Reveal delay={0.1}>
          <p className="lp-sub">{sub}</p>
        </Reveal>
      )}
    </>
  );
}
