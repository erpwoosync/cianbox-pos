import { create } from 'zustand';
import { authApi } from '../services/api';

interface AgencyUser {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: AgencyUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.login(email, password);
      const { token, user } = response;

      localStorage.setItem('agency_token', token);
      localStorage.setItem('agency_user', JSON.stringify(user));

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al iniciar sesión';
      set({
        error: message,
        isLoading: false,
      });
      throw error;
    }
  },

  logout: () => {
    authApi.logout();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  checkAuth: () => {
    const token = localStorage.getItem('agency_token');
    const userStr = localStorage.getItem('agency_user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({
          user,
          token,
          isAuthenticated: true,
        });
      } catch {
        localStorage.removeItem('agency_token');
        localStorage.removeItem('agency_user');
      }
    }
  },
}));
