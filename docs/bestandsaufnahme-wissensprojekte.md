# Bestandsaufnahme Wissensprojekte — Stand 11.10.2026

Auftrag `aufnahme:20260922:gesamt-wissensprojekte` (Revision 1), Basis `13bf9f2bd` =
`1.0.0-beta.1.785`. Zugeordnet ist genau ein Originalpunkt: **`package:projekte`** („Wissensprojekte
verwalten“, Archivat-Synthese vom 17.09.2026, Originaleintrag `archivat-funktionen-projekte`). Die
dort genannten Kriterien sind laut Quelle **Planvorschläge**; eine direkte Nutzerquelle ist dort
ausdrücklich noch nicht zugeordnet. Der einzige historische Beleg der Quelle lautet „Löschen als
offen gemeldet“ (`CHECKLISTE-DEMO-vor-20260912-rev4.json`).

Diese Datei hält fest, was im Repository geliefert ist, woran man es sieht, was dieser Lauf ändert
und was offen bleibt. Ein „Beleg“ ist eine Datei oder ein Test im Repository. Ob ein Test grün ist,
belegt erst der Prüflauf am festen Commit; dieser Lauf hat **keine** Tests ausgeführt.

Legende: **geliefert** = im Code mit Test belegt · **dieser Lauf** = in diesem Lauf gebaut ·
**offen** = nicht gebaut · **ungeklärt** = ohne Beleg oder ohne passenden Produktbegriff.

## Was im heutigen Produkt ein „Wissensprojekt“ ist

Es gibt keine eigene Projekt-Entität. Der nächstliegende Bestand sind die **Spaces** (Arbeitsräume
mit Zweck, Mitgliedern, Zuständigkeit und Rechten; `services/app/src/spaces.ts`), geliefert im
**gesonderten Auftrag `produkt:20261007:spaces`** (Fassungen `1.0.0-beta.1.731` bis `.735`, zuletzt
Commit `1efe951de`). Ein Artikel hat höchstens einen führenden Space (`spaceId`); dieser bestimmt
zusätzlich zur Vertraulichkeitsstufe die Sichtbarkeit (`services/app/src/sichtbarkeit.ts`).

Die Gleichsetzung „Wissensprojekt = Space“ ist **meine Einordnung**, keine Nutzerentscheidung. Sie
stützt sich darauf, dass der Originalpunkt dieselben Handlungen nennt (erstellen, zuordnen, ändern,
löschen) und Spaces der einzige Bestand mit dieser Form sind.

## Übersicht

| Kriterium aus `package:projekte` | Stand | Beleg |
|---|---|---|
| Projekte erstellen | geliefert (Spaces-Auftrag) | `POST /api/spaces`; `tests/spaces/spaces-api.test.ts` K1, `tests/spaces/spaces-pg.integration.test.ts`, `tests-smoke/spaces-browser.spec.ts` K1 |
| Projekte ändern | geliefert (Spaces-Auftrag) | `PUT /api/spaces/:id` mit Fassungen und 409 bei veralteter Version; dieselben Tests K1 |
| Inhalte zuordnen | geliefert (Spaces-Auftrag) | Spacewechsel mit Rechtevorschau `POST /api/spaces/verschiebung[/vorschau]`; `spaces-api.test.ts` K4, Smoke K4 |
| **Projektlöschung funktioniert** | **dieser Lauf** | `POST /api/spaces/:id/loeschung`; `tests/wissensprojekte/space-loeschen.test.ts` L1, `tests-smoke/wissensprojekte-loeschen.spec.ts` |
| **Auswirkung auf Artikel wird vorab erklärt** | **dieser Lauf** | `POST /api/spaces/:id/loeschung/vorschau` und Löschkarte auf `/spaces/:id`; `space-loeschen.test.ts` L2, Smoke |
| **Verknüpfungen bleiben konsistent** | **dieser Lauf** | Löschen nur ohne führende Artikel (auch Papierkorb), Gegenprüfung bei gleichzeitigem Spacewechsel; `space-loeschen.test.ts` L3; PostgreSQL: `spaces-pg.integration.test.ts` (zweiter Fall) |
| Projektfilter stimmen | geliefert, nach Löschung **dieser Lauf** nachgemessen | Artikel je Space, gespeicherte Ansicht (Tag), Spaceliste mit Zähler: `spaces-api.test.ts` K2/K3; nach einer Löschung: `space-loeschen.test.ts` L4 |
| **Firmenfilter stimmen** | **Nacharbeit 5** (nach Pedis Entscheidung Frage 51) | Kontext je Space (`firma`/`partner`/`oeffentlich`) mit serverseitig erzwungenem Zugang; Filter `GET /api/spaces/artikel?kontext=…[&partner=…]` und `GET /api/spaces?kontext=…`, Filterleiste auf `/spaces`; `tests/wissensprojekte/firmenfilter.test.ts` F1–F4, `tests-smoke/wissensprojekte-firmenfilter.spec.ts`. Fassung und grüner Lauf stehen noch aus. |

