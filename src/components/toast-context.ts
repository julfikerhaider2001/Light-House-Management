import { createContext, useContext } from 'react';

export interface ToastApi {
  show(message: string, opts?: { tone?: 'info' | 'error'; onUndo?: () => void }): void;
}

export const ToastContext = createContext<ToastApi>({ show: () => undefined });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
