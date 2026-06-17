import { useAuthStore } from '../store/auth.store';

const BASE_URL = 'https://queyoumajiang-backend.onrender.com';

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  traceId: string;
  ts: number;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const { token } = useAuthStore.getState();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Protocol-Version': '1',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }

  const data = (await res.json()) as ApiResponse<T>;

  if (data.code !== 0) {
    throw new Error(data.message || '请求失败');
  }

  return data.data;
}

// ==================== Auth ====================
export const authApi = {
  login: (guestId: string, nickname: string) =>
    request<{
      token: string;
      refreshToken: string;
      expiresIn: number;
      user: {
        id: string;
        nickname: string;
        avatarUrl: string;
        rankLevel: number;
        rankScore: number;
        totalMatches: number;
        totalWins: number;
      };
      isNewUser: boolean;
    }>('POST', '/api/auth/login', { guestId, nickname }),

  refresh: (refreshToken: string) =>
    request<{ token: string; expiresIn: number }>(
      'POST',
      '/api/auth/refresh',
      { refreshToken },
    ),

  logout: () => request<null>('POST', '/api/auth/logout'),
};

// ==================== User ====================
export const userApi = {
  getMe: () =>
    request<{
      id: string;
      nickname: string;
      avatarUrl: string;
      gender: number;
      rankLevel: number;
      rankScore: number;
      rankName: string;
      totalMatches: number;
      totalWins: number;
      createdAt: number;
    }>('GET', '/api/user/me'),

  updateMe: (data: { nickname?: string; avatarUrl?: string }) =>
    request('PATCH', '/api/user/me', data),

  getFriends: () =>
    request<{
      total: number;
      online: number;
      list: {
        userId: string;
        nickname: string;
        avatarUrl: string;
        rankLevel: number;
        isOnline: boolean;
      }[];
    }>('GET', '/api/user/me/friends'),

  addFriend: (friendId: string) =>
    request<{ ok: boolean }>(
      'POST',
      `/api/user/me/friends/${friendId}`,
    ),
};

// ==================== Room ====================
export const roomApi = {
  create: (data: {
    rule: string;
    totalRounds: number;
    baseScore: number;
    requestId: string;
  }) =>
    request<{ roomCode: string; roomId: string; hostId: string }>(
      'POST',
      '/api/room/create',
      data,
    ),

  getInfo: (roomCode: string) =>
    request<{
      roomCode: string;
      status: string;
      rule: string;
      totalRounds: number;
      baseScore: number;
      hostId: string;
      seats: {
        seat: number;
        userId: string | null;
        nickname: string | null;
        avatarUrl: string | null;
      }[];
    }>('GET', `/api/room/${roomCode}`),
};

// ==================== Stats ====================
export const statsApi = {
  getMyStats: () =>
    request<{
      rank: {
        level: number;
        name: string;
        score: number;
        nextLevelScore: number;
      };
      totalMatches: number;
      totalWins: number;
      winRate: number;
      maxSingleScore: number;
      longestWinStreak: number;
      thisWeek: {
        matches: number;
        wins: number;
        winRate: number;
        scoreSum: number;
      };
    }>('GET', '/api/stats/me'),

  getRecent: (limit: number = 20, before?: number) =>
    request<{
      list: unknown[];
      hasMore: boolean;
      nextCursor: number | null;
    }>(
      'GET',
      `/api/stats/me/recent?limit=${limit}${before ? `&before=${before}` : ''}`,
    ),
};
