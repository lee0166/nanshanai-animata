import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageLoader } from '../PageLoader';
import '@testing-library/jest-dom';

describe('PageLoader', () => {
  it('should render with default message', () => {
    render(<PageLoader />);

    expect(screen.getByText('页面加载中...')).toBeInTheDocument();
  });

  it('should render with custom message', () => {
    render(<PageLoader message="Custom loading message" />);

    expect(screen.getByText('Custom loading message')).toBeInTheDocument();
  });

  it('should have correct styling classes', () => {
    render(<PageLoader />);

    const container = screen.getByText('页面加载中...').parentElement;
    expect(container).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center');
  });
});
