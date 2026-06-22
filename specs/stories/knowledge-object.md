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

## Datenmodell (Auszug, Technischer Anhang §1)
`kos(id, title, statement, conditions, measures, type, category, tags[], confidence, trust, status, version, original_author, needed_validations, asset_ref, created_at)` + `ko_history`. Wissensart als Enum.

## Nicht-Ziele (v1)
Import/Output-Felder (`source_type`, `validity_until` …) sind Konzept/Roadmap → Modul `extensions` (FR-EXT-07).

## Offene Fragen
Konfliktfeld-Verknüpfung zu `conflicts` · Asset-Speicherung (Bilder/Dokumente) lokal vs. Objektspeicher.
