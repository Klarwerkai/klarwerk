## [Cloud-Worker] SCRUM-429 + 432 — Onboarding-Politur + Vertrauen & Sicherheit (03.07.2026, v0.9.44-beta)

Das VIP-Bündel: ein ruhiger Erstlauf für den neuen Admin (der VIP macht die Erstanmeldung) und
ein investoren-tauglicher Vertrauens-/Sicherheits-Auszug. Reines Frontend — Browser-Reload genügt.

### SCRUM-429 — Erststart-Führung für den neuen Admin
Auf der Startseite erscheint für Admins **nur beim ersten Besuch** eine ruhige Karte
(`AdminFirstRunCard`), bewusst ausblendbar (localStorage-Merker, Muster wie `startOrientation`):
- Ehrlicher KI-Status aus der echten Config: „Beide KIs verbunden: Cloud-KI und dein eigener
  lokaler LLM." — mit klaren Teilzuständen (nur Cloud / nur lokal / keine), nie geraten.
- Drei geführte erste Schritte als echte Deep-Links: Wissen erfassen · Wissen prüfen ·
  Verwaltung öffnen. Kein Zwang, keine Reihenfolge.
- Ausgeblendet bleibt ausgeblendet (kein Wiederauftauchen).

### SCRUM-432 — Vertrauen & Sicherheit (Investoren-Auszug)
Neuer Admin-Bereich **„Sicherheit"** (vierter Reiter neben Konten · KI · Daten):
- **Prüfprotokoll — manipulationssicher:** die vorhandene, hash-verkettete, append-only
  Audit-Kette sichtbar gemacht (letzte 12 Aktionen + Gesamtzahl der Kette). Ehrliche Aussage:
  nachträglich lässt sich nichts ändern/löschen, ohne dass die Kette bricht (tamper-evident).
  Nutzt die bestehende `GET /api/audit` — kein neuer Endpunkt, kein Backend-Neustart nötig.
- **Datenschutz & Sicherheit:** sieben echte Systemeigenschaften (keine Versprechen) — Schlüssel
  im Schlüsselbund/serverseitig, eigener/lokaler LLM nur über privaten Tunnel, externe
  Wissensabfrage standardmäßig eingeschränkt, manipulationssicheres Protokoll, Papierkorb mit
  verzögerter Endlöschung, Rollen & minimale Rechte, keine Kundendaten in Tests.

### Neu/Geändert
- `apps/web/src/components/AdminFirstRunCard.tsx` (neu) — Erststart-Karte.
- `apps/web/src/lib/adminFirstRun.ts` (neu) — DOM-freie Persistenz + KI-Zustand (testbar).
- `apps/web/src/lib/securityStatements.ts` (neu) — die 7 Sicherheits-Aussagen (i18n-Schlüssel).
- `apps/web/src/pages/Start.tsx` — Karte für Admins eingehängt.
- `apps/web/src/pages/Admin.tsx` — Bereich „Sicherheit" (Prüfprotokoll + Datenschutz-Auszug).
- `apps/web/src/lib/adminSections.ts` — vierter Bereich „sicherheit".
- `apps/web/src/i18n.ts` — alle neuen Schlüssel in DE **und** EN.
- Tests: `tests/app/admin-first-run.test.ts`, `tests/app/security-statements.test.ts` (neu);
  `tests/app/admin-sections.test.ts` auf 4 Bereiche aktualisiert.
- `apps/web/src/version.ts` — 0.9.43 → 0.9.44-beta.

**Version:** 0.9.43-beta → 0.9.44-beta (reines Frontend — Browser-Reload genügt).
**Gates:** Paul-Runner v20 (Gesamtbestand).
