// types/timer.ts

export type StoredRotationMessage = {
  label:
    | '오늘'
    | '내일'
    | '이번주'
    | '다음주'
    | '이번달'
    | '다음달';
  text: string;
};

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

  // 기록 타이머 종료 후 카드에 보여줄 마지막 로테이션 문구.
  lastRotationMessages?: StoredRotationMessage[];
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
