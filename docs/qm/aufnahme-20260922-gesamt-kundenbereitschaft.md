# Aufnahme 20260922 · Gesamt-Kundenbereitschaft: Abgleich Betriebscockpit

Auftrag `aufnahme:20260922:gesamt-kundenbereitschaft`, Revision 1. Zugeordnet: **R-1423** (alias
F-1423) und **RECHERCHE:cockpit-schema**.

- **Stand dieses Dokuments:** Nacharbeit 1, aufgesetzt auf den Kandidaten `53dfa0eb` (Basis
  `9d92797e`, `1.0.0-beta.1.978`), 14.10.2026.
- **Lieferbeleg:** Die Fassung, mit der diese Änderung ausgeliefert wird, entsteht erst mit der
  Veröffentlichung. Sie steht deshalb hier noch nicht (K3).

Diese Datei hält fest, **wo** das vorhandene Cockpit liegt, **welche** Abweichungen aus K2 an seinem
lesbaren Quellstand belegt sind und **was** zur Behebung noch fehlt. Die Weiterverwendung des
vorhandenen Cockpits ist beauftragt; eine weitere Umfangsentscheidung ist dafür nicht nötig.

**Berichtigung zu Kandidat `53dfa0eb`:** Die frühere Fassung behauptete, der Cockpit-Quelltext sei
nicht lesbar, und verlangte eine Nutzerentscheidung zwischen vier Wegen (darunter „als historische
Lieferung schließen"). **Beides war falsch.** Der Quelltext ist lokal lesbar (Abschnitt 2), und die
Weiterverwendung steht bereits im Auftrag. Ein Schließen ohne Behebung hätte K2 gestrichen. K1 und
K2 bleiben vollständig als Anforderung erhalten.

## 1. Das vorhandene Cockpit

Beide Originalpunkte beziehen sich auf das **Ops-Cockpit v0.2.0** des damaligen Teams 3:

| Fassung | Ticket | Inhalt laut Bericht | Ort | Fundstelle hier |
|---|---|---|---|---|
| v0.1.0 | KBB-113 | `cockpit/` (index.html, app.js, `cockpit/scripts/serve.mjs` auf 127.0.0.1:8030), vier Reiter: Pilot-Akte, Go/No-Go-Board (32 Gates, Status offen/erfüllt/blockiert), Support & Incidents, Pause/Stop/Exit (Lebenszyklus mit Verlaufslog); Desktop-App „KLARWERK Ops" | Repository `klarwerk-business-backend`, Commit `1c5717e`, laut Bericht „kein Push" | `docs/qm/claude-after-report.md`, After-Report KBB-113 |
| v0.2.0 | KBB-115 | Reiter **Überblick** (Server-Reife x/3, Gates x/32, offene Vorgänge, Lebenszyklus-Zustand), Checkliste „Weg zur Server-Reife" SR-1..SR-3, **D-010/D-011-Tracker**, `POST /api/report` erzeugt `OPS_STATUSBERICHT_<Datum>.md` im Cockpit-Repository | Repository `klarwerk-business-backend`, Commit `25dbe92` | `docs/qm/claude-after-report.md`, After-Report KBB-115; `docs/qm/BOSS_SESSION_STAND_2026-07-02.md` |

Der Quelltext liegt lokal im Repository `klarwerk-business-backend`, nicht in diesem Produktbaum. Im
Produktbaum gibt es keine Cockpit-Dateien, keine Desktop-App „KLARWERK Ops" und keinen Datenvertrag
mit `beta_paused`, `current_state`, `ticket_id` oder `entries`/`log` (festgehalten in
`tests/kundenbereitschaft/cockpit-einordnung.test.ts`, Fall A). Daran ändert diese Nacharbeit
nichts: Es wird weiterverwendet, nicht nachgebaut.

## 2. Lesbarer Quellstand und statische Befunde zu K2

**Quellstand** (technische Hilfe vom 13.10.2026, `QUELLEN-TECHNISCHE-HILFE-71a140353ffcc545.json`;
von Ben erneut gelesen, Hashes übereinstimmend):

| Datei im Cockpit-Repository | SHA-256 |
|---|---|
| `klarwerk-business-backend/cockpit/app.js` | `7fa1e3a33f8a2dcb00551c7dfe1d0b99e3c2bdb90bd9e03aa2c03889b8beb485` |
| `klarwerk-business-backend/cockpit/scripts/serve.mjs` | `0851dd0c70f3f1e394c62a6e6da1840b85a99383f2f7b25d02d80efa6659f3af` |

Gelesener `HEAD`: `25dbe922e7bf7cb172d061d7741579a30530cb98`, also der KBB-115-Stand. Ob die
gelesenen Dateien genau diesem Stand entsprechen, ist **nicht bestätigt**: `git status` und
`git log` scheiterten dort mit „Resource deadlock avoided" (Abschnitt 6).

**Statische Befunde** (Quelleninspektion durch technische Hilfe und Ben, keine dynamische Messung):

| K2-Anforderung | Bildschirm: Fachansicht (`app.js`) | Bildschirm: Überblick (`app.js`:300–336) | Bericht (`serve.mjs`:150–178) |
|---|---|---|---|
| Gate-Zähler `erfüllt`/`erfuellt` | Gate-Ansicht zählt `erfüllt` (:96–100) | zählt nur `erfuellt` | zählt nur `erfuellt` |
| offene Tickets ohne geschlossene/abgebrochene | Ticketansicht liest `ticket_status` (:160–170) | filtert `status != geschlossen` — anderes Feld, abgebrochene nicht ausgeschlossen | filtert `status != geschlossen` |
| `beta_paused` über `status`/`current_state` | Lebenszyklusansicht liest `current_state` (:260–272) | liest `lifecycle.state` | liest `lifecycle.state` |
| Ticketkennung `ticket_id`/`id` | `ticket_id` | `id` | `id` |
| Verlauf `entries`/`at` gegenüber `log`/`ts` | `log`/`ts` | `entries`/`at` | `entries`/`at` |

Damit sind alle vier Abweichungen aus K2 am lesbaren Quellstand **bestätigt und unbehoben**. Sie
bleiben unverändert als Anforderung erhalten:

1. Der Gate-Zähler zählt beide Schreibweisen `erfüllt` und `erfuellt` als erfüllt.
2. „Offene Vorgänge" zählt offene Tickets, nicht geschlossene oder abgebrochene.
3. Der Zustand `beta_paused` wird über `status` bzw. `current_state` richtig erkannt.
4. Bildschirm und Statusbericht lesen denselben Datenvertrag: `ticket_id` gegenüber `id`, Verlauf
   `entries`/`at` gegenüber `log`/`ts`.

## 3. Abgleich je Anliegen

| Anliegen | Geliefert | Beleg heute | Stand |
|---|---|---|---|
| **R-1423** Werkzeug zeigt Server-Reife, offene Entscheidungen und Statusbericht (K1) | historisch: Ops-Cockpit v0.2.0 (KBB-115, 02.07.2026) mit genau diesen drei Teilen | Berichte aus Abschnitt 1 und der lesbare Quellstand aus Abschnitt 2. Überblick und Bericht werten die Daten falsch aus (K2). Die Abnahme SR-1 ist nirgends belegt. | **offen.** Das Werkzeug ist vorhanden, zeigt aber wegen der K2-Fehler keine zutreffenden Werte. In diesem Auftrag nicht neu gebaut. |
| **RECHERCHE:cockpit-schema** Gate-Zähler, offene Tickets, `beta_paused`, gemeinsamer Datenvertrag (K2) | nichts | statische Befunde aus Abschnitt 2 | **offen.** Behebung in `cockpit/app.js` und `cockpit/scripts/serve.mjs` steht aus. |

## 4. Was zur Behebung fehlt

Zu tun ist eine Änderung am vorhandenen Cockpit, keine Umfangsentscheidung: Überblick und Bericht
werten Gate-Stati, Ticketstatus, Lebenszyklus, Ticketkennung und Verlauf wie in Abschnitt 2 gefordert
aus, und zwar beide über dieselbe Auswertung. Ein Funktionsnachweis mit künstlichen Daten
(Gate-Stati in beiden Schreibweisen, geschlossene und abgebrochene Tickets, `beta_paused` über
`current_state`, Verlauf in beiden Feldformen) muss an Bildschirm und Bericht dasselbe Ergebnis
zeigen.

**Fehlende Mittel in dieser Nacharbeit (technisch, keine Produktentscheidung):**

- Das Cockpit-Repository gehört nicht zu den erlaubten Pfaden dieses Auftrags (`AUFTRAG.json`,
  `allowed_paths`). Der Arbeitsgang ist auf den Produktarbeitsbaum und den Auftragsordner
  beschränkt. Lesen und Schreiben von `cockpit/app.js` und `cockpit/scripts/serve.mjs` waren hier
  nicht möglich. Die Befunde in Abschnitt 2 stammen deshalb aus der technischen Hilfe und von Ben,
  nicht aus eigener Lektüre.
- Vor einer Änderung dort müssen die Git-Lesefehler geklärt werden. Sonst ist nicht feststellbar,
  auf welchem Stand die Änderung aufsetzt.

Es wurde **kein** Cockpit im Produkt nachgebaut und kein Beispielmarker (etwa „PILOT-CUST-0001
Musterwerk GmbH [SYNTHETISCH]") als echter Kundenvorgang gewertet. Eine Erfüllung von R-1423 oder
RECHERCHE:cockpit-schema wird hier nicht behauptet.

**Getrennte Menschenprobe:** SR-1, Pedis Sichtabnahme des Cockpits, steht ohne Abschlussbeleg aus.
Sie sperrt die technische Behebung von K1/K2 nicht.

## 5. Verwandter Bestand im Produkt — keine Erfüllung

Diese Stellen behandeln ähnliche Fragen, sind aber **kein Werkzeug** im Sinn von R-1423 und nicht
als Nachfolger des Cockpits belegt:

| Frage aus R-1423 | Vorhandenes im Repository | Einordnung |
|---|---|---|
| Server-Reife | `docs/operations/server-hardening-readiness.md` (Runbook, Betreiberschritte offen) | Dokument, kein Zähler, keine Abnahme |
| Offene Entscheidungen | `OFFEN.md`, Abschnitt „1 — Was bei dir liegt"; Entscheidungsvorlagen unter `docs/entscheidungen/`; Entscheidungsliste `PROJECT_CONTEXT/09_ENTSCHEIDUNGEN.md` (D-010) | Projektgedächtnis, kein Cockpit |
| Statusbericht kommerzielle Vorbereitung | `docs/demo/stage-1-pilot-readiness.md` (Stand 29.06.2026, Go/No-Go für Stage 1) | datierter Einzelbericht, kein erzeugter Bericht |

## 6. Abgrenzung zu gesonderten Aufträgen

- **Risiko-Cockpit** (`apps/web/src/lib/riskCockpit.ts`, `apps/web/src/pages/Risk.tsx`, SCRUM-133/230):
  Wissensrisiko je Domäne, nicht Pilotbereitschaft. Nicht berührt.
- **Import-Cockpit** (Confluence-Import, WP-COCKPIT-LINIE): Importführung. Nicht berührt.
- **TLS-Nachweis am Betriebsweg** (Basis-Commit, `docs/operations/tls-bis-zur-anwendung.md`): eigener
  Auftrag, der einen Teil der Server-Härtung belegt. Hier nicht bewertet.
- **D-010 Kanzlei/Datenschutz:** eine externe Entscheidung, die das Cockpit nur verfolgte. Dieser
  Auftrag entscheidet und kontaktiert nichts.

## 7. Quellenwidersprüche und fehlende Belege

1. **„angedacht"/„GEPLANT" gegen „Done":** Das Register führt R-1423 als `angedacht`, der
   Altbestand als `GEPLANT` und „nur Doku, keine Abnahme belegt". Der After-Report KBB-115 meldet
   v0.2.0 als gebaut („neu, Done") samt Live-Smoke im Sandbox. Der lesbare Quellstand bestätigt den
   Code; die Abnahme fehlt.
2. **„keine Code-Implementierung" gegen Cockpit-Code:** `docs/boss-assistant/interviews/team-3.md`
   (06.07.2026) beschreibt das Repository als „Nur `README.md` + `docs/` … keine
   Code-Implementierung". Der gelesene `HEAD` `25dbe922` enthält `cockpit/` mit Server und
   Oberfläche. Ob die Commits je gepusht wurden, ist nicht belegt.
3. **Kennung D-011 doppelt belegt:** Im Team-3-Material ist D-011 die offene
   Commercial/Billing-Entscheidung. In `apps/web/src/pages/Validation.quittung.test.tsx` heißt
   „Sollvertrag D-011" die Quittung nach einer Bewertung. Für einen D-010/D-011-Tracker ist die
   gemeinte Kennung deshalb nicht eindeutig.
4. **Schreibweise der Gate-Stati:** KBB-113 nennt `offen/erfüllt/blockiert`; die Gate-Ansicht zählt
   `erfüllt`, Überblick und Bericht zählen `erfuellt` (Abschnitt 2). Welche Schreibweise die
   gespeicherten Daten tragen, ist nicht belegt; K2 verlangt deshalb beide.
5. **Fehlende Belege:**
   - die Befundquelle `recherche/sichtung/OPS-COCKPIT-ORIGINALBEFUND.md` (Abschnitt „Dynamisch
     gemessene Abweichungen"). Die statischen Befunde aus Abschnitt 2 bestätigen ihre Aussagen, eine
     dynamische Messung fehlt;
   - die Zuordnung des gelesenen Dateistands zum Git-Stand (Git-Lesefehler, Abschnitt 2);
   - ein Funktionsnachweis für K1/K2 am Cockpit;
   - die Abnahme SR-1 und ein erzeugter `OPS_STATUSBERICHT_<Datum>.md`;
   - die Altquelle `FUNKTIONSREGISTER.json:32602`. Sie trägt keine Zeitangabe (`zeit: null`) und
     wurde nicht gelesen.

## 8. Prüfbelege

- **Kandidat `53dfa0eb`, Archiv `HISTORIE/nacharbeit-1/PRUEFUNG`:** Build und Format grün, die
  fünf Fälle der Fundstellenprobe grün. Das belegt nur das Dokument, nicht das Cockpit.
- **Nacharbeit 1:** Dokument und Fundstellenprobe berichtigt (Abschnitte 2–4, 7). In diesem
  Arbeitsgang ist kein Test gelaufen; das Ergebnis steht im nächsten Prüfarchiv.
- **Fundstellenprobe:** `tests/kundenbereitschaft/cockpit-einordnung.test.ts`. Sie hält fest, dass
  die genannten Dateien existieren, die tragenden Sätze dort stehen und kein Cockpit-Code im Produkt
  liegt. Sie belegt **nicht** das Verhalten des Cockpits und ist kein Nachweis für K1 oder K2.
