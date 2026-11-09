import { MAX_PRODUCT_QUANTITY } from '@sports-center/shared';
import type { CartLine, CheckoutItemInput } from '../types';
import { selectionKey } from '../utils';

export type DraftBuyer =
  | { kind: 'MEMBER'; accountId: string; fullName: string; phone: string | null }
  | { kind: 'GUEST'; name: string; phone: string };

export interface CartState {
  lines: CartLine[];
  couponCodes: string[];
  /** Only used by the counter draft (receptionist); members always buy for themselves. */
  buyer: DraftBuyer | null;
}

const EMPTY: CartState = { lines: [], couponCodes: [], buyer: null };

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
  /** Set once a write failed (storage full or blocked): this tab then keeps the draft in memory only. */
  private memoryOnly = false;

  constructor(storage: Storage | null, key: string) {
    this.storage = storage;
    this.key = key;
  }

  private read(): CartState {
    if (!this.storage || this.memoryOnly) return this.snapshot;
    let raw: string | null;
    try {
      raw = this.storage.getItem(this.key);
    } catch {
      return this.snapshot;
    }
    if (raw === this.raw) return this.snapshot;
    this.raw = raw;
    try {
      const parsed = raw ? (JSON.parse(raw) as Partial<CartState>) : null;
      this.snapshot = parsed
        ? {
            lines: Array.isArray(parsed.lines) ? parsed.lines : [],
            couponCodes: Array.isArray(parsed.couponCodes) ? parsed.couponCodes : [],
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
      // Storage full or blocked: reading it back would bring the old draft back, so stay in memory.
      this.memoryOnly = true;
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

  /**
   * Adds a service; returns `false` when the very same selection is already in the draft.
   * A product already in the draft gets the new quantity added to its line instead.
   */
  add = (selection: CheckoutItemInput): boolean => {
    const state = this.read();
    const key = selectionKey(selection);
    const existing = state.lines.find((line) => selectionKey(line.selection) === key);
    if (existing?.selection.type === 'PRODUCT_SALE' && selection.type === 'PRODUCT_SALE') {
      this.setQuantity(existing.key, existing.selection.quantity + selection.quantity);
      return true;
    }
    if (existing) return false;
    this.write({ ...state, lines: [...state.lines, { key: crypto.randomUUID(), selection }] });
    return true;
  };

  /** Changes the quantity of a product line, kept within what one order line allows. */
  setQuantity = (lineKey: string, quantity: number) => {
    const state = this.read();
    const next = Math.min(Math.max(Math.trunc(quantity) || 1, 1), MAX_PRODUCT_QUANTITY);
    this.write({
      ...state,
      lines: state.lines.map((line) =>
        line.key === lineKey && line.selection.type === 'PRODUCT_SALE'
          ? { ...line, selection: { ...line.selection, quantity: next } }
          : line,
      ),
    });
  };

  /** Sets how many of a product the draft holds; 0 takes its line out. */
  setProductQuantity = (productId: string, quantity: number) => {
    const line = this.read().lines.find(
      ({ selection }) => selection.type === 'PRODUCT_SALE' && selection.productId === productId,
    );
    if (!line) return;
    if (quantity <= 0) this.remove(line.key);
    else this.setQuantity(line.key, quantity);
  };

  remove = (lineKey: string) => {
    const state = this.read();
    this.write({ ...state, lines: state.lines.filter((line) => line.key !== lineKey) });
  };

  clear = () => {
    const state = this.read();
    this.write({ ...EMPTY, buyer: state.buyer });
  };

  addCoupon = (code: string) => {
    const state = this.read();
    if (!state.couponCodes.includes(code)) this.write({ ...state, couponCodes: [...state.couponCodes, code] });
  };

  removeCoupon = (code: string) => {
    const state = this.read();
    this.write({ ...state, couponCodes: state.couponCodes.filter((entry) => entry !== code) });
  };

  /** Changing the buyer resets the draft: services and coupons are validated per buyer. */
  setBuyer = (buyer: DraftBuyer | null) => {
    const state = this.read();
    if (buyerIdentity(state.buyer) === buyerIdentity(buyer)) {
      this.write({ ...state, buyer });
      return;
    }
    this.write({ lines: [], couponCodes: [], buyer });
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
