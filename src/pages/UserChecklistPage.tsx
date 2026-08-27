// pages/UserChecklistPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { format, isValid, parse } from 'date-fns';
import { get, ref, update } from 'firebase/database';
import { generatePath, useNavigate, useParams } from 'react-router-dom';
import { database } from '~/constants/firebase';
import { ROUTE_USER_TIMERS } from '~/constants/routes';
import { PaginationControls } from '~/components/PaginationControls';
import { HamburgerMenu } from '~/components/HamburgerMenu';
import { HamburgerDivider } from '~/components/HamburgerDivider';
import { RotationSettingsModal } from '~/components/RotationSettingsModal';
import { LogoutButton } from '~/components/LogoutButton';
import { useAuth } from '~/contexts/AuthContext';
import type { PageSize } from '~/types/editor';

type RecordSession = { startAt: number };
type ModalMode = 'add' | 'edit';

const DATE_TIME_FORMAT = 'yyyy-MM-dd HH:mm:ss';
const DATE_TIME_FORMAT_MS = 'yyyy-MM-dd HH:mm:ss.SSS';
const DATE_TIME_PLACEHOLDER = 'YYYY-MM-DD hh:mm:ss[.SSS]';

function formatDateTime(ms: number): string {
  return format(new Date(ms), DATE_TIME_FORMAT_MS);
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function parseDateTime(value: string): number | null {
  const input = value.trim();
  const dateTimeFormat = input.includes('.') ? DATE_TIME_FORMAT_MS : DATE_TIME_FORMAT;
  const parsed = parse(input, dateTimeFormat, new Date());

  if (!isValid(parsed)) return null;
  if (format(parsed, dateTimeFormat) !== input) return null;
  return parsed.getTime();
}

function findInsertIndex(sessions: RecordSession[], startAt: number): number {
  let low = 0;
  let high = sessions.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (sessions[mid].startAt < startAt) low = mid + 1;
    else high = mid;
  }

  return low;
}

