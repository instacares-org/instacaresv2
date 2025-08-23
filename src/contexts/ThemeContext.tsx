"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
});

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    // Remove the dark class immediately on mount to ensure clean state
    if (typeof window !== 'undefined') {
      document.documentElement.classList.remove('dark');
    }
    
    const savedTheme = localStorage.getItem('theme') as Theme;
    // Default to light theme instead of system preference for better control
    const initialTheme = savedTheme || 'light';
    
    setThemeState(initialTheme);
    setMounted(true);
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (typeof window !== 'undefined' && mounted) {
      const root = document.documentElement;
      
      // Ensure we always start fresh
      root.classList.remove('dark');
      
      if (theme === 'dark') {
        root.classList.add('dark');
      }
      
      // Save to localStorage
      localStorage.setItem('theme', theme);
      
      // Force a check to ensure the class is applied
      console.log('Theme state:', theme, 'HTML classes:', root.className);
    }
  }, [theme, mounted]);

  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return <div className="min-h-screen bg-white">{children}</div>;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;