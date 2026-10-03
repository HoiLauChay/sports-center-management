import { newId } from '~/lib/mock/store';
import type { CartLine, CheckoutItemInput } from '../types';
import { selectionKey } from '../utils';

export type DraftBuyer =
  | { kind: 'MEMBER'; accountId: string; fullName: string; phone: string | null }
  | { kind: 'GUEST'; name: string; phone: string };

export interface CartState {
  lines: CartLine[];
  couponCode: string;
  /** Only used by the counter draft (receptionist); members always buy for themselves. */
  buyer: DraftBuyer | null;
}

const EMPTY: CartState = { lines: [], couponCode: '', buyer: null };

type Listener = () => void;

function buyerIdentity(buyer: DraftBuyer | null) {
  if (!buyer) return '';
  return buyer.kind === 'MEMBER' ? `M:${buyer.accountId}` : `G:${buyer.phone}`;
}

/**
 * A draft order kept in the browser (BR_3.18): nothing is reserved or stored on the server until checkout.
 * The member cart lives in `localStorage` (shared by tabs); the counter draft lives in `sessionStorage`,
 * which is private to a tab, so two tabs composing two different orders never mix.
 */
export class CartStore {
  private readonly storage: Storage | null;
  private readonly key: string;
  private readonly listeners = new Set<Listener>();
  private raw: string | null | undefined;
  private snapshot: CartState = EMPTY;

  constructor(storage: Storage | null, key: string) {
    this.storage = storage;
    this.key = key;
  }

  private read(): CartState {
    let raw: string | null;
    try {
      raw = this.storage?.getItem(this.key) ?? null;
    } catch {
      raw = null;
    }
    if (raw === this.raw) return this.snapshot;
    this.raw = raw;
    try {
      const parsed = raw ? (JSON.parse(raw) as Partial<CartState>) : null;
      this.snapshot = parsed
        ? {
            lines: Array.isArray(parsed.lines) ? parsed.lines : [],
            couponCode: typeof parsed.couponCode === 'string' ? parsed.couponCode : '',
            buyer: parsed.buyer ?? null,
          }
        : EMPTY;
    } catch {
      this.snapshot = EMPTY;
    }
    return this.snapshot;
  }

  private write(next: CartState) {
    const raw = JSON.stringify(next);
    try {
      this.storage?.setItem(this.key, raw);
    } catch {
      /* storage full or blocked: the in-memory snapshot below still drives this tab */
    }
    this.raw = raw;
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }

  getSnapshot = () => this.read();

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea === this.storage && (event.key === this.key || event.key === null)) listener();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      this.listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  };

  /** Adds a service; returns `false` when the very same selection is already in the draft. */
  add = (selection: CheckoutItemInput): boolean => {
    const state = this.read();
    const key = selectionKey(selection);
    if (state.lines.some((line) => selectionKey(line.selection) === key)) return false;
    this.write({ ...state, lines: [...state.lines, { key: newId(), selection }] });
    return true;
  };

  remove = (lineKey: string) => {
    const state = this.read();
    this.write({ ...state, lines: state.lines.filter((line) => line.key !== lineKey) });
  };

  clear = () => {
    const state = this.read();
    this.write({ ...EMPTY, buyer: state.buyer });
  };

  setCoupon = (couponCode: string) => {
    this.write({ ...this.read(), couponCode: couponCode.trim().toUpperCase() });
  };

  /** Changing the buyer resets the draft: services and coupons are validated per buyer. */
  setBuyer = (buyer: DraftBuyer | null) => {
    const state = this.read();
    if (buyerIdentity(state.buyer) === buyerIdentity(buyer)) {
      this.write({ ...state, buyer });
      return;
    }
    this.write({ lines: [], couponCode: '', buyer });
  };

  reset = () => this.write(EMPTY);
}

const stores = new Map<string, CartStore>();

function safeStorage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** The member's cart, one per account so a shared computer never leaks a cart between users. */
export function memberCartStore(accountId: string) {
  const key = `sc_cart_v1:${accountId}`;
  let store = stores.get(key);
  if (!store) {
    store = new CartStore(safeStorage('local'), key);
    stores.set(key, store);
  }
  return store;
}

/** The receptionist's counter draft: private to the browser tab. */
export function counterDraftStore(staffId: string) {
  const key = `sc_counter_draft_v1:${staffId}`;
  let store = stores.get(key);
  if (!store) {
    store = new CartStore(safeStorage('session'), key);
    stores.set(key, store);
  }
  return store;
}
