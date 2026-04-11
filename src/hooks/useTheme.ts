"use client";

import { useTheme as useNextTheme } from "next-themes";

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
  };
}
