import React from 'react';
import { cn } from '../../lib/utils';

const CFInput = ({
  label,
  icon: Icon,
  error,
  className,
  type = 'text',
  ...props
}) => {
  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className="h-5 w-5 text-[var(--text-muted)]" />
          </div>
        )}
        <input
          type={type}
          className={cn(
            "w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3",
            "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
            "focus:outline-none focus:ring-2 focus:ring-[#6A68DF]/30 focus:border-[#6A68DF]",
            "transition-all duration-200",
            Icon ? "pl-10" : "",
            error ? "border-red-500 focus:ring-red-500/30 focus:border-red-500" : ""
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
};

export default CFInput;
