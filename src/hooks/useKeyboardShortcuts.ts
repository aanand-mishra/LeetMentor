import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface ShortcutOptions {
  onOpenShortcuts?: () => void;
  onCloseModal?: () => void;
  isModalOpen?: boolean;
}

export function useKeyboardShortcuts(options: ShortcutOptions = {}) {
  const navigate = useNavigate();

  useEffect(() => {
    let gPressed = false;
    let gTimeout: NodeJS.Timeout | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Esc always works, even in input (NFR-9)
      if (e.key === 'Escape') {
        if (options.onCloseModal) {
          options.onCloseModal();
        }
        return;
      }

      // Suppress all other shortcuts while text input has focus
      if (isInputFocused) {
        return;
      }

      // '?' — show shortcut list
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (options.onOpenShortcuts) {
          options.onOpenShortcuts();
        }
        return;
      }

      // '/' — focus search (FR-2.2, NFR-9)
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.focus();
        }
        return;
      }

      // 'n' — new problem
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        navigate('/problem/new');
        return;
      }

      // 'g h' — go home sequence
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        gPressed = true;
        if (gTimeout) clearTimeout(gTimeout);
        gTimeout = setTimeout(() => {
          gPressed = false;
        }, 1000);
        return;
      }

      if (e.key === 'h' && gPressed && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        gPressed = false;
        navigate('/');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gTimeout) clearTimeout(gTimeout);
    };
  }, [navigate, options]);
}
