import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  label: string;
  tags: string[];
  suggestions: readonly string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export const TagInput: React.FC<Props> = ({
  label,
  tags,
  suggestions,
  onChange,
  placeholder = 'Type and press Enter...',
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const availableSuggestions = suggestions.filter(
    (s) =>
      !tags.some((t) => t.toLowerCase() === s.toLowerCase()) &&
      s.toLowerCase().includes(inputValue.toLowerCase().trim())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    if (!tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, idx) => idx !== indexToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>

      <div className="min-h-[42px] p-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg flex flex-wrap gap-1.5 items-center focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-shadow">
        {tags.map((tag, idx) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(idx)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}

        <div className="relative flex-1 min-w-[140px]">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? placeholder : ''}
            className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-2 py-1 outline-none"
          />

          {isOpen && availableSuggestions.length > 0 && (
            <ul className="absolute left-0 top-full mt-1.5 w-64 max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg z-20 py-1 text-sm">
              {availableSuggestions.slice(0, 8).map((suggestion) => (
                <li
                  key={suggestion}
                  onClick={() => addTag(suggestion)}
                  className="px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-slate-700 cursor-pointer text-slate-700 dark:text-slate-200 transition-colors"
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
