# PMO-Muster für Paul (Weg b: Drafts über die Brücke, Runner wendet an)

> Von der Boss-Session, 03.07. abends. Quelle: `~/Documents/KLARWERK_Reporting_PMO/`
> (144 Items). Anwenden IMMER via `node scripts/apply-item-update.mjs <draft>` — macht Backup +
> Audit-Log, nie direkt in pmo-items.json schreiben.

## 1 · Item-Ausschnitt (echte Struktur, gekürzt)

```json
{
  "id": "T1-KI-001",
  "type": "requirement",
  "title": "Knowledge Capture (Erfassung ohne Schulung)",
  "team": "team-1",
  "area": "Knowledge Input / Capture",
  "status": "partially_done",
  "priority": "P1",
  "beta_relevance": "high",
  "evidence": "KGURU-7 Capture->Validation E2E · SCRUM-354 @57d1596 m. Pruefvorbehalt",
  "missing": "UX-Tiefe/Wizard-Default (AG-12)",
  "next_step": "UX/Wizard-Slice (AG-12)",
  "last_review": "2026-06-30"
}
```
(Zweites Beispiel: `T1-KI-002`, status `done`.)

## 2 · Gültiges Update-Draft (genau EIN Item je Draft)

Ablage: `data/intake-drafts/<name>.json` im PMO-Ordner (der Runner-Schritt kopiert es dorthin).

```json
{
  "mode": "update_existing",
  "target_id": "T1-KI-001",
  "reason": "SCRUM-407/408/405 geliefert (v0.9.42, Commit e29508a) — [Cloud-Worker]",
  "fields_to_update": {
    "status": "done",
    "evidence": "SCRUM-407/408/405 @4f3ed42; Gates Paul-Runner gruen",
    "next_step": "-"
  }
}
```
WICHTIG: Der Schlüssel heißt **`fields_to_update`** (nicht `fields`). Skalare Felder erlaubt:
title, description, area, status, priority, beta_relevance, missing, next_step,
why_it_matters, source, evidence.

## 3 · Zulässige Status-Werte

`recognized · planned · in_progress · partially_done · done · blocked · deferred ·
out_of_scope · paused · archived` — kein Hard-Delete; archivieren nur über status/archived.

## Runner-Schritt (Vorschlag für paul-runner.sh)

Drafts aus `docs/team2-austausch/pmo-drafts/*.json` nach
`~/Documents/KLARWERK_Reporting_PMO/data/intake-drafts/` kopieren und je Draft
`node scripts/apply-item-update.mjs data/intake-drafts/<datei>` ausführen (im PMO-Ordner),
Ausgabe ins Brücken-Log; angewendete Drafts in der Brücke nach `pmo-drafts/angewendet/` verschieben.
