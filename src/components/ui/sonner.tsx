"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": theme === "dark" ? "rgba(15,23,42,0.94)" : "#ffffff",
          "--normal-text": theme === "dark" ? "#f8fafc" : "#111827",
          "--normal-border": theme === "dark" ? "rgba(51,65,85,0.9)" : "#e5e7eb",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
