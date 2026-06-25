# Modul: capture — Erfassung

> Quelle: Pflichtenheft §3.3 (FR-CAP-01…09). Jira-Epic: KW-CAP.

## Ziel
Wissen flexibel erfassen — Freitext, geführtes Formular, Diktat, KI-Interview — mit Anhängen,
gemeinsamem Entwurfs-Pool und Metadaten.

## User Stories & Akzeptanzkriterien

### FR-CAP-01 · Vier Erfassungsmodi (MUSS)
- [ ] **Gegeben** Freitext / Formular / Diktat / KI-Interview, **dann** entsteht jeweils strukturierbarer Input.

### FR-CAP-02 · KI-Interview als „Redakteur" (MUSS)
- [ ] **Gegeben** ein Interview, **dann** eine Frage pro Schritt; nach ~4–5 Antworten liegt ein KO vor.

### FR-CAP-03 · Live-Diktat (MUSS)
- [ ] **Gegeben** Diktat, **dann** erscheint Text live; **und** iOS friert nicht ein (Fallback Tastatur-Mikro).

### FR-CAP-04 · Fotoanhang (MUSS)
- [ ] **Gegeben** Kamera **oder** Mediathek, **dann** Anhang wählbar; Thumbnails entfernbar.

### FR-CAP-05 · Dokumentanhang + OCR (SOLL)
- [x] **Gegeben** txt/md/csv/json/log, **dann** wird der Klartext client-seitig in Rohtext/Strukturierung übernommen (`readTextFile`).
- [x] **Gegeben** eine .docx, **dann** wird der Text client-seitig per `mammoth` (lazy) extrahiert und übernommen (`extractDocxText`/`readDocxFile`; Test `tests/capture/docx-extract.test.ts`).
- [ ] **Offen (eigenes Restticket):** PDF-Textextraktion — `pdfjs-dist@6` verlangt Node ≥22 (Konflikt zu Node ≥20) und ist nicht build-verifiziert; bei Umsetzung auf eine Node-20-kompatible Version pinnen.
- [ ] **Offen (eigenes Restticket):** Bild-OCR — nur mit lazy geladener, performanter und testbarer Lösung (z. B. tesseract.js als separater Worker).
- Hinweis: altes Binärformat `.doc` wird von `mammoth` nicht unterstützt; nur `.docx`.

### FR-CAP-06 · Gemeinsamer Entwurfs-Pool (MUSS)
- [ ] **Gegeben** ein geparkter Entwurf, **dann** für alle Schreibberechtigten sichtbar und fortsetzbar (mit Autoranzeige).

### FR-CAP-07 · Originalautor bleibt erhalten (MUSS)
- [ ] **Gegeben** ein fortgesetzter Entwurf, **dann** trägt das KO den Entwurfs-Autor, nicht den Bearbeiter.

### FR-CAP-08 · Metadaten bei Erstellung (MUSS)
- [ ] **Gegeben** Erstellung, **dann** Domäne, Kategorie, Tags und nötige Validierungen (1–5, Standard 3) werden gesetzt und am KO gespeichert.

### FR-CAP-09 · Offline-Warteschlange mobil (KANN)
- [ ] **Gegeben** mobil ohne Netz erfasste Entwürfe, **dann** Sync bei Wiederverbindung.

## API / Schnittstellen (Entwurf)
`POST /api/drafts` · `GET /api/drafts` (Pool) · `POST /api/drafts/:id/continue` · `POST /api/capture/interview` (→ reasoner) · `POST /api/capture/ocr`.

## Datenmodell (Auszug)
`drafts(id, payload, original_author, created_at)` · Anhänge als `asset`-Refs. Metadaten am späteren KO.

## Nicht-Ziele (v1)
Echtzeit-Kollaboration am selben Entwurf (gleichzeitiges Editieren).

## Offene Fragen
Umfang Offline-Queue (Pflichtenheft §7) · OCR-Provider lokal vs. Cloud (Datenschutz NFR-PRV).
