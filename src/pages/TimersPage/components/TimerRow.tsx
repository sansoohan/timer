// pages/TimersPage/components/TimerRow.tsx
import { generatePath, useNavigate, useParams } from 'react-router-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HamburgerDivider } from '~/components/HamburgerDivider';
import { HamburgerMenu } from '~/components/HamburgerMenu';
import { ROUTE_USER_CHECKLIST, ROUTE_USER_TIMER } from '~/constants/routes';
import type { TimerItem } from '~/types/timer';
import { getRotationMessages } from '~/utils/rotation';

function formatAccumulatedTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const totalHours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(totalHours).padStart(5, '0')}:${String(minutes).padStart(
    2,
    '0',
  )}:${String(seconds).padStart(2, '0')}`;
}

function formatElapsedSince(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}일 ${hours}시간 전`;
  if (hours > 0) return `${hours}시간 ${minutes}분 전`;
  if (minutes > 0) return `${minutes}분 ${seconds}초 전`;
  return `${seconds}초 전`;
}

function formatRecordTime(ms: number) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(5, '0')}:${String(minutes).padStart(
    2,
    '0',
  )}:${String(seconds).padStart(2, '0')}`;
}

type TimerRowProps = {
  timer: TimerItem;
  now: number;
  onToggle: (timer: TimerItem) => void;
  onRename: (timer: TimerItem) => void;
  onDelete: (timer: TimerItem) => void;
};

export function TimerRow({
  timer,
  now,
  onToggle,
  onRename,
  onDelete,
}: TimerRowProps) {
  const { uid } = useParams<{ uid: string }>();
  const nav = useNavigate();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: timer.id });

  const isAccumulated = timer.type === 'accumulated';
  const isRecord = timer.type === 'record';
  const isChecklist = !isAccumulated && !isRecord;

  const isRunning =
    (isAccumulated || isRecord) && timer.currentStartAt != null;

  const displayName = timer.name.trim() || ' ';
  const elapsedMs = isRunning
    ? Math.max(0, now - (timer.currentStartAt ?? 0))
    : 0;

  const displayMs = isAccumulated
    ? (timer.accumulatedMs ?? 0) + elapsedMs
    : elapsedMs;

  const timerColor = isRunning ? 'text-success' : 'text-light';

  const stoppedRecordMessages =
    isRecord &&
    !isRunning &&
    timer.lastStoppedAt != null
      ? getRotationMessages(
          timer,
          timer.lastStoppedAt,
          Math.max(0, timer.counter - 1),
          'stop',
        )
      : [];

  const hasStoppedRecordMessages = stoppedRecordMessages.length > 0;

  const handleOpenDetail = () => {
    if (!uid) return;

    if (isChecklist) {
      nav(
        generatePath(ROUTE_USER_CHECKLIST, {
          uid,
          timerId: timer.id,
        }),
      );
      return;
    }

    nav(
      generatePath(ROUTE_USER_TIMER, {
        uid,
        timerId: timer.id,
      }),
    );
  };

  return (
    <div
      ref={setNodeRef}
      className='col-12 col-lg-6'
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.75 : 1,
      }}
    >
      <div className='border rounded-3 px-3 py-3 shadow-sm h-100'>
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

            {hasStoppedRecordMessages ? (
              <div
                className='d-flex flex-column gap-2 text-light'
                style={{ minWidth: 0 }}
              >
                {stoppedRecordMessages.map((message, index) => (
                  <div
                    key={`${message.label}-${index}`}
                    className='d-flex align-items-start gap-2'
                    style={{ minWidth: 0 }}
                  >
                    <span
                      className='badge text-bg-secondary flex-shrink-0'
                      style={{
                        fontSize: '0.72rem',
                        marginTop: '0.1rem',
                      }}
                    >
                      {message.label}
                    </span>

                    <span
                      className='fw-semibold'
                      style={{
                        minWidth: 0,
                        fontSize: '0.95rem',
                        lineHeight: 1.45,
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {message.text}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className={`fw-bold ${timerColor}`}
                style={{
                  fontSize: 'clamp(1.35rem, 3vw, 2.1rem)',
                  letterSpacing: '0.04em',
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {isAccumulated
                  ? formatAccumulatedTime(displayMs)
                  : isRecord
                    ? formatRecordTime(
                        timer.currentStartAt == null
                          ? 0
                          : now - timer.currentStartAt,
                      )
                    : timer.recentStartAt == null
                      ? '이전기록이 없습니다'
                      : formatElapsedSince(now - timer.recentStartAt)}
              </div>
            )}
          </button>

          <div
            className='d-flex align-items-center gap-1'
            onClick={e => e.stopPropagation()}
          >
            <button
              type='button'
              className='btn btn-sm btn-link text-secondary text-decoration-none px-1'
              title='드래그해서 순서 변경'
              aria-label='드래그해서 순서 변경'
              {...attributes}
              {...listeners}
              style={{
                cursor: isDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                fontSize: '1.25rem',
                lineHeight: 1,
              }}
            >
              ⠿
            </button>

            <HamburgerMenu>
              <li>
                <button
                  className='dropdown-item'
                  type='button'
                  onClick={handleOpenDetail}
                >
                  {isAccumulated
                    ? '누적시간 상세보기'
                    : isRecord
                      ? '기록시간 상세보기'
                      : '체크리스트 상세보기'}
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
    </div>
  );
}
