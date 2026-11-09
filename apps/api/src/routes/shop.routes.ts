import {
  adjustStockBodySchema,
  cancelProductSaleBodySchema,
  createProductBodySchema,
  createProductCategoryBodySchema,
  listProductSalesQuerySchema,
  listProductsQuerySchema,
  pageQuerySchema,
  shopIdParamsSchema,
  shopReportQuerySchema,
  updateProductBodySchema,
  updateProductCategoryBodySchema,
} from '@sports-center/shared';
import { Router } from 'express';

import shopController from '~/controllers/shop.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const params = shopIdParamsSchema;
const manager = isRole('MANAGER');
const staff = isRole('MANAGER', 'RECEPTIONIST');

const shopRouter = Router();
shopRouter.use(auth);

// Catalog: every signed-in role can browse; only managers change it.
shopRouter.get('/categories', shopController.listCategories);
shopRouter.post(
  '/categories',
  manager,
  validate({ body: createProductCategoryBodySchema }),
  shopController.createCategory,
);
shopRouter.patch(
  '/categories/:id',
  manager,
  validate({ params, body: updateProductCategoryBodySchema }),
  shopController.updateCategory,
);
shopRouter.delete('/categories/:id', manager, validate({ params }), shopController.removeCategory);

shopRouter.get('/products', validate({ query: listProductsQuerySchema }), shopController.listProducts);
shopRouter.get('/products/:id', validate({ params }), shopController.getProduct);
shopRouter.post('/products', manager, validate({ body: createProductBodySchema }), shopController.createProduct);
shopRouter.patch(
  '/products/:id',
  manager,
  validate({ params, body: updateProductBodySchema }),
  shopController.updateProduct,
);
shopRouter.delete('/products/:id', manager, validate({ params }), shopController.removeProduct);
shopRouter.post(
  '/products/:id/stock',
  manager,
  validate({ params, body: adjustStockBodySchema }),
  shopController.adjustStock,
);
shopRouter.get(
  '/products/:id/movements',
  manager,
  validate({ params, query: pageQuerySchema }),
  shopController.listMovements,
);

// Hand-over of paid goods at the counter.
shopRouter.get('/sales', staff, validate({ query: listProductSalesQuerySchema }), shopController.listSales);
shopRouter.get('/sales/:id', isRole('MANAGER', 'RECEPTIONIST', 'MEMBER'), validate({ params }), shopController.getSale);
shopRouter.post('/sales/:id/pickup', staff, validate({ params }), shopController.pickup);
shopRouter.post(
  '/sales/:id/cancel',
  isRole('MANAGER', 'RECEPTIONIST', 'MEMBER'),
  validate({ params, body: cancelProductSaleBodySchema }),
  shopController.cancel,
);

shopRouter.get('/report', manager, validate({ query: shopReportQuerySchema }), shopController.report);

export default shopRouter;
