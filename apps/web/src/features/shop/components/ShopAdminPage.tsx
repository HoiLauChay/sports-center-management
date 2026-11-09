import { Card, Tabs } from 'antd';
import { useState } from 'react';
import { PageHeader } from '~/components/ui/PageHeader';
import { CategoriesPanel } from './CategoriesPanel';
import { ProductsPanel } from './ProductsPanel';
import { ShopReportPanel } from './ShopReportPanel';

type ShopTab = 'products' | 'categories' | 'report';

/** Manager: the shop catalog, its stock and how it sells. */
export function ShopAdminPage() {
  const [tab, setTab] = useState<ShopTab>('products');
  return (
    <>
      <PageHeader title="Cửa hàng" description="Sản phẩm bán tại quầy và online, tồn kho và doanh thu bán hàng." />
      <Card>
        <Tabs
          activeKey={tab}
          onChange={(key) => setTab(key as ShopTab)}
          destroyOnHidden
          items={[
            { key: 'products', label: 'Sản phẩm', children: <ProductsPanel /> },
            { key: 'categories', label: 'Danh mục', children: <CategoriesPanel /> },
            { key: 'report', label: 'Thống kê', children: <ShopReportPanel /> },
          ]}
        />
      </Card>
    </>
  );
}
