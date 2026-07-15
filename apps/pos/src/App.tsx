import { Navigate, Route, Routes } from 'react-router-dom';
import { CatalogPage } from './admin/CatalogPage';
import { CustomersPage } from './admin/CustomersPage';
import { FinancePage } from './admin/FinancePage';
import { HomePage } from './admin/HomePage';
import { InventoryPage } from './admin/InventoryPage';
import { OnlinePage } from './admin/OnlinePage';
import { ReportingPage } from './admin/ReportingPage';
import { SetupPage } from './admin/SetupPage';
import { AdminLayout } from './shell/AdminLayout';
import { Login } from './shell/Login';
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
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />

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
        <Route path="/reporting" element={<ReportingPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/setup" element={<SetupPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/sell" replace />} />
    </Routes>
  );
}
