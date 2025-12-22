import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './context/authStore';

// Layout
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import ProductLookup from './pages/ProductLookup';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Users from './pages/Users';
import Sales from './pages/Sales';
import Sync from './pages/Sync';
import Settings from './pages/Settings';

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
  );
}
