# R-1863 „ENTSCHEIDUNGEN": Zuordnung zwischen gesamt-peer-validierung und gesamt-wissen-herkunft

*Aufnahme 20260922 · `aufnahme:20260922:gesamt-peer-validierung`, Nacharbeit 9 (Kandidat-Basis
`5f1ec900`). Grundlage: die Originalzeile `OFFEN.md:176` (W10, über `QUELLEN-HILFE-R1863-b2ff599ddfee.json`),
das darin genannte Klara-Gesamtkonzept (Abschnitte 2, 3, 6) und die Nutzerentscheide vom 11.10.2026
(`QUELLEN-FACHHILFE-PETER-ENTSCHEIDUNGEN-20261011.json`, Fragen 18–21, 27, 54).*

R-1863 ist im Register **beiden** Aufträgen zugeordnet (`assignments`: gesamt-peer-validierung und
gesamt-wissen-herkunft). Diese Datei legt fest, welcher Teil wo bearbeitet und nachgewiesen wird. Sie
erfindet keinen neuen Umfang, und sie verteilt nichts um, was die Quellen schon zuordnen.

## 1. Die Teile von R-1863 und ihr Stand

Die Zeile nennt vier Stücke (Weisung, Teilbereiche, Copilot, Fakt ohne Prüfschleife) und als offene
Entscheidungen: „Weisungsbefugnis wie verankern · nachgelagerte Sichtung ja/nein ·
Geltungsbereich-Modell · S6".

