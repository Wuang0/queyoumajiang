import { create } from 'zustand';

export interface RoomSeat {
  seat: number;
  userId: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  isReady?: boolean;
  isOnline?: boolean;
}

export interface RoomInfo {
  roomCode: string;
  status: string;
  rule: string;
  totalRounds: number;
  baseScore: number;
  hostId: string;
  seats: RoomSeat[];
}

interface RoomState {
  currentRoom: RoomInfo | null;
  mySeat: number;
  isHost: boolean;
  readyPlayerIds: string[];
  isAllReady: boolean;

  setRoom: (room: RoomInfo) => void;
  setMySeat: (seat: number) => void;
  clearRoom: () => void;
  updateSeat: (seat: number, info: Partial<RoomSeat>) => void;
  setPlayerReady: (userId: string, ready: boolean) => void;
  checkAllReady: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  currentRoom: null,
  mySeat: -1,
  isHost: false,
  readyPlayerIds: [],
  isAllReady: false,

  setRoom: (room) => {
    set({
      currentRoom: room,
      // 从 room 信息判断是否房主（需要传入 userId）
      isHost: false, // 由外部 setHost 设置
    });
  },

  setMySeat: (seat) => set({ mySeat: seat }),

  clearRoom: () =>
    set({
      currentRoom: null,
      mySeat: -1,
      isHost: false,
      readyPlayerIds: [],
      isAllReady: false,
    }),

  updateSeat: (seat, info) => {
    const room = get().currentRoom;
    if (!room) return;
    const seats = room.seats.map((s) =>
      s.seat === seat ? { ...s, ...info } : s,
    );
    set({ currentRoom: { ...room, seats } });
  },

  setPlayerReady: (userId, ready) => {
    const { readyPlayerIds } = get();
    if (ready) {
      if (!readyPlayerIds.includes(userId)) {
        set({ readyPlayerIds: [...readyPlayerIds, userId] });
      }
    } else {
      set({
        readyPlayerIds: readyPlayerIds.filter((id) => id !== userId),
      });
    }
    get().checkAllReady();
  },

  checkAllReady: () => {
    const { currentRoom, readyPlayerIds } = get();
    if (!currentRoom) {
      set({ isAllReady: false });
      return;
    }
    const filledSeats = currentRoom.seats.filter((s) => s.userId);
    const allFilled = filledSeats.length >= 4;
    const allReady = filledSeats.every((s) =>
      readyPlayerIds.includes(s.userId!),
    );
    set({ isAllReady: allFilled && allReady });
  },
}));
