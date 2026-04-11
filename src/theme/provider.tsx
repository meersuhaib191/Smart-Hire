"use client";

import React from "react";
import { ThemeProvider } from "next-themes";

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="smarthire-theme"
    >
      {children}
    </ThemeProvider>
  );
}
