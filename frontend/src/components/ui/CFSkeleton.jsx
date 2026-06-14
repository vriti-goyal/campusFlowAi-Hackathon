import React from 'react';
import { cn } from '../../lib/utils';
import CFCard from './CFCard';

const CFSkeleton = ({ lines = 3, card = false, className }) => {
  const Bars = () => (
    <div className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-4 bg-[var(--border)] rounded-full animate-pulse",
            i === 0 ? "w-full" : i === 1 ? "w-3/4" : "w-1/2"
          )}
        />
      ))}
    </div>
  );

  if (card) {
    return (
      <CFCard>
        <Bars />
      </CFCard>
    );
  }

  return <Bars />;
};

export default CFSkeleton;
