import type { Config } from "tailwindcss";

// Design-Tokens aus dem Hi-Fi-Handoff (BRIEF.md §3). Farb-Disziplin:
// brand = Marke/Auswahl · trust = nur Reife/Status · ai = nur Reasoner/KI.
//
// AUFTRAG-mega40 BLOCK A: die WERTE wohnen nicht mehr hier, sondern als CSS Custom Properties in
// src/styles/themes.css — der EINEN Token-Datei für beide Themes (klassisch = :root, unverändert
// die bisherigen Hex-Werte; modern = [data-theme="modern"]). Die rgb(var(…) / <alpha-value>)-Form
// erhält die Alpha-Modifier (border-ink/30, border-ai/50, …); die berechneten Werte im Standard
// bleiben exakt die alten (Pin: tests/app/mega40-theme-invarianz.test.ts, dort auch die
// Kalibrierung). Kontrast-Pins der klassischen Werte: tests/app/contrast-tokens-d5.test.ts.
function token(name: string): string {
  return `rgb(var(--kw-${name}) / <alpha-value>)`;
}

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: token("page"),
        surface: token("surface"),
        ink: token("ink"),
        text: { DEFAULT: token("text"), soft: token("text-soft") },
        // E2E-014: sekundäres Muted abgedunkelt (≥4,5:1) — Wert s. themes.css --kw-muted-2.
        muted: { DEFAULT: token("muted"), 2: token("muted-2") },
        hairline: { DEFAULT: token("hairline"), soft: token("hairline-soft") },
        // brand.DEFAULT bleibt Marke/Fläche (Knöpfe); brand.text ist das abgedunkelte Text-Token
        // (≥4,5:1) für Link-/Metatexte („Alle Aufgaben →") — Werte s. themes.css.
        brand: { DEFAULT: token("brand"), 300: token("brand-300"), text: token("brand-text") },
        trust: {
          "pos-text": token("trust-pos-text"),
          "pos-fill": token("trust-pos-fill"),
          "pos-bg": token("trust-pos-bg"),
          "warn-text": token("trust-warn-text"),
          "warn-fill": token("trust-warn-fill"),
          "warn-bg": token("trust-warn-bg"),
          "crit-text": token("trust-crit-text"),
          "crit-fill": token("trust-crit-fill"),
          "crit-bg": token("trust-crit-bg"),
          "info-text": token("trust-info-text"),
          "info-bg": token("trust-info-bg"),
        },
        ai: {
          DEFAULT: token("ai"),
          light: token("ai-light"),
          "surface-1": token("ai-surface-1"),
          "surface-2": token("ai-surface-2"),
          dashed: token("ai-dashed"),
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
        popover: "var(--kw-shadow-popover)",
        tile: "var(--kw-shadow-tile)",
      },
      fontSize: {
        micro: ["10.5px", { lineHeight: "1.2", letterSpacing: "0.5px" }],
      },
    },
  },
  plugins: [],
} satisfies Config;