## Was dieser Lauf ändert

1. **Löschvermerk statt DELETE** (`services/app/src/spaces.ts`). Eine Löschung ist eine weitere,
   unveränderliche Fassung mit `geloeschtAm`. `aktuelle()` führt einen so vermerkten Space nicht
   mehr — im Speicher wie in PostgreSQL (erst jüngste Fassung je Space, dann der Vermerk). Das
   Schema bleibt unverändert, der Verlauf (`fassungen`) bleibt vollständig.
2. **Löschvorschau** `POST /api/spaces/:id/loeschung/vorschau` (`routes/spaces-routes.ts`). Sie
   nennt die Artikel mit diesem führenden Space — mit Titel nur, wenn `darfSehen` es erlaubt —,
   die Zahl weiterer, für den Betrachter verborgener Artikel, die Zahl im Papierkorb sowie die
   Ansichten und Mitgliedschaften, die mit dem Space verschwinden. Sie schreibt nichts.
3. **Löschung** `POST /api/spaces/:id/loeschung` mit der Version der gesehenen Vorschau. Rechte
   wie beim Bearbeiten (Spacezuständige oder Kontoverwaltung; sonst 403, unsichtbar 404).
   Abgelehnt (409) bei veralteter Version (`VERSION_VERALTET`) oder solange ein Artikel — auch im
   Papierkorb — den Space trägt (`SPACE_NICHT_LEER`). Audit `space.geloescht`.
4. **Konsistenz bei Gleichzeitigkeit (Nacharbeit 4, Bens Befund).** Spacewechsel und
   Spacelöschung prüfen und schreiben jeweils vollständig unter einer gemeinsamen Sperre
   (`SpacesRepo.exklusiv`): im Speicherbetrieb eine prozessweite Warteschlange, in PostgreSQL
   zusätzlich `pg_advisory_lock`, damit auch mehrere App-Prozesse an derselben Datenbank sich
   ausschliessen. Die frühere Nachkontrolle mit Rücknahme ist entfernt — sie konnte einen Artikel
   ungeprüft in einen inzwischen gelöschten Quellspace zurückschreiben. Ergebnis: Eine Löschung
   sieht jeden vorher abgeschlossenen Wechsel; ein Wechsel findet einen vorher gelöschten Space
   nicht mehr (404). So entsteht kein Artikel mit der Kennung eines gelöschten Space; ein solcher
   wäre nach `sichtbarkeit.ts` fail-closed für alle unsichtbar. Gegenproben:
   `space-loeschen.test.ts` L3 (beide Reihenfolgen und Bens Ablauf A→B mit Löschung von B und A
   im Fenster), `spaces-pg.integration.test.ts` (Sperre über zwei Pools).
5. **Oberfläche** (`apps/web/src/pages/Spaces.tsx`, Texte `apps/web/src/texte/spaces.ts` DE/EN/NL).
   „Space löschen“ für Berechtigte öffnet die Folgenkarte; der Bestätigungsknopf ist gesperrt,
   solange Artikel den Space tragen, die sichtbaren sind verlinkt. Nach der Löschung zeigt die
   Übersicht eine Bestätigung.
