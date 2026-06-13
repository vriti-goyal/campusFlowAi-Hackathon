import React from 'react';
import { useToast } from '@/contexts/ToastContext';
import { X } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        let bgColor = 'bg-red-500';
        if (toast.type === 'success') bgColor = 'bg-green-500';
        if (toast.type === 'info') bgColor = 'bg-blue-500';

        return (
          <div
            key={toast.id}
            className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between gap-3 min-w-[250px] max-w-sm pointer-events-auto transform transition-all duration-300 ease-in-out translate-y-0 opacity-100`}
            role="alert"
          >
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/80 hover:text-white transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
