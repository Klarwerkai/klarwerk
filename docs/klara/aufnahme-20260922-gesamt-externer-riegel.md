# Aufnahme 20260922 · Externer Zugriffsriegel — Abgleich und Klärung

Auftrag `aufnahme:20260922:gesamt-externer-riegel`, Revision 1. Abgeglichen am 13.10.2026 gegen
den Stand **1.0.0-beta.1.953** (Basis `06468f05`).

Dies ist ein **Abgleich mit dem vorhandenen Stand** und eine **Klärungsvorlage**. Fertige Teile
werden nicht neu gebaut, und offene Entscheidungen werden nicht ersetzt. Die Auftragsquelle mit
Originalwortlaut, Herkunft und Altbelegen liegt **nicht** im Arbeitsbaum. Sie wurde dem Lauf als
`QUELLEN.json` beigegeben (Registerauszug `REGISTER-SNAPSHOT.json` `$.eintraege[509]`, sha256
`6e22ce8e…`). Die Kennungen R-0510, F-0510 und JOB 2003 kommen im Repository nicht vor.

## Das eine Anliegen

**R-0510 „Externer Riegel (KA6)“** (Alias F-0510, Bereich Verwaltung, Kategorie Rechte/Identität,
Zustand `angedacht`, Prüfstatus `nur_altquelle`, Quell-IDs JOB 2003 und KA6):

> Eine Schutzsperre gegen Zugriffe von außen. Sie wurde in achtzehn Anläufen bearbeitet: der
> zweite Durchgang war grün, alle sechzehn danach rot, und die Sache galt trotzdem lange als
> fertig, weil die Zählregel den besten statt den jüngsten Durchgang nahm.

Herkunft: Erkenntnisbuch, Eintrag vom 26.08.2026: „JOB 2003 hat achtzehn Durchgänge, D1 rot, D2
grün, danach D3 bis D18 alle rot, und die Kennung galt als erledigt. Der jüngste Stand ist rot.“
Notiz der Quelle: „Beispiel für die Messfalle, eine Kennung nach ihrem besten statt ihrem jüngsten
Durchgang zu zählen.“ Eine Pedi-Auswahl ist nicht gesetzt (`pedi_override: null`), es gibt keine
Entscheidung (`entscheidungen: []`).

## Die Messfalle (Klärung zu K2)

Die Kennung ist **das Beispiel** der Quelle für eine falsche Zählregel. Am Fall heißt das:

| Zählregel | Ergebnis für JOB 2003 am 26.08. |
|---|---|
| bester Durchgang | D2 grün → „erledigt“ |
| jüngster Durchgang | D18 rot → **offen** |

Richtig ist der jüngste Durchgang. Ein früheres Grün ist kein Nachweis, wenn danach rote
Durchgänge folgen. Daraus folgt für diesen Abgleich:

- Der Altstand **„erledigt“ gilt nicht**. Der jüngste dokumentierte Stand der Quelle ist rot.
- Auch der Code-Stand unten ist erst dann ein **aktueller** Nachweis, wenn der **jüngste**
  Prüflauf dieses Auftrags grün ist. Ein früherer grüner Lauf anderer Aufträge (z. B. der
  Sprachassistent-Abgleich am Kandidaten `366e624e`) ersetzt ihn nicht.

Die Zählregel selbst gehört nicht zum Produkt. Sie liegt im Steuerbestand außerhalb dieses
Repositorys (`00_CONTROL`). Sie wird hier nicht geändert und nicht geprüft.

## Stand heute im Code

Der Riegel, der in der Quelle „KA6 Stufe 2 (externer Riegel)“ heißt, ist heute als
Einwilligungstor im Erzeuger gebaut:

