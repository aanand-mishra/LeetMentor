import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

const BadComponent = () => {
  throw new Error('Test crash in route');
};

describe('NFR-8 — Error Handling & Boundary', () => {
  it('catches render errors, showing reload and export actions rather than a blank screen', () => {
    // Suppress console.error in test output for intentional throw
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BadComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/Test crash in route/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload Page/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export My Data/i })).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
