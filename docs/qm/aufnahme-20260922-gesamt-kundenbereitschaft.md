# Aufnahme 20260922 · Gesamt-Kundenbereitschaft: Abgleich Betriebscockpit

Auftrag `aufnahme:20260922:gesamt-kundenbereitschaft`, Revision 1. Zugeordnet: **R-1423** (alias
F-1423) und **RECHERCHE:cockpit-schema**.

- **Stand dieses Dokuments:** Lauf 1 auf Basis `9d92797e` (`1.0.0-beta.1.978`), 14.10.2026.
- **Lieferbeleg:** Die Fassung, mit der diese Änderung ausgeliefert wird, entsteht erst mit der
  Veröffentlichung. Sie steht deshalb hier noch nicht (K3).

Diese Datei hält fest, **wo** das vorhandene Cockpit liegt, **was** davon belegt ist und **welche**
Entscheidung vor einer Umsetzung fehlt. Sie baut nichts und ersetzt keine Entscheidung.

## 1. Das vorhandene Cockpit liegt nicht in diesem Repository

Beide Originalpunkte beziehen sich auf das **Ops-Cockpit v0.2.0** des damaligen Teams 3. Belegt ist
es nur durch Berichte in diesem Repository, nicht durch Quelltext:

| Fassung | Ticket | Inhalt laut Bericht | Ort laut Bericht | Fundstelle hier |
|---|---|---|---|---|
| v0.1.0 | KBB-113 | `cockpit/` (index.html, app.js, `cockpit/scripts/serve.mjs` auf 127.0.0.1:8030), vier Reiter: Pilot-Akte, Go/No-Go-Board (32 Gates, Status offen/erfüllt/blockiert), Support & Incidents, Pause/Stop/Exit (Lebenszyklus mit Verlaufslog); Desktop-App „KLARWERK Ops" | Repository `klarwerk-business-backend`, Commit `1c5717e`, „kein Push" | `docs/qm/claude-after-report.md`, After-Report KBB-113 |
| v0.2.0 | KBB-115 | Reiter **Überblick** (Server-Reife x/3, Gates x/32, offene Vorgänge, Lebenszyklus-Zustand), Checkliste „Weg zur Server-Reife" SR-1..SR-3, **D-010/D-011-Tracker**, `POST /api/report` erzeugt `OPS_STATUSBERICHT_<Datum>.md` im Cockpit-Repository | Repository `klarwerk-business-backend`, Commit `25dbe92`, „kein Push" | `docs/qm/claude-after-report.md`, After-Report KBB-115; `docs/qm/BOSS_SESSION_STAND_2026-07-02.md` |

Im heutigen Produktbaum gibt es davon **nichts**: keine Cockpit-Dateien, keine Desktop-App
„KLARWERK Ops" und keinen Datenvertrag mit `beta_paused`, `current_state`, `ticket_id` oder
`entries`/`log` (festgehalten in `tests/kundenbereitschaft/cockpit-einordnung.test.ts`, Fall A). Das
Repository `klarwerk-business-backend` gehört nicht zu den erlaubten Pfaden dieses Auftrags und
wurde **nicht gelesen**.

## 2. Abgleich je Anliegen

