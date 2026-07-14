import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Register session lifecycle: open/close state, opening float, cash in/out
// movements, and the closure history. Drives Open/Close, Cash management,
// Register status and the Reporting register-closures / cash-movement reports.
export type CashMovementType = 'ADD' | 'REMOVE';

export interface CashMovement {
  id: string;
  type: CashMovementType;
  amountMinor: number;
  note: string;
  by: string;
  at: number;
}

export interface RegisterClosure {
  id: string;
  number: number;
  openedAt: number;
  closedAt: number;
  openingFloatMinor: number;
  countedMinor: number;
  expectedMinor: number;
  varianceMinor: number;
  nextFloatMinor: number;
  note: string;
  by: string;
  movements: CashMovement[];
}

interface RegisterSessionState {
  status: 'open' | 'closed';
  openedAt: number | null;
  openingFloatMinor: number;
  closureSeq: number;
  movements: CashMovement[];
  closures: RegisterClosure[];

  openRegister: (floatMinor: number) => void;
  addMovement: (m: Omit<CashMovement, 'id' | 'at'>) => void;
  closeRegister: (data: {
    countedMinor: number;
    expectedMinor: number;
    nextFloatMinor: number;
    note: string;
    by: string;
  }) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

export const useRegisterSession = create<RegisterSessionState>()(
  persist(
    (set) => ({
      // Registers start open so a fresh account can sell immediately.
      status: 'open',
      openedAt: null,
      openingFloatMinor: 0,
      closureSeq: 1,
      movements: [],
      closures: [],

      openRegister: (floatMinor) =>
        set({
          status: 'open',
          openedAt: Date.now(),
          openingFloatMinor: floatMinor,
          movements: [],
        }),

      addMovement: (m) =>
        set((s) => ({ movements: [{ ...m, id: uid(), at: Date.now() }, ...s.movements] })),

      closeRegister: (data) =>
        set((s) => ({
          status: 'closed',
          closureSeq: s.closureSeq + 1,
          closures: [
            {
              id: uid(),
              number: s.closureSeq,
              openedAt: s.openedAt ?? Date.now(),
              closedAt: Date.now(),
              openingFloatMinor: s.openingFloatMinor,
              countedMinor: data.countedMinor,
              expectedMinor: data.expectedMinor,
              varianceMinor: data.countedMinor - data.expectedMinor,
              nextFloatMinor: data.nextFloatMinor,
              note: data.note,
              by: data.by,
              movements: s.movements,
            },
            ...s.closures,
          ],
          movements: [],
          openedAt: null,
          openingFloatMinor: data.nextFloatMinor,
        })),
    }),
    { name: 'nova-register-session-v1' },
  ),
);
