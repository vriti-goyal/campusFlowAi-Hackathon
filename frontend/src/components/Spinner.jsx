import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Spinner() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm">
      <Loader2 className="animate-spin text-primary" size={48} />
    </div>
  );
}