export function UserChecklistPage() {
  const { uid, timerId } = useParams<{ uid: string; timerId: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const currentUserUid = user?.uid ?? null;

  const [sessions, setSessions] = useState<RecordSession[]>([]);
  const [selectedStartAt, setSelectedStartAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(20 as PageSize);
  const [pageIndex, setPageIndex] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [modalStart, setModalStart] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [rotationSettingsOpen, setRotationSettingsOpen] = useState(false);

  useEffect(() => {
    if (!uid || !timerId) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!currentUserUid || currentUserUid !== uid) {
          setError('본인 타이머만 수정할 수 있습니다.');
          return;
        }

        const snapshot = await get(ref(database, `timerSessions/${timerId}/sessions`));
        const raw = snapshot.val() as Record<string, { startAt?: unknown }> | null;
        const loaded: RecordSession[] = [];

        if (raw) {
          for (const value of Object.values(raw)) {
            if (typeof value?.startAt === 'number') loaded.push({ startAt: value.startAt });
          }
        }

        loaded.sort((a, b) => a.startAt - b.startAt);
        setSessions(loaded);
      } catch (e) {
        console.error(e);
        setError('기록시간을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [uid, timerId, currentUserUid]);

  const displaySessions = useMemo(
    () =>
      [...sessions]
        .reverse()
        .map((session, index, items) => ({
          ...session,
          differenceMs:
            index === items.length - 1
              ? null
              : session.startAt - items[index + 1].startAt,
        })),
    [sessions],
  );
  const totalPages = Math.ceil(displaySessions.length / pageSize);
  const safePageIndex = totalPages === 0 ? 0 : Math.min(pageIndex, totalPages - 1);
  const pagedSessions = displaySessions.slice(
    safePageIndex * pageSize,
    safePageIndex * pageSize + pageSize,
  );

  const handleBack = () => {
    if (uid) nav(generatePath(ROUTE_USER_TIMERS, { uid }));
  };

  const handleSave = async () => {
    if (!uid || !timerId || currentUserUid !== uid) return;
    setSaving(true);
    setError(null);

    try {
      const sessionsData: Record<string, { startAt: number }> = {};
      for (const session of sessions) {
        sessionsData[String(session.startAt)] = { startAt: session.startAt };
      }

      const recentStartAt = sessions.length > 0 ? sessions[sessions.length - 1].startAt : null;
      await update(ref(database), {
        [`timerSessions/${timerId}/sessions`]:
          sessions.length === 0 ? null : sessionsData,
        [`users/${uid}/timers/${timerId}/recentStartAt`]: recentStartAt,
        [`users/${uid}/timers/${timerId}/counter`]: sessions.length,
      });
      handleBack();
    } catch (e) {
      console.error(e);
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const openAddModal = () => {
    setModalMode('add');
    setModalStart('');
    setModalError(null);
    setModalOpen(true);
  };

  const openEditModal = () => {
    if (selectedStartAt == null) return;
    setModalMode('edit');
    setModalStart(formatDateTime(selectedStartAt));
    setModalError(null);
    setModalOpen(true);
  };

  const handleModalConfirm = () => {
    const startAt = parseDateTime(modalStart);
    if (startAt == null) {
      setModalError(
        '아래 형식으로 입력해주세요.\n' +
        'YYYY-MM-DD hh:mm:ss\n' +
        'YYYY-MM-DD hh:mm:ss.SSS',
      );
      return;
    }

    const others = sessions.filter(
      session => modalMode !== 'edit' || session.startAt !== selectedStartAt,
    );
    const insertIndex = findInsertIndex(others, startAt);

    if (others[insertIndex]?.startAt === startAt) {
      setModalError('동일한 기록시간이 이미 존재합니다.');
      return;
    }

    const next = [...others];
    next.splice(insertIndex, 0, { startAt });
    setSessions(next);
    setSelectedStartAt(startAt);
    setModalOpen(false);
    setModalError(null);
  };

  const handleDelete = () => {
    if (selectedStartAt == null) return;
    setSessions(prev => prev.filter(session => session.startAt !== selectedStartAt));
    setSelectedStartAt(null);
  };

  if (loading) return <div className="container py-5"><p>로딩 중...</p></div>;

  return (
    <div className="container py-4" style={{ minHeight: '100vh' }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex gap-2">
          <button className="btn btn-outline-light" onClick={handleBack}>뒤로</button>
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
        <button className="btn btn-sm btn-outline-light" onClick={openEditModal} disabled={selectedStartAt == null}>✏ 수정</button>
        <button className="btn btn-sm btn-outline-light" onClick={openAddModal}>＋ 추가</button>
        <button className="btn btn-sm btn-outline-danger" onClick={handleDelete} disabled={selectedStartAt == null}>🗑 삭제</button>
      </div>

      <PaginationControls
        className="w-100 justify-content-between mb-2"
        pageSize={pageSize}
        pageIndex={safePageIndex}
        totalPages={totalPages}
        onPageSizeChange={size => { setPageSize(size); setPageIndex(0); }}
        onPageIndexChange={setPageIndex}
      />

      <ul style={{ listStyle: 'none', paddingLeft: 0, marginBottom: 0 }}>
        {pagedSessions.map(item => (
          <li
            key={item.startAt}
            onClick={() => setSelectedStartAt(prev => prev === item.startAt ? null : item.startAt)}
            style={{
              padding: '6px',
              borderBottom: '1px solid #333',
              backgroundColor: item.startAt === selectedStartAt ? '#1d3557' : '#000',
              color: '#f8f9fa',
              cursor: 'pointer',
            }}
          >
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold">{formatDateTime(item.startAt)}</span>
              <span className="text-info ms-auto">
                {item.differenceMs == null ? '-' : formatDuration(item.differenceMs)}
              </span>
            </div>
          </li>
        ))}
        {displaySessions.length === 0 && <li className="text-secondary bg-black" style={{ padding: '4px 6px' }}>기록시간을 추가해주세요</li>}
      </ul>

      {modalOpen && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }}>
          <div className="bg-dark text-light p-3 rounded" style={{ minWidth: 320 }}>
            <h5 className="mb-3">{modalMode === 'add' ? '기록시간 추가' : '기록시간 수정'}</h5>
            <div className="mb-2">
              <label className="form-label">기록시간</label>
              <input
                className={`form-control ${modalError ? 'is-invalid' : ''}`}
                value={modalStart}
                placeholder={DATE_TIME_PLACEHOLDER}
                onChange={e => { setModalStart(e.target.value); setModalError(null); }}
              />
            </div>
            {modalError && <div className="text-danger small mb-3" style={{ whiteSpace: 'pre-line' }}>{modalError}</div>}
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>취소</button>
              <button className="btn btn-primary btn-sm" onClick={handleModalConfirm}>확인</button>
            </div>
          </div>
        </div>
      )}

      {rotationSettingsOpen && uid && timerId && (
        <RotationSettingsModal
          uid={uid}
          timerId={timerId}
          sessionCount={sessions.length}
          onClose={() => setRotationSettingsOpen(false)}
        />
      )}
    </div>
  );
}
