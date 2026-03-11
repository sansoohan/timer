export type TimerSession = {
  startAt: number;
  endAt?: number;
};

export type TimerItem = {
  id: string;
  name: string;
  accumulatedMs: number;
  currentStartAt: number | null;
  recentStartAt?: number | null;
  sessions?: Record<string, TimerSession>;
};
