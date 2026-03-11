import React from 'react';
import { Spinner } from '@heroui/react';

interface PageLoaderProps {
  message?: string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({ message = '页面加载中...' }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Spinner size="lg" color="primary" />
      <p className="text-default-500 text-sm">{message}</p>
    </div>
  );
};

export default PageLoader;
