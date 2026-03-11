import { HamburgerDivider } from '~/components/HamburgerDivider';
import { HamburgerMenu } from '~/components/HamburgerMenu';
import type { TimerItem } from '~/types/timer';

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

export function TimerRow({
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
