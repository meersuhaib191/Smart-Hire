"use client";
import React, { useEffect } from "react";
import { useStore } from "@/store/useStore";
import { Toaster } from "@/components/ui/sonner";
import { AppThemeProvider } from "@/theme/provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const checkSession = useStore((state) => state.checkSession);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <AppThemeProvider>
      <Toaster position="top-right" richColors />
      {children}
    </AppThemeProvider>
  );
}
