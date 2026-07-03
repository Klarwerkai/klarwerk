## [Cloud-Worker] SCRUM-428 — Key-Test für den lokalen LLM + Gate-Fix (03.07.2026, v0.9.41-beta)

### Gate-Fix (SCRUM-421-Batch)
Der v15-Lauf war rot: TS2322 in ko-routes.ts — ein benannter Typ (UploadLimits) ohne
Index-Signatur ist nicht direkt als Audit-`payload` (Record<string, unknown>) zuweisbar.
Behoben: Audit-Payload als Inline-Literal. (Merke: mein Cloud-Syntax-Sweep prüft nur
Syntax, keine Cross-Modul-Typen — solche TS2xxx fängt erst der Mac-Gate.)

### SCRUM-428 — lokalen LLM per Schlüssel-Test prüfen
Der Key-Test prüfte bisher nur die Cloud. Neu: zweiter Knopf „Lokalen LLM testen" (Admin → KI)
— echter Mini-Aufruf über den lokalen Provider (probe des secondary).
- Reasoner `probeLocal()`: nicht verdrahtet → ehrlicher Befund; erreichbar → „hat geantwortet";
  Tunnel/Server aus → der echte Fehler (nie geraten).
- Route POST /api/reasoner/test-local (users.manage); Guard-Matrix ergänzt.
- Admin-UI: zweiter Test-Knopf + ehrliche Ergebnis-Zeile.
- Test: tests/app/local-probe-e2e.test.ts (ohne LLM ehrlich nicht verbunden; Experte 403).

Damit wird „Verfügbare KIs" beim VIP von „bereit" auf ehrlich „geantwortet" — sobald der
Tunnel steht und der lokale LLM läuft.

**Version:** 0.9.40-beta → 0.9.41-beta (umfasst den 421/427-Batch + Gate-Fix + 428).
**Gates:** Paul-Runner v16 (Gesamtbestand).
