import type { FeatureKey } from '../../../data/content';
import { AiVisual } from './AiVisual';
import { ClassVisual } from './ClassVisual';
import { CourtVisual } from './CourtVisual';
import { InvoiceVisual } from './InvoiceVisual';
import { ProgressVisual } from './ProgressVisual';

const VISUALS: Record<FeatureKey, () => React.JSX.Element> = {
  court: CourtVisual,
  class: ClassVisual,
  progress: ProgressVisual,
  ai: AiVisual,
  invoice: InvoiceVisual,
};

export function FeatureVisual({ feature }: { feature: FeatureKey }) {
  const Visual = VISUALS[feature];
  return <Visual />;
}
