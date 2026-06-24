# @klarwerk/web — Frontend (Control Room)

Produktive Web-App für KLARWERK, gebaut gegen den Hi-Fi-Design-Handoff
(`../../UI:UX/design_handoff_klarwerk_frontend/`) und die Anforderungsbeschreibung
(`../../Frontend-Anforderungsbeschreibung.md`). Spricht die vorhandenen Modul-APIs
des Backends an (`../../services`).

## Stack
React + TypeScript + Vite · React Router · TanStack Query · react-i18next (DE/EN) ·
Tailwind (Design-Tokens aus `BRIEF.md` §3). Fonts self-hosted (kein externes CDN).

## Befehle
```bash
npm install        # einmalig
npm run dev        # Dev-Server (http://localhost:5173), /api → Backend (VITE_API_TARGET)
npm run build      # Produktions-Build
npm run typecheck  # Typprüfung
```

## Schutz / Sichtbarkeit
- **Kein Suchmaschinen-Index:** `public/robots.txt` (alles gesperrt) + `noindex`-Meta in `index.html`.
  Zusätzlich am Server `X-Robots-Tag: noindex` setzen (siehe `../../docs/operations/pre-launch-protection.md`).
- **Vorab-Zugangsschutz:** HTTP Basic Auth auf Proxy-Ebene (Coolify/Traefik), **nicht** im Frontend-Bundle.
  Siehe `../../docs/operations/pre-launch-protection.md`.
- **App-Login:** Die Anwendung selbst ist vollständig auth-/rollengeschützt (Backend-Auth).

## Architektur-Hinweis
Eigenständige SPA außerhalb von `services/` — die `dependency-cruiser`-Regeln des
modularen Monolithen gelten nur für `services` und bleiben unberührt.
