import { useMemo, useState } from 'react';
import { ref, update } from 'firebase/database';

import { database } from '~/constants/firebase';
import { useAuth } from '~/contexts/AuthContext';
import { BasicModal } from '~/components/BasicModal';
import type { TimerItem } from '~/types/timer';

const MAX_TIMER_NAME_LENGTH = 100;

type RenameTimerModalProps = {
  timer: TimerItem;
  onClose: () => void;
};

export function RenameTimerModal({
  timer,
  onClose,
}: RenameTimerModalProps) {
  const { currentUserUid: uid } = useAuth();
  const [name, setName] = useState(timer.name ?? '');

  const trimmedName = name.trim();
  const isNameEmpty = trimmedName.length === 0;
  const isNameTooLong = name.length > MAX_TIMER_NAME_LENGTH;
  const canSubmit = !isNameEmpty && !isNameTooLong;

  const invalidMessage = useMemo(() => {
    if (isNameEmpty) return '타이머 이름을 입력하세요.';
    if (isNameTooLong) {
      return `타이머 이름은 ${MAX_TIMER_NAME_LENGTH}자 이하여야 합니다.`;
    }
    return '';
  }, [isNameEmpty, isNameTooLong]);

  const handleSubmit = async () => {
    if (!uid || !canSubmit) return;

    await update(ref(database, `users/${uid}/timers/${timer.id}`), {
      name: trimmedName,
    });

    onClose();
  };

  return (
    <BasicModal
      title='타이머명 변경'
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
            className='btn btn-primary'
            disabled={!canSubmit}
            onClick={handleSubmit}
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
          isNameEmpty || isNameTooLong ? 'is-invalid' : ''
        }`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canSubmit) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        autoFocus
      />

      <div className='d-flex justify-content-between align-items-start mt-2'>
        <div className='invalid-feedback d-block mb-0'>{invalidMessage}</div>

        <div className='text-secondary small ms-3'>
          {name.length}/{MAX_TIMER_NAME_LENGTH}
        </div>
      </div>
    </BasicModal>
  );
}
