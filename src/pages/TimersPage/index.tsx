// pages/TimersPage/index.tsx
import { useEffect, useState } from 'react';
import { increment, onValue, ref, update } from 'firebase/database';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';

import { database } from '~/constants/firebase';
import { useAuth } from '~/contexts/AuthContext';
import { HamburgerDivider } from '~/components/HamburgerDivider';
import { HamburgerMenu } from '~/components/HamburgerMenu';
import { LogoutButton } from '~/components/LogoutButton';
import { DeleteTimerModal } from './components/DeleteTimerModal';
import { RenameTimerModal } from './components/RenameTimerModal';
import { TimerRow } from './components/TimerRow';
import type { TimerItem } from '~/types/timer';
import { RotationNoticeModal } from './components/RotationNoticeModal';
import {
  getRotationMessages,
  getSessionCount,
  type RotationMessage,
} from '~/utils/rotation';

export function TimersPage() {
  const { currentUserUid: uid } = useAuth();

  const [timers, setTimers] = useState<TimerItem[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const [deleteTarget, setDeleteTarget] = useState<TimerItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<TimerItem | null>(null);
  const [rotationMessages, setRotationMessages] = useState<RotationMessage[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (!uid) return;

    const r = ref(database, `users/${uid}/timers`);

    return onValue(r, snap => {
      const val = snap.val() ?? {};

      const list: TimerItem[] = Object.entries(val).map(([id, t]) => {
        const timer = (t ?? {}) as Partial<TimerItem>;

        const type =
          timer.type ??
          (typeof timer.accumulatedMs === 'number'
            ? 'accumulated'
            : 'checklist');

        return {
          id,
          type,
          name: timer.name ?? '',
          order: typeof timer.order === 'number' ? timer.order : undefined,

          ...(type === 'accumulated' &&
          typeof timer.accumulatedMs === 'number'
            ? { accumulatedMs: timer.accumulatedMs }
            : {}),

          ...(type === 'accumulated' || type === 'record'
            ? { currentStartAt: timer.currentStartAt ?? null }
            : {}),

          recentStartAt: timer.recentStartAt ?? null,
          counter: typeof timer.counter === 'number' ? timer.counter : 0,

          oddDayText: timer.oddDayText,
          evenDayText: timer.evenDayText,
          oddWeekText: timer.oddWeekText,
          evenWeekText: timer.evenWeekText,
          oddMonthText: timer.oddMonthText,
          evenMonthText: timer.evenMonthText,

          // Firebase에 저장된 반전 옵션을 TimerItem에도 반드시 넣는다.
          reverseRotation: timer.reverseRotation === true,

          lastRotationMessages: Array.isArray(timer.lastRotationMessages)
            ? timer.lastRotationMessages
            : undefined,
        } as TimerItem;
      });

      // 기존 데이터에 order가 없는 경우에도 순서가 매번 흔들리지 않도록
      // id를 보조 정렬 기준으로 사용한다.
      list.sort((a, b) => {
        const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;

        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.id.localeCompare(b.id);
      });

      setTimers(list);
    });
  }, [uid]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const handleToggleTimer = async (timer: TimerItem) => {
    if (!uid) return;

    const sessionCount = getSessionCount(timer);

    // 체크리스트: 클릭한 현재시각만 기록한다.
    if (timer.type === 'checklist') {
      const startAt = Date.now();

      await update(ref(database), {
        [`users/${uid}/timers/${timer.id}/recentStartAt`]: startAt,
        [`users/${uid}/timers/${timer.id}/counter`]: increment(1),
        [`timerSessions/${timer.id}/sessions/${startAt}/startAt`]: startAt,
      });

      setRotationMessages(
        getRotationMessages(timer, startAt, sessionCount, 'start'),
      );
      return;
    }

    // 기록 타이머: 0초부터 시작하고, 중지하면 다시 0초로 돌아간다.
    if (timer.type === 'record') {
      if (timer.currentStartAt == null) {
        const startedAt = Date.now();

        await update(ref(database), {
          [`users/${uid}/timers/${timer.id}/currentStartAt`]: startedAt,
          [`users/${uid}/timers/${timer.id}/recentStartAt`]: startedAt,
          [`users/${uid}/timers/${timer.id}/lastRotationMessages`]: null,
          [`timerSessions/${timer.id}/sessions/${startedAt}/startAt`]: startedAt,
        });

        setRotationMessages(
          getRotationMessages(timer, startedAt, sessionCount, 'start'),
        );
        return;
      }

      const endedAt = Date.now();
      const startedAt = timer.currentStartAt;
      const stopMessages = getRotationMessages(
        timer,
        endedAt,
        sessionCount,
        'stop',
      );

      await update(ref(database), {
        [`users/${uid}/timers/${timer.id}/currentStartAt`]: null,
        [`users/${uid}/timers/${timer.id}/counter`]: increment(1),
        [`users/${uid}/timers/${timer.id}/lastRotationMessages`]:
          stopMessages.length > 0 ? stopMessages : null,
        [`timerSessions/${timer.id}/sessions/${startedAt}/endAt`]: endedAt,
      });

      setRotationMessages(stopMessages);
      return;
    }

    // 누적 타이머 시작
    if (timer.currentStartAt == null) {
      const startedAt = Date.now();

      await update(ref(database), {
        [`users/${uid}/timers/${timer.id}/currentStartAt`]: startedAt,
        [`users/${uid}/timers/${timer.id}/recentStartAt`]: startedAt,
        [`timerSessions/${timer.id}/sessions/${startedAt}/startAt`]: startedAt,
      });

      setRotationMessages(
        getRotationMessages(timer, startedAt, sessionCount, 'start'),
      );
      return;
    }

    // 누적 타이머 종료
    const endedAt = Date.now();
    const startedAt = timer.currentStartAt;

    await update(ref(database), {
      [`users/${uid}/timers/${timer.id}/accumulatedMs`]: increment(
        endedAt - startedAt,
      ),
      [`users/${uid}/timers/${timer.id}/currentStartAt`]: null,
      [`users/${uid}/timers/${timer.id}/counter`]: increment(1),
      [`timerSessions/${timer.id}/sessions/${startedAt}/endAt`]: endedAt,
    });

    setRotationMessages(
      getRotationMessages(timer, endedAt, sessionCount, 'stop'),
    );
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!uid || !over || active.id === over.id) return;

    const oldIndex = timers.findIndex(timer => timer.id === active.id);
    const newIndex = timers.findIndex(timer => timer.id === over.id);

    if (oldIndex < 0 || newIndex < 0) return;

    const previousTimers = timers;
    const movedTimers = arrayMove(timers, oldIndex, newIndex);
    const orderedTimers = movedTimers.map(
      (timer, index) => ({ ...timer, order: index }) as TimerItem,
    );

    // 먼저 화면에 즉시 반영한다.
    setTimers(orderedTimers);

    const updates: Record<string, number> = {};

    orderedTimers.forEach((timer, index) => {
      updates[`users/${uid}/timers/${timer.id}/order`] = index;
    });

    try {
      // 루트 기준 multi-location update라 한 번에 모든 order를 저장한다.
      await update(ref(database), updates);
    } catch (e) {
      console.error(e);
      setTimers(previousTimers);
    }
  };

  const getNewTimerName = () => {
    const base = '새 타이머';

    const numbers = timers
      .map(timer => {
        const match = timer.name.match(/^새 타이머(?: (\d+))?$/);
        if (!match) return null;
        return match[1] ? Number(match[1]) : 1;
      })
      .filter((n): n is number => n !== null);

    const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;

    return next === 1 ? base : `${base} ${next}`;
  };

  const getNextOrder = () => {
    if (timers.length === 0) return 0;

    return (
      Math.max(
        ...timers.map((timer, index) => timer.order ?? index),
      ) + 1
    );
  };

  const handleAddAccumulatedTimer = async () => {
    if (!uid) return;

    const id = crypto.randomUUID();

    await update(ref(database, `users/${uid}/timers/${id}`), {
      type: 'accumulated',
      name: getNewTimerName(),
      order: getNextOrder(),
      accumulatedMs: 0,
      currentStartAt: null,
      recentStartAt: null,
      counter: 0,
      reverseRotation: false,
    });
  };

  const handleAddRecordTimer = async () => {
    if (!uid) return;

    const id = crypto.randomUUID();

    await update(ref(database, `users/${uid}/timers/${id}`), {
      type: 'record',
      name: getNewTimerName(),
      order: getNextOrder(),
      currentStartAt: null,
      recentStartAt: null,
      counter: 0,
      reverseRotation: false,
    });
  };

  const handleAddChecklist = async () => {
    if (!uid) return;

    const id = crypto.randomUUID();

    await update(ref(database, `users/${uid}/timers/${id}`), {
      type: 'checklist',
      name: getNewTimerName(),
      order: getNextOrder(),
      recentStartAt: null,
      counter: 0,
      reverseRotation: false,
    });
  };

  return (
    <div
      className='container'
      style={{
        maxWidth: 1100,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: '0.75rem',
        paddingBottom: '1rem',
      }}
    >
      <div
        className='position-relative mb-3'
        style={{ minHeight: 40 }}
      >
        <div
          className='position-absolute'
          style={{ top: 0, right: 0 }}
        >
          <HamburgerMenu>
            <li>
              <button
                className='dropdown-item'
                type='button'
                onClick={handleAddAccumulatedTimer}
              >
                새 누적 타이머
              </button>
            </li>

            <li>
              <button
                className='dropdown-item'
                type='button'
                onClick={handleAddRecordTimer}
              >
                새 기록 타이머
              </button>
            </li>

            <li>
              <button
                className='dropdown-item'
                type='button'
                onClick={handleAddChecklist}
              >
                새 체크리스트
              </button>
            </li>

            <HamburgerDivider />
            <LogoutButton />
          </HamburgerMenu>
        </div>
      </div>

      {timers.length === 0 ? (
        <div className='border border-secondary rounded-4 bg-dark text-light text-center py-5 px-4 shadow-sm mt-2'>
          <div className='fw-semibold fs-5 mb-2'>
            타이머가 없습니다
          </div>

          <div className='text-secondary'>
            우측 상단 메뉴에서 새 타이머를 추가해보세요.
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={timers.map(timer => timer.id)}
            strategy={rectSortingStrategy}
          >
            <div className='row g-3 mt-1'>
              {timers.map(timer => (
                <TimerRow
                  key={timer.id}
                  timer={timer}
                  now={now}
                  onToggle={handleToggleTimer}
                  onRename={setRenameTarget}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {deleteTarget && (
        <DeleteTimerModal
          timer={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {renameTarget && (
        <RenameTimerModal
          timer={renameTarget}
          onClose={() => setRenameTarget(null)}
        />
      )}

      <RotationNoticeModal
        messages={rotationMessages}
        onClose={() => setRotationMessages([])}
      />
    </div>
  );
}
