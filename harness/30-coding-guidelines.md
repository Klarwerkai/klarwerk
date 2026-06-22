# 30 — Coding-Guidelines

- **Sprache:** TypeScript, `strict: true`. Keine impliziten `any`.
- **Format/Lint:** Biome (`tools/lint`, `tools/format`). Keine manuellen Stil-Diskussionen — Biome entscheidet.
- **Module:** ein Verzeichnis je fachliches Modul unter `/services`. Öffentliche API nur über `index.ts` exportieren.
- **Fehlerbehandlung:** keine stillen Catches; Fehler typisiert weitergeben oder bewusst behandeln.
- **Naming:** sprechende Domänenbegriffe aus `/harness/10-domain-glossary.md`.
- **Secrets:** ausschließlich über Umgebungsvariablen (`.env`, niemals committen). `.env.example` pflegen.
- **Imports:** Abhängigkeitsrichtung gemäß `.dependency-cruiser.cjs`. Verstöße brechen den Build.
