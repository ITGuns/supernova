import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbRegisterSession } from '../lib/db';

// Register session lifecycle: open/close state, opening float, cash in/out
// movements, and the closure history.
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

  /** Pull session state from Supabase. */
  syncFromDb: () => Promise<void>;
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
    (set, get) => ({
      // Registers start open so a fresh account can sell immediately.
      status: 'open',
      openedAt: null,
      openingFloatMinor: 0,
      closureSeq: 1,
      movements: [],
      closures: [],

      syncFromDb: async () => {
        const row = await dbRegisterSession.get();
        if (!row) return;
        set({
          status: row.status ?? 'open',
          openedAt: row.opened_at ? new Date(row.opened_at as string).getTime() : null,
          openingFloatMinor: row.opening_float_minor ?? 0,
          closureSeq: row.closure_seq ?? 1,
          movements: (row.movements as CashMovement[]) ?? [],
          closures: (row.closures as RegisterClosure[]) ?? [],
        });
      },

      openRegister: (floatMinor) => {
        const next = {
          status: 'open' as const,
          openedAt: Date.now(),
          openingFloatMinor: floatMinor,
          movements: [] as CashMovement[],
        };
        set(next);
        dbRegisterSession.save({
          status: 'open',
          opened_at: new Date(next.openedAt).toISOString(),
          opening_float_minor: floatMinor,
          movements: [],
        });
      },

      addMovement: (m) => {
        const movement: CashMovement = { ...m, id: uid(), at: Date.now() };
        const movements = [movement, ...get().movements];
        set({ movements });
        dbRegisterSession.save({ movements });
      },

      closeRegister: (data) => {
        const s = get();
        const closure: RegisterClosure = {
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
        };
        const closures = [closure, ...s.closures];
        set({
          status: 'closed',
          closureSeq: s.closureSeq + 1,
          closures,
          movements: [],
          openedAt: null,
          openingFloatMinor: data.nextFloatMinor,
        });
        dbRegisterSession.save({
          status: 'closed',
          closure_seq: s.closureSeq + 1,
          closures,
          movements: [],
          opened_at: null,
          opening_float_minor: data.nextFloatMinor,
        });
      },
    }),
    { name: 'nova-register-session-v1' },
  ),
);