6. **Rechtematrix** um die Routen ergänzt (`tests/security/routeGuardAudit.ts`,
   `tests/security/mega74-lesewege-sammler.test.ts`), in Nacharbeit 5 auch
   `GET /api/spaces/artikel`.
7. **Firmenfilter (Nacharbeit 5)** — s. Widerspruch 2.
8. **Integration mit main (Nacharbeit 6).** Main brachte zu Spaces Teams, Archivieren/Wiederaufnehmen,
   Bestandszuordnung, Freigaberegeln und Vorlagen. Beide Seiten sind erhalten; an den Berührungen gilt:
   - Der Spacewechsel trägt main's Bindung an die wirksame Rechtelage (`grundlage`),
     Prüfzuständigkeit und Freigaberegel — und läuft weiter vollständig unter der Sperre.
   - Auch die Bestandszuordnung (`POST /api/spaces/bestand/zuordnung`) und das Ablegen eines
     neuen Beitrags im gewählten Space (Vorlagen-Einreichung, `build-app.ts`) setzen den führenden
     Space unter derselben Sperre; ein inzwischen gelöschter Zielspace wird nicht belegt.
   - Der Löschvermerk ist endgültig: `lege` schreibt auf einen gelöschten Space keine weitere
     Fassung (Speicher und PostgreSQL). So belebt weder Archiv, Freigaberegel, Vorlagenänderung
     noch Bearbeiten einen gelöschten Space still wieder; Freigaberegel- und Vorlagenwege
     behandeln ihn wie einen fehlenden.
   - Der Team-Wrapper `TeamAufloesendeSpaces` reicht die Sperre an die Ablage durch.
   - Textschlüssel des Firmenfilters heißen jetzt `spaces.firmenfilter.*`, weil main
     `spaces.filter.*` für seine Suchleiste belegt; der Kontextfilter ändert nur `kontext` in der
     Adresse und lässt main's Filter stehen.

Die Regel „erst verschieben, dann löschen“ (kein Mitlöschen, kein Sammelverschieben beim Löschen)
ist **meine vorläufige Regel**, keine Nutzerentscheidung. Grund: ein Sammelwechsel änderte die
Sichtbarkeit vieler Artikel auf einmal und bräuchte je Artikel die bestehende Rechtevorschau.

## Widersprüche und fehlende Belege

1. **Begriff.** Die Quelle spricht von „Projekten“, das Produkt kennt „Spaces“. Die Zuordnung ist
   abgeleitet (s. oben). Ist mit „Wissensprojekt“ etwas anderes gemeint, gilt diese Lieferung nur
   für Spaces.
