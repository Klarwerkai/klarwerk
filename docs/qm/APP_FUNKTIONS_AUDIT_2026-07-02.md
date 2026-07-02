# App-Funktions-Audit — 2026-07-02 (Pedi-Auftrag: „gehe durch die gesamte App")

Methode: vollständiges Inventar FE-Routen/Seiten (routes.tsx + navigation.ts), Abgleich aller
64 Frontend-API-Aufrufe (api/endpoints.ts + api/auth.ts) gegen die 80 Backend-Routen
(tests/security/routeGuardAudit.ts = erzwungene Vollständigkeitsmatrix), statische Suche nach
unverdrahteten Buttons/Platzhaltern, Logik-Stichproben je Seite. Laufzeit-Evidenz: 1235 Tests /
205 Dateien grün (inkl. Workflow-, Guard- und Contract-Tests). Stand: v0.9.6-beta.

## 1. Ergebnis in einem Satz

Die App ist funktional geschlossen: **alle 18 Seiten sind echte Seiten** (PlaceholderPage wird von
keiner Route mehr getroffen — die 4 „Placeholder-Kandidaten" sind Sidebar-Gruppenüberschriften),
**kein einziger Button ohne hinterlegte Funktion** (statische Prüfung; 3 Treffer waren
Link-Wrapper bzw. die Button-Basiskomponente), und alle Kernflüsse sind Ende-zu-Ende verdrahtet.

## 2. Seiten-Status (alle geprüft)

| Seite | Funktion & Verdrahtung |
|---|---|
| Start | Wissenskreis, Orientierung (einklappbar), Missionen, Arbeitsübersicht aus echten Signalen (Board/Konflikte/Revalidierung/Lücken/Lernpfad), KPIs ✓ |
| Meine Aufgaben | aggregierte echte Aufgaben + Lernpfad-Fortschritt (complete-Mutation) ✓ |
| Wissen erfassen | Wizard v0.9.6: Erzählen (Freitext/Diktat/Interview/Upload) → Wissensseite (ARGUS-Editor, ✨KI) → Einreichen; Entwürfe-Pool, Verwerfen, Gap-Kontext, OCR, Video-Transkription ✓ |
| Fragen (Ask) | quellengebundene Antwort, „hat geholfen" (Wirkungs-Rückmeldung SCRUM-383), ehrliche Lücke → Erfassen-Handoff ✓ |
| Bibliothek | Suche/Filter, Export (JSON/Markdown/MediaWiki/HTML), Re-Import-Link ✓ |
| Externes Wissen | Suche über external/search mit ehrlicher Quellen-Kennzeichnung ✓ |
| Validierung | Board, Freigabe/Ablehnung mit Feedback, Zweitprüfer-Zuweisung ✓ |
| Konflikte | Liste/Detail, Eskalation, Zweitmeinung ✓ |
| Risiko & Lücken | Gaps zuweisen/schließen/löschen, Bus-Faktor ✓ |
| Lebenszyklus | Anlagenänderung → Revalidierungs-Pipeline (asset-changed, pending) ✓ |
| Analytics & Audit | Kennzahlen, Impact, Audit-Log (read-only, korrekt ohne Buttons) ✓ |
| Admin | Nutzer anlegen/ändern/löschen/freigeben/Reset, Demo-Seed ✓ |
| Stufe 2: Output / Import / Graph / Kapital | Output Factory (generate+sources), Import-Kandidaten-Review, Wissensgraph, Kapital-Sichten ✓ |
| KO-Detail | Bearbeiten (Studio), Versionen, Evidence, Status-Aktionen, Kommentar-/Feedback-Fluss ✓ |
| Profil | Passwort ändern (auth/password) ✓ · Hilfe ✓ · Mobile/PWA-Vorschau ✓ · UI-Kit (Dev) ✓ |
| Login-Gate | Login/Registrieren/Warten/Ersteinrichtung/Passwort-vergessen ✓ |
| Global | Topbar-Suche + Command-Palette (⌘K), Glocke (notifications inkl. Wirkungs-Feed), Reasoner-Status, DE/EN, Versions-Chip ✓ |

## 3. Befunde (Backend kann es schon — Frontend fehlt)

| # | Backend-Route (ungenutzt) | Bedeutung / Vorschlag |
|---|---|---|
| B1 | `POST /api/lifecycle/couple` | Anlage↔KO **koppeln** geht nur implizit. Vorschlag: im KO-Detail „Mit Anlage koppeln" (Voraussetzung für präzise Revalidierung — Konzept §5 Re-Validierung). |
| B2 | `POST /api/learning-paths` | Lernpfade können nicht in der UI angelegt werden. Vorschlag: Admin-Karte „Lernpfad anlegen" (Onboarding-Motor). |
| B3 | `POST /api/library/import` | Direkter Bulk-Import (JSON) nur per API. Vorschlag: Admin/Import-Seite um „Datei-Import (JSON)" ergänzen — passt zu PMO-FEA-0006. |
| B4 | `GET /api/i18n/locales` + `/:locale/:key` | Server-seitige Übersetzungsverwaltung ungenutzt — **der natürliche Unterbau für PMO-FEA-0007** (In-Place-Übersetzung) und den DE/EN-Ausbau. |
| B5 | `GET /api/ai-status` | Alt-Route, redundant zu `/api/reasoner/status`. Vorschlag: deprecaten (Aufräumen, kein Nutzerwert). |
| B6 | `DELETE /api/auth/users/:id` | redundant zu `DELETE /api/users/:id` (FE nutzt letzteres). Konsolidieren. |

Keine FE-Aufrufe ins Leere (jeder Frontend-Call hat eine Backend-Route). Guard-Matrix deckt
alle 80 Routen ab (Test erzwingt Vollständigkeit — neuer Endpunkt ohne Guard-Eintrag bricht CI).

## 4. Mitgedacht: Was fehlt für das Konzept-Zielbild (Vorschläge, priorisiert)

**P1 — vor der Beta sinnvoll**
1. **Echte Persistenz auch im Server-Betrieb prüfen** (lokal via SCRUM-387 gelöst; Hetzner-Ziel: DATABASE_URL-Pfad ist da — beim Server-Gang einmal Migrations-/Backup-Drill).
2. **Playwright-Smoke (SCRUM-381 entscheiden):** 1235 Tests decken Logik, aber kein einziger
   Test klickt die UI. Ein 10-Routen-Smoke hätte die Weiß-Seite und Misch-Builds von heute
   automatisch gefangen. Klare Empfehlung: JA, minimal (Login → Erfassen → Einreichen → Ask).
3. **Anlagen-Kopplung (B1)** — sonst bleibt die Revalidierungs-Kette stumpf.
4. **Benachrichtigungen „gelesen":** die Glocke aggregiert, kennt aber keinen Gelesen-Status;
   bei realer Nutzung nervt das schnell (kleines Backend-Feld + FE-Haken).

**P2 — Adoption & Schurzfeld-Richtung**
5. **Live-Wall** („frisch gesichert / hat heute geholfen") als Start-Karte oder Beamer-Ansicht —
   Pedi/Schurzfeld-Punkt, Backend-Daten (evidence, helpful) existieren schon.
6. **Wissens-Update-Ritual:** wiederkehrender „Frische-Check" (z. B. monatlich 3 älteste
   validierte KOs je Experte zur Bestätigung) — nutzt lifecycle/pending-Mechanik.
7. **KI-Presets kundenkonfigurierbar (SCRUM-386):** Palette ist seit Runde 3 datengetrieben
   (ASSIST_ACTIONS) — der Schritt zu Admin-konfigurierbaren Presets ist jetzt klein.
8. **In-Place-Übersetzung (PMO-FEA-0007)** auf i18n-Routen (B4) + Reasoner aufsetzen.

**P3 — später**
9. Lernpfad-Editor (B2), Bulk-Import-UI (B3), PWA offline-Erfassung (Roadmap), 
   Alt-Routen-Aufräumen (B5/B6), Graph-Ansicht: Kopplungs-Kanten aus B1 mitzeichnen.

## 5. Ehrliche Grenzen dieses Audits

Statische + Test-Evidenz, keine manuelle Klick-Probe jeder einzelnen Seite im Browser (das
deckt erst Playwright ab — Punkt 2). Reasoner-Echtbetrieb hängt am Anthropic-Key (heute im
PMO als ungültig aufgefallen — bitte auch den App-Eintrag „KLARWERK-App-Anthropic" erneuern,
sonst arbeitet die App im deterministischen Modus).
