// pages/UserTimerPage/index.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { get, ref } from 'firebase/database';
import { database } from '~/constants/firebase';
import { AccumulatedTimerPage } from './components/AccumulatedTimerPage';

type TimerType = 'accumulated' | 'record' | 'checklist';

export function UserTimerPage() {
  const { uid, timerId } = useParams<{ uid: string; timerId: string }>();

  const [timerType, setTimerType] = useState<TimerType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !timerId) return;

    const load = async () => {
      try {
        setError(null);

        const snap = await get(
          ref(database, `users/${uid}/timers/${timerId}/type`),
        );

        const type = snap.val();

        if (
          type !== 'accumulated' &&
          type !== 'record' &&
          type !== 'checklist'
        ) {
          setError('타이머 종류를 확인할 수 없습니다.');
          return;
        }

        setTimerType(type);
      } catch (e) {
        console.error(e);
        setError('타이머를 불러오는 중 오류가 발생했습니다.');
      }
    };

    load();
  }, [uid, timerId]);

  if (error) {
    return (
      <div className='container py-5'>
        <p>{error}</p>
      </div>
    );
  }

  if (timerType == null) {
    return (
      <div className='container py-5'>
        <p>로딩 중...</p>
      </div>
    );
  }

  if (timerType === 'accumulated' || timerType === 'record') {
    return <AccumulatedTimerPage />;
  }

  return (
    <div className='container py-5'>
      <p>체크리스트는 체크리스트 상세페이지에서 열어주세요.</p>
    </div>
  );
}