| Teil | Ort | Was er tut | Beleg (Testdatei) |
|---|---|---|---|
| Riegel im Erzeuger (JOB 3026) | `services/output/src/zuruf.ts`, `einwilligungLiegtVor` | Fragt das Sitzungstor und öffnet nur bei genau `erlaubt === true`. Fehlende oder halbe Bindung, kein Tor, werfendes Tor, `erlaubt: false` und Antworten ohne `erlaubt` bleiben geschlossen (`CONSENT_MISSING`). Der Formulierer wird dann nicht gerufen, der Bestand nicht gelesen. `ZurufEingabe` hat kein Feld `einwilligung` mehr | `tests/ka6/job3026-riegel-am-erzeuger.test.ts`, `tests/output/ka6-zuruf.test.ts` |
| Sitzungstor | `services/app/src/services/klara-session-service.ts`, `pruefeExterneAusfuehrung` | Liest Sitzung und Zustimmung frisch. Eine nicht deckende Zustimmung wird entwertet und protokolliert. Eine Zustimmung trägt nur Aufgaben am selben Anbieter | `services/app/src/services/klara-consent-protokoll.test.ts` |
| Schalter | `services/reasoner/src/klara-policy.ts`, `KLARA_EXTERNAL_EXECUTION_MIGRATED = true` (seit JOB 3079) | Ohne den Schalter blockiert die Auflösung mit `external_not_migrated` | `services/reasoner/src/klara-policy.test.ts` |
| Draht (JOB 3091) | `services/app/src/routes/klara-session-routes.ts`, `POST /api/klara/sessions/{id}/zuruf` | Ohne Zustimmung 403 `CONSENT_MISSING`, kein Entwurf, kein Modellaufruf. Ohne Bindungskopfzeilen wird das Tor gar nicht erst gefragt | `tests/ka6-memo-panel/memo-route.test.ts` |

Urteil: **Im Code gebaut.** Ob er heute hält, sagt allein der jüngste Prüflauf dieses Auftrags
(siehe „Prüfung“). Ein Beleg aus echtem Word und mit echtem Anbieter fehlt (siehe „Offen“).

## Offene Geltungs- und Umfangsfrage (K1)

Die Quelle sagt nicht eindeutig, was mit R-0510 bestellt ist. Drei Lesarten sind belegbar:

| | Lesart | Beleg | Was daraus folgte |
|---|---|---|---|
| **A** | R-0510 meint den KA6-Riegel im Zuruf-Weg (Einwilligung je Dokument, bevor Text das Haus verlässt) | Name „Externer Riegel (KA6)“, Quell-ID KA6, `OFFEN.md` Zeile KA6 („Stufe 2 (externer Riegel)“) | Gebaut (Tabelle oben). Rest: aktueller Prüflauf und Realbeleg |
| **B** | R-0510 meint eine allgemeine Sperre gegen Zugriffe von außen (Netz, Anmeldung, Rechte) | Satz „Schutzsperre gegen Zugriffe von außen“, Kategorie Rechte/Identität | Ein solcher Umfang ist in der Quelle nicht beschrieben. Ohne Zielzustand wäre jede Umsetzung erfunden |
| **B'** | R-0510 meint die zentrale Freigabe externer KI überhaupt | `KLARA_EXTERNAL_EXECUTION_MIGRATED`, KA4-Einwilligung | Gehört zu den Aufträgen zu KA4 und zu den KI-Freigaberegeln (`docs/entscheidungen/gesamt-ki-freigaberegeln.md`), nicht hierher |
| **C** | R-0510 ist nur das Beispiel einer Messfalle, keine Produktanforderung | Zustand `angedacht`, Notiz „Beispiel für die Messfalle …“, Hinweis „Altbestand: Einordnung offen“ | Kein Produktbau. Die Zählregel liegt außerhalb des Repositorys |

**Eindeutig bestellt** ist nur, was der Auftragstitel sagt: den vorhandenen Riegel fachlich
einordnen und aktuell nachweisen. Das leistet dieses Dokument mit dem Prüfplan zu Lesart A.

**Entscheidung erforderlich (Pedi):** Gilt R-0510 nach dem Nachweis als erledigt (A), bleibt es
ein reines Messfallen-Beispiel ohne Produktumfang (C), oder ist eine weitergehende Sperre
gegen Zugriffe von außen gewollt (B)? Für B fehlt ein Zielzustand. Diese Entscheidung wird hier
nicht getroffen.

