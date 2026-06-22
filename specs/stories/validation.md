# Modul: validation — Validierung & Zuweisung

> Quelle: Pflichtenheft §3.6 (FR-VAL-01…07), Technischer Anhang §3 (Trust/Status). Jira-Epic: KW-VAL.

## Ziel
Peer-Validierung von KOs mit konfigurierbarem Limit, Trust-Berechnung, Validation Board und
Zuweisungen inkl. Benachrichtigung.

## User Stories & Akzeptanzkriterien

### FR-VAL-01 · Peer-Bewertung (MUSS)
- [ ] **Gegeben** ✅/⚠️/❌ durch Berechtigte, **dann** ändern sich Status & Trust gemäß Formel (Anhang §3).

### FR-VAL-02 · Konfigurierbares Validierungs-Limit (MUSS)
- [ ] **Gegeben** *n* nötige Validierungen, **wenn** *n* grüne und 0 rote vorliegen, **dann** Status „validated".

### FR-VAL-03 · Board zeigt nur offene KOs (MUSS)
- [ ] **Gegeben** validierte KOs, **dann** erscheinen sie nicht im Board (aber in der Bibliothek).

### FR-VAL-04 · Board-Filter (MUSS)
- [ ] **Gegeben** Filter (Status, Volltext, Domäne, Kategorie, Tags, „Mir zugewiesen"), **dann** kombinierbar wirksam.

### FR-VAL-05 · Zuweisung (MUSS)
- [ ] **Gegeben** Zuweisung an ≥1 Person, **dann** In-App-Benachrichtigung + Badge; Bewertung setzt die Aufgabe auf erledigt.

### FR-VAL-06 · Zuweisungs-Status sichtbar (MUSS)
- [ ] **Gegeben** Analytics/Admin, **dann** pro Person offen/erledigt sichtbar.

### FR-VAL-07 · E-Mail/Push-Zustellung (SOLL)
- [ ] **Gegeben** eine Zuweisung, **dann** Benachrichtigung auch außerhalb der App.

## API / Schnittstellen (Entwurf)
`POST /api/kos/:id/rate` · `GET /api/validation/board` (Filter) · `POST /api/kos/:id/assign` · `GET /api/notifications`. Events `ko.validated`, `ko.assigned`.

## Datenmodell (Auszug)
`ratings(ko_id, user_id, verdict, created_at)` · `assignments(ko_id, user_id, status)` · Trust/Status am KO. Formeln: Technischer Anhang §3.

## Nicht-Ziele (v1)
Gewichtete Bewertungen nach Reputation (Roadmap), Gamification (ausdrücklich nicht erwünscht, §6).

## Offene Fragen
Benachrichtigungs-Provider (Pflichtenheft §7) · Trust-Formel-Parameter gegen Anhang §3 verifizieren.
