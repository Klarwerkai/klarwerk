# Beta RC Runtime Start Path & Build Evidence v0

- **Status:** `evidence_delivered`
- **Team:** Team 1 / KLARWERK Produktkern
- **Jira-Bezug:** SCRUM-380 — löst den KREL-33-P1-Blocker „RC-genaue Frontend-Runtime/Build-Evidence"
- **RC-Kandidat:** `main@1e662e9` (SCRUM-377) · Handoff `c0863c6` (SCRUM-378)
- **Erstellt:** 2026-07-02

---

## 1. RC-Genauigkeit des Quellstands

Verifiziert per `git diff --stat 1e662e9..HEAD -- apps/web services` → **leer**.
Alle Commits nach dem RC (c0863c6, 35e11ec, bc423cb) sind reine Doku (`docs/`). Der hier gebaute
Frontend-/Backend-Quellstand ist damit **bit-identisch zum RC-Kandidaten** `1e662e9`.

## 2. Build-Evidence (Frontend `apps/web`)

| Feld | Wert |
|---|---|
| Befehl | `npm ci && npm run build` (in `apps/web/`) |
| Ergebnis | ✅ grün, `vite build` in 3,3 s |
| Dateien in `dist/` | 94 |
| **Gesamt-Hash** (sha256 über sortierte Datei-Hashes) | `d4f6196e4cbc234f82992df853380b5c9acf9d3f3911eaee6906312ed74f7518` |
| `index.html` | `6722545429d69f6bc0601f807583e0446f8755447762e349afb44594f622dc7b` |
| `assets/index-CZenRkKk.js` | `096447816cfdb1a041b7d564cb70727149e739ee06a3a02ae5b11089f9c57ac7` |
| `assets/index-DUALDSus.js` | `3768f06bce4055959d3db3116b835274d399cfc74461b59fccd4904ab7dad9d9` |
| `assets/index-e8fAImxd.js` | `8c89612da2f57c77bdcc10544d3cac4bfa85a0c1f4e785f4727e9f0dd47fedab` |
| Größe | 5,1 MB (inkl. pdf.worker 2,3 MB) |
| Build-Umgebung | Linux-Sandbox, Node v22.22.3, npm 10.9.8 |

**Reproduktion (Team 5):** identische Befehle; Vite-Content-Hashes in den Dateinamen
(`index-CZenRkKk.js` …) müssen übereinstimmen — sie hängen nur vom Quellinhalt ab.
Hash-Prüfung: `cd apps/web/dist && find . -type f -exec sha256sum {} \; | sort -k2 | sha256sum`.

## 3. Runtime Start Path (verifiziert)

```bash
# Backend (In-Memory, frische Instanz):
PORT=3001 npm start
# Frontend statisch: das Backend liefert apps/web/dist selbst aus (configureWebDelivery)
#   -> ein Prozess, eine Origin. Alternativ Dev-Modus:
VITE_API_TARGET=http://localhost:3001 npm --prefix apps/web run dev
```

Verifizierte Antworten (Sandbox, 01.07.2026): `GET /health` → `{"status":"ok"}` (200) ·
SPA-Fallback `/` → 200. Demo-Daten: `npm run seed:demo` (In-Memory bzw. `DATABASE_URL` für Postgres).

## 4. Browser-Smoke (Bezug SCRUM-381)

Playwright ist ab SCRUM-381 devDependency; Ablauf siehe `scripts/smoke-browser.mjs`
(Backend :3001 + FE-Dev :5173 → `npm run smoke:browser`). Erstinstallation des Browsers einmalig:
`npx playwright install chromium`.

## 5. Ehrliche Grenzen

- Build-Evidence stammt aus der Linux-Sandbox (Node 22). Auf macOS/CI können npm-Plattform-Pakete
  abweichen, die **Vite-Output-Hashes bleiben inhaltsgleich** — Abweichung der Gesamt-Hashes wäre ein Befund.
- `test:integration` (Testcontainers/Postgres) ist nicht Teil dieser Evidence (separates Gate).
- Kein Deployment, kein Beta-Go — reine Nachweis-Lieferung an Team 5 für den Re-Smoke (KREL-34).
