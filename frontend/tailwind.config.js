/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        danger: "hsl(var(--danger))",
      },
      fontFamily: {
        sans: ["Instrument Sans", "Inter", "system-ui", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"],
      },
      borderRadius: {
        lg: "0.75rem",
        xl: "1rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgb(15 23 42 / 0.04), 0 8px 24px -12px rgb(15 23 42 / 0.12)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out both",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
