# Glossar & Konten-Übersicht

## Glossar (Projektsprache)

- **KO (Wissensobjekt):** die Grundeinheit gesicherten Wissens (Titel, Aussage, Bedingungen,
  Maßnahmen, Quellen, Anhänge, Status).
- **Validierung / Peer-Prüfung:** Kollegen prüfen ein KO; erst danach gilt es als „gesichert"
  und wird für Antworten benutzt. **Stufe 2** = externe Quellen (angehängt, aber NICHT peer-validiert).
- **Reasoner:** die KI-Schicht der App mit 6 Einsätzen: Strukturieren, Schreibhilfe, Interview,
  Antworten, Kandidaten-Auswahl, Wissen-aus-Datei. Anbieteragnostisch (`ModelClient`).
- **Deterministischer Fallback:** ohne gültigen KI-Key liefert die App ehrliche, regelbasierte
  Ergebnisse und sagt das klar — niemals Schein-KI.
- **G-2 / Belegstelle:** Regel für Wissen-aus-Datei — jeder extrahierte Punkt braucht ein
  wörtliches Zitat aus dem Dokument (gegen Halluzination); wird im Prüfstand hart geprüft.
- **Wissenslücke retten:** Wenn eine Frage nicht aus gesichertem Wissen beantwortbar ist, wird
  daraus ein geführter Erfassen-Einstieg (kein „weiß nicht" ohne Anschluss).
- **Verhörer-Interview (SCRUM-393):** geplantes vertieftes KI-Interview, das gezielt nachbohrt.
- **Prüfstand:** unser Messverfahren für LLM-Qualität (12 dt. Testfälle, 0–2 Punkte, inkl.
  „Ehrlich-Fällen", bei denen die richtige Antwort „weiß nicht" ist). Liegt im PMO.
- **Boss-Session:** die koordinierende Claude-Konversation (plant, baut, dokumentiert).
- **After-Report:** Pflicht-Eintrag nach jeder Aufgabe in `docs/qm/claude-after-report.md`.
- **Gates:** `tools/check` + `npm run smoke:ui` — nur grün ist lieferbar.
- **RC-Freeze:** Pedi-Kommando „RC einfrieren" → Version 1.0.0-beta.1 + Tag (KREL-34).
- **Guard-Matrix:** Test, der für JEDE API-Route die Berechtigung erzwingt (`tests/security/routeGuardAudit.ts`).
- **Dev-Persist:** lokales Journal, das In-Memory-Daten über Neustarts rettet (`MUTATING_METHODS` pflegen).
- **D-010 / D-012:** Grundsatzentscheidungen (s. `09_ENTSCHEIDUNGEN.md`).
- **KLARWERK Sync:** die Schreibtisch-App, die als EINZIGER Weg Commits zu GitHub/Gitea pusht.

## Konten & Zugänge (Übersicht — Secrets stehen hier bewusst NICHT)

| System | Zweck | Inhaber | Neuer Mitarbeiter braucht |
|---|---|---|---|
| Jira `klarwerk.atlassian.net` | Auftrags-Wahrheit (SCRUM/KWEB/KLLM/KGURU/KREL) | Pedi | Einladung von Pedi |
| GitHub | Code-Wahrheit (Repos s. Datei 03) | Pedi | Repo-Zugriff von Pedi |
| Gitea | Spiegel der Repos | Pedi | i. d. R. nichts (Spiegel) |
| Anthropic API | Reasoner der App + PMO-Prüfstand | Pedi | eigenen Key von Pedi, nur in eigenen Schlüsselbund |
| UpCloud | Team-2-GPU-Server (Limit 1 GPU, Credits bis ~01.08.) | Pedi | nichts (nur Pedi bucht) |
| Domain/Hosting klarwerk.ai (+ geplant Coolify für app.klarwerk.ai) | Website/Deploy | Pedi | nichts |
| Google Gemini/Veo | Promo-Video-Generierung (Tageslimits!) | Pedi | nichts |

## Sicherung (Verantwortung: Pedi — von jeder Session erinnerbar)

**Nicht in Git und daher nur lokal:** `KLARWERK_Reporting_PMO/` (Dashboard, Items, Prüfstand-
Ergebnisse) und `Klarwerk/llm-eval-zugang/` (SSH-Schlüssel). Ohne Backup wären sie bei einem
Mac-Defekt verloren. Minimum: macOS Time Machine aktiv halten; besser zusätzlich: regelmäßige
Kopie des PMO-Ordners auf ein externes Medium. SSH-Schlüssel sind notfalls neu erzeugbar
(neues Paar + Public Key bei UpCloud hinterlegen) — der PMO-Ordner ist es NICHT.