2. **Firmenfilter — durch Pedis Entscheidung vom 11.10.2026 geklärt.**
   *Damaliger Stand (bis Nacharbeit 4, überholt):* Das Produkt führt keine Firmen als Daten (eine
   Instanz je Organisation, Entscheidung 03.07.2026); der Filter hatte keinen Gegenstand, die
   Bedeutung war eine offene Entscheidung.
   *Jetzt:* Frage 51 (`QUELLEN-FACHHILFE-PETER-ENTSCHEIDUNGEN-20261011.json`, `human_decisions[0]`;
   Original `FRAGEN_AN_PETER_ORIGINAL.md:408–414`): „Firmenfilter als serverseitig berechtigter
   Firmen-/Partner-/öffentlicher Kontext“ — eigene Firmeninstanz, ausdrücklich erlaubte
   Partnerbereiche und öffentliche Quellen klar unterscheiden; Antwort „deine empfehlung, arbeite es
   aus“. Die Detail-Ausarbeitung `LAGEBILD_UND_FIRMENFILTER` ist laut Quelle nur ein Vorschlag und
   wurde **nicht** übernommen (keine zusätzliche API- oder Sicherheitsmatrix daraus).
   *Ausarbeitung (meine, im bestehenden Space-Weg):*
   - Jeder Space trägt einen Kontext: `firma` (Vorgabe; auch Altbestand ohne Angabe und Artikel
     ohne Space), `partner` mit genau einem Partnernamen, `oeffentlich`.
   - Partnerbereiche sind **nur** für ausdrücklich berechtigte Konten (Mitglieder, Zuständige)
     lesbar: der Server lehnt Zugang `alle` ab (`SPACE_KONTEXT_ZUGANG`); kein Rollen-Durchgriff,
     auch nicht für die Kontoverwaltung. Öffentliche Quellen sind für alle mit Leserecht offen
     (Zugang `mitglieder` abgelehnt).
   - Der Filter (`GET /api/spaces/artikel?kontext=…`, optional `&partner=…`) liefert nur, was
     `darfSehen` dem Betrachter je Artikel erlaubt; die Partnerliste nennt nur sichtbare Bereiche.
     `GET /api/spaces?kontext=…` grenzt die Spaceliste ein. Auf `/spaces` stehen dafür vier
     Schaltflächen (Alle, Eigene Firma, Partnerbereich, Öffentliche Quellen) mit Artikelliste.
   - Gegenproben an konkreten Fällen: `tests/wissensprojekte/firmenfilter.test.ts` — F1 eigene
     Inhalte (ohne Space, offen, geschlossen), F2 erlaubter Partner erscheint, fremder Partner nicht
     (auch nicht per Partnername, Detailabruf oder als Admin), F3 öffentliche Quellen für alle, F4
     serverseitige Kontextregeln und Altbestand; Oberfläche:
     `tests-smoke/wissensprojekte-firmenfilter.spec.ts`.
   *Noch offen:* der grüne Prüflauf und die Fassung dieser Nacharbeit. Unverändert getrennt bleiben
   der Confluence-„Firmenfilter“ (`package:confluence`) und die nicht montierte Ortszeile
   „gesamtes Unternehmen“ (`LibraryScopeBar.tsx`, PLAN PRO 378 §9). Einen Partnerzugang für
   Konten einer fremden Firma (eigene Anmeldung des Partners) baut dieser Auftrag nicht; berechtigt
   werden Konten dieser Instanz.
3. **Herkunft der Kriterien.** Laut Quelle Planvorschläge ohne zugeordnete Nutzerquelle; der
   historische Satz „Löschen als offen gemeldet“ ist kein Prüfbeleg.
4. **Lieferbeleg mit Fassung.** Die Fassungsnummer dieses Laufs vergibt der Starter; der
   tatsächliche Lieferbeleg entsteht erst mit Veröffentlichung (AUFTRAG.json, K2).

## Abgrenzung zu gesonderten Aufträgen

- `produkt:20261007:spaces` — Anlegen, Bearbeiten, Rechte, Ansichten, Spacewechsel. Wiederverwendet,
  nicht neu gebaut.
- `produkt:20261007:ownership-uebergabe` — Artikelverantwortung; vom Löschen unberührt.
- Jira-Import mit Projektleserechten (`1.0.0-beta.1.750`–`.754`) — „Projekt“ meint dort das
  Jira-Projekt als Importquelle, nicht ein Wissensprojekt.

## Fremde rote Wächter (nicht aus diesem Auftrag)

Am Kandidaten `54828f07` waren drei globale Sicherheitswächter rot, ohne dass dieser Auftrag die
betroffenen Stellen berührt: `route-guard-audit.test.ts` (der Textscanner liest
`mcp-routes.ts:284` `app.post(MCP_PFAD, …)` und nimmt das Literal `"/api/ask"` aus Zeile 357 als
Pfad — „POST /api/ask ist public“), `g10-herkunft-zentrum-vertraulich.test.ts` (drei Importrouten in
`library-routes.ts` ohne `zeilenrecht`) und `mega74-lesewege-sammler.test.ts`
(`POST /api/duplicates/:id/merge` ohne Urteil). Die beiden neuen Löschrouten stehen in keiner dieser
Fehlerlisten. Die Wächter bleiben unverändert; die Behebung gehört zu den jeweiligen Aufträgen.

## Nicht geprüft

Mehrere echte Menschen mit verschiedenen Rechten in der Oberfläche (die Smoke-Suite kennt ein
Konto; die Rechtewirkung misst der Drahttest). Kein Durchlauf auf einer Kundeninstanz.
