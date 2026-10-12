# Modul: knowledge-object — Wissensobjekt & Wissensarten

> Quelle: Pflichtenheft §3.5 (FR-KO-01…04), Technischer Anhang §1. Jira-Epic: KW-KO.
> Zentrale Domänen-Entität (KO). Andere Module bauen darauf auf.

## Ziel
Versioniertes Wissensobjekt mit klarem Datenmodell, fünf Wissensarten, Kategorie/Tags und Historie.

## User Stories & Akzeptanzkriterien

### FR-KO-01 · Datenmodell (MUSS)
- [ ] **Gegeben** ein persistiertes KO, **dann** enthält es alle Pflichtfelder gemäß Anhang §1 (u. a. `version`, `history`, `originalAuthor`, `needed`, `assignments`, `asset`).

### FR-KO-02 · Fünf Wissensarten (MUSS)
- [ ] **Gegeben** ein KO, **dann** ist die Art aus {Bauchgefühl, Best Practice, Lernkurve, Technik, Negativwissen} setzbar und filterbar.

### FR-KO-03 · Kategorie & Tags (MUSS)
- [ ] **Gegeben** ein KO, **dann** sind freie Kategorie + #Tags setz- und nachträglich änderbar (in Bibliothek/Board).

### FR-KO-04 · Versionierung (MUSS)
- [ ] **Gegeben** eine Überarbeitung, **dann** erhöht sich die Version, Bewertungen werden zurückgesetzt, ein History-Eintrag entsteht.

## API / Schnittstellen (Entwurf)
`POST/GET/PATCH /api/kos` · `GET /api/kos/:id/history` · Statusfeld (offen/validiert) wird von `validation` gepflegt; Events `ko.created`, `ko.revised`.

### FR-KO-06 · Kommentare am Objekt (MUSS)
- [ ] **Gegeben** ein angemeldeter Nutzer, **wenn** er einen nicht-leeren Kommentar anfügt, **dann** wird `{id, author, text, at}` am KO gespeichert (leerer Text → 400).
- [ ] **Gegeben** ein KO mit Kommentaren, **wenn** es überarbeitet wird (`revise`), **dann** bleiben die Kommentare erhalten.
- Persistenz als Teil des KO-JSONB (keine separate Tabelle); Audit-Eintrag `ko.commented`. API: `PUT /api/kos/:id` mit `{action:"comment", text}`.

### FR-CAP-05 · Anhänge / Fotos am Objekt (MUSS, Pilot)
- [ ] **Gegeben** ein Bild, **wenn** es angehängt wird, **dann** wird es client-seitig auf ein Thumbnail (JPEG, max. ~1024px) verkleinert und als Daten-URL im KO-JSONB gespeichert; Größe (~700 KB) und Anzahl (max. 8) sind serverseitig begrenzt, nur `image/*` erlaubt.
- [ ] **Gegeben** ein Anhang, **dann** kann er entfernt werden; Audit `ko.attached` / `ko.detached`. API: `PUT /api/kos/:id` mit `{action:"attach", attachment}` bzw. `{action:"detach", attachmentId}`.
- **Stufe-2-Upgrade:** Voll-Bild/Dokument über Objektspeicher (S3) statt Daten-URL.

## Datenmodell (Auszug, Technischer Anhang §1)
`kos(id, title, statement, conditions, measures, type, category, tags[], confidence, trust, status, version, original_author, needed_validations, asset_ref, created_at)` + `ko_history`. Wissensart als Enum.

### Metadaten und Anlagenbezug (aufnahme:20260922:gesamt-wissen-metadaten)
- Beim Erfassen setzbar und am KO gespeichert: Wissensart, Kategorie, **Fachgebiet** (`domain`, eigene Angabe neben der Kategorie), Schlagwörter, **Anlage** (`asset`), nötige Validierungen (1–5, Standard 3) und die **Art der Aussage** (`aussageart`: `tatsache` | `handlungsanweisung`, optional). Fachgebiet und Aussageart reisen auch über Entwurf → Einreichen ins KO.
- Fachgebiet nachträglich änderbar (Leseansicht „Provenienz", `PUT /api/kos/:id {action:"domain"}`); Fachgebiet, Anlage und Wissensart sind Facetten der Bibliothek.
- **Kanonischer Anlagenbezug (JOB 593, Option A):** welche Anlage zu einem KO gehört, sagt allein `KnowledgeObject.asset` (Normalform `normalizeAsset`). Die Lebenszyklus-Kopplungen (`/api/lifecycle/couple`) sind nur die Liste für Änderungsmeldungen; sie nehmen nur sichtbare, existierende KOs und eine nicht leere, normalisierte Kennung an. Eine Kennung kann an mehreren KOs hängen.
- **Mehrere Anlagen je KO:** die Anlagen stehen am KO und werden über `anlagenVon` gelesen. Eine (oder keine) Anlage wird wie bisher nur in `asset` gespeichert — Einzelzuordnungen und Altbestand bleiben unverändert; ab zwei Anlagen trägt `assets` die Liste (Normalform, ohne Doppelte) und `asset` spiegelt die erste für Einzelleser (Konflikterkennung, Word-Add-in). Erfassen: ein Feld, mehrere Anlagen mit `;` getrennt (ein Semikolon in einer Kennung als `\;`, ein Backslash als `\\` — vorhandene Kennungen überstehen Öffnen und Speichern unverändert); eine mitgeschickte `assets`-Angabe, die keine Liste nicht leerer Texte ist, weist der Server mit 400 ab (`null` und `[]` löschen ausdrücklich); Ändern: Leseansicht „Kopplung und Anlagen" (über `revise`, `changes.assets`); Filter: Facette „Anlage" zählt ein KO unter jeder seiner Anlagen.
- **Matrix (R-0477):** Bibliothek → Menü „…" → „Anlagen-Matrix": Anlagen × Wissensobjekte über die aktuellen, sichtbaren Treffer.
- **Re-Validierungstermin (R-1690):** `revalidierungAm` (`JJJJ-MM-TT`) beim Erfassen, über Entwurf → Einreichen am KO gespeichert; ungültige Tage werden abgewiesen. Eine automatische Erinnerung zum Termin gibt es nicht.

## Nicht-Ziele (v1)
Import/Output-Felder (`source_type`, `validity_until` …) sind Konzept/Roadmap → Modul `extensions` (FR-EXT-07); dokumentiert in `specs/reference/Funktionsbeschreibung.md` §18.4.

## Offene Fragen
Konfliktfeld-Verknüpfung zu `conflicts` · Asset-Speicherung (Bilder/Dokumente) lokal vs. Objektspeicher.
