import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { project, rubberband, spring, SPRING_SHEET, VelocityTracker } from '../lib/motion';

/**
 * Bottom sheet: rises from the bottom edge and leaves the same way. The grabber tracks the
 * finger 1:1, rubber-bands upward, and a flick projects past the dismiss line with the
 * finger's velocity handed to the spring.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const y = useRef(0);
  const anim = useRef<ReturnType<typeof spring> | null>(null);
  const drag = useRef<{ start: number; from: number; tracker: VelocityTracker } | null>(null);

  const apply = (value: number) => {
    y.current = value;
    const el = panel.current;
    if (el) el.style.transform = `translate3d(0, ${value}px, 0)`;
  };

  const animateTo = useCallback((target: number, velocity = 0, onRest?: () => void) => {
    anim.current?.stop();
    anim.current = spring(y.current, target, apply, { ...SPRING_SHEET, velocity }, onRest);
  }, []);

  useEffect(() => {
    if (!open) return;
    const el = panel.current;
    if (!el) return;
    apply(el.offsetHeight);
    animateTo(0);
    const focusable = el.querySelector<HTMLElement>('input, select, textarea, button');
    focusable?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, animateTo, onClose]);

  const close = (velocity = 0) => {
    const h = panel.current?.offsetHeight ?? 400;
    animateTo(h, velocity, onClose);
  };

  if (!open) return null;

  return (
    <div className="sheet-layer">
      <div className="sheet-scrim" onClick={() => close()} aria-hidden="true" />
      <div
        ref={panel}
        className="sheet glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div
          className="sheet__grabber"
          onPointerDown={(e) => {
            anim.current?.stop(); // grab mid-flight; continue from the live value
            e.currentTarget.setPointerCapture(e.pointerId);
            const tracker = new VelocityTracker();
            tracker.add(e.clientY);
            drag.current = { start: e.clientY, from: y.current, tracker };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            d.tracker.add(e.clientY);
            const raw = d.from + (e.clientY - d.start);
            apply(raw < 0 ? rubberband(raw, panel.current?.offsetHeight ?? 400) : raw);
          }}
          onPointerUp={() => {
            const d = drag.current;
            drag.current = null;
            if (!d) return;
            const v = d.tracker.velocity();
            const h = panel.current?.offsetHeight ?? 400;
            if (y.current + project(v) > h / 2) close(v);
            else animateTo(0, v);
          }}
          onPointerCancel={() => {
            drag.current = null;
            animateTo(0);
          }}
        >
          <span aria-hidden="true" />
        </div>
        <header className="sheet__header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={() => close()}>
            <X size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </header>
        <div className="sheet__body">{children}</div>
      </div>
    </div>
  );
}
