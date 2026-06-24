import type { Config } from "tailwindcss";

// Design-Tokens aus dem Hi-Fi-Handoff (BRIEF.md §3). Farb-Disziplin:
// brand = Marke/Auswahl · trust = nur Reife/Status · ai = nur Reasoner/KI.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "#f3f4f6",
        surface: "#ffffff",
        ink: "#16222c",
        text: { DEFAULT: "#1b1e21", soft: "#23272b" },
        muted: { DEFAULT: "#687078", 2: "#8a929a" },
        hairline: { DEFAULT: "#e4e7ea", soft: "#f0f1f3" },
        brand: { DEFAULT: "#ED7D0E", 300: "#f5a04a" },
        trust: {
          "pos-text": "#256b46",
          "pos-fill": "#3aa06a",
          "pos-bg": "#e2f1e8",
          "warn-text": "#9a6a12",
          "warn-fill": "#c8861a",
          "warn-bg": "#faf1db",
          "crit-text": "#9e352e",
          "crit-fill": "#c0473f",
          "crit-bg": "#f8e7e5",
          "info-text": "#1c5d70",
          "info-bg": "#e4eef1",
        },
        ai: {
          DEFAULT: "#5b50c4",
          light: "#9d93f0",
          "surface-1": "#ecebfb",
          "surface-2": "#f6f4fd",
          dashed: "#b9b2ec",
        },
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "13px",
        btn: "9px",
        input: "9px",
        pill: "6px",
        nav: "10px",
      },
      boxShadow: {
        popover: "0 14px 40px rgba(16,24,32,.16)",
        tile: "0 1px 3px rgba(16,24,32,.14)",
      },
      fontSize: {
        micro: ["10.5px", { lineHeight: "1.2", letterSpacing: "0.5px" }],
      },
    },
  },
  plugins: [],
} satisfies Config;
