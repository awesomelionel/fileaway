import type { Config } from "tailwindcss";

const config: Config = {
  /* System preference: dark: variants follow prefers-color-scheme */
  darkMode: "media",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        fa: {
          canvas: "var(--fa-canvas)",
          surface: "var(--fa-surface)",
          elevated: "var(--fa-elevated)",
          input: "var(--fa-input)",
          "muted-bg": "var(--fa-muted-bg)",
          chip: "var(--fa-chip)",
          border: "var(--fa-border)",
          "border-soft": "var(--fa-border-soft)",
          line: "var(--fa-line)",
          strong: "var(--fa-strong)",
          separator: "var(--fa-separator)",
          primary: "var(--fa-primary)",
          secondary: "var(--fa-secondary)",
          soft: "var(--fa-soft)",
          dim: "var(--fa-dim)",
          muted: "var(--fa-muted)",
          subtle: "var(--fa-subtle)",
          faint: "var(--fa-faint)",
          mid: "var(--fa-mid)",
          placeholder: "var(--fa-placeholder)",
          ring: "var(--fa-ring)",
          "logo-dim": "var(--fa-logo-dim)",
          "pill-active": "var(--fa-pill-active)",
          divider: "var(--fa-divider)",
          "btn-bg": "var(--fa-btn-bg)",
          "btn-fg": "var(--fa-btn-fg)",
          "btn-hover": "var(--fa-btn-hover)",
          "secondary-alt": "var(--fa-secondary-alt)",
          "icon-muted": "var(--fa-icon-muted)",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      boxShadow: {
        "fa-card": "var(--fa-shadow-card)",
      },
      backgroundColor: {
        "fa-count-active": "var(--fa-count-active-bg)",
      },
    },
  },
  plugins: [],
};
export default config;
