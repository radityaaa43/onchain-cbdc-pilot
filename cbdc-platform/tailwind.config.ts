import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
        heading: ["var(--font-sans)", "sans-serif"],
      },
      colors: {
        positive: "hsl(var(--positive))",
        warning: "hsl(var(--warning))",
      },
    },
  },
};

export default config;