| Teil | Entscheid | Auftrag | Stand in diesem Kandidaten |
| --- | --- | --- | --- |
| **A · Weisungsbefugnis am Konto mit Zuständigkeitsbereich** | Antwort 18: ausdrücklich im Benutzerkonto, mit Zuständigkeitsbereich; Geschäftsführung und weisungsberechtigte Personen; technische Administration genügt nicht | **gesamt-peer-validierung** (Freigaberegel: wer darf ohne Vier-Augen-Prüfung annehmen) | **umgesetzt**: `User.weisungsbefugnis` (`services/auth/src/types.ts`), eigene Spalte `users.weisungsbefugnis` (`repo-pg.ts`), Vergabe/Entzug nur über `PUT /api/users/:id` durch die Verwaltung mit Vermerk `user.weisungsbefugnis-set`, Karte in der Kontoverwaltung (`components/einstellungen/Weisungsbefugnis.tsx`). Die Rolle `admin` verleiht sie nicht. `*` = ganzes Unternehmen. |
| **B · Unmittelbar gültige eigene Weisung** | Antwort 19: befugte Weisung gilt sofort | **gesamt-peer-validierung** (neue Kontoregel neben Peer-Prüfung, Direktannahme, Eigentümerfreigabe) | **umgesetzt**: Aktion `weisung-validate`, Kontoregel `weisung`, Beleg `ko.weisung-validated` (Fassung, Bereich, Sichtung), Annahmeverweis wie bei den übrigen Annahmen. Nur eigene Objekte (`author`), nur im befugten Bereich (Kategorie), unter dem KO-Lock geprüft. |
| **C · Nachgelagerte Sichtung mit Verantwortlichem und Frist** | Antwort 19: „Verantwortlichen und Sichtungsfrist festlegen; gültig, solange kein berechtigter Widerruf oder Konflikt" | **gesamt-peer-validierung** | **umgesetzt**: `KnowledgeObject.weisungsSichtung` (verantwortlich ≠ Weisungsgeber, freigegebenes Konto mit Freigaberecht oder Weisungsbefugnis im Bereich; Frist frühestens heute), Aktion `weisung-sichten` (`bestaetigt` / `widerrufen` → Status offen, Annahme entfällt), Beleg `ko.weisung-gesichtet`, Anzeige „überfällig" an der Lesefläche. Ein Wahrheitskonflikt öffnet das Objekt wie bisher (`wahrheitskonfliktFolge`); solange er offen ist, lässt sich die Weisung nicht erneut gültig setzen (409). Weisung und Sichtung entscheiden nur die gelesene Fassung (`expectedVersion`, sonst 409 `KO_STALE`); sichten darf die benannte Person nur, solange sie Prüfrecht oder Weisungsbefugnis für den Bereich noch hat. |
| **D · Herkunft „Weisung von [Person] am [Datum]"** | Antwort 27 (Übernahme externer Freigaben mit Provenienz) als Nachbarentscheid; Kriterium von gesamt-wissen-herkunft: „Weisungswissen trägt seine befugte Herkunft und geltende Einordnung" | **gesamt-wissen-herkunft** | Hier nur die Daten, die dafür ohnehin entstehen: Beleg `ko.weisung-validated` nennt Person, Zeit, Fassung und Bereich; die Annahmezeile zeigt die Kontoregel. **Keine** eigene Herkunftsanzeige/-kennzeichnung in diesem Auftrag — die gehört dem Herkunftsauftrag und baut auf diesem Beleg auf. |
| **E · Überstimmen je Punkt mit Hinweis (`superseded`)** | Konzept Abschnitt 2/3; kein jüngerer Entscheid | Bestand (Konfliktsystem, R-0263 `vorrang` `ueberstimmt`) | **vorhanden, nicht neu gebaut**: Vorrangwahl am Konfliktentscheid (`services/conflicts/src/service.ts`, `vorrang.art = ueberstimmt`). Eine automatische Überstimmungsfolge aus `weisung-validate` gibt es **nicht** — sie wäre eine Vorrangentscheidung (Teil F). |
| **F · Geltungsbereich und Vorrang „spezieller vor allgemeiner"** | Antwort 20: Vorrang nach Geltungsbereich, Zeitraum und Befugnis; **Detailfälle ausdrücklich später** | geteilt; Grundregel im Bestand (R-0263 `schraenkt_ein` mit `geltungsbereich`) | **zurückgestellt** (s. Abschnitt 2). Nicht in diesem Kandidaten. |
| **G · Copilot / S6 (Modell)** | kein Entscheid; Konzept: „Maschinenfrage ist eine Geldfrage" | weder noch (eigenes Register-Thema S6) | **nicht Teil dieser Aufträge** — QUELLEN-HILFE-R1863: „S6 … nicht als zusätzliche Blockade". |
| **H · Fakt ohne Prüfschleife („10 Nm")** | über A/B abgedeckt (eine Weisung eines befugten Kontos); die KI-Umformung ist kein eigener Entscheid | gesamt-peer-validierung (Freigabe), Kennzeichnung der KI-Umformung im bestehenden KI-Kennzeichnungsweg | Freigabeweg = B. **Keine** eigene „Fakt"-Erfassung gebaut. |

Abgrenzung zu vorhandenen Lieferungen, damit nichts doppelt entsteht:

- `Gesamtanweisung` (JOB 4154, `services/knowledge-object/src/gesamtanweisung-*.ts`) ist ein
  zusammengesetztes Anweisungs**dokument** aus gebundenen Bausteinen mit eigener Entscheidung über die
  Gesamtfassung. Es ist **nicht** die Weisungsbefugnis und wird von ihr nicht berührt.
- Die Direktannahme des Admins (`admin-validate`, Kontoregel `direktannahme`) und der Word-Vertrag
  „Direktrückgabe nur Admin" bleiben **unverändert**. Weisung ist ein zusätzlicher, kontogebundener
  Weg; sie erweitert keine Rolle.
- R-0566 / R-2195: keine Expertenfreigabe **fremder** Beiträge — die Weisung gilt nur für **eigene**
  Objekte; über fremde Vorschläge entscheidet sie nicht.
- Antwort 21 (Experten/Leser melden Hinweise; Entscheidungen und Zuweisungen brauchen eigene Rechte):
  die Sichtung kann nur einer Person mit Freigaberecht oder eigener Weisungsbefugnis im Bereich
  zugewiesen werden.

## 2. Ausdrücklich zurückgestellt (Antwort 20)

„Vorrang nach Geltungsbereich, Zeitraum und Befugnis; Detailfälle während weiterer Entwicklung."
Nicht entschieden und deshalb **nicht gebaut**:

1. Wann eine neue Weisung eine bestehende Aussage **überstimmt** und wann sie sie nur
   **einschränkt** (Konzept Abschnitt 3, „Grenzfrage") — und wer das je Punkt festlegt.
2. Wie ein **Zeitraum** (gültig ab/bis) an der Weisung und an der allgemeinen Aussage beschrieben
   wird und wie er den Vorrang ändert.
3. Ob die **Befugnisstufe** (z. B. Geschäftsführung vor Bereichsleitung) bei widersprechenden
   Weisungen den Vorrang bestimmt.
4. Ob `weisung-validate` vor dem Einstellen einen Vergleich „gibt es dazu schon etwas?" **erzwingt**
   und die betroffenen Punkte je Punkt zur Entscheidung vorlegt (Konzept Abschnitt 2, „Erstens …
   Viertens"). Heute gilt dafür nur das vorhandene Dublettentor (offene Dublette ⇒ ausdrückliche
   Bestätigung).
5. Ein Geltungsbereich, der feiner ist als die Kategorie des Objekts (Anlage, Bauteil, Werk). Die
   Befugnis prüft heute die **Kategorie**; die Geltung (`geltung`, R-1632/R-1633) und der
   Anlagenkontext (R-1631) werden für die Befugnis nicht ausgewertet.

## 3. Quellenwidersprüche

- **„Bei einer Weisung bürgt das Amt" (Konzept 2) gegen Antwort 19:** das Konzept will keine
  Vier-Augen-Prüfung; Antwort 19 verlangt eine nachfolgende Sichtung. Umgesetzt ist Antwort 19 (jünger):
  **kein Tor davor**, aber eine Sichtung danach mit Widerrufsmöglichkeit.
- **Konzept 6 „Sichtung als Meldung an die Prüferrolle" gegen Antwort 19 „Verantwortlichen
  festlegen":** umgesetzt ist eine **benannte** verantwortliche Person mit Frist, keine Meldung an eine
  Rolle. Eine Benachrichtigung/Aufgabenliste für die Sichtende gibt es nicht; sie sieht die offene
  Sichtung am Objekt.
- **„Wer darf" — Konzept: „eigenes Recht, Kontoeigenschaft oder an Controller/Admin gebunden?"**:
  entschieden durch Antwort 18 = Kontoeigenschaft mit Bereich, ausdrücklich nicht an die Rolle.

## 4. Abschließende Zuordnung (Ben, Nacharbeit 11)

Die Aufteilung ist anhand der beiden **bestehenden** Originalaufträge abgeschlossen. Maßgeblich sind
deren Originalkriterien, nicht ein neuer Zuschnitt:

- `aufnahme:20260922:gesamt-peer-validierung` (dieser Auftrag): „Befugte menschliche Prüfung … keine
  neue Expertenfreigabe" und R-1863 als Kriterium — also **wer** annehmen darf, **wie** eine Annahme
  entsteht und wie sie gesichtet oder zurückgenommen wird.
- `aufnahme:20260922:gesamt-wissen-herkunft`: Kriterium „Weisungswissen trägt seine befugte Herkunft
  und geltende Einordnung" (zitiert in `QUELLEN-HILFE-R1863-b2ff599ddfee.json`,
  `bereits_quellenbelegte_abgrenzung`) — also, wie die Herkunft eines solchen Wissens **angezeigt und
  eingeordnet** wird.

| Teil | Verbindlich bei | Ergebnis, Fassung und Beleg | Rest |
| --- | --- | --- | --- |
| A · Befugnis am Konto | gesamt-peer-validierung | geliefert: Kandidat `2bc8169c` (Nacharbeit 11); Prüfbelege `HISTORIE/nacharbeit-11/PRUEFUNG` — Suite `integration-ko-routen-und-weisung` 47/47 grün (u. a. `weisung-befugnis-route` B1/B2/B7/B8), Build Exit 0 | PostgreSQL-Rundlauf `weisungsbefugnis-pg.integration.test.ts` (P1–P3) liegt vor, wurde aber in keinem archivierten Lauf ausgeführt — kein Beleg. |
| B · Unmittelbar gültige Weisung | gesamt-peer-validierung | geliefert wie A (B2/B3, Fläche M2/M6). Nacharbeit 12 ergänzt die Bindung an die gelesene Fassung (B10) und die Sperre bei offenem Wahrheitskonflikt (B12); deren Ausführung steht mit dem neuen Kandidaten aus. | — |
| C · Sichtung mit Verantwortlichem und Frist | gesamt-peer-validierung | geliefert wie A (B4–B6, B9, Fläche M4/M5). Nacharbeit 12: Sichtung fassungsgebunden (B10, M7) und nur mit **aktueller** Befugnis (B11); Ausführung mit dem neuen Kandidaten. | Benachrichtigung/Aufgabenliste der Sichtenden: kein Original- oder Entscheidungsumfang (Abschnitt 3), nicht gebaut. |
| D · Herkunftsanzeige „Weisung von [Person] am [Datum]" | **gesamt-wissen-herkunft** | Von hier geliefert sind nur die Daten, auf die D aufbaut: Beleg `ko.weisung-validated` (Person, Zeit, Fassung, Bereich, Kontoregel), Annahmezeile mit Kontoregel „Weisung" (M6). | **Offen im Herkunftsauftrag**: Anzeige und Einordnung der Weisungsherkunft an Wissen und Antworten. Registerstand beim letzten belegten Lesen (08.10.2026, `QUELLEN-HILFE-R1863`): `status offen`, `completion_evidence null` — ein Erfüllungsbeleg liegt nicht vor und wird hier nicht behauptet. Keine Doppelimplementierung in diesem Auftrag. |
| E · Überstimmen je Punkt | Bestand (R-0263) | vorhanden, nicht Teil dieser Lieferung | — |
| F · Vorrang spezieller/allgemeiner | zurückgestellt (Antwort 20) | — | die fünf Punkte aus Abschnitt 2, erst nach Vertiefung durch den Nutzer |
| G · Copilot/S6 | keiner der beiden Aufträge | — | eigenes Register-Thema S6 |
| H · Fakt ohne Prüfschleife | gesamt-peer-validierung über B | Freigabeweg = B | keine eigene Fakt-Erfassung (kein Entscheid) |

Diese Zuordnung führt **keine** zusätzliche Freigabepflicht ein und verschiebt keinen Teil in einen
neuen Auftrag. Der einzige Teil von R-1863, der außerhalb dieses Auftrags offen bleibt, ist D — beim
bereits bestehenden Auftrag gesamt-wissen-herkunft, dem er durch dessen eigenes Kriterium gehört.
