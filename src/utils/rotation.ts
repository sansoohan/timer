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

export type RotationParity = {
  isOddDay: boolean;
  isOddWeek: boolean;
  isOddMonth: boolean;
};

export function getSessionCount(timer: TimerItem): number {
  return timer.counter ?? 0;
}

/**
 * 실제 시점 기준 홀짝 상태.
 *
 * 중요:
 * - reverseRotation은 여기서 적용하지 않는다.
 * - 설정 화면의 "(현재)" 표시는 이 값을 그대로 사용한다.
 */
export function getRotationParity(
  at: number,
  sessionCount: number,
): RotationParity {
  const date = new Date(at);

  return {
    isOddDay: sessionCount % 2 === 1,
    isOddWeek: getISOWeek(date) % 2 === 1,
    isOddMonth: (date.getMonth() + 1) % 2 === 1,
  };
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
  let {
    isOddDay,
    isOddWeek,
    isOddMonth,
  } = getRotationParity(at, sessionCount);

  let dayLabel: RotationMessage['label'] =
    trigger === 'stop' ? '내일' : '오늘';

  let weekLabel: RotationMessage['label'] =
    trigger === 'stop' ? '다음주' : '이번주';

  let monthLabel: RotationMessage['label'] =
    trigger === 'stop' ? '다음달' : '이번달';

  // 종료 클릭에서는 종료시각(at)을 기준으로
  // 다음 주 / 다음 달 문구를 보여주기 위해 홀짝을 반전한다.
  if (trigger === 'stop') {
    isOddWeek = !isOddWeek;
    isOddMonth = !isOddMonth;
  }

  // "반대로 보여주기"는 실제 출력에만 적용한다.
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
