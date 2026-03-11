import { useEffect, useState } from 'react';
import { ref, onValue, update, runTransaction } from 'firebase/database';

import { database } from '~/constants/firebase';
import { useAuth } from '~/contexts/AuthContext';
import { HamburgerDivider } from '~/components/HamburgerDivider';
import { HamburgerMenu } from '~/components/HamburgerMenu';
import { LogoutButton } from '~/components/LogoutButton';
import { DeleteTimerModal } from './components/DeleteTimerModal';
import { RenameTimerModal } from './components/RenameTimerModal';
import { TimerRow } from './components/TimerRow';
import type { TimerItem } from '~/types/timer';

export function TimersPage() {
  const { currentUserUid: uid } = useAuth();

  const [timers, setTimers] = useState<TimerItem[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const [deleteTarget, setDeleteTarget] = useState<TimerItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<TimerItem | null>(null);

  useEffect(() => {
    if (!uid) return;

    const r = ref(database, `users/${uid}/timers`);

    return onValue(r, (snap) => {
      const val = snap.val() ?? {};

      const list: TimerItem[] = Object.entries(val).map(([id, t]) => {
        const timer = (t ?? {}) as Partial<TimerItem>;

        return {
          id,
          name: timer.name ?? '',
          accumulatedMs: timer.accumulatedMs ?? 0,
          currentStartAt: timer.currentStartAt ?? null,
          recentStartAt: timer.recentStartAt ?? null,
          sessions: timer.sessions ?? {},
        };
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

    const timerRef = ref(database, `users/${uid}/timers/${timer.id}`);

    if (timer.currentStartAt == null) {
      const startedAt = Date.now();

      await update(timerRef, {
        currentStartAt: startedAt,
        recentStartAt: startedAt,
        [`sessions/${startedAt}/startAt`]: startedAt,
        [`sessions/${startedAt}/endAt`]: null,
      });

      return;
    }

    await runTransaction(timerRef, (data: TimerItem | null) => {
      if (!data || data.currentStartAt == null) return data;

      const endedAt = Date.now();
      const startAt = data.currentStartAt;
      const accumulatedMs = (data.accumulatedMs ?? 0) + (endedAt - startAt);

      data.accumulatedMs = accumulatedMs;
      data.sessions ??= {};

      const sessionKey = String(startAt);
      const session = (data.sessions[sessionKey] ??= { startAt });

      session.endAt = endedAt;
      data.currentStartAt = null;

      return data;
    });
  };

  const handleAddTimer = async () => {
    if (!uid) return;

    const id = crypto.randomUUID();
    const base = '새 타이머';

    const numbers = timers
      .map((t) => {
        const match = t.name.match(/^새 타이머(?: (\d+))?$/);
        if (!match) return null;
        return match[1] ? Number(match[1]) : 1;
      })
      .filter((n): n is number => n !== null);

    const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    const name = next === 1 ? base : `${base} ${next}`;

    await update(ref(database, `users/${uid}/timers/${id}`), {
      name,
      accumulatedMs: 0,
      currentStartAt: null,
      recentStartAt: null,
      sessions: {},
    });
  };

  const handleOpenDetail = (timerId: string) => {
    console.log('detail', timerId);
  };

  return (
    <div
      className='container'
      style={{
        maxWidth: 720,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: '0.75rem',
        paddingBottom: '1rem',
      }}
    >
      <div className='position-relative mb-3' style={{ minHeight: 40 }}>
        <div className='position-absolute' style={{ top: 0, right: 0 }}>
          <HamburgerMenu>
            <li>
              <button
                className='dropdown-item'
                type='button'
                onClick={handleAddTimer}
              >
                새 타이머 추가
              </button>
            </li>

            <HamburgerDivider />
            <LogoutButton />
          </HamburgerMenu>
        </div>
      </div>

      <div className='d-flex flex-column mt-2'>
        {timers.length === 0 ? (
          <div className='border border-secondary rounded-4 bg-dark text-light text-center py-5 px-4 shadow-sm'>
            <div className='fw-semibold fs-5 mb-2'>타이머가 없습니다</div>
            <div className='text-secondary'>
              우측 상단 메뉴에서 새 타이머를 추가해보세요.
            </div>
          </div>
        ) : (
          timers.map((timer) => (
            <TimerRow
              key={timer.id}
              timer={timer}
              now={now}
              onToggle={handleToggleTimer}
              onOpenDetail={handleOpenDetail}
              onRename={setRenameTarget}
              onDelete={setDeleteTarget}
            />
          ))
        )}
      </div>

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
    </div>
  );
}
