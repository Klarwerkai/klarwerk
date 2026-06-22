# Governance & Teams — Lean jetzt, volle Agenten-Org später

> Adressiert zwei Anforderungen von Pedi: (1) später mit **zwei externen Teams** arbeiten,
> (2) den ursprünglichen Grundgedanken einer **mehrköpfigen Agenten-Organisation** nicht verwerfen.
> Beides ist hier verankert — nur zeitlich richtig sequenziert.

## Das tragende Prinzip
Der ursprüngliche Plan (viele Agenten) und der Lean-Ansatz widersprechen sich nicht. Sie sind
**dieselbe Organisation in zwei Ausbaustufen**. Was beide zusammenhält, sind drei feste Verträge:

| Vertrag | Inhalt | Wo |
|---|---|---|
| **WAS** | Pflichtenheft (FR-/NFR-Anforderungen + Abnahmekriterien) | `/specs` (aus Original übernommen) |
| **WIE** | Harness: Architektur-, Code-, Test-, Sicherheitsregeln | `/harness`, `CLAUDE.md` |
| **KORREKT** | `tools/check` (Build · Lint · Architektur · Tests) | CI / Branch-Protection |

Das Pflichtenheft sagt selbst: *„technische Umsetzung ist frei"*. Genau das macht **zwei externe Teams**
möglich: Sie dürfen frei umsetzen — solange die Abnahmekriterien als grüne Tests erfüllt sind und der
Harness eingehalten wird. Niemand muss dem anderen vertrauen; der grüne Check entscheidet.

## Ausbaustufe 1 — jetzt (Lean, 3 Agenten)
Solange **du** der einzige Stakeholder bist und noch kein Team-Code fließt, brauchst du keine 11 Agenten.

- **Spec-Agent** — Pflichtenheft → überprüfbare Specs, kritisches Interview bei Lücken.
- **Review-Panel** (Claude · GPT · Perplexity, on demand) — red-teamt Specs/Architektur.
- **Doku-/Logbuch-Agent** — hält `/docs` + Notion synchron.

## Ausbaustufe 2 — mit zwei externen Teams (deine ursprüngliche Org)
Sobald Teams real arbeiten, gibt es echte Koordination zu leisten — **dann** ziehen wir deine
ursprünglich beschriebene Organisation ein. Jede Rolle bekommt jetzt einen echten Zweck:

| Deine ursprüngliche Rolle | Modell-Vielfalt | Aufgabe in der Team-Phase |
|---|---|---|
| **3× Project-Owner** | Claude · GPT · Perplexity | Hüten das **WAS**: priorisieren Anforderungen, schärfen Akzeptanzkriterien je Team, erkennen Lücken. |
| **3× Project-Manager** | Claude · GPT · Perplexity | Hüten das **WIE**: Prozess, Schnittstellen zwischen den Teams, Fortschritt, Risiken. |
| **1× Jira-Agent** (Claude) | — | Übersetzt freigegebene Specs in Board-Tasks, pflegt Status, verknüpft mit Git-PRs. |
| **3× Doku-Agenten** | Claude · GPT · Perplexity | Stimmen Doku & Logbuch ab, kontrollieren Vollständigkeit. |
| **1–2× Logbuch/Doku-Führung** (Claude) | — | Führen Logbuch und Doku in Notion. |

So bleibt dein Grundgedanke vollständig erhalten — er wird nur dann aktiviert, wenn er Arbeit
koordiniert statt sie zu erfinden. Die **Modell-Vielfalt** (Claude/GPT/Perplexity) bleibt überall,
wo unterschiedliche blinde Flecken wertvoll sind: Anforderungs- und Architektur-Review.

## Arbeitsteilung der zwei externen Teams
- **Code-Grenze:** je Team klar geschnittene Module unter `/services/<modul>` (modularer Monolith) —
  oder getrennte Repos in der Gitea-Org `klarwerk`. Modulgrenzen erzwingt `dependency-cruiser`.
- **Beitrag nur per Pull Request** gegen `main`, geschützt durch Branch-Protection + grünen CI-Check.
- **Koordination:** Jira (Tasks/Abhängigkeiten) + Notion (Doku/Entscheidungen/Logbuch).
- **Konfliktauflösung:** Bei Streit gewinnt nicht die Meinung, sondern das Pflichtenheft-Abnahmekriterium
  und der deterministische Check. Strittiges geht als ADR nach `/specs/decisions`.

## Einführungs-Trigger (wann Stufe 2 startet)
Aktiviere die volle Org erst, wenn **alle** zutreffen: Pflichtenheft als Specs übernommen ·
erster Service mit grünem `tools/check` · n8n verbunden · mindestens ein externes Team vertraglich an Bord.
Vorher wäre die Org Overhead ohne Koordinationsnutzen.
