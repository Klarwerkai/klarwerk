# Agenten — Lean-Start (3 Rollen)

Statt 11 dauerhaft laufender Agenten starten wir mit **drei Rollen**. Weitere (Jira-Verwalter, Architektur-, Test-, Implementierungs-, Operations-Agent) kommen dazu, sobald reale Specs, Tasks und Code existieren — siehe `SETUP.md`, Phasen.

| Rolle | Modell(e) | Aufgabe | Schreibt nach |
|---|---|---|---|
| **Spec-Agent** | Claude Opus 4.8 | Kritisches Interview, Idee → überprüfbare Spec | `/specs` |
| **Review-Panel** | Claude + GPT-5.x + Perplexity (on demand) | Specs/Architektur red-teamen, blinde Flecken finden | Kommentare in `/specs/decisions` |
| **Doku-/Logbuch-Agent** | Claude | Doku + Logbuch synchron halten | `/docs` + Notion |

**Quelle der Wahrheit bleibt Git.** Notion/Jira sind Spiegel, kein Ersatz. Jeder Agent liest zuerst `CLAUDE.md`.
