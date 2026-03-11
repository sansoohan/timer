import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, update, runTransaction } from 'firebase/database';

import { database } from '~/constants/firebase';
import { useAuth } from '~/contexts/AuthContext';
import { BasicModal } from '~/components/BasicModal';
import { HamburgerDivider } from '~/components/HamburgerDivider';
import { HamburgerMenu } from '~/components/HamburgerMenu';
import { LogoutButton } from '~/components/LogoutButton';
import type { TimerItem } from '~/types/timer';
import { MAX_TIMER_NAME_LENGTH } from '~/constants/timer';

function formatAccumulatedTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const totalHours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(totalHours).padStart(5, '0')}:${String(minutes).padStart(
    2,
    '0'
  )}:${String(seconds).padStart(2, '0')}`;
}

type TimerRowProps = {
  timer: TimerItem;
  now: number;
  onToggle: (timer: TimerItem) => void;
  onOpenDetail: (timerId: string) => void;
  onRename: (timer: TimerItem) => void;
  onDelete: (timer: TimerItem) => void;
};

function TimerRow({
  timer,
  now,
  onToggle,
  onOpenDetail,
  onRename,
  onDelete,
}: TimerRowProps) {
  const isRunning = timer.currentStartAt != null;
  const displayName = timer.name.trim() || ' ';
  const elapsedMs = isRunning
    ? Math.max(0, now - (timer.currentStartAt ?? 0))
    : 0;
  const displayMs = timer.accumulatedMs + elapsedMs;
  const timerColor = isRunning ? 'text-success' : 'text-light';

  return (
    <div className='border rounded-3 px-3 py-3 mb-3 shadow-sm'>
      <div className='d-flex align-items-start justify-content-between gap-3'>
        <button
          type='button'
          className='flex-grow-1 text-start bg-transparent border-0 p-0'
          style={{ minWidth: 0 }}
          onClick={() => onToggle(timer)}
        >
          <div
            className={`fw-semibold text-truncate mb-2 ${timerColor}`}
            style={{ fontSize: '1rem', minHeight: '1.5rem' }}
          >
            {displayName}
          </div>

          <div
            className={`fw-bold ${timerColor}`}
            style={{
              fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
              letterSpacing: '0.04em',
              lineHeight: 1.1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatAccumulatedTime(displayMs)}
          </div>
        </button>

        <div onClick={(e) => e.stopPropagation()}>
          <HamburgerMenu>
            <li>
              <button
                className='dropdown-item'
                type='button'
                onClick={() => onOpenDetail(timer.id)}
              >
                누적시간 상세보기
              </button>
            </li>

            <li>
              <button
                className='dropdown-item'
                type='button'
                onClick={() => onRename(timer)}
              >
                타이머명 변경
              </button>
            </li>

            <HamburgerDivider />

            <li>
              <button
                className='dropdown-item text-danger'
                type='button'
                onClick={() => onDelete(timer)}
              >
                타이머 삭제
              </button>
            </li>
          </HamburgerMenu>
        </div>
      </div>
    </div>
  );
}

export function TimersPage() {
  const { currentUserUid: uid } = useAuth();

  const [timers, setTimers] = useState<TimerItem[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const [deleteTarget, setDeleteTarget] = useState<TimerItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<TimerItem | null>(null);
  const [renameName, setRenameName] = useState('');

  const trimmedRenameName = renameName.trim();
  const isRenameNameEmpty = trimmedRenameName.length === 0;
  const isRenameNameTooLong = renameName.length > MAX_TIMER_NAME_LENGTH;
  const canSubmitRename = !isRenameNameEmpty && !isRenameNameTooLong;

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
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const deleteTargetName = useMemo(() => {
    if (!deleteTarget) return '';
    return deleteTarget.name.trim() || '(이름 없음)';
  }, [deleteTarget]);

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

  const handleRequestDeleteTimer = (timer: TimerItem) => {
    setDeleteTarget(timer);
  };

  const handleCancelDeleteTimer = () => {
    setDeleteTarget(null);
  };

  const handleConfirmDeleteTimer = async () => {
    if (!uid || !deleteTarget) return;

    await update(ref(database, `users/${uid}/timers`), {
      [deleteTarget.id]: null,
    });

    setDeleteTarget(null);
  };

  const handleOpenRenameModal = (timer: TimerItem) => {
    setRenameTarget(timer);
    setRenameName(timer.name ?? '');
  };

  const handleCloseRenameModal = () => {
    setRenameTarget(null);
    setRenameName('');
  };

  const handleSubmitRename = async () => {
    if (!uid || !renameTarget || !canSubmitRename) return;

    await update(ref(database, `users/${uid}/timers/${renameTarget.id}`), {
      name: trimmedRenameName,
    });

    handleCloseRenameModal();
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
              onRename={handleOpenRenameModal}
              onDelete={handleRequestDeleteTimer}
            />
          ))
        )}
      </div>

      {deleteTarget && (
        <BasicModal
          title='타이머 삭제'
          onClose={handleCancelDeleteTimer}
          footer={
            <>
              <button
                type='button'
                className='btn btn-secondary'
                onClick={handleCancelDeleteTimer}
              >
                취소
              </button>
              <button
                type='button'
                className='btn btn-danger'
                onClick={handleConfirmDeleteTimer}
              >
                삭제
              </button>
            </>
          }
        >
          <p className='mb-0'>
            정말 삭제 하시겠습니까?
            <br />
            <span className='fw-semibold'>{deleteTargetName}</span>
          </p>
        </BasicModal>
      )}

      {renameTarget && (
        <BasicModal
          title='타이머명 변경'
          onClose={handleCloseRenameModal}
          footer={
            <>
              <button
                type='button'
                className='btn btn-secondary'
                onClick={handleCloseRenameModal}
              >
                취소
              </button>
              <button
                type='button'
                className='btn btn-primary'
                disabled={!canSubmitRename}
                onClick={handleSubmitRename}
              >
                저장
              </button>
            </>
          }
        >
          <label htmlFor='timer-name-input' className='form-label'>
            타이머 이름
          </label>

          <input
            id='timer-name-input'
            type='text'
            className={`form-control bg-dark text-light border-secondary ${
              isRenameNameEmpty || isRenameNameTooLong ? 'is-invalid' : ''
            }`}
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmitRename) {
                e.preventDefault();
                handleSubmitRename();
              }
            }}
            autoFocus
          />

          <div className='d-flex justify-content-between align-items-start mt-2'>
            <div className='invalid-feedback d-block mb-0'>
              {isRenameNameEmpty
                ? '타이머 이름을 입력하세요.'
                : isRenameNameTooLong
                ? `타이머 이름은 ${MAX_TIMER_NAME_LENGTH}자 이하여야 합니다.`
                : ''}
            </div>

            <div className='text-secondary small ms-3'>
              {renameName.length}/{MAX_TIMER_NAME_LENGTH}
            </div>
          </div>
        </BasicModal>
      )}
    </div>
  );
}
