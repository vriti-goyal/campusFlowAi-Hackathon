import React from 'react';
import CFButton from './CFButton';

const CFEmptyState = ({
  icon: Icon,
  title,
  description,
  action
}) => {
  return (
    <div className="py-16 flex flex-col items-center gap-4 text-center">
      {Icon && (
        <div className="bg-gradient-to-br from-[#6A68DF] via-[#B78AEF] to-[#EFB995] p-4 rounded-full">
          <Icon className="w-8 h-8 text-white" />
        </div>
      )}
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
        {description && (
          <p className="text-sm text-[var(--text-secondary)] max-w-xs mx-auto mt-1">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="mt-2">
          <CFButton variant="primary" {...action} />
        </div>
      )}
    </div>
  );
};

export default CFEmptyState;
