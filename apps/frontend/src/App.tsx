import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './context/authStore';

// Layout (no lazy - siempre necesario)
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy load de páginas
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const POS = lazy(() => import('./pages/POS'));
const ProductLookup = lazy(() => import('./pages/ProductLookup'));
const Products = lazy(() => import('./pages/Products'));
const Categories = lazy(() => import('./pages/Categories'));
const Users = lazy(() => import('./pages/Users'));
const Sales = lazy(() => import('./pages/Sales'));
const Sync = lazy(() => import('./pages/Sync'));
const Settings = lazy(() => import('./pages/Settings'));

// Loading spinner para Suspense
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}

// Auth wrapper - only checks if user is logged in
function AuthRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />

        {/* POS - Full screen sin Layout */}
        <Route
          path="/pos"
          element={
            <AuthRoute>
              <ProtectedRoute permissions={['pos:sell']}>
                <POS />
              </ProtectedRoute>
            </AuthRoute>
          }
        />

        {/* Protected routes with Layout */}
        <Route
          element={
            <AuthRoute>
              <Layout />
            </AuthRoute>
          }
        >
          {/* Dashboard - todos pueden acceder */}
          <Route path="/" element={<Dashboard />} />

          {/* Consulta de Productos - permisos de POS o inventario */}
          <Route
            path="/consulta-productos"
            element={
              <ProtectedRoute permissions={['pos:sell', 'inventory:view', 'inventory:edit']}>
                <ProductLookup />
              </ProtectedRoute>
            }
          />

          {/* Productos - requiere permisos de inventario */}
          <Route
            path="/productos"
            element={
              <ProtectedRoute permissions={['admin:products', 'inventory:view', 'inventory:edit']}>
                <Products />
              </ProtectedRoute>
            }
          />

          {/* Categorías - requiere permisos de inventario */}
          <Route
            path="/categorias"
            element={
              <ProtectedRoute permissions={['admin:products', 'inventory:view', 'inventory:edit']}>
                <Categories />
              </ProtectedRoute>
            }
          />

          {/* Usuarios - requiere admin:users */}
          <Route
            path="/usuarios"
            element={
              <ProtectedRoute permissions={['admin:users']}>
                <Users />
              </ProtectedRoute>
            }
          />

          {/* Ventas - requiere permisos de reportes */}
          <Route
            path="/ventas"
            element={
              <ProtectedRoute permissions={['reports:sales', 'pos:view_reports']}>
                <Sales />
              </ProtectedRoute>
            }
          />

          {/* Sincronización - requiere admin:settings */}
          <Route
            path="/sync"
            element={
              <ProtectedRoute permissions={['admin:settings']}>
                <Sync />
              </ProtectedRoute>
            }
          />

          {/* Configuración - requiere admin:settings */}
          <Route
            path="/configuracion"
            element={
              <ProtectedRoute permissions={['admin:settings']}>
                <Settings />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
