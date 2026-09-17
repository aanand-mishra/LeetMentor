import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { settingsRepo, clearAllLocalData } from '../db';
import { ToastProvider } from '../context/ToastContext';

describe('Welcome and Quick Start Guide Banner', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await clearAllLocalData();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('renders welcome banner on HomePage for a fresh session without an API key', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Welcome to Leetcode DSA Tracker/i)).toBeInTheDocument();
    });

    // Verify key guide contents
    expect(screen.getByText(/Quick Start Guide/i)).toBeInTheDocument();
    expect(screen.getByText(/Free Gemini API Key/i)).toBeInTheDocument();
    expect(screen.getByText(/Languages & Models/i)).toBeInTheDocument();
    expect(screen.getByText(/Offline Data & Backups/i)).toBeInTheDocument();

    // Verify "Go to Settings" button
    const settingsLink = screen.getByRole('link', { name: /Go to Settings/i });
    expect(settingsLink).toBeInTheDocument();
    expect(settingsLink).toHaveAttribute('href', '/settings');
  });

  it('does not render banner if Gemini API key is already configured', async () => {
    await settingsRepo.update({ geminiApiKey: 'AIzaSyFakeKeyForTest12345' });

    render(
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      // Zero problems empty state should render, but NOT the welcome banner
      expect(screen.getByText(/Start tracking your Leetcode practice/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Welcome to Leetcode DSA Tracker/i)).not.toBeInTheDocument();
  });

  it('allows user to dismiss the banner, persisting dismissal in sessionStorage', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Welcome to Leetcode DSA Tracker/i)).toBeInTheDocument();
    });

    const dismissButton = screen.getByRole('button', { name: /Dismiss guide/i });
    await user.click(dismissButton);

    await waitFor(() => {
      expect(screen.queryByText(/Welcome to Leetcode DSA Tracker/i)).not.toBeInTheDocument();
    });

    expect(sessionStorage.getItem('dsa_welcome_banner_dismissed')).toBe('true');
  });

  it('re-displays banner after data deletion even if previously dismissed', async () => {
    // Dismiss banner in session
    sessionStorage.setItem('dsa_welcome_banner_dismissed', 'true');

    // Wiping data resets the dismissal flag and resets settings
    await clearAllLocalData();
    expect(sessionStorage.getItem('dsa_welcome_banner_dismissed')).toBeNull();

    render(
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Welcome to Leetcode DSA Tracker/i)).toBeInTheDocument();
    });
  });

  it('does not re-display banner if API key was saved and later cleared', async () => {
    // 1. User saves API key initially
    await settingsRepo.update({ geminiApiKey: 'AIzaSyInitialValidKey' });

    // 2. Later, user clears the API key
    await settingsRepo.update({ geminiApiKey: '' });

    render(
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Start tracking your Leetcode practice/i)).toBeInTheDocument();
    });

    // The banner should NOT re-appear
    expect(screen.queryByText(/Welcome to Leetcode DSA Tracker/i)).not.toBeInTheDocument();
  });
});
