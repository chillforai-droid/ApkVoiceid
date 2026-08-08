import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
      <div className="bg-white p-5 sm:p-6 rounded-lg shadow-xl w-full max-w-sm max-h-[85dvh] overflow-y-auto">
        <h3 className="text-lg font-medium mb-2">{title}</h3>
        <p className="text-gray-600 mb-6 break-words">{message}</p>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
          <button onClick={onCancel} className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 w-full sm:w-auto">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 w-full sm:w-auto">Delete</button>
        </div>
      </div>
    </div>
  );
};
