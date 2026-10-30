import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Fraction } from '../lib/calc/fraction';
import { taka } from '../lib/format';

export type Tone = 'ok' | 'info' | 'warn' | 'due' | 'idle';

/** Glowing-dot status pill: OPEN / CLOSED / PAID / DUE. */
export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`pill pill--${tone}`}>
      <span className="pill__dot" aria-hidden="true" />
      {children}
    </span>
  );
}

/** Small outlined tag: MEAL / BAZAR / BILL. */
export function Tag({ tone = 'idle', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`tag tag--${tone}`}>{children}</span>;
}

/** Money with ৳, tabular numerals and due/credit colouring. */
export function Money({
  value,
  signed = false,
  max = 2,
  className = '',
}: {
  value: number | Fraction;
  signed?: boolean;
  max?: number;
  className?: string;
}) {
  const n = value instanceof Fraction ? value.toNumber() : value;
  const tone = signed ? (n > 0 ? ' money--due' : n < 0 ? ' money--credit' : '') : '';
  return <span className={`money mono${tone} ${className}`}>{taka(n, max)}</span>;
}

export function Button({
  variant = 'ghost',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  return <button type="button" className={`btn btn--${variant} ${className}`} {...props} />;
}

export function Card({
  children,
  className = '',
  as: As = 'section',
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
  'aria-labelledby'?: string;
  'aria-label'?: string;
}) {
  return (
    <As className={`glass card ${className}`} {...rest}>
      {children}
    </As>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="eyebrow mono">{children}</span>;
}

export function PageHeader({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1>{title}</h1>
      </div>
      {aside ? <div className="page-header__aside">{aside}</div> : null}
    </header>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
  id,
}: {
  label: string;
  error?: string | undefined;
  hint?: string;
  children: ReactNode;
  id: string;
}) {
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <span className="field__msg" id={`${id}-msg`} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field__msg field__msg--hint" id={`${id}-msg`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty muted">{children}</p>;
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="spinner" role="status" aria-live="polite">
      <span className="spinner__dot" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
