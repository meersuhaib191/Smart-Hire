"use client";
import React, { useEffect } from "react";
import { Toaster } from "sonner";
import { useStore } from "@/store/useStore";

export function Providers({ children }: { children: React.ReactNode }) {
  const checkSession = useStore((state) => state.checkSession);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <>
      <Toaster position="top-right" richColors />
      {children}
    </>
  );
}
