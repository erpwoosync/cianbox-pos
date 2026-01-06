import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: {
    id: string;
    name: string;
    permissions: string[];
  };
  branch?: {
    id: string;
    code: string;
    name: string;
  };
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  surchargeDisplayMode?: 'SEPARATE_ITEM' | 'DISTRIBUTED';
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  tenant: Tenant | null;
  sessionId: string | null;
  isAuthenticated: boolean;

  // Acciones
  login: (data: {
    token: string;
    refreshToken: string;
    user: User;
    tenant: Tenant;
    sessionId: string;
  }) => void;
  logout: () => void;
  updateToken: (token: string) => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,
      tenant: null,
      sessionId: null,
      isAuthenticated: false,

      login: (data) => {
        set({
          token: data.token,
          refreshToken: data.refreshToken,
          user: data.user,
          tenant: data.tenant,
          sessionId: data.sessionId,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({
          token: null,
          refreshToken: null,
          user: null,
          tenant: null,
          sessionId: null,
          isAuthenticated: false,
        });
      },

      updateToken: (token) => {
        set({ token });
      },

      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        const permissions = user.role.permissions;
        return permissions.includes(permission) || permissions.includes('*');
      },
    }),
    {
      name: 'cianbox-pos-auth',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        tenant: state.tenant,
        sessionId: state.sessionId,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
