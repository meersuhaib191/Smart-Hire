export const themeTokens = {
  colors: {
    background: "var(--background)",
    card: "var(--surface)",
    cardMuted: "var(--surface-muted)",
    border: "var(--border-color)",
    text: {
      primary: "var(--foreground)",
      secondary: "var(--text-muted)",
    },
    accent: "var(--ring)",
  },
  chart: {
    primary: "var(--chart-primary)",
    secondary: "var(--chart-secondary)",
    tertiary: "var(--chart-tertiary)",
    positive: "var(--chart-positive)",
    warning: "var(--chart-warning)",
    grid: "var(--chart-grid)",
    axis: "var(--chart-axis)",
    tooltipBg: "var(--chart-tooltip-bg)",
    tooltipText: "var(--chart-tooltip-text)",
  },
} as const;

export type ThemeTokens = typeof themeTokens;
