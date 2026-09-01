// types/timer.ts

type BaseTimerItem = {
  id: string;
  name: string;
  order?: number;

  recentStartAt: number | null;
  counter: number;

  oddDayText?: string;
  evenDayText?: string;
  oddWeekText?: string;
  evenWeekText?: string;
  oddMonthText?: string;
  evenMonthText?: string;

  reverseRotation?: boolean;

  // 기록 타이머의 마지막 종료시각.
  // 카드의 종료 문구는 이 시각을 기준으로 utils/rotation.ts에서 다시 계산한다.
  lastStoppedAt?: number;
};

export type AccumulatedTimerItem = BaseTimerItem & {
  type: 'accumulated';
  accumulatedMs: number;
  currentStartAt: number | null;
};

export type RecordTimerItem = BaseTimerItem & {
  type: 'record';
  accumulatedMs?: never;
  currentStartAt: number | null;
};

export type ChecklistTimerItem = BaseTimerItem & {
  type: 'checklist';
  accumulatedMs?: never;
  currentStartAt?: never;
};

export type TimerItem =
  | AccumulatedTimerItem
  | RecordTimerItem
  | ChecklistTimerItem;
