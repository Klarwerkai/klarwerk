# Modul: library-analytics — Bibliothek, Risiko, Graph, Analytics, Audit

> Quelle: Pflichtenheft §3.9 (FR-LIB/ANA/AUD), NFR-TAI-01. Jira-Epic: KW-LIB.

## Ziel
Wissen durchsuchen/exportieren, Risiken und Lücken sichtbar machen, Kennzahlen aggregieren und
ein manipulationssicheres Audit führen.

## User Stories & Akzeptanzkriterien

### FR-LIB-01 · Bibliothek mit Suche & Filtern (MUSS)
- [ ] **Gegeben** Suche/KI-Suche + Filter (Domäne/Status/Kategorie/Tags), **dann** korrekte Treffer.

### FR-LIB-02 · Export/Import (MUSS)
- [ ] **Gegeben** Auswahl, **dann** Export als JSON/MediaWiki/PDF; **und** JSON-Import merged ohne Duplikate.

### FR-LIB-03 · Risiko & Bus-Faktor (SOLL)
- [ ] **Gegeben** Domänen mit Einzelquelle, **dann** zeigt die Bus-Faktor-Ansicht diese.

### FR-LIB-04 · Wissensgraph (SOLL)
- [ ] **Gegeben** Relationen, **dann** stellt der Graph sie dar.

### FR-ANA-01 · Analytics (MUSS)
- [ ] **Gegeben** Bestände, **dann** korrekt aggregiert nach Status/Art, Validierungs-Aufgaben pro Person, Kategorie-Verteilung.

### FR-ANA-02 · Wirkungs-Dashboard (SOLL)
- [ ] **Gegeben** Zeitverlauf, **dann** validierte Objekte/Woche und Antwortquote ohne Lücke sichtbar.

### FR-AUD-01 · Audit-Log (MUSS, NFR-TAI-01)
- [ ] **Gegeben** relevante Aktionen, **dann** lückenloser Eintrag (wer/was/wann) gemäß Funktionsbeschreibung §12.3.

### FR-AUD-02 · Append-only (MUSS)
- [ ] **Gegeben** ein Audit-Eintrag, **dann** nicht änder-/löschbar (Manipulation unmöglich).

## API / Schnittstellen (Entwurf)
`GET /api/library` (Suche/Filter) · `POST /api/export`, `POST /api/import` · `GET /api/analytics` · `GET /api/audit` (read-only). Audit zentral, append-only.

## Datenmodell (Auszug)
`audit(id, actor, action, target, payload, created_at)` — append-only. Graph aus KO-Relationen abgeleitet.

## Nicht-Ziele (v1)
Erweiterte BI/Drittanbieter-Dashboards (Out of Scope §6).

## Offene Fragen
PDF-Renderer · Append-only technisch erzwingen (DB-Trigger/Hash-Kette) · Graph-Bibliothek.
