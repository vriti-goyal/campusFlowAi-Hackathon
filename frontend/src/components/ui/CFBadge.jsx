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
    high: 'bg-red-50 text-yellow-600 dark:bg-black-900/20 dark:text-black-300',
    danger: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300',
    medium: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300',
    warning: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300',
    low: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300',
    info: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300',
    success: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-300',
    eligible: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-300',
    applied: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-300',
    missed: 'bg-gray-50 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300',
    default: 'bg-[#6A68DF]/8 text-[#6A68DF]',
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
