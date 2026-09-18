import { Navigate, Route, Routes } from 'react-router-dom';
import { CatalogPage } from './admin/CatalogPage';
import { CategoryEditor } from './admin/CategoryEditor';
import { PriceBookEditor } from './admin/PriceBookEditor';
import { ImportProductsPage } from './admin/ImportProductsPage';
import { UserEditor } from './admin/UserEditor';
import { ServicesPage } from './admin/ServicesPage';
import { ServiceEditor } from './admin/ServiceEditor';
import { WholesalePage } from './admin/WholesalePage';
import { PromotionEditor } from './admin/PromotionEditor';
import { CustomersPage } from './admin/CustomersPage';
import { FinancePage } from './admin/FinancePage';
import { HomePage } from './admin/HomePage';
import { InventoryCountEditor } from './admin/InventoryCountEditor';
import { InventoryCountPage } from './admin/InventoryCountPage';
import { InventoryPage } from './admin/InventoryPage';
import { OnlinePage } from './admin/OnlinePage';
import { ProductEditor } from './admin/ProductEditor';
import { ReportingPage } from './admin/ReportingPage';
import { SetupPage } from './admin/SetupPage';
import { StockTxEditor } from './admin/StockTxEditor';
import { SupplierEditor } from './admin/SupplierEditor';
import { AdminLayout } from './shell/AdminLayout';
import { Login } from './shell/Login';
import { RequireUser } from './shell/RequireUser';
import { SyncToast } from './shell/SyncToast';
import { CashManagement } from './sell/CashManagement';
import { CloseRegister } from './sell/CloseRegister';
import { Quotes } from './sell/Quotes';
import { RegisterScreen } from './sell/RegisterScreen';
import { QuickKeyLayoutEditor } from './sell/QuickKeyLayoutEditor';
import { RegisterSettings } from './sell/RegisterSettings';
import { RegisterStatus } from './sell/RegisterStatus';
import { SalesHistory } from './sell/SalesHistory';
import { SellLayout } from './sell/SellLayout';

export function App() {
  return (
    <>
    <SyncToast />
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />

      <Route element={<RequireUser />}>
      {/* Sell section — dark register experience */}
      <Route element={<SellLayout />}>
        <Route path="/sell" element={<RegisterScreen />} />
        <Route path="/sell/open-close" element={<CloseRegister />} />
        <Route path="/sell/sales-history" element={<SalesHistory />} />
        <Route path="/sell/cash-management" element={<CashManagement />} />
        <Route path="/sell/status" element={<RegisterStatus />} />
        <Route path="/sell/settings" element={<RegisterSettings />} />
        <Route path="/sell/settings/layout/:id" element={<QuickKeyLayoutEditor />} />
        <Route path="/sell/quotes" element={<Quotes />} />
      </Route>

      {/* Back office — light */}
      <Route element={<AdminLayout />}>
        <Route path="/home" element={<HomePage />} />
        <Route path="/online" element={<OnlinePage />} />
        <Route path="/wholesale" element={<WholesalePage />} />
        <Route path="/reporting" element={<ReportingPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/catalog/products/new" element={<ProductEditor />} />
        <Route path="/catalog/products/import" element={<ImportProductsPage />} />
        <Route path="/catalog/products/:id" element={<ProductEditor />} />
        <Route path="/catalog/suppliers/new" element={<SupplierEditor />} />
        <Route path="/catalog/suppliers/:id" element={<SupplierEditor />} />
        <Route path="/catalog/categories/new" element={<CategoryEditor />} />
        <Route path="/catalog/categories/:id" element={<CategoryEditor />} />
        <Route path="/catalog/promotions/new" element={<PromotionEditor />} />
        <Route path="/catalog/promotions/:id" element={<PromotionEditor />} />
        <Route path="/catalog/price-books/new" element={<PriceBookEditor />} />
        <Route path="/catalog/price-books/:id" element={<PriceBookEditor />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/inventory/receive" element={<StockTxEditor />} />
        <Route path="/inventory/orders/new" element={<StockTxEditor />} />
        <Route path="/inventory/transfers/new" element={<StockTxEditor />} />
        <Route path="/inventory/returns/new" element={<StockTxEditor />} />
        <Route path="/inventory/stock/:id" element={<StockTxEditor />} />
        <Route path="/inventory/counts/new" element={<InventoryCountEditor />} />
        <Route path="/inventory/counts/:id" element={<InventoryCountPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/setup/users/new" element={<UserEditor />} />
        <Route path="/setup/users/:id" element={<UserEditor />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/new" element={<ServiceEditor />} />
        <Route path="/services/:id" element={<ServiceEditor />} />
      </Route>
      </Route>

      <Route path="*" element={<Navigate to="/sell" replace />} />
    </Routes>
    </>
  );
}
