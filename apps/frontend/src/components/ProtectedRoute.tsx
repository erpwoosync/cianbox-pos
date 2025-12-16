import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../context/authStore';

interface ProtectedRouteProps {
  children: ReactNode;
  permissions?: string[];
}

// Helper para verificar si el usuario tiene alguno de los permisos requeridos
const hasAnyPermission = (userPermissions: string[], requiredPermissions: string[]): boolean => {
  // Si no hay permisos requeridos, todos tienen acceso
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  // Si el usuario tiene '*', tiene acceso a todo
  if (userPermissions.includes('*')) return true;
  // Verificar si tiene alguno de los permisos requeridos
  return requiredPermissions.some(perm => userPermissions.includes(perm));
};

export default function ProtectedRoute({ children, permissions = [] }: ProtectedRouteProps) {
  const { user } = useAuthStore();

  // Si no hay usuario, no debería estar aquí (ya debería estar en login)
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Verificar permisos
  const userPermissions = user.role?.permissions || [];
  const hasPermission = hasAnyPermission(userPermissions, permissions);

  // Si no tiene permiso, redirigir al dashboard
  if (!hasPermission) {
    return <Navigate to="/" replace />;
  }

  // Si tiene permiso, renderizar el contenido
  return <>{children}</>;
}
