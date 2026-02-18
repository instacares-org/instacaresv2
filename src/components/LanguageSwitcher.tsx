"use client";

import React, { useState, useRef, useEffect } from 'react';
import { GlobeAltIcon, ChevronDownIcon, CheckIcon } from '@heroicons/react/24/solid';
import { useLanguage, SUPPORTED_LOCALES, Locale } from '@/contexts/LanguageContext';

interface LanguageSwitcherProps {
  className?: string;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className = '' }) => {
  const { locale, setLocale, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get current locale config
  const currentLocale = SUPPORTED_LOCALES.find(l => l.code === locale) || SUPPORTED_LOCALES[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleSelectLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer group"
        aria-label={t('language.select')}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <GlobeAltIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors" />
        <span className="hidden sm:inline text-sm font-medium text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200">
          {currentLocale.code.toUpperCase()}
        </span>
        <ChevronDownIcon
          className={`hidden sm:block h-3.5 w-3.5 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
          role="listbox"
          aria-label={t('language.select')}
        >
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('language.select')}
            </p>
          </div>

          {SUPPORTED_LOCALES.map((localeOption) => (
            <button
              key={localeOption.code}
              onClick={() => handleSelectLocale(localeOption.code)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                locale === localeOption.code
                  ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
              role="option"
              aria-selected={locale === localeOption.code}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{localeOption.flag}</span>
                <div className="text-left">
                  <div className="font-medium">{localeOption.nativeName}</div>
                  {localeOption.name !== localeOption.nativeName && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {localeOption.name}
                    </div>
                  )}
                </div>
              </div>

              {locale === localeOption.code && (
                <CheckIcon className="h-4 w-4 text-rose-500 dark:text-rose-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
