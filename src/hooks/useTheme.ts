import { useState, useEffect, useCallback } from "react";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "soloboard-theme";
const THEME_CLASSES: ThemeMode[] = ["system", "light", "dark"];

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  // Strip all theme classes then apply the chosen one — synchronously
  THEME_CLASSES.forEach(cls => root.classList.remove(`theme-${cls}`));
  root.classList.add(`theme-${theme}`);
}

// Called immediately in <script> tag or on import to prevent FOUC
export function initTheme() {
  const stored = (localStorage.getItem(STORAGE_KEY) as ThemeMode) || "dark";
  applyTheme(stored);
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    return stored && THEME_CLASSES.includes(stored) ? stored : "dark";
  });

  // Synchronous setter: applies DOM class AND updates localStorage immediately,
  // then updates React state so the UI re-renders with the correct active indicator
  const setTheme = useCallback((next: ThemeMode) => {
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  // On mount: ensure DOM is aligned with stored preference
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemeMode) || "dark";
    applyTheme(stored);
    setThemeState(stored);
  }, []);

  return { theme, setTheme };
}
