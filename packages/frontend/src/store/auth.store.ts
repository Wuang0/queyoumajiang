import { create } from 'zustand';

export interface UserInfo {
  id: string;
  guestId: string;
  nickname: string;
  avatarUrl: string;
  rankLevel: number;
  rankScore: number;
  totalMatches: number;
  totalWins: number;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: UserInfo | null;
  isLoggedIn: boolean;
  guestId: string | null;
  login: (token: string, refreshToken: string, user: UserInfo) => void;
  logout: () => void;
  updateUser: (u: Partial<UserInfo>) => void;
  restore: () => boolean; // 从 localStorage 恢复登录态
}

function getOrCreateGuestId(): string {
  try {
    let id = localStorage.getItem('queyou_guest_id');
    if (!id) {
      id = `g_${crypto.randomUUID()}`;
      localStorage.setItem('queyou_guest_id', id);
    }
    return id;
  } catch {
    return `g_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  refreshToken: null,
  user: null,
  isLoggedIn: false,
  guestId: getOrCreateGuestId(),

  login: (token, refreshToken, user) => {
    // 持久化到 localStorage
    try {
      localStorage.setItem('queyou_token', token);
      localStorage.setItem('queyou_refresh_token', refreshToken);
      localStorage.setItem('queyou_user', JSON.stringify(user));
    } catch { /* ignore */ }
    set({ token, refreshToken, user, isLoggedIn: true });
  },

  logout: () => {
    try {
      localStorage.removeItem('queyou_token');
      localStorage.removeItem('queyou_refresh_token');
      localStorage.removeItem('queyou_user');
    } catch { /* ignore */ }
    set({ token: null, refreshToken: null, user: null, isLoggedIn: false });
  },

  updateUser: (u) =>
    set((state) => {
      const updated = state.user ? { ...state.user, ...u } : null;
      if (updated) {
        try { localStorage.setItem('queyou_user', JSON.stringify(updated)); } catch { /* ignore */ }
      }
      return { user: updated as UserInfo | null };
    }),

  restore: () => {
    try {
      const token = localStorage.getItem('queyou_token');
      const refreshToken = localStorage.getItem('queyou_refresh_token');
      const userStr = localStorage.getItem('queyou_user');
      if (token && userStr) {
        const user = JSON.parse(userStr) as UserInfo;
        set({ token, refreshToken, user, isLoggedIn: true });
        return true;
      }
    } catch { /* ignore */ }
    return false;
  },
}));