## Quellenwidersprüche

- **W1 · Drei Jobnummern für dieselbe Stufe.** Die Quelle nennt JOB 2003 (achtzehn Durchgänge,
  jüngster rot). `OFFEN.md` Zeile KA6 nennt JOB 1162 D1 rot, „der Korrekturdurchgang läuft“. Der
  Code nennt JOB 3026. Ob JOB 2003 und JOB 1162 Vorläufer von JOB 3026 sind, lässt sich im
  Arbeitsbaum nicht belegen.
- **W2 · „Stufe 2 steht noch offen“ gegen den Code.** `OFFEN.md` Zeile KA6 und
  `docs/klara/aufnahme-20260922-gesamt-klara-assistenz.md` (Zeile KA6, Stand 21.08.) führen
  Stufe 2 als offen. Heute liegt der Riegel im Erzeuger (Tabelle oben). Beide Stellen bleiben als
  historische Aussagen unverändert.
- **W3 · Überholter Testkopf.** `tests/ka6/job3026-riegel-am-erzeuger.test.ts` sagte, eine Route
  gäbe es nicht, weil der Schalter auf `false` stehe (benannt schon in
  `docs/klara/aufnahme-20260922-gesamt-sprachassistent.md`, W1). **In diesem Lauf korrigiert:**
  Der Kopf trennt jetzt den Stand von JOB 3026 vom heutigen Stand. Die Testfälle sind unverändert.
- **W4 · Zustand „angedacht“ gegen Altstatus „IN_ARBEIT“ und „galt als erledigt“.** Drei
  verschiedene Einordnungen derselben Kennung. Nach der Regel „jüngster Durchgang“ ist keine
  davon ein heutiger Nachweis.

## Fehlende Belege

- Ein BEN-Urteil zu JOB 3026, JOB 2003 oder JOB 1162 ist im Arbeitsbaum nicht einsehbar.
- Die erste `ship:`-Fassung mit dem Riegel wurde nicht nachgeschlagen. Die Fassungsangabe oben
  ist der Abgleichsstand, kein Lieferdatum.
- Der echte Lieferbeleg dieses Auftrags (Fassung, Deployment, Livefassung) entsteht erst nach der
  Veröffentlichung (K3).

## Offen

- **O1 · Wirkung in echtem Word mit echtem Anbieter.** Alle Belege sind Unit- und Routentests mit
  Attrappen für Formulierer und Tor. Eine menschliche Bedienung im echten Word-Host mit erteilter
  und verweigerter Einwilligung fehlt. Abgegrenzt ist der bestehende M365-Folgeauftrag
  Realabnahme (`aufnahme:20260922:m365-anmeldung`).
- **O2 · Entscheidung zur Lesart** (siehe K1).

## Abgrenzung

- KA6 Stufe 1, Panel und Memo-Block sowie R-0376 gehören zu
  `aufnahme:20260922:gesamt-sprachassistent`
  (`docs/klara/aufnahme-20260922-gesamt-sprachassistent.md`). Dort ist auch der Riegel als
  Bestand geprüft. Hier wird er nur für R-0510 neu nachgewiesen.
- KA1–KA5, KA7, KA8 und R-0380 gehören zu `aufnahme:20260922:gesamt-klara-assistenz`.
- Die zentralen KI-Freigaberegeln und der Dokumenttext-Riegel (R-0639) stehen in
  `docs/entscheidungen/gesamt-ki-freigaberegeln.md`.
- Die verwandte Registerzeile R-1779 ist diesem Auftrag in der Quelle **nicht** zugeordnet.

## Prüfung

Dieser Lauf ändert keinen Produktcode, nur den Kopfkommentar einer Testdatei und dieses Dokument.
Der Prüfplan führt die vorhandenen Riegeltests aus (Erzeuger, Sitzungstor, Schalter, Route).
Ergebnisse stehen im Bericht des Prüfadapters, nicht in diesem Dokument. Gilt nur der
**jüngste** Lauf.
