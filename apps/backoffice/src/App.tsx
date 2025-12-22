import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Categories from './pages/Categories';
import Brands from './pages/Brands';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Prices from './pages/Prices';
import Stock from './pages/Stock';
import Branches from './pages/Branches';
import PriceLists from './pages/PriceLists';
import PointsOfSale from './pages/PointsOfSale';
import Promotions from './pages/Promotions';
import Roles from './pages/Roles';
import Users from './pages/Users';
import Sales from './pages/Sales';
import SaleDetail from './pages/SaleDetail';
import CashSessions from './pages/CashSessions';
import CashSessionDetail from './pages/CashSessionDetail';
import Integrations from './pages/Integrations';
import OrphanPayments from './pages/OrphanPayments';
import CreateSaleFromOrphan from './pages/CreateSaleFromOrphan';
import LinkSaleToOrphan from './pages/LinkSaleToOrphan';
import Terminals from './pages/Terminals';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import AfipConfig from './pages/AfipConfig';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/branches" element={<Branches />} />
                <Route path="/price-lists" element={<PriceLists />} />
                <Route path="/points-of-sale" element={<PointsOfSale />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/brands" element={<Brands />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/:id" element={<ProductDetail />} />
                <Route path="/prices" element={<Prices />} />
                <Route path="/stock" element={<Stock />} />
                <Route path="/promotions" element={<Promotions />} />
                <Route path="/roles" element={<Roles />} />
                <Route path="/users" element={<Users />} />
                <Route path="/sales" element={<Sales />} />
                <Route path="/sales/:id" element={<SaleDetail />} />
                <Route path="/cash-sessions" element={<CashSessions />} />
                <Route path="/cash-sessions/:id" element={<CashSessionDetail />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/orphan-payments" element={<OrphanPayments />} />
                <Route path="/orphan-payments/:orderId/create-sale" element={<CreateSaleFromOrphan />} />
                <Route path="/orphan-payments/:orderId/link-sale" element={<LinkSaleToOrphan />} />
                <Route path="/terminals" element={<Terminals />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/:id" element={<CustomerDetail />} />
                <Route path="/afip" element={<AfipConfig />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}
