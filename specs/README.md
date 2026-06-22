# Specs — Backlog & Quelle der Wahrheit

> Übernommen aus dem KLARWERK-Pflichtenheft v1.0 (14.06.2026). Kanonische Quelle:
> `specs/reference/Pflichtenheft.md` (+ Funktionsbeschreibung, Technischer Anhang).
> Jede Anforderung ist test-fähig (Abnahmekriterium → Test). Modulschnitt = modularer Monolith.

## Lesart
- **FR** = funktionale Anforderung, **NFR** = nichtfunktionale (Constraints, siehe unten).
- Priorität **MUSS / SOLL / KANN**. Abnahme: alle MUSS erfüllt, SOLL erfüllt oder begründet zurückgestellt.
- Jeder Bereich wird ein **Modul** unter `/services/<modul>` und ein **Jira-Epic**.
- Pro Modul entsteht ein ausgearbeitetes Spec in `specs/stories/<modul>.md` (Vorlage: `specs/stories/auth.md`).

## Modul-/Epic-Backlog
| Modul | Bereich | FR-IDs | Prio-Schwerpunkt | Spec | Jira-Epic | Team |
|---|---|---|---|---|---|---|
| `auth` | Authentifizierung & Onboarding | FR-AUTH-01…08 | MUSS | ✅ `stories/auth.md` | KW-AUTH | A |
| `rbac` | Rollen & Rechte | FR-RBAC-01…04 | MUSS | ✅ vorhanden | KW-RBAC | A |
| `capture` | Erfassung | FR-CAP-01…09 | MUSS | ✅ vorhanden | KW-CAP | A |
| `structure` | Strukturierung & Editor | FR-STR-01…06 | MUSS | ✅ vorhanden | KW-STR | A |
| `knowledge-object` | Wissensobjekt & Wissensarten | FR-KO-01…04 | MUSS | ✅ vorhanden | KW-KO | A |
| `validation` | Validierung & Zuweisung | FR-VAL-01…07 | MUSS | ✅ vorhanden | KW-VAL | A |
| `conflicts` | Konflikte | FR-CON-01…04 | MUSS | ✅ vorhanden | KW-CON | B |
| `ask` | Abfrage & Wissenslücken | FR-ASK-01…06 | MUSS | ✅ vorhanden | KW-ASK | B |
| `library-analytics` | Bibliothek, Risiko, Graph, Analytics, Audit | FR-LIB/ANA/AUD | MUSS/SOLL | ✅ vorhanden | KW-LIB | B |
| `lifecycle` | Lebenszyklus & Governance | FR-LIF-01…04 | MUSS/SOLL | ✅ vorhanden | KW-LIF | B |
| `reasoner` | Reasoner (KI-Schicht) | FR-RSN-01…06 | MUSS | ✅ vorhanden | KW-RSN | B |
| `mobile` | Mobile / PWA | FR-MOB-01…03 | MUSS | ✅ vorhanden | KW-MOB | A |
| `i18n` | Internationalisierung | FR-I18N-01…02 | MUSS/SOLL | ✅ vorhanden | KW-I18N | A |
| `extensions` | Strategische Erweiterungen | FR-EXT-01…07 | KANN (Roadmap) | ✅ vorhanden | KW-EXT | — |

*Team-Spalte = Vorschlag für die spätere Aufteilung auf zwei externe Teams (A = Erfassen→Validieren-Vertikale, B = Wissen-Nutzen+KI-Vertikale). Anpassbar.*

## Empfohlene Build-Reihenfolge (erste Vertikale)
`auth` → `rbac` → `knowledge-object` → `capture` → `structure` → `validation`.
Das ergibt den ersten durchgängigen Anwendungsfall (Wissen erfassen → strukturieren → validieren) und damit echte API-/Workflow-Tests.

## Nichtfunktionale Anforderungen (Constraints)
NFR-SEC/PRV/TAI/PERF/OPS/UX/MNT/DAT gelten **modulübergreifend** und sind im Harness verankert
(`harness/70-security-and-permissions.md`, `40-testing-strategy.md`, `80-definition-of-done.md`).
Kanonische Liste: `specs/reference/Pflichtenheft.md` §4.

**Architektur-kritische NFR** (bestimmen den Stack):
- **NFR-PRV-01/02** — drei Deployment-Modelle inkl. **On-Premises** („keine Daten verlassen das Haus").
- **NFR-PERF-03** — ≥ 1.000 Nutzer / ≥ 100.000 KOs pro Mandant.
- **NFR-MNT-01/03** — austauschbarer Reasoner, Mandantenfähigkeit.
