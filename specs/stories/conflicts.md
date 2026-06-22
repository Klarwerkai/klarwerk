# Modul: conflicts — Konflikte

> Quelle: Pflichtenheft §3.7 (FR-CON-01…04), NFR-TAI-02. Jira-Epic: KW-CON.

## Ziel
Widersprüche zwischen KOs klassifiziert behandeln statt still überschreiben; nur Wahrheitskonflikte
eskalieren an Menschen.

## User Stories & Akzeptanzkriterien

### FR-CON-01 · Klassifizierte Konflikte (MUSS)
- [ ] **Gegeben** ein Widerspruch, **dann** entsteht ein Konflikt mit Art (Truth/Experience/Context/Temporal/Role) + Beschreibung — kein stilles Überschreiben.

### FR-CON-02 · Nur Wahrheitskonflikte eskalieren (MUSS, NFR-TAI-02)
- [ ] **Gegeben** ein Konflikt, **dann** löst nur Art „Truth" den Eskalationspfad an einen Menschen aus.

### FR-CON-03 · Auflösungsablauf (MUSS)
- [ ] **Gegeben** ein Wahrheitskonflikt, **dann** durchläuft er Eskalation → Zweitmeinung → Controller-Entscheidung → gelöst; Trust erholt sich.

### FR-CON-04 · Konflikt-Seite (MUSS)
- [ ] **Gegeben** ungelöste Konflikte, **dann** listet die Konflikt-Seite alle (jeder Status) mit Link zur Klärung; Sidebar-Badge zählt korrekt.

## API / Schnittstellen (Entwurf)
`GET /api/conflicts` (ungelöst) · `POST /api/conflicts/:id/escalate|second-opinion|resolve` · Zweitmeinung via `reasoner`. Events `conflict.created`, `conflict.resolved`.

## Datenmodell (Auszug)
`conflicts(id, ko_a, ko_b, type, description, status, created_at)`. Trust-Auswirkung am betroffenen KO.

## Nicht-Ziele (v1)
Automatische „Wahrheits"-Entscheidung durch KI (verboten, NFR-TAI-02).

## Offene Fragen
Erkennungslogik für Widersprüche (semantisch via reasoner vs. Regel) · Schwellen je Konfliktart.
