import React from 'react';
import { Modal, ModalContent, Button } from '@heroui/react';
import { Trash2, AlertTriangle } from 'lucide-react';
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
      backdrop="blur"
    >
      <ModalContent className="p-0 overflow-hidden">
        {onCloseModal => (
          <div className="flex flex-col">
            <div className="flex items-center gap-4 p-6 pb-4 border-b border-content3">
              {showIcon && (
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-content2 flex items-center justify-center text-slate-500 dark:text-slate-400">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-white shadow-lg">
                    <AlertTriangle className="w-3 h-3" />
                  </div>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground tracking-tight">
                  {title || defaultTitle}
                </h3>
                {itemName && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                    {itemName}
                  </p>
                )}
              </div>
            </div>

            <div className="p-6 pt-4 space-y-4">
              {description && (
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {description || defaultDescription}
                </p>
              )}
              {warningText && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/15 rounded-xl border border-amber-100 dark:border-amber-900/25">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                    {warningText}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 pt-4 bg-content1/50 border-t border-content3">
              <Button
                variant="light"
                onPress={onCloseModal}
                isDisabled={isLoading}
                radius="lg"
                size="sm"
                className="text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium min-w-[80px]"
              >
                {cancelText || t.common.cancel}
              </Button>
              <Button
                color="danger"
                variant="solid"
                onPress={onConfirm}
                isLoading={isLoading}
                isDisabled={isLoading}
                radius="lg"
                size="sm"
                className="font-semibold min-w-[100px] shadow-lg shadow-danger/15 hover:shadow-danger/25 transition-all duration-200"
                startContent={!isLoading && <Trash2 className="w-4 h-4" />}
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
