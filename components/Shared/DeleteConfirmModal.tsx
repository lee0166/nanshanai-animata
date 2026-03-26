import React from 'react';
import { Modal, ModalContent, Button } from '@heroui/react';
import { Trash2 } from 'lucide-react';
import { useApp } from '../../contexts/context';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  warningText?: string;
  itemName?: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
  showIcon?: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  warningText,
  itemName,
  confirmText,
  cancelText,
  isLoading = false,
  size = 'sm',
  showIcon = true,
}) => {
  const { t } = useApp();

  const defaultTitle = t.common.confirmDeleteTitle;
  const defaultDescription = t.common.confirmDeleteImageDesc;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size={size as any}
      classNames={{
        base: 'border border-content3 shadow-xl dark:shadow-2xl',
        wrapper: 'items-center',
      }}
      placement="center"
      backdrop="opaque"
    >
      <ModalContent className="p-7 sm:p-8">
        {(onCloseModal) => (
          <div className="flex flex-col items-center gap-5 text-center">
            {showIcon && (
              <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/25 flex items-center justify-center text-red-500 mb-1 shadow-sm dark:shadow-red-900/20 ring-1 ring-red-100 dark:ring-red-900/30">
                <Trash2 className="w-7 h-7" />
              </div>
            )}
            
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-foreground tracking-tight">
                {title || defaultTitle}
              </h3>
              {description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                  {description || defaultDescription}
                </p>
              )}
              {warningText && (
                <p className="text-xs text-red-500 dark:text-red-400 font-medium px-3 py-1.5 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20">
                  {warningText}
                </p>
              )}
            </div>

            <div className="flex gap-3 w-full mt-3">
              <Button 
                fullWidth 
                variant="light" 
                onPress={onCloseModal} 
                isDisabled={isLoading}
                radius="lg"
                className="text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-all duration-200"
              >
                {cancelText || t.common.cancel}
              </Button>
              <Button
                fullWidth
                color="danger"
                onPress={onConfirm}
                isLoading={isLoading}
                isDisabled={isLoading}
                radius="lg"
                className="font-semibold shadow-lg shadow-danger/20 hover:shadow-danger/30 transition-all duration-200"
              >
                {confirmText || t.common.delete}
              </Button>
            </div>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};

export default DeleteConfirmModal;
