import { ref, update } from 'firebase/database';

import { database } from '~/constants/firebase';
import { useAuth } from '~/contexts/AuthContext';
import { BasicModal } from '~/components/BasicModal';
import type { TimerItem } from '~/types/timer';

type DeleteTimerModalProps = {
  timer: TimerItem;
  onClose: () => void;
};

export function DeleteTimerModal({
  timer,
  onClose,
}: DeleteTimerModalProps) {
  const { currentUserUid: uid } = useAuth();

  const timerName = timer.name.trim() || '(이름 없음)';

  const handleConfirmDelete = async () => {
    if (!uid) return;

    await update(ref(database, `users/${uid}/timers`), {
      [timer.id]: null,
    });

    onClose();
  };

  return (
    <BasicModal
      title='타이머 삭제'
      onClose={onClose}
      footer={
        <>
          <button
            type='button'
            className='btn btn-secondary'
            onClick={onClose}
          >
            취소
          </button>
          <button
            type='button'
            className='btn btn-danger'
            onClick={handleConfirmDelete}
          >
            삭제
          </button>
        </>
      }
    >
      <p className='mb-0'>
        정말 삭제 하시겠습니까?
        <br />
        <span className='fw-semibold'>{timerName}</span>
      </p>
    </BasicModal>
  );
}
