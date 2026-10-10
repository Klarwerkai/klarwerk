# ADMIN-10 · Qualitätsaufgaben und Rückmeldungen gemeinsam bearbeiten

Auftrag `produkt:20261009:admin-qualitaetsaufgaben`. Fläche `/qualitaetsaufgaben`, erreichbar aus
der Verwaltung (Gruppe „Qualität und Freigaben", Zeile „Alle Qualitätsaufgaben und Rückmeldungen").

## Was die Fläche ist

Eine **Leseansicht** auf vorhandene Vorgänge. Es gibt keinen neuen Aufgabenspeicher und keine neue
Erkennung. Jeder Eintrag nennt seinen Ursprung (`ursprung`) und den vorhandenen Arbeitsweg
(`arbeitsweg`):

| Typ | Quelle (vorhanden) | Arbeitsweg | Zuständigkeit | Frist |
|---|---|---|---|---|
| Prüfung | `ValidationService.board` | `/wissen/:id` | offene Prüferzuweisungen | keine hinterlegt |
| Revalidierung | `LifecycleService.pendingRevalidation` + `lifecycle.revalidation-requested` | `/lebenszyklus?fall=:id` | `responsibleOf` (Eigentümer, sonst Autor) | `revalidierungAm` |
| Konflikt | `ConflictService.unresolved` | `/konflikte?fall=:id` | keine im Bestand → „niemand zugeordnet" | keine hinterlegt |
| Duplikat | `OverlapService.unresolved` | `/duplikate/:id/vergleich` | keine im Bestand → „niemand zugeordnet" | keine hinterlegt |
| Wissenslücke | `AskService.listGaps` (offen), Fragetext nach `redactGapForViewer` | `/risiko?fall=:id` | `assignee` | keine hinterlegt |
| Rückmeldung | Protokoll `answer.reported` (R-1089, „Antwort falsch" / „Quelle passt nicht") | `/wissen/:koId` | `responsible` der Meldung | keine hinterlegt |

Einmal gezählt: der Schlüssel eines Eintrags ist `typ:ursprung`. Erreichen mehrere Quellzeilen
denselben Vorgang (Board und Prüferzuweisungen; mehrere Prüfanforderungen an dasselbe Objekt; eine
übernommene Rückmeldung an einer laufenden Revalidierung), entsteht ein Eintrag, und die Zeilen
stehen in `einstiege`. Die Fläche zeigt die Bilanz „N Einstiege führen auf M Vorgänge".

## Rückmeldung → Aufgabe

Rückmeldungen kommen ausschließlich aus der **vorhandenen** Ereignisquelle `answer.reported`. Eine
Quelle für Rückmeldungen direkt aus Artikeln oder aus Klara gibt es im Bestand nicht; sie wird hier
nicht angelegt.

„Als Aufgabe übernehmen" fordert die vorhandene Revalidierung des betroffenen Objekts an
(`LifecycleService.requestRevalidationAusRueckmeldung`). Neu im gelieferten Umfang sind genau zwei
Protokolleinträge, beide Belege und keine eigenen Rückmeldequellen:

1. `qualitaet.rueckmeldung-uebernommen` — je Meldung höchstens einmal (`recordOnce`, Ereignis
   `qualitaet.rueckmeldung-uebernommen:<meldungId>`). Wiederholtes oder gleichzeitiges Übernehmen
   antwortet „bereits" mit Person und Zeitpunkt.
2. Der Grund `rueckmeldung` (mit `meldungId`) am vorhandenen Beleg
   `lifecycle.revalidation-requested`. Läuft die Revalidierung schon, wird nichts neu angefordert;
   die Meldung hängt sich an diesen Vorgang („angehängt").

Erledigt ist eine übernommene Rückmeldung erst mit einer Bestätigung `ko.revalidated` **nach** der
Übernahme. Das Ergebnis (wer, wann, Fassung) und der Rückbezug (Übernahme, Vorgang, Weg zum
Objekt) stehen am Eintrag. Fehlt dieses Signal und läuft keine Revalidierung, heißt der Zustand
„Unklar – Signal fehlt", nie „Erledigt". Eine spätere Meldung zum selben Objekt ist wieder offen.

## Rechte

`GET /api/qualitaetsaufgaben` und `POST /api/qualitaetsaufgaben/rueckmeldungen/:meldungId/uebernehmen`
fordern `users.manage`. Jede Zeile läuft durch `sichtbarkeitsfilterFuer(user)`; ein Paar erscheint nur,
wenn beide Seiten sichtbar sind. Ein Objekt in einem Space, den die Verwaltung nicht lesen darf, fehlt
in Liste und Zahl; Übernehmen antwortet dort 404 und schreibt nichts. Den Fragetext einer Lücke
sieht die Verwaltung nur als Zuständige (R-0585).

## Grenzen

- Konflikte und Duplikate tragen im Bestand weder Zuständigkeit noch Frist; die Fläche zeigt das
  ausdrücklich, sie erfindet keine.
- Die Glocke der verantwortlichen Person führt die Meldung unverändert weiter; sie zeigt den
  Übernahmestand nicht.
- Prüfungen haben keine Frist im Bestand; ihr Beginn ist der Verlaufseintrag der aktuellen Fassung.
