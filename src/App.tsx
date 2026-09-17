import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Header } from './components/layout/Header';
import { DataDurabilityBanner } from './components/layout/DataDurabilityBanner';
import { ShortcutsModal } from './components/common/ShortcutsModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

import HomePage from './pages/HomePage';
import AddProblemPage from './pages/AddProblemPage';
import ProblemDetailPage from './pages/ProblemDetailPage';
import EditProblemPage from './pages/EditProblemPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';

const AppContent: React.FC = () => {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useKeyboardShortcuts({
    onOpenShortcuts: () => setShortcutsOpen(true),
    onCloseModal: () => setShortcutsOpen(false),
    isModalOpen: shortcutsOpen,
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Header onOpenShortcuts={() => setShortcutsOpen(true)} />
      <DataDurabilityBanner />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/problem/new" element={<AddProblemPage />} />
          <Route path="/problem/:id" element={<ProblemDetailPage />} />
          <Route path="/problem/:id/edit" element={<EditProblemPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <ShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
