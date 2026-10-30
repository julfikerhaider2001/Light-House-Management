import { Minus, Plus } from 'lucide-react';
import { mealCount } from '../lib/format';

/** −/+ in 0.5 steps. Feedback happens on press (CSS :active); value updates optimistically. */
export function Stepper({
  value,
  onChange,
  size = 'sm',
  disabled = false,
  decLabel,
  incLabel,
  max = 9,
  testId,
}: {
  value: number;
  onChange: (next: number) => void;
  size?: 'sm' | 'lg';
  disabled?: boolean;
  decLabel: string;
  incLabel: string;
  max?: number;
  testId?: string;
}) {
  const icon = size === 'lg' ? 24 : 18;
  return (
    <div className={`stepper stepper--${size}`}>
      <button
        type="button"
        className="stepper__btn glass"
        aria-label={decLabel}
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 0.5))}
      >
        <Minus size={icon} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <span className="stepper__value mono" aria-live="polite" data-testid={testId}>
        {mealCount(value)}
      </span>
      <button
        type="button"
        className="stepper__btn stepper__btn--accent glass"
        aria-label={incLabel}
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 0.5))}
      >
        <Plus size={icon} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );
}
