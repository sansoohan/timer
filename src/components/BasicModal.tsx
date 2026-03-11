import type { ReactNode } from 'react';

type BasicModalProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer: ReactNode;
};

export function BasicModal({
  title,
  children,
  onClose,
  footer,
}: BasicModalProps) {
  return (
    <>
      <div
        className='modal fade show'
        tabIndex={-1}
        role='dialog'
        style={{ display: 'block' }}
        onClick={onClose}
      >
        <div
          className='modal-dialog modal-dialog-centered'
          role='document'
          onClick={(e) => e.stopPropagation()}
        >
          <div className='modal-content bg-dark text-light border-secondary'>
            <div className='modal-header border-secondary'>
              <h5 className='modal-title'>{title}</h5>
              <button
                type='button'
                className='btn-close btn-close-white'
                aria-label='Close'
                onClick={onClose}
              />
            </div>

            <div className='modal-body'>{children}</div>

            <div className='modal-footer border-secondary'>{footer}</div>
          </div>
        </div>
      </div>

      <div className='modal-backdrop fade show' />
    </>
  );
}
