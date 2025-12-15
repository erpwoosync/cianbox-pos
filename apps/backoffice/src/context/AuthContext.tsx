import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../services/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  tenantName: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('backoffice_token');
    const savedUser = localStorage.getItem('backoffice_user');
    const savedTenant = localStorage.getItem('backoffice_tenant');

    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        if (savedTenant) {
          setTenant(JSON.parse(savedTenant));
        }
      } catch {
        localStorage.removeItem('backoffice_token');
        localStorage.removeItem('backoffice_user');
        localStorage.removeItem('backoffice_tenant');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string, tenantSlug: string) => {
    const data = await authApi.login(email, password, tenantSlug);
    localStorage.setItem('backoffice_token', data.token);
    localStorage.setItem('backoffice_user', JSON.stringify(data.user));
    localStorage.setItem('backoffice_tenant', JSON.stringify(data.tenant));
    setUser(data.user);
    setTenant(data.tenant);
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
    setTenant(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
