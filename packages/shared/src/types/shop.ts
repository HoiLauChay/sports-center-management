import type { FulfillmentStatus, StockReason } from '../constants/enums';
import type { Ref } from './api';
import type { Person } from './audit';

export interface ProductCategory {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: Ref;
  sport: Ref | null;
  price: number;
  /** Units still for sale. */
  stock: number;
  /** Paid online units waiting at the counter: on the shelf, but no longer for sale. */
  reserved: number;
  lowStockThreshold: number;
  lowStock: boolean;
  isActive: boolean;
}

export interface StockMovement {
  id: string;
  reason: StockReason;
  delta: number;
  stockAfter: number;
  note: string | null;
  orderNumber: string | null;
  createdBy: Person | null;
  createdAt: string;
}

export interface ProductSaleInfo {
  id: string;
  status: FulfillmentStatus;
  quantity: number;
  pickupDeadline: string | null;
  pickedUpAt: string | null;
  cancelledAt: string | null;
}

export interface ProductSale extends ProductSaleInfo {
  orderId: string;
  orderNumber: string;
  orderItemId: string;
  product: { id: string; sku: string; name: string; imageUrl: string | null };
  unitPrice: number;
  totalAmount: number;
  buyer: { id: string | null; fullName: string; phone: string | null };
  pickedUpBy: Person | null;
  createdAt: string;
}

export interface ShopReport {
  revenue: number;
  units: number;
  orders: number;
  topProducts: { product: { id: string; sku: string; name: string }; units: number; revenue: number }[];
  byCategory: { category: Ref; units: number; revenue: number }[];
  lowStock: { id: string; sku: string; name: string; stock: number; lowStockThreshold: number }[];
  pendingPickups: number;
}
