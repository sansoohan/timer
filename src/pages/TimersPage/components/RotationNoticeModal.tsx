// pages/TimersPage/components/RotationNoticeModal.tsx
import type { RotationMessage } from '~/utils/rotation';

type Props = {
  messages: RotationMessage[];
  onClose: () => void;
};

export function RotationNoticeModal({
  messages,
  onClose,
}: Props) {
  if (messages.length === 0) return null;

  return (
    <div
      className='position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center'
      style={{
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 1060,
      }}
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className='bg-dark text-light p-3 rounded'
        style={{ minWidth: 320, maxWidth: 520 }}
      >
        <h5 className='mb-3'>알림</h5>

        <div className='d-flex flex-column gap-2'>
          {messages.map((message, index) => (
            <div
              key={index}
              className={
                index < messages.length - 1
                  ? 'border-bottom border-secondary pb-2'
                  : ''
              }
            >
              <div className='mb-1'>
                <span className='badge bg-secondary'>
                  {message.label}
                </span>
              </div>

              <div style={{ whiteSpace: 'pre-wrap' }}>
                {message.text}
              </div>
            </div>
          ))}
        </div>

        <div className='d-flex justify-content-end mt-3'>
          <button
            className='btn btn-primary btn-sm'
            onClick={onClose}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}