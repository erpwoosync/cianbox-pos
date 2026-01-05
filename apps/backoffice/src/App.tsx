import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';

// Lazy load de todas las páginas para reducir bundle inicial
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Categories = lazy(() => import('./pages/Categories'));
const Brands = lazy(() => import('./pages/Brands'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Prices = lazy(() => import('./pages/Prices'));
const Stock = lazy(() => import('./pages/Stock'));
const Branches = lazy(() => import('./pages/Branches'));
const PriceLists = lazy(() => import('./pages/PriceLists'));
const PointsOfSale = lazy(() => import('./pages/PointsOfSale'));
const Promotions = lazy(() => import('./pages/Promotions'));
const Roles = lazy(() => import('./pages/Roles'));
const Users = lazy(() => import('./pages/Users'));
const Sales = lazy(() => import('./pages/Sales'));
const SaleDetail = lazy(() => import('./pages/SaleDetail'));
const CashSessions = lazy(() => import('./pages/CashSessions'));
const CashSessionDetail = lazy(() => import('./pages/CashSessionDetail'));
const Integrations = lazy(() => import('./pages/Integrations'));
const OrphanPayments = lazy(() => import('./pages/OrphanPayments'));
const CreateSaleFromOrphan = lazy(() => import('./pages/CreateSaleFromOrphan'));
const LinkSaleToOrphan = lazy(() => import('./pages/LinkSaleToOrphan'));
const Terminals = lazy(() => import('./pages/Terminals'));
const Customers = lazy(() => import('./pages/Customers'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));
const AfipConfig = lazy(() => import('./pages/AfipConfig'));
const Treasury = lazy(() => import('./pages/Treasury'));
const GiftCards = lazy(() => import('./pages/GiftCards'));
const StoreCredits = lazy(() => import('./pages/StoreCredits'));

// Loading spinner para Suspense
function PageLoader() {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    </div>
  );
}

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
              <Suspense fallback={<PageLoader />}>
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
                  <Route path="/treasury" element={<Treasury />} />
                  <Route path="/gift-cards" element={<GiftCards />} />
                  <Route path="/store-credits" element={<StoreCredits />} />
                </Routes>
              </Suspense>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}
