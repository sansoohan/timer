// utils/rotation.ts

import { getISOWeek } from 'date-fns';
import type { TimerItem } from '~/types/timer';

export type RotationMessage = {
  label:
    | '오늘'
    | '내일'
    | '이번주'
    | '다음주'
    | '이번달'
    | '다음달';
  text: string;
};

export type RotationTrigger = 'start' | 'stop';

export function getSessionCount(timer: TimerItem): number {
  return timer.counter ?? 0;
}

function addMessage(
  result: RotationMessage[],
  label: RotationMessage['label'],
  text?: string,
) {
  const value = text?.trim();

  if (value) {
    result.push({
      label,
      text: value,
    });
  }
}

export function getRotationMessages(
  timer: TimerItem,
  at: number,
  sessionCount: number,
  trigger: RotationTrigger,
): RotationMessage[] {
  const date = new Date(at);

  let isOddDay = sessionCount % 2 === 1;
  let isOddWeek = getISOWeek(date) % 2 === 1;
  let isOddMonth = (date.getMonth() + 1) % 2 === 1;

  let dayLabel: RotationMessage['label'] =
    trigger === 'stop' ? '내일' : '오늘';

  let weekLabel: RotationMessage['label'] =
    trigger === 'stop' ? '다음주' : '이번주';

  let monthLabel: RotationMessage['label'] =
    trigger === 'stop' ? '다음달' : '이번달';

  // 종료 클릭에서만 다음 로테이션 문구를 보여준다.
  // DB 값은 변경하지 않고 표시용 홀짝만 반전한다.
  if (trigger === 'stop') {
    isOddWeek = !isOddWeek;
    isOddMonth = !isOddMonth;
  }

  // 옵션이 켜져 있으면 레이블과 실제 값 선택을 전부 정반대로 뒤집는다.
  if (timer.reverseRotation === true) {
    isOddDay = !isOddDay;
    isOddWeek = !isOddWeek;
    isOddMonth = !isOddMonth;

    dayLabel = trigger === 'stop' ? '오늘' : '내일';
    weekLabel = trigger === 'stop' ? '이번주' : '다음주';
    monthLabel = trigger === 'stop' ? '이번달' : '다음달';
  }

  const result: RotationMessage[] = [];

  addMessage(
    result,
    dayLabel,
    isOddDay ? timer.oddDayText : timer.evenDayText,
  );

  addMessage(
    result,
    weekLabel,
    isOddWeek ? timer.oddWeekText : timer.evenWeekText,
  );

  addMessage(
    result,
    monthLabel,
    isOddMonth ? timer.oddMonthText : timer.evenMonthText,
  );

  return result;
}
