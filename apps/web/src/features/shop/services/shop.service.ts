import type {
  AdjustStockBody,
  ApiResponse,
  CreateProductBody,
  CreateProductCategoryBody,
  ListProductSalesInput,
  ListProductsInput,
  PageQuery,
  Paginated,
  Product,
  ProductCategory,
  ProductSale,
  ShopReport,
  StockMovement,
  UpdateProductBody,
  UpdateProductCategoryBody,
} from '@sports-center/shared';
import { privateApi } from '~/lib/http';

const id = (value: string) => encodeURIComponent(value);

/** Shop catalog, stock and counter hand-over (`/shop`). */
export const shopService = {
  categories: async (includeInactive = false) => {
    const { data } = await privateApi.get<ApiResponse<ProductCategory[]>>('/shop/categories', {
      params: includeInactive ? { includeInactive: true } : undefined,
    });
    return data.result;
  },

  createCategory: async (body: CreateProductCategoryBody) => {
    const { data } = await privateApi.post<ApiResponse<ProductCategory>>('/shop/categories', body);
    return data.result;
  },

  updateCategory: async (categoryId: string, body: UpdateProductCategoryBody) => {
    const { data } = await privateApi.patch<ApiResponse<ProductCategory>>(`/shop/categories/${id(categoryId)}`, body);
    return data.result;
  },

  removeCategory: async (categoryId: string) => {
    await privateApi.delete(`/shop/categories/${id(categoryId)}`);
  },

  products: async (params: ListProductsInput) => {
    const { data } = await privateApi.get<ApiResponse<Paginated<Product>>>('/shop/products', { params });
    return data.result;
  },

  product: async (productId: string) => {
    const { data } = await privateApi.get<ApiResponse<Product>>(`/shop/products/${id(productId)}`);
    return data.result;
  },

  createProduct: async (body: CreateProductBody) => {
    const { data } = await privateApi.post<ApiResponse<Product>>('/shop/products', body);
    return data.result;
  },

  updateProduct: async (productId: string, body: UpdateProductBody) => {
    const { data } = await privateApi.patch<ApiResponse<Product>>(`/shop/products/${id(productId)}`, body);
    return data.result;
  },

  removeProduct: async (productId: string) => {
    await privateApi.delete(`/shop/products/${id(productId)}`);
  },

  adjustStock: async (productId: string, body: AdjustStockBody) => {
    const { data } = await privateApi.post<ApiResponse<StockMovement>>(`/shop/products/${id(productId)}/stock`, body);
    return data.result;
  },

  movements: async (productId: string, params: PageQuery) => {
    const { data } = await privateApi.get<ApiResponse<Paginated<StockMovement>>>(
      `/shop/products/${id(productId)}/movements`,
      { params },
    );
    return data.result;
  },

  sales: async (params: ListProductSalesInput) => {
    const { data } = await privateApi.get<ApiResponse<Paginated<ProductSale>>>('/shop/sales', { params });
    return data.result;
  },

  pickup: async (saleId: string) => {
    const { data } = await privateApi.post<ApiResponse<ProductSale>>(`/shop/sales/${id(saleId)}/pickup`);
    return data.result;
  },

  cancel: async (saleId: string, reason?: string) => {
    const { data } = await privateApi.post<ApiResponse<{ sale: ProductSale; refund: number }>>(
      `/shop/sales/${id(saleId)}/cancel`,
      { reason },
    );
    return data.result;
  },

  report: async (params: { from: string; to: string }) => {
    const { data } = await privateApi.get<ApiResponse<ShopReport>>('/shop/report', { params });
    return data.result;
  },
};
