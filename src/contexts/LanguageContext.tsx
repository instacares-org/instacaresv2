"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

// Import translation files
import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';
import es from '@/i18n/locales/es.json';

export type Locale = 'en' | 'fr' | 'es';

export interface LocaleConfig {
  code: Locale;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LOCALES: LocaleConfig[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
];

type TranslationData = typeof en;

const translations: Record<Locale, TranslationData> = {
  en,
  fr,
  es,
};

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  locales: LocaleConfig[];
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
  locales: SUPPORTED_LOCALES,
});

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [mounted, setMounted] = useState(false);

  // Load language from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLocale = localStorage.getItem('locale') as Locale;

      // Check if saved locale is valid
      if (savedLocale && SUPPORTED_LOCALES.some(l => l.code === savedLocale)) {
        setLocaleState(savedLocale);
      } else {
        // Try to detect browser language
        const browserLang = navigator.language.split('-')[0] as Locale;
        if (SUPPORTED_LOCALES.some(l => l.code === browserLang)) {
          setLocaleState(browserLang);
        }
      }

      setMounted(true);
    }
  }, []);

  // Save language preference when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && mounted) {
      localStorage.setItem('locale', locale);
      // Update HTML lang attribute
      document.documentElement.lang = locale;
    }
  }, [locale, mounted]);

  const setLocale = useCallback((newLocale: Locale) => {
    if (SUPPORTED_LOCALES.some(l => l.code === newLocale)) {
      setLocaleState(newLocale);
    }
  }, []);

  // Translation function with nested key support and parameter interpolation
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = translations[locale];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Key not found, return the key itself
        console.warn(`Translation key not found: ${key} for locale: ${locale}`);
        return key;
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Translation value is not a string for key: ${key}`);
      return key;
    }

    // Handle parameter interpolation (e.g., {radius})
    if (params) {
      return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey]?.toString() || match;
      });
    }

    return value;
  }, [locale]);

  // Prevent hydration mismatch by showing children only after mount
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, locales: SUPPORTED_LOCALES }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;
