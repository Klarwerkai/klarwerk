# Modul: lifecycle — Lebenszyklus & Governance

> Quelle: Pflichtenheft §3.10 (FR-LIF-01…04). Jira-Epic: KW-LIF.

## Ziel
Wissen aktuell halten (Re-Validierung bei Anlagenänderung), Autorschaft sauber übergeben,
Lernpfade anbieten und das Vermächtnis-Framing (Autorname sichtbar) wahren.

## User Stories & Akzeptanzkriterien

### FR-LIF-01 · Anlagenkopplung & Re-Validierung (SOLL)
- [ ] **Gegeben** eine Anlagen-/Prozessänderung, **dann** werden gekoppelte KOs „Stimmt das noch?"-markiert; Bestätigung erzeugt eine neue Version.

### FR-LIF-02 · Autor-Übergabe (MUSS)
- [ ] **Gegeben** Admin-Autor-Übergabe, **dann** ändert sich der Autor, der Originalautor bleibt in der Fußnote sichtbar.

### FR-LIF-03 · Lernpfade (SOLL)
- [ ] **Gegeben** ein rollenspezifischer Pfad, **dann** darstellbar mit Abhaken; Fortschritt speicherbar.

### FR-LIF-04 · Vermächtnis-Framing (MUSS)
- [ ] **Gegeben** ein KO, **dann** ist der Autorenname überall sichtbar.

## API / Schnittstellen (Entwurf)
`POST /api/assets/:id/change` (markiert gekoppelte KOs) · `POST /api/kos/:id/revalidate` · `POST /api/kos/:id/transfer-author` (admin) · `GET/POST /api/learning-paths`.

## Datenmodell (Auszug)
KO-Felder `original_author`, `author`, `asset_ref` · `learning_paths(id, role, steps[])` + Fortschritt je Nutzer.

## Nicht-Ziele (v1)
Automatische Anlagen-Synchronisation aus Fremdsystemen (Konnektoren Out of Scope §6).

## Offene Fragen
Kopplungsmodell KO↔Anlage · Granularität Lernpfad-Fortschritt.
