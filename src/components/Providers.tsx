"use client";
import React, { useEffect } from "react";
import { Toaster } from "sonner";
import { useStore } from "@/store/useStore";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  const checkSession = useStore((state) => state.checkSession);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <Toaster position="top-right" richColors />
      {children}
    </ThemeProvider>
  );
}
