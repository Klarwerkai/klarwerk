# Workflows (n8n)

> Registry der n8n-Assets. Namenskonvention: `W-<DOMAIN>-<NR> · <Auslöser> → <Aktion>`.
> n8n-Instanz: `klarwerkai.app.n8n.cloud` · Projekt: persönlich (Peter Kohnert).

## Aktive/angelegte Workflows
| Workflow | ID | Zweck | Status |
|---|---|---|---|
| **W-SPEC-01 · Idee-Intake → specs/ideas** | `VnXGlzTrEeyzbq6b` | Formular erfasst Titel/Idee/Quelle → speichert in Data Table `klarwerk_ideas`. Stakeholder-Intake (schriftlich); Ergänzung zu Cowork als Hauptschnittstelle. | Entwurf (noch nicht aktiviert) |

## Data Tables
| Tabelle | ID | Spalten |
|---|---|---|
| `klarwerk_ideas` | `glvG9X9U5hfLK3XP` | title, idea, source, status |

## Geplant (braucht LLM-API-Keys)
- **W-SPEC-02 · Review-Panel** — Claude + GPT + Perplexity prüfen parallel eine Spec, Konsolidierung → `specs/decisions`. Skelett folgt, sobald `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `PERPLEXITY_API_KEY` als n8n-Credentials hinterlegt sind.
- **W-DOC-01 · Doku/Logbuch-Sync** — Merge-Ereignis → Notion-Update.

## Hinweise
- W-SPEC-01 ist als **Entwurf** angelegt. Zum Scharfschalten in n8n öffnen und aktivieren (Form-Production-URL wird dann live).
- Idee: später Idee-Datensätze aus `klarwerk_ideas` automatisch als Markdown nach `specs/ideas/` im Git-Repo überführen (Triage-Schritt).
