import React from 'react';
import { cn } from '../../lib/utils';

const CFBadge = ({
  children,
  variant = 'default',
  className,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap';
  
  // Mapping variants exactly as described
  const variants = {
    high: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    danger: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    medium: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    warning: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    low: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    info: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    success: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    eligible: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    applied: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    missed: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    default: 'bg-[#6A68DF]/10 text-[#6A68DF]',
  };

  return (
    <span
      className={cn(baseStyles, variants[variant] || variants.default, className)}
      {...props}
    >
      {children}
    </span>
  );
};

export default CFBadge;
