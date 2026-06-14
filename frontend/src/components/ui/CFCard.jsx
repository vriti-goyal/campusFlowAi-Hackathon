import React from 'react';
import { cn } from '../../lib/utils';

const CFCard = ({
  children,
  className,
  elevated = false,
  gradient = false,
  hover = false,
  onClick,
  ...props
}) => {
  const baseStyles = 'rounded-[20px] p-6 transition-all duration-200';
  
  const bgStyles = gradient
    ? 'bg-gradient-to-br from-[#6A68DF] via-[#B78AEF] to-[#EFB995] text-white border-none'
    : elevated
    ? 'bg-[var(--card-elevated)] border border-[var(--border)] shadow-md text-[var(--text-primary)]'
    : 'bg-[var(--card)] border border-[var(--border)] shadow-[var(--shadow)] text-[var(--text-primary)]';

  const hoverStyles = (hover || onClick)
    ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg'
    : '';

  return (
    <div
      className={cn(baseStyles, bgStyles, hoverStyles, className)}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
};

export default CFCard;
