# Mehrinstanz-Tor — wann eine zweite Anwendungsinstanz gegen dieselbe Datenbank laufen darf

**Freigabe: GESPERRT**

Stand: R-0824 (Auftrag „Übersprungene Datenbanktests sichtbar machen und echte Datenbankprüfung
belegen"). Gehalten von `tests/app/mehrinstanz-tor.test.ts`.

## Worum es geht

KLARWERK darf heute nicht ein zweites Mal gegen dieselbe Datenbank gestartet werden. Der Grund ist
nicht Leistung, sondern Korrektheit: mehrere Stellen im Produkt verlassen sich darauf, dass genau
ein Prozess läuft. Die schwerste davon steht im Anmeldedienst — `services/auth/src/repo-pg.ts`
trägt einen `DEPLOY-VERTRAG`, der eine Produktzusage an die Single-Instanz-Annahme bindet
(JOB 947 §2.3 U1, `OFFEN.md` I11).

Dieses Tor legt fest, was erfüllt sein muss, bevor die Sperre aufgehoben werden darf. Solange auch
nur eine Bedingung unten `OFFEN` ist, bleibt die Freigabe `GESPERRT`.

## Was die Sperre heute hält

- `docker-compose.prod.yml` beschreibt **einen** App-Dienst ohne `replicas`/`scale`. Der Wächter
  prüft, dass das so bleibt, solange die Freigabe gesperrt ist.
- Die tatsächliche Instanzzahl auf der Plattform (Coolify) ist eine Owner-Auskunft und **unbelegt**
  (JOB 947, Ownerfrage O-1). Dieses Tor ersetzt sie nicht.
- Es gibt **keine** technische Startsperre im Code: eine zweite Instanz wird heute nicht abgewiesen,
  sie läuft in die Fälle unten hinein. Eine solche Sperre ist nicht gebaut, weil sie einen
  Rolling-Deploy (neuer Prozess startet, bevor der alte endet) blockieren würde — das wäre eine
  eigene Betriebsentscheidung.

## Bedingungen

Spalten: Kennung · Status (`OFFEN`/`ERFÜLLT`) · Stelle (`Datei` · `Merkmal`) · was bei einer zweiten
Instanz heute geschieht · was vor der Aufhebung erfüllt sein muss (bei `ERFÜLLT`: der Beleg).

| Kennung | Status | Stelle | Heute bei zwei Instanzen | Vor der Aufhebung / Beleg |
|---|---|---|---|---|
| T1 | OFFEN | `services/app/src/db.ts` · `export async function migrate` | Der Schemaaufbau läuft ohne Sperre. Gemessen: beim gleichzeitigen Erstaufbau fällt die zweite Instanz mit einer Eindeutigkeitsverletzung im Katalog (23505) aus (`tests/pg-erstaufbau-konkurrenz/erstaufbau-konkurrenz.integration.test.ts`, E2). | `migrate()` läuft unter einer datenbankweiten Beratungssperre; E2 ist auf „die zweite Instanz kommt durch" umgeschrieben und gegen echtes PostgreSQL grün. |
| T2 | OFFEN | `services/auth/src/repo-pg.ts` · `migrateAuthTokensAtRest` | Der `DEPLOY-VERTRAG`: die Token-at-Rest-Migration läuft bei jedem Start ohne Serialisierung. Zwei Prozesse lesen dieselben Klartextzeilen und schreiben parallel. Der Dual-Read verhindert ein Aussperren, nicht den Bruch der Reihenfolgezusage. | Die Migration ist serialisiert (Sperre) oder mit dem Ende des Dual-Read-Übergangs entfernt; Nachweis mit zwei gleichzeitigen Starts gegen echtes PostgreSQL. |
| T3 | OFFEN | `services/auth/src/rate-limit.ts` · `class LoginRateLimiter` | Fehlversuche zählt jeder Prozess für sich im Arbeitsspeicher. Bei n Instanzen erlaubt die Anmeldung n-mal so viele Versuche je Fenster. | Gemeinsamer Zählerstand für alle Instanzen oder eine ausdrücklich entschiedene und dokumentierte Grenze je Instanz. |
| T4 | OFFEN | `services/auth/src/routes.ts` · `const officeHandover` | Der Office-Übergabecode liegt nur in der Instanz, die ihn ausgab. Landet die Einlösung an der anderen, lautet die Antwort „Übergabe abgelehnt". | Geteilte Ablage der Codes oder nachgewiesene Sitzungsbindung am Verteiler. |
| T5 | OFFEN | `services/app/src/build-app.ts` · `KLARWERK_ASK_RECEIPT_SECRET` | Ohne die Variable erzeugt jeder Prozess sein eigenes Zufallsgeheimnis; den Antwortbeleg einer Instanz erkennt die andere nicht an. | Die Variable ist für den Mehrinstanzbetrieb Pflicht und wird beim Start geprüft. |
| T6 | OFFEN | `services/app/src/routes/confluence-import-routes.ts` · `laufendeJeAblage` | „Höchstens ein Importlauf je Space" gilt nur innerhalb eines Prozesses; eine zweite Instanz startet einen zweiten Lauf daneben. | Die Sperre liegt in der Datenbank; Nachweis mit zwei Prozessen. |
| T7 | OFFEN | `services/app/src/server.ts` · `startTrashSweepScheduler` | Die periodische Papierkorb-Endlöschung läuft in jeder Instanz. Ihr Verhalten bei gleichzeitigen Läufen ist in diesem Tor nicht nachgewiesen. | Nachweis gegen echtes PostgreSQL, dass zwei gleichzeitige Läufe dasselbe Ergebnis haben wie einer — oder der Lauf ist auf eine Instanz beschränkt. |
| T8 | OFFEN | `services/app/src/server.ts` · `starteKlaraAufraeumen` | Der Klara-Aufräumlauf läuft ebenfalls in jeder Instanz; gleichzeitige Läufe sind in diesem Tor nicht nachgewiesen. | Nachweis gegen echtes PostgreSQL, dass zwei gleichzeitige Aufräumläufe dasselbe Ergebnis haben wie einer (kein doppelter Endeintrag im Prüfprotokoll) — oder der Lauf ist auf eine Instanz beschränkt. |
| T9 | ERFÜLLT | `services/audit/src/repo-pg.ts` · `SQL_AUDIT_KETTENSPERRE` | Zwei Schreiber hängen ihre Prüfprotokolleinträge über die Kettensperre nacheinander an. | Beleg: Kettensperre aus der Aufnahme gesamt-auditprotokoll; gemessen in `tests/pg-erstaufbau-konkurrenz/erstaufbau-konkurrenz.integration.test.ts`, E3. Im Auftrag R-0824 nicht neu gefahren. |

## Wie die Freigabe aufgehoben wird

1. Jede Bedingung wird einzeln auf `ERFÜLLT` gesetzt, und zwar nur mit einem Beleg in ihrer letzten
   Spalte: ein Test gegen echtes PostgreSQL oder eine ausdrückliche Betriebsentscheidung.
2. Kommt eine neue Stelle hinzu, die auf einer einzigen Instanz beruht, bekommt sie eine eigene
   Zeile mit `OFFEN`.
3. Erst wenn keine Zeile mehr `OFFEN` ist, darf oben `**Freigabe: ERTEILT**` stehen. Erst danach
   darf `docker-compose.prod.yml` oder die Plattform mehr als eine App-Instanz fahren.
