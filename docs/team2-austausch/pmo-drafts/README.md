# PMO-Update-Drafts (Weg b — Paul liefert, Runner wendet an)

Der PMO-Fortschritt lebt lokal auf Pedis Mac unter `~/Documents/KLARWERK_Reporting_PMO/`
(bewusst OHNE Git, Paul hat keinen Zugriff). Statt dort direkt zu schreiben legt Paul
**Update-Drafts** hier ab; der Paul-Runner (Schritt 5) wendet sie auf dem Mac an —
immer über `node scripts/apply-item-update.mjs <draft>` (macht Backup + Audit-Log).

## Ablauf (automatisch im Runner, nur bei grünen Gates)
1. Jede `*.json` in diesem Ordner wird nach `KLARWERK_Reporting_PMO/data/intake-drafts/` kopiert.
2. `node scripts/apply-item-update.mjs data/intake-drafts/<datei>` wird im PMO-Ordner ausgeführt.
3. Erfolgreich angewendete Drafts wandern nach `pmo-drafts/angewendet/` (nicht erneut angewendet).
4. Die komplette Ausgabe landet im Runner-Log. Ein PMO-Fehler macht den Lauf NICHT rot
   (Progress-Pflege blockiert keine Code-Lieferung) — er wird nur sichtbar protokolliert.

## Draft-Schema (genau EIN Item je Draft)
```json
{
  "mode": "update_existing",
  "target_id": "T1-KI-001",
  "reason": "Kurzbegründung inkl. SCRUM-Nummern + Commit — [Cloud-Worker]",
  "fields_to_update": {
    "status": "done",
    "evidence": "SCRUM-… @<commit>; Gates Paul-Runner grün",
    "next_step": "-"
  }
}
```
- **Der Schlüssel heißt `fields_to_update`** (NICHT `fields`) — dokumentierter Stolperstein.
- Erlaubte Skalar-Felder: `title, description, area, status, priority, beta_relevance,
  missing, next_step, why_it_matters, source, evidence`.
- Zulässige Status-Werte: `recognized · planned · in_progress · partially_done · done ·
  blocked · deferred · out_of_scope · paused · archived`. Kein Hard-Delete — nur `archived`.
- `mode: "update_existing"` legt NIE ein neues Item an (schützt vor Tippfehler-IDs).

## Regel
Paul schreibt einen Draft nur für ein Item, dessen ID + Bezug er sicher kennt. Im Zweifel:
Boss-Prompt mit Rückfrage statt Raten. Der Boss sieht jeden Draft im v-Diff, bevor der Runner ihn anwendet.
