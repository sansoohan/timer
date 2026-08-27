// pages/UserTimerPage/omponents/AccumulatedTimerPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { generatePath, useNavigate, useParams } from 'react-router-dom';
import { get, ref, update } from 'firebase/database';
import { format, isValid, parse } from 'date-fns';
import { ROUTE_USER_TIMERS } from '~/constants/routes';
import { HamburgerMenu } from '~/components/HamburgerMenu';
import { HamburgerDivider } from '~/components/HamburgerDivider';
import { RotationSettingsModal } from '~/components/RotationSettingsModal';
import { LogoutButton } from '~/components/LogoutButton';
import { PaginationControls } from '~/components/PaginationControls';
import { useAuth } from '~/contexts/AuthContext';
import { database } from '~/constants/firebase';
import type { PageSize } from '~/types/editor';

type TimerSession = {
  startAt: number;
  endAt: number | null;
};

type ModalMode = 'add' | 'edit';

const DATE_TIME_FORMAT = 'yyyy-MM-dd HH:mm:ss';
const DATE_TIME_FORMAT_MS = 'yyyy-MM-dd HH:mm:ss.SSS';
const DATE_TIME_PLACEHOLDER = 'YYYY-MM-DD hh:mm:ss[.SSS]';

function formatDateTime(ms: number): string {
  return format(new Date(ms), DATE_TIME_FORMAT_MS);
}

function parseDateTime(value: string): number | null {
  const input = value.trim();
  const dateTimeFormat = input.includes('.')
    ? DATE_TIME_FORMAT_MS
    : DATE_TIME_FORMAT;
  const parsed = parse(input, dateTimeFormat, new Date());

  if (!isValid(parsed)) return null;

  // date-fns가 입력을 보정해서 받아들이는 경우까지 막는다.
  if (format(parsed, dateTimeFormat) !== input) return null;

  return parsed.getTime();
}

function findInsertIndex(
  sessions: TimerSession[],
  startAt: number,
): number {
  let low = 0;
  let high = sessions.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);

    if (sessions[mid].startAt < startAt) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

