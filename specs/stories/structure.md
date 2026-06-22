# Modul: structure — Strukturierung & Editor

> Quelle: Pflichtenheft §3.4 (FR-STR-01…06). Jira-Epic: KW-STR.

## Ziel
Roh-Input über den Reasoner zu einem strukturierten KO formen und in einem WYSIWYG-Editor
verlustfrei bearbeiten, bis es eingereicht wird.

## User Stories & Akzeptanzkriterien

### FR-STR-01 · Strukturierung durch Reasoner (MUSS)
- [ ] **Gegeben** Roh-Input, **dann** liefert der Reasoner ein KO mit Titel-als-Aussage, Aussage, Bedingungen, Maßnahmen, Tags, Konfidenz, Wissensart.

### FR-STR-02 · WYSIWYG-Editor (MUSS)
- [ ] **Gegeben** der Editor, **dann** sind Überschriften, Listen, Hervorhebung, Panels, Links, Bilder, Datei-Anhänge erzeugbar; Ergebnis als HTML gespeichert.

### FR-STR-03 · Bilder frei platzieren (SOLL)
- [ ] **Gegeben** ein angehängtes Bild, **dann** an Cursorposition einfügbar (Palette/Drag&Drop).

### FR-STR-04 · KI-Schreibhilfe (SOLL)
- [ ] **Gegeben** Aktionen (klarer, strukturieren, erweitern, Rechtschreibung), **dann** Vorschlag mit Übernehmen/Einfügen.

### FR-STR-05 · Vorschau/Bearbeiten ohne Verlust (MUSS)
- [ ] **Gegeben** Wechsel Vorschau↔Bearbeiten, **dann** bleiben alle Edits inkl. Bilder erhalten.

### FR-STR-06 · Einreichen (MUSS)
- [ ] **Gegeben** Einreichen, **dann** entsteht ein KO im Status „offen" und der verbundene Entwurf wird entfernt.

## API / Schnittstellen (Entwurf)
`POST /api/structure` (→ reasoner) · `POST /api/kos` (Einreichen) · Schreibhilfe `POST /api/structure/assist`.

## Datenmodell (Auszug)
KO-Inhalt als sanitisiertes HTML (XSS-Schutz, NFR-SEC-04). Bild-Refs im HTML zeigen auf `asset`-Store.

## Nicht-Ziele (v1)
Versionsdiff im Editor, kollaboratives Live-Editing.

## Offene Fragen
HTML-Sanitizing-Policy (erlaubte Tags) · Editor-Bibliothek.
