// src/context/ThemeContext.jsx
// Theme context — dark/light mode with AsyncStorage persistence

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme } from '../theme';

const THEME_KEY = '@ai_chat_theme_preference';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true); // Default to dark theme

  // Load saved preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((stored) => {
        if (stored !== null) {
          setIsDark(stored === 'dark');
        }
      })
      .catch(console.warn);
  }, []);

  const toggleTheme = useCallback(async () => {
    const next = !isDark;
    setIsDark(next);
    try {
      await AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    } catch (error) {
      console.warn('[Theme] Failed to save preference:', error);
    }
  }, [isDark]);

  const setTheme = useCallback(async (dark) => {
    setIsDark(dark);
    try {
      await AsyncStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    } catch (error) {
      console.warn('[Theme] Failed to save preference:', error);
    }
  }, []);

  const theme = isDark ? darkTheme : lightTheme;

  const value = {
    theme,
    isDark,
    toggleTheme,
    setTheme,
    colors: theme.colors,
    spacing: theme.spacing,
    typography: theme.typography,
    borderRadius: theme.borderRadius,
    shadows: theme.shadows,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return context;
}

export default ThemeContext;
