import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import CFButton from './CFButton';

const CFModal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md'
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className={cn(
          "bg-[var(--card)] rounded-[24px] border border-[var(--border)] shadow-xl w-full p-6",
          "animate-in fade-in zoom-in-95 duration-200",
          sizeClasses[size]
        )}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
          <CFButton variant="ghost" size="sm" onClick={onClose} className="px-2 py-2" icon={X} />
        </div>
        
        <div className="text-[var(--text-primary)]">
          {children}
        </div>
        
        {footer && (
          <div className="flex gap-3 justify-end border-t border-[var(--border)] pt-4 mt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default CFModal;