| Anliegen | Geliefert | Beleg heute | Stand |
|---|---|---|---|
| **R-1423** Werkzeug zeigt Server-Reife, offene Entscheidungen und Statusbericht (K1) | historisch: Ops-Cockpit v0.2.0 (KBB-115, 02.07.2026) mit genau diesen drei Teilen | nur die Berichte aus Abschnitt 1. Die Abnahme SR-1 („Cockpit-Abnahme Pedi") ist nirgends belegt; der letzte Eintrag ist die offene Pedi-Aktion „Ops-Cockpit ansehen → SR-1 abhaken". | **ungeklärt.** Der Funktionsumfang ist berichtet, nicht abgenommen und hier nicht nachprüfbar. In diesem Auftrag nicht neu gebaut. |
| **RECHERCHE:cockpit-schema** Gate-Zähler, offene Tickets, `beta_paused`, gemeinsamer Datenvertrag (K2) | nichts. Die Fehler stammen laut Quelle aus `recherche/sichtung/OPS-COCKPIT-ORIGINALBEFUND.md`, Abschnitt „Dynamisch gemessene Abweichungen" — ein isolierter historischer Codebefund am Cockpit. | keiner. Die Befundquelle liegt weder im Arbeitsbaum noch in den Auftragsquellen; dort steht nur der zusammenfassende Anforderungssatz. | **offen.** Ohne Cockpit-Quelltext und ohne Befundtext lässt sich keine der vier Abweichungen hier messen oder beheben. |

Die vier Abweichungen aus K2 bleiben unverändert als Anforderung erhalten:

1. Der Gate-Zähler zählt beide Schreibweisen `erfüllt` und `erfuellt` als erfüllt.
2. „Offene Vorgänge" zählt offene Tickets, nicht geschlossene oder abgebrochene.
3. Der Zustand `beta_paused` wird über `status` bzw. `current_state` richtig erkannt.
4. Bildschirm und Statusbericht lesen denselben Datenvertrag: `ticket_id` gegenüber `id`, Verlauf
   `entries`/`at` gegenüber `log`/`ts`.

## 3. Verwandter Bestand im Produkt — keine Erfüllung

Diese Stellen behandeln ähnliche Fragen, sind aber **kein Werkzeug** im Sinn von R-1423 und nicht
als Nachfolger des Cockpits belegt:

| Frage aus R-1423 | Vorhandenes im Repository | Einordnung |
|---|---|---|
| Server-Reife | `docs/operations/server-hardening-readiness.md` (Runbook, Betreiberschritte offen) | Dokument, kein Zähler, keine Abnahme |
| Offene Entscheidungen | `OFFEN.md`, Abschnitt „1 — Was bei dir liegt"; Entscheidungsvorlagen unter `docs/entscheidungen/`; Entscheidungsliste `PROJECT_CONTEXT/09_ENTSCHEIDUNGEN.md` (D-010) | Projektgedächtnis, kein Cockpit |
| Statusbericht kommerzielle Vorbereitung | `docs/demo/stage-1-pilot-readiness.md` (Stand 29.06.2026, Go/No-Go für Stage 1) | datierter Einzelbericht, kein erzeugter Bericht |

## 4. Offene Umfangsfrage (K1, K2)

**Frage:** Auf welchem heutigen Weg wird das vorhandene Cockpit weiterverwendet?

| Alternative | Inhalt | Voraussetzung |
|---|---|---|
| **A · Arbeit im Cockpit-Repository** | K2 im vorhandenen `cockpit/` von `klarwerk-business-backend` beheben; K1 dort abnehmen (SR-1). | Auftrag mit diesem Repository als erlaubtem Pfad; Befundquelle `OPS-COCKPIT-ORIGINALBEFUND.md`; Nachweis, welcher Stand dort heute liegt (`25dbe92` war nur lokal). |
| **B · Cockpit in dieses Repository übernehmen** | den vorhandenen Quelltext unverändert übernehmen, dann K2 daran beheben | ausdrückliche Entscheidung, dass das interne Team-3-Werkzeug Teil dieses Repositorys wird; dieselben Quellen wie A |
| **C · Als historische Lieferung schließen** | R-1423 als berichtete Lieferung v0.2.0 verbuchen; K2 als ungeprüfter Altbefund schließen | Entscheidung, dass das Cockpit nicht mehr gebraucht wird (Team 3 ruht laut `docs/boss-assistant/github-jira-architektur.md`) |
| **D · Neue Ansicht im Produkt** | Bereitschaft und Entscheidungen im Admin-Bereich des Produkts zeigen | nur mit einer **neuen, ausdrücklichen** Anforderung. Der Auftrag verlangt Weiterverwendung und verbietet einen pauschalen Neubau. |

**Noch erforderlich:** eine Entscheidung des Nutzers (Pedi) zwischen A–D und, für A oder B, Zugang
zum Cockpit-Quelltext und zur Befundquelle.

**Eindeutig umgesetzt** ist in diesem Lauf nur der Abgleich selbst (diese Datei und ihre
Fundstellenprobe). Es wurde **kein** Produktcode geändert, kein Cockpit nachgebaut und kein
Beispielmarker (etwa „PILOT-CUST-0001 Musterwerk GmbH [SYNTHETISCH]") als echter Kundenvorgang
gewertet. Eine Erfüllung von R-1423 oder RECHERCHE:cockpit-schema wird hier nicht behauptet.

## 5. Abgrenzung zu gesonderten Aufträgen

- **Risiko-Cockpit** (`apps/web/src/lib/riskCockpit.ts`, `apps/web/src/pages/Risk.tsx`, SCRUM-133/230):
  Wissensrisiko je Domäne, nicht Pilotbereitschaft. Nicht berührt.
- **Import-Cockpit** (Confluence-Import, WP-COCKPIT-LINIE): Importführung. Nicht berührt.
- **TLS-Nachweis am Betriebsweg** (Basis-Commit, `docs/operations/tls-bis-zur-anwendung.md`): eigener
  Auftrag, der einen Teil der Server-Härtung belegt. Hier nicht bewertet.
- **D-010 Kanzlei/Datenschutz:** eine externe Entscheidung, die das Cockpit nur verfolgte. Dieser
  Auftrag entscheidet und kontaktiert nichts.

## 6. Quellenwidersprüche und fehlende Belege

1. **„angedacht"/„GEPLANT" gegen „Done":** Das Register führt R-1423 als `angedacht`, der
   Altbestand als `GEPLANT` und „nur Doku, keine Abnahme belegt". Der After-Report KBB-115 meldet
   v0.2.0 als gebaut („neu, Done") samt Live-Smoke im Sandbox. Beides ist vereinbar nur so: Code
   berichtet, Abnahme fehlt.
2. **„keine Code-Implementierung" gegen Cockpit-Commits:** `docs/boss-assistant/interviews/team-3.md`
   (06.07.2026) beschreibt das Repository als „Nur `README.md` + `docs/` … keine
   Code-Implementierung". Die After-Reports vom 02.07.2026 nennen dort `cockpit/` mit Server und
   Oberfläche. Ob die Commits je gepusht wurden, ist nicht belegt.
3. **Kennung D-011 doppelt belegt:** Im Team-3-Material ist D-011 die offene
   Commercial/Billing-Entscheidung. In `apps/web/src/pages/Validation.quittung.test.tsx` heißt
   „Sollvertrag D-011" die Quittung nach einer Bewertung. Für einen D-010/D-011-Tracker ist die
   gemeinte Kennung deshalb nicht eindeutig.
4. **Schreibweise der Gate-Stati:** KBB-113 nennt `offen/erfüllt/blockiert`. Woher die Variante
   `erfuellt` aus K2 stammt (alte Daten, Bericht, Import), geht aus den vorliegenden Quellen nicht
   hervor.
5. **Fehlende Belege:** Cockpit-Quelltext (`1c5717e`, `25dbe92`), die Befundquelle
   `recherche/sichtung/OPS-COCKPIT-ORIGINALBEFUND.md`, eine Abnahme SR-1 und ein erzeugter
   `OPS_STATUSBERICHT_<Datum>.md`. Alle liegen außerhalb des Produktbaums oder fehlen. Die Altquelle
   `FUNKTIONSREGISTER.json:32602` trägt keine Zeitangabe (`zeit: null`) und wurde nicht gelesen.

## 7. Prüfbelege

- **Quelleninspektion (dieser Lauf):** Berichte und Fundstellen aus den Abschnitten 1–6, gelesen am
  Arbeitsbaum auf Basis `9d92797e`.
- **Fundstellenprobe:** `tests/kundenbereitschaft/cockpit-einordnung.test.ts`. Sie hält fest, dass
  die genannten Dateien existieren, die tragenden Sätze dort stehen und kein Cockpit-Code im Produkt
  liegt. Sie belegt **nicht** das Verhalten des Cockpits. In diesem Arbeitsgang ist kein Test
  gelaufen; das Ergebnis steht im Prüfarchiv des Kandidaten.
