import React from 'react';
import { Spinner } from "@heroui/react";
import { Sparkles } from 'lucide-react';
import { useApp } from '../contexts/context';

const LoadingView: React.FC = () => {
  const { t } = useApp();

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-8">
          <Spinner size="lg" color="primary" labelColor="primary" />
          <Sparkles className="w-6 h-6 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
      </div>
      <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3 uppercase tracking-tighter">
          {t.settings.initLoading}
      </h2>
    </div>
  );
};

export default LoadingView;
