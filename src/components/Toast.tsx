import { useCallback, useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { ToastContext, type ToastApi } from './toast-context';

interface ToastItem {
  id: number;
  message: string;
  tone: 'info' | 'error';
  onUndo?: () => void;
}

/** Undo toasts replace confirm dialogs: act immediately, offer a way back. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((i) => i.id !== id));
  }, []);

  const show = useCallback<ToastApi['show']>(
    (message, opts = {}) => {
      const id = nextId.current++;
      const item: ToastItem = { id, message, tone: opts.tone ?? 'info' };
      if (opts.onUndo) item.onUndo = opts.onUndo;
      setItems((list) => [...list.slice(-2), item]);
      setTimeout(() => dismiss(id), opts.onUndo ? 6000 : 3500);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast glass toast--${item.tone}`} role="status">
            <span>{item.message}</span>
            {item.onUndo ? (
              <button
                type="button"
                className="toast__undo mono"
                onClick={() => {
                  item.onUndo?.();
                  dismiss(item.id);
                }}
              >
                {t('common.undo')}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