function hasOverlap(
  sortedSessions: TimerSession[],
  startAt: number,
  endAt: number,
): boolean {
  const index = findInsertIndex(sortedSessions, startAt);
  const prev = sortedSessions[index - 1];
  const next = sortedSessions[index];

  // endAt === null인 기존 세션은 아직 끝나지 않은 세션이므로
  // 그 뒤에 들어오는 시간은 모두 겹치는 것으로 본다.
  if (prev && (prev.endAt == null || startAt < prev.endAt)) {
    return true;
  }

  if (next && endAt > next.startAt) {
    return true;
  }

  return false;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
    2,
    '0',
  )}:${String(seconds).padStart(2, '0')}`;
}

function computeAccumulatedMs(sessions: TimerSession[]): number {
  return sessions.reduce((sum, session) => {
    if (session.endAt == null) return sum;
    return sum + Math.max(0, session.endAt - session.startAt);
  }, 0);
}

export function AccumulatedTimerPage() {
  const { uid, timerId } = useParams<{ uid: string; timerId: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const currentUserUid = user?.uid ?? null;

  const [sessions, setSessions] = useState<TimerSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedStartAt, setSelectedStartAt] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(20 as PageSize);
  const [pageIndex, setPageIndex] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [modalStart, setModalStart] = useState('');
  const [modalEnd, setModalEnd] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [rotationSettingsOpen, setRotationSettingsOpen] = useState(false);

  useEffect(() => {
    if (!uid || !timerId) return;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!currentUserUid) {
          setError('로그인이 필요합니다.');
          return;
        }

        if (currentUserUid !== uid) {
          setError('본인 타이머만 수정할 수 있습니다.');
          return;
        }

        const [timerSnapshot, sessionsSnapshot] = await Promise.all([
          get(ref(database, `users/${uid}/timers/${timerId}`)),
          get(ref(database, `timerSessions/${timerId}/sessions`)),
        ]);

        if (!timerSnapshot.exists()) {
          setError('타이머를 찾을 수 없습니다.');
          return;
        }

        const rawSessions = sessionsSnapshot.val() as
          | Record<string, { startAt?: unknown; endAt?: unknown }>
          | null;

        const loadedSessions: TimerSession[] = [];

        if (rawSessions) {
          for (const value of Object.values(rawSessions)) {
            if (typeof value?.startAt !== 'number') continue;

            loadedSessions.push({
              startAt: value.startAt,
              endAt: typeof value.endAt === 'number' ? value.endAt : null,
            });
          }
        }

        loadedSessions.sort((a, b) => a.startAt - b.startAt);
        setSessions(loadedSessions);
      } catch (e) {
        console.error(e);
        setError('누적시간을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [uid, timerId, currentUserUid]);

  // sessions 자체는 startAt 오름차순으로 유지한다.
  // 화면에만 최신 기록이 먼저 보이도록 내림차순으로 뒤집는다.
  const displaySessions = useMemo(() => [...sessions].reverse(), [sessions]);

  const totalPages = Math.ceil(displaySessions.length / pageSize);
  const safePageIndex = totalPages === 0 ? 0 : Math.min(pageIndex, totalPages - 1);
  const pagedSessions = displaySessions.slice(
    safePageIndex * pageSize,
    safePageIndex * pageSize + pageSize,
  );

  const selectedSession =
    sessions.find(item => item.startAt === selectedStartAt) ?? null;

  const handleBack = () => {
    if (!uid) return;
    nav(generatePath(ROUTE_USER_TIMERS, { uid }));
  };

  const handleSave = async () => {
    if (!uid || !timerId || !currentUserUid || currentUserUid !== uid) {
      setError('저장 권한이 없습니다.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const sessionsData: Record<string, { startAt: number; endAt?: number }> = {};

      for (const session of sessions) {
        const sessionId = String(session.startAt);
        sessionsData[sessionId] = {
          startAt: session.startAt,
          ...(session.endAt == null ? {} : { endAt: session.endAt }),
        };
      }

      const completedCount = sessions.reduce(
        (count, session) => count + (session.endAt == null ? 0 : 1),
        0,
      );

      await update(ref(database), {
        [`timerSessions/${timerId}/sessions`]:
          sessions.length === 0 ? null : sessionsData,
        [`users/${uid}/timers/${timerId}/accumulatedMs`]:
          computeAccumulatedMs(sessions),
        [`users/${uid}/timers/${timerId}/counter`]:
          completedCount,
      });

      nav(generatePath(ROUTE_USER_TIMERS, { uid }));
    } catch (e) {
      console.error(e);
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleSelect = (startAt: number) => {
    setSelectedStartAt(prev => (prev === startAt ? null : startAt));
  };

  const openAddModal = () => {
    setModalMode('add');

    const startAt = selectedSession?.endAt ?? Date.now();
    setModalStart(formatDateTime(startAt));
    setModalEnd('');
    setModalError(null);
    setModalOpen(true);
  };

  const openEditModal = () => {
    if (!selectedSession) return;

    setModalMode('edit');
    setModalStart(formatDateTime(selectedSession.startAt));
    setModalEnd(
      selectedSession.endAt == null ? '' : formatDateTime(selectedSession.endAt),
    );
    setModalError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalError(null);
  };

  const handleModalConfirm = () => {
    const startAt = parseDateTime(modalStart);
    const endAt = parseDateTime(modalEnd);

    if (startAt == null || endAt == null) {
      setModalError(
        '아래 형식으로 입력해주세요.\n' +
        'YYYY-MM-DD hh:mm:ss\n' +
        'YYYY-MM-DD hh:mm:ss.SSS'
      );
      return;
    }

    if (endAt <= startAt) {
      setModalError('종료시간은 시작시간보다 뒤여야 합니다.');
      return;
    }

    const otherSessions = sessions
      .filter(
        session =>
          modalMode !== 'edit' || session.startAt !== selectedStartAt,
      )
      .sort((a, b) => a.startAt - b.startAt);

    if (hasOverlap(otherSessions, startAt, endAt)) {
      setModalError('기존 누적시간과 겹칩니다.');
      return;
    }

    const newItem: TimerSession = {
      startAt,
      endAt,
    };

    if (modalMode === 'add') {
      const insertIndex = findInsertIndex(otherSessions, startAt);
      const nextSessions = [...otherSessions];
      nextSessions.splice(insertIndex, 0, newItem);
      setSessions(nextSessions);
    } else {
      if (selectedStartAt == null) return;

      const insertIndex = findInsertIndex(otherSessions, startAt);
      const nextSessions = [...otherSessions];
      nextSessions.splice(insertIndex, 0, newItem);
      setSessions(nextSessions);
    }

    setSelectedStartAt(startAt);

    setModalOpen(false);
    setModalError(null);
  };

  const handleDelete = () => {
    if (selectedStartAt == null) return;

    setSessions(prev =>
      prev.filter(item => item.startAt !== selectedStartAt),
    );
    setSelectedStartAt(null);
  };

  if (loading) {
    return (
      <div className="container py-5">
        <p>로딩 중...</p>
      </div>
    );
  }

  if (error && sessions.length === 0) {
    return (
      <div className="container py-5">
        <p>{error}</p>
        <button className="btn btn-outline-light" onClick={handleBack}>
          뒤로
        </button>
      </div>
    );
  }

  return (
    <div className="container py-4" style={{ minHeight: '100vh' }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex gap-2">
          <button className="btn btn-outline-light" onClick={handleBack}>
            뒤로
          </button>
          <button className="btn btn-success" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>

        <HamburgerMenu>
          <li>
            <button
              className="dropdown-item"
              type="button"
              onClick={() => setRotationSettingsOpen(true)}
            >
              로테이션 문구 설정
            </button>
          </li>
          <HamburgerDivider />
          <LogoutButton />
        </HamburgerMenu>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="d-flex justify-content-end mb-2 gap-2">
        <button
          className="btn btn-sm btn-outline-light"
          onClick={openEditModal}
          disabled={selectedStartAt == null}
          title="수정"
        >
          ✏ 수정
        </button>
        <button
          className="btn btn-sm btn-outline-light"
          onClick={openAddModal}
          title="추가"
        >
          ＋ 추가
        </button>
        <button
          className="btn btn-sm btn-outline-danger"
          onClick={handleDelete}
          disabled={selectedStartAt == null}
          title="삭제"
        >
          🗑 삭제
        </button>
      </div>

      <PaginationControls
        className="w-100 justify-content-between mb-2"
        pageSize={pageSize}
        pageIndex={safePageIndex}
        totalPages={totalPages}
        onPageSizeChange={size => {
          setPageSize(size);
          setPageIndex(0);
        }}
        onPageIndexChange={setPageIndex}
      />

      <ul style={{ listStyle: 'none', paddingLeft: 0, marginBottom: 0 }}>
        {pagedSessions.map(item => {
          const isSelected = item.startAt === selectedStartAt;

          return (
            <li
              key={item.startAt}
              onClick={() => handleSelect(item.startAt)}
              style={{
                padding: '6px',
                borderBottom: '1px solid #333',
                fontSize: '0.92rem',
                lineHeight: 1.35,
                backgroundColor: isSelected ? '#1d3557' : '#000',
                color: '#f8f9fa',
                cursor: 'pointer',
              }}
            >
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <span className="fw-bold">{formatDateTime(item.startAt)}</span>
                <span className="text-secondary">~</span>
                <span className="fw-bold">
                  {item.endAt == null ? '진행 중' : formatDateTime(item.endAt)}
                </span>
                <span className="text-info ms-auto">
                  {item.endAt == null
                    ? '-'
                    : formatDuration(item.endAt - item.startAt)}
                </span>
              </div>
            </li>
          );
        })}

        {displaySessions.length === 0 && (
          <li
            style={{ padding: '4px 6px', fontSize: '0.9rem' }}
            className="text-secondary bg-black"
          >
            누적시간 기록을 추가해주세요
          </li>
        )}
      </ul>

      {modalOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }}
        >
          <div className="bg-dark text-light p-3 rounded" style={{ minWidth: 320 }}>
            <h5 className="mb-3">
              {modalMode === 'add' ? '누적시간 추가' : '누적시간 수정'}
            </h5>

            <div className="mb-2">
              <label className="form-label">시작시간</label>
              <input
                className={`form-control ${modalError ? 'is-invalid' : ''}`}
                value={modalStart}
                placeholder={DATE_TIME_PLACEHOLDER}
                onChange={e => {
                  setModalStart(e.target.value);
                  setModalError(null);
                }}
              />
            </div>

            <div className="mb-2">
              <label className="form-label">종료시간</label>
              <input
                className={`form-control ${modalError ? 'is-invalid' : ''}`}
                value={modalEnd}
                placeholder={DATE_TIME_PLACEHOLDER}
                onChange={e => {
                  setModalEnd(e.target.value);
                  setModalError(null);
                }}
              />
            </div>

            {modalError && (
              <div className="text-danger small mb-3" style={{ whiteSpace: 'pre-line' }}>
                {modalError}
              </div>
            )}

            <div className="d-flex justify-content-end gap-2 mt-3">
              <button className="btn btn-secondary btn-sm" onClick={closeModal}>
                취소
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleModalConfirm}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}
      {rotationSettingsOpen && uid && timerId && (
        <RotationSettingsModal
          uid={uid}
          timerId={timerId}
          onClose={() => setRotationSettingsOpen(false)}
        />
      )}

    </div>
  );
}
