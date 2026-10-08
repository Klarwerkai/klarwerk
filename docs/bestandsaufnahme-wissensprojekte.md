# Bestandsaufnahme Wissensprojekte — Stand 09.10.2026

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
| Firmenfilter stimmen | **ungeklärt** | s. Widerspruch 2 |

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
4. **Konsistenz bei Gleichzeitigkeit.** Läuft ein Spacewechsel in den Space zwischen Prüfung und
   Vermerk, nimmt die Löschung sich mit einer neuen Fassung ohne Vermerk zurück (409). Wird der
   Zielspace während eines Spacewechsels gelöscht, geht der Artikel in seinen bisherigen Space
   zurück (409 `VORSCHAU_VERALTET`). So entsteht kein Artikel mit der Kennung eines gelöschten
   Space; ein solcher wäre nach `sichtbarkeit.ts` fail-closed für alle unsichtbar.
5. **Oberfläche** (`apps/web/src/pages/Spaces.tsx`, Texte `apps/web/src/texte/spaces.ts` DE/EN/NL).
   „Space löschen“ für Berechtigte öffnet die Folgenkarte; der Bestätigungsknopf ist gesperrt,
   solange Artikel den Space tragen, die sichtbaren sind verlinkt. Nach der Löschung zeigt die
   Übersicht eine Bestätigung.
6. **Rechtematrix** um beide Routen ergänzt (`tests/security/routeGuardAudit.ts`,
   `tests/security/mega74-lesewege-sammler.test.ts`).

Die Regel „erst verschieben, dann löschen“ (kein Mitlöschen, kein Sammelverschieben beim Löschen)
ist **meine vorläufige Regel**, keine Nutzerentscheidung. Grund: ein Sammelwechsel änderte die
Sichtbarkeit vieler Artikel auf einmal und bräuchte je Artikel die bestehende Rechtevorschau.

## Widersprüche und fehlende Belege

1. **Begriff.** Die Quelle spricht von „Projekten“, das Produkt kennt „Spaces“. Die Zuordnung ist
   abgeleitet (s. oben). Ist mit „Wissensprojekt“ etwas anderes gemeint, gilt diese Lieferung nur
   für Spaces.
2. **Firmenfilter.** Das Produkt führt keine Firmen als Daten: je Organisation gibt es eine eigene
   Instanz (Entscheidung 03.07.2026, `PROJECT_CONTEXT/09_ENTSCHEIDUNGEN.md`: „jede Organisation“,
   eigener Server je Kunde). Ein Filter nach Firmen innerhalb einer Instanz hat damit keinen
   Gegenstand. Nicht zu verwechseln: der Confluence-„Firmenfilter“ gehört zu `package:confluence`
   (gesonderter Auftrag, `docs/bestandsaufnahme-confluence-import.md`), die nicht montierte
   Ortszeile „gesamtes Unternehmen“ (`apps/web/src/components/LibraryScopeBar.tsx`) zu einer offenen
   Ownerentscheidung (PLAN PRO 378 §9). Beides ist hier nicht bearbeitet.
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
