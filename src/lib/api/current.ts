import { createContext, useContext } from 'react';
import type { Membership } from './mess';

export interface CurrentMess {
  userId: string;
  messId: string;
  memberId: string;
  isManager: boolean;
  memberships: Membership[];
  switchMess: (messId: string) => void;
}

export const CurrentMessContext = createContext<CurrentMess | null>(null);

export function useCurrentMess(): CurrentMess {
  const value = useContext(CurrentMessContext);
  if (!value) throw new Error('useCurrentMess outside a mess');
  return value;
}
