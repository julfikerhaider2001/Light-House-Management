import { useRef, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { project, rubberband, spring, VelocityTracker } from '../lib/motion';

/**
 * Swipe left to delete. Direction is decided after ~10 px (so vertical scroll still wins),
 * then the row tracks the finger 1:1; a flick or a long pull commits, anything else springs
 * back. Deleting is undoable via toast, so there is no confirm dialog.
 */
export function SwipeRow({
  children,
  onDelete,
  disabled = false,
  deleteLabel,
}: {
  children: ReactNode;
  onDelete: () => void;
  disabled?: boolean;
  deleteLabel: string;
}) {
  const row = useRef<HTMLDivElement>(null);
  const x = useRef(0);
  const anim = useRef<ReturnType<typeof spring> | null>(null);
  const g = useRef<{
    sx: number;
    sy: number;
    from: number;
    axis: 'x' | 'y' | null;
    tracker: VelocityTracker;
  } | null>(null);

  const apply = (v: number) => {
    x.current = v;
    if (row.current) row.current.style.transform = `translate3d(${v}px, 0, 0)`;
  };
  const width = () => row.current?.offsetWidth ?? 320;
  const to = (target: number, velocity = 0, onRest?: () => void) => {
    anim.current?.stop();
    anim.current = spring(
      x.current,
      target,
      apply,
      { damping: 1, response: 0.35, velocity },
      onRest,
    );
  };

  return (
    <div className="swipe">
      <div className="swipe__action" aria-hidden="true">
        <Trash2 size={18} strokeWidth={1.5} />
      </div>
      <div
        ref={row}
        className="swipe__content"
        onPointerDown={(e) => {
          if (disabled || e.pointerType === 'mouse') return;
          anim.current?.stop();
          const tracker = new VelocityTracker();
          tracker.add(e.clientX);
          g.current = { sx: e.clientX, sy: e.clientY, from: x.current, axis: null, tracker };
        }}
        onPointerMove={(e) => {
          const s = g.current;
          if (!s) return;
          const dx = e.clientX - s.sx;
          const dy = e.clientY - s.sy;
          if (s.axis === null) {
            if (Math.hypot(dx, dy) < 10) return;
            s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
            if (s.axis === 'x') e.currentTarget.setPointerCapture(e.pointerId);
          }
          if (s.axis !== 'x') return;
          s.tracker.add(e.clientX);
          const raw = s.from + dx;
          apply(raw > 0 ? rubberband(raw, width()) : raw);
        }}
        onPointerUp={() => {
          const s = g.current;
          g.current = null;
          if (!s || s.axis !== 'x') return;
          const v = s.tracker.velocity();
          if (x.current + project(v, 0.99) < -width() * 0.45) {
            to(-width(), v, onDelete);
          } else {
            to(0, v);
          }
        }}
        onPointerCancel={() => {
          g.current = null;
          to(0);
        }}
      >
        {children}
      </div>
      {!disabled ? (
        <button type="button" className="sr-only-focusable swipe__keyboard" onClick={onDelete}>
          {deleteLabel}
        </button>
      ) : null}
    </div>
  );
}
