import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils'; // Assuming Shadcn's cn utility is here, will verify

const CFButton = ({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled,
  icon: Icon,
  loading,
  className,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:pointer-events-none';
  
  const variants = {
    primary: 'bg-[#6A68DF] text-white hover:bg-[#5856CC] rounded-full',
    secondary: 'bg-transparent border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--card-elevated)] rounded-full',
    ghost: 'bg-transparent text-[#6A68DF] hover:bg-[#6A68DF]/10 rounded-full',
    danger: 'bg-red-500 text-white hover:bg-red-600 rounded-full',
  };

  const sizes = {
    sm: 'px-4 py-1.5 text-sm',
    md: 'px-6 py-2.5 text-base',
    lg: 'px-8 py-3 text-lg',
  };

  // Ghost has specific padding overrides in prompt
  if (variant === 'ghost') {
    sizes.md = 'px-4 py-2 text-base';
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
      ) : Icon ? (
        <Icon className="w-5 h-5 mr-2" />
      ) : null}
      {children}
    </button>
  );
};

export default CFButton;
