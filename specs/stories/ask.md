# Modul: ask — Abfrage & Wissenslücken

> Quelle: Pflichtenheft §3.8 (FR-ASK-01…06), NFR-TAI-01. Jira-Epic: KW-ASK.

## Ziel
Fragen begründet beantworten mit Trust, Quellen und Argumentationsschritten — und ehrlich
verweigern, wenn Wissen fehlt (Ablage als Wissenslücke).

## User Stories & Akzeptanzkriterien

### FR-ASK-01 · Begründete Antwort (MUSS)
- [ ] **Gegeben** eine Frage, **dann** Antwort mit Trust, Quelle(n), Argumentationsschritten, ggf. Konflikt-Hinweis.

### FR-ASK-02 · Semantische Auswahl (MUSS)
- [ ] **Gegeben** eine sinngemäß passende Frage mit anderen Worten, **dann** wird das relevante KO gefunden (Keyword-Fallback).

### FR-ASK-03 · Ehrliche Verweigerung (MUSS)
- [ ] **Gegeben** fehlende Grundlage, **dann** keine erfundene Antwort; es entsteht eine Wissenslücke.

### FR-ASK-04 · „Hat geholfen" (MUSS)
- [ ] **Gegeben** Klick auf „hat geholfen", **dann** Trust leicht erhöht + Audit-Eintrag.

### FR-ASK-05 · Wissenslücken verwalten (MUSS)
- [ ] **Gegeben** eine Lücke, **dann** einem Experten zuweisbar, schließbar und mit Bestätigung löschbar.

### FR-ASK-06 · Belegstelle (KANN)
- [ ] **Gegeben** eine Antwort, **dann** Verweis auf konkretes Quell-Snippet.

## API / Schnittstellen (Entwurf)
`POST /api/ask` (→ reasoner: semantische Auswahl + Antwort) · `GET/POST /api/gaps` · `POST /api/gaps/:id/assign|close`. Event `gap.created`.

## Datenmodell (Auszug)
`gaps(id, question, status, assignee, created_at)`. Antwort-Provenienz (Quellen-KO-IDs, Schritte) im Response.

## Nicht-Ziele (v1)
Freie generative Antworten ohne Quellenbindung (verboten, Anti-Halluzination FR-RSN-03).

## Offene Fragen
Embedding-/Retrieval-Verfahren für semantische Suche (lokal vs. extern, NFR-PRV) · Trust-Inkrement-Höhe.
