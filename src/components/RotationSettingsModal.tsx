// components/RotationSettingsModal.tsx

import { useEffect, useState } from 'react';
import { getISOWeek } from 'date-fns';
import { get, ref, update } from 'firebase/database';
import { database } from '~/constants/firebase';

type RotationFields = {
  oddDayText: string;
  evenDayText: string;
  oddWeekText: string;
  evenWeekText: string;
  oddMonthText: string;
  evenMonthText: string;
};

type Props = {
  uid: string;
  timerId: string;
  sessionCount: number;
  onClose: () => void;
};

const EMPTY: RotationFields = {
  oddDayText: '',
  evenDayText: '',
  oddWeekText: '',
  evenWeekText: '',
  oddMonthText: '',
  evenMonthText: '',
};

export function RotationSettingsModal({
  uid,
  timerId,
  sessionCount,
  onClose,
}: Props) {
  const [values, setValues] = useState<RotationFields>(EMPTY);
  const [reverseRotation, setReverseRotation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await get(
          ref(database, `users/${uid}/timers/${timerId}`),
        );

        const value = snap.val() ?? {};

        setValues({
          oddDayText:
            typeof value.oddDayText === 'string' ? value.oddDayText : '',
          evenDayText:
            typeof value.evenDayText === 'string' ? value.evenDayText : '',
          oddWeekText:
            typeof value.oddWeekText === 'string' ? value.oddWeekText : '',
          evenWeekText:
            typeof value.evenWeekText === 'string' ? value.evenWeekText : '',
          oddMonthText:
            typeof value.oddMonthText === 'string' ? value.oddMonthText : '',
          evenMonthText:
            typeof value.evenMonthText === 'string' ? value.evenMonthText : '',
        });

        setReverseRotation(value.reverseRotation === true);
      } catch (e) {
        console.error(e);
        setError('설정을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [uid, timerId]);

  const setField = (key: keyof RotationFields, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const textUpdates = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          key,
          value.trim() || null,
        ]),
      );

      await update(
        ref(database, `users/${uid}/timers/${timerId}`),
        {
          ...textUpdates,
          reverseRotation,
        },
      );

      onClose();
    } catch (e) {
      console.error(e);
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const now = new Date();

  let isOddDay = sessionCount % 2 === 1;
  let isOddWeek = getISOWeek(now) % 2 === 1;
  let isOddMonth = (now.getMonth() + 1) % 2 === 1;

  if (reverseRotation) {
    isOddDay = !isOddDay;
    isOddWeek = !isOddWeek;
    isOddMonth = !isOddMonth;
  }

  const isCurrent: Record<keyof RotationFields, boolean> = {
    oddDayText: isOddDay,
    evenDayText: !isOddDay,
    oddWeekText: isOddWeek,
    evenWeekText: !isOddWeek,
    oddMonthText: isOddMonth,
    evenMonthText: !isOddMonth,
  };

  const fields: Array<[keyof RotationFields, string]> = [
    ['oddDayText', '홀수일 문구'],
    ['evenDayText', '짝수일 문구'],
    ['oddWeekText', '홀수주 문구'],
    ['evenWeekText', '짝수주 문구'],
    ['oddMonthText', '홀수달 문구'],
    ['evenMonthText', '짝수달 문구'],
  ];

  return (
    <div
      className='position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center'
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
    >
      <div
        className='bg-dark text-light p-3 rounded overflow-auto'
        style={{ width: 'min(92vw, 520px)', maxHeight: '90vh' }}
      >
        <h5 className='mb-3'>로테이션 문구 설정</h5>

        {loading ? (
          <p className='mb-0'>로딩 중...</p>
        ) : (
          <>
            {fields.map(([key, label]) => (
              <div className='mb-3' key={key}>
                <label className='form-label'>
                  {label}
                  {isCurrent[key] && ' (현재)'}
                </label>

                <textarea
                  className='form-control'
                  rows={2}
                  value={values[key]}
                  onChange={e => setField(key, e.target.value)}
                />
              </div>
            ))}

            <div className='form-check mb-3'>
              <input
                className='form-check-input'
                type='checkbox'
                id={`reverseRotation-${timerId}`}
                checked={reverseRotation}
                onChange={e => {
                  setReverseRotation(e.target.checked);
                  setError(null);
                }}
              />

              <label
                className='form-check-label'
                htmlFor={`reverseRotation-${timerId}`}
              >
                반대로 보여주기
              </label>
            </div>

            {error && (
              <div className='text-danger small mb-3'>
                {error}
              </div>
            )}

            <div className='d-flex justify-content-end gap-2'>
              <button
                className='btn btn-secondary btn-sm'
                onClick={onClose}
                disabled={saving}
              >
                취소
              </button>

              <button
                className='btn btn-primary btn-sm'
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
