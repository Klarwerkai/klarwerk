# Restprüfung Gesamtanweisung — Zuordnung der Nachweise (BEN-Hinweise 4355/4357/4156)

Stand: 29.09.2026, Auftrag `aufnahme:20260922:gesamtanweisung-restpruefung` (Aufgabenrevision 13),
Basis `41fad46c`. Inhaltlich unverändert übernommen aus dem Kandidaten `ca955c93` (Lauf 3-v7, Runde 2
samt BEN-1; Ben-Codefreigabe dort erteilt), der wiederum `1dd77562` vom 24.09. fortschreibt. Die drei
gezielten Serverprüfungen dieses Ordners liefen am 28.09. an `ca955c93` grün (B6, Chromium): a7 4/4,
Verdeckung 5/5, Bestand 7/7. Sie sind an diesem Commit erneut zu fahren; frühere Belege ersetzen das nicht.

Diese Datei ordnet jedem Kriterium des Auftrags die Nachweise zu, die es tragen — die bestehenden
(unverändert) und die neuen aus diesem Ordner. Sie behauptet nichts, was nicht in einer der
genannten Dateien gemessen wird.

**Zu „4355“:** Im Repository (Quelltext, Tests, Commit-Historie ab Basis) gibt es keine Spur einer
JOB-Nummer 4355. In der Steuerung trägt der Listenauftrag `arbeit:gesamtanweisung-liste-20260919`
die Nummer 4355; seine Lieferung steht im Repository unter JOB 4357. Die Zuordnung unten stützt sich
deshalb auf die belegten Nachweise zu 4156, 4309, 4323, 4357 und 4362.

## Kriterium 1 — mehrere Anweisungen und alle Stände in DE/EN/NL im echten Browser, aus gespeichertem Bestand

| Nachweis | Was er misst | Grenze |
|---|---|---|
| **neu** `bestand-drei-sprachen-im-echten-browser.test.ts` | Echtes Chromium gegen eine echte Instanz auf einem echten Port, die die gebaute Fläche ausliefert. Fünf über die echten Türen angelegte Anweisungen, darunter je eine in `entwurf`, `vorgelegt`, `entschieden` (angenommen) und `abgelehnt`. In DE, EN und NL steht jede Zeile mit Titel und Standwort sichtbar da (Messung je Textknoten); danach wird die Seite neu geladen und alles noch einmal gemessen. Genau fünf Zeilen, kein Leersatz. | Speicherablage der Instanz, kein PostgreSQL, kein Prozesswechsel. Nur Chromium. |
| `tests/gesamtanweisung-nutzerweg/liste-nach-prozesswechsel.integration.test.ts` (JOB 4357) | PostgreSQL, echter Prozessneustart (SIGTERM, neue PID), Menüweg und Listenweg nur per Tastatur | Nur DE, nur eine Anweisung im Stand `entwurf`. Läuft nur, wenn `KLARWERK_PG_TEST_URL` gesetzt ist (nicht Teil von `tools/test`); ohne URL ist es ein Skip und zählt nicht als Nachweis. Die PG-URL ist laut Betriebshinweis vom 27.09. am Prüfweg repariert — ob dieser Lauf dort gefahren wird, entscheidet die Endprüfung. |
| `tests/wiki-gesamtanweisung-abnahme/a12-liste-flaeche.test.tsx` (JOB 4357) | Vier Anzeigelagen (laden/leer/Fehler/Bestand) in DE/EN/NL; Wechsel des Stands nach einer Statusänderung | jsdom mit festgelegtem `fetch`: kein Browser, kein Server |

## Kriterium 2 — vollständige Verdeckung mit dem echten Rollenprädikat am HTTP-Endpunkt

| Nachweis | Was er misst | Grenze |
|---|---|---|
| **neu** `verdeckung-am-http-endpunkt.test.ts` | Echter Port, Sitzungskekse. Vier Rollen, die Erwartung je Rolle kommt aus `darfSehen` (`services/app/src/sichtbarkeit.ts`) selbst. Für eine Anweisung, deren einziger Baustein vertraulich ist: Liste (Kopf ja, Zählung 0/1 bzw. 1/0), Einzelabruf (keine Bausteine), `staende` und `vergleich` (403 FORBIDDEN), Schreibtüren PUT-Kopf, Reihenfolge und Vorlegen (403, danach unverändert). Im rohen Antwortkörper stehen weder Titel noch Kennung noch Rumpfmerkmal des geschützten Eintrags. Gegenprobe: controller und admin bekommen diese Angaben im Einzelabruf. | Speicherablage der Instanz |
| **neu** `bestand-drei-sprachen-im-echten-browser.test.ts` (Experte-Fälle) | Auf der Fläche in DE/EN/NL: Zeile mit „0 Bausteine“ und dem Unvollständigkeitssatz; per Tab und Enter geöffnet: Hinweis sichtbar, 0 gezeichnete Bausteine, Titel des geschützten Eintrags nicht im sichtbaren Text. Gegenprobe: der Admin sieht ihn. | wie oben |
| `tests/wiki-gesamtanweisung-abnahme/a11-liste-rollenmatrix.test.ts` (JOB 4357) | Rollenmatrix, gleiche Zählung wie `GET /:id`, keine Bausteinangaben in der Liste | `app.inject`, kein Socket |
| `tests/wiki-gesamtanweisung-fassungsbindung/entzogenes-recht-kein-text.test.ts`, `absage-verraet-nichts.test.ts` | Kein Text und keine Kennung in Absagen, wenn das Recht fehlt | Dienst- bzw. `inject`-Ebene |

## Kriterium 3 — A7-Journal-/Absagefall über die echte montierte Oberfläche und API, mit Neuladen

| Nachweis | Was er misst | Grenze |
|---|---|---|
| **neu** `a7-journal-absage-im-echten-prozess.test.ts` | `services/app/src/server.ts` als eigener Prozess im Journalbetrieb, mit der Umgebung aus `scripts/insel/release-texte.mjs`. Der Server liefert die gebaute Fläche selbst aus. In DE/EN/NL wird „anlegen“ per Tastatur ausgelöst: Der Absagesatz steht sichtbar da, die Eingabe bleibt im Feld, es gibt keine Weiterleitung, und am Draht entsteht kein Eintrag. Nach dem **Neuladen** steht der abgelehnte Titel wieder im Feld und der Knopf ist bedienbar (unbestätigte Arbeit), die Liste zeigt den Leersatz ohne Phantomzeile und ohne Fehlersatz, und der im Journal gespeicherte Wissenseintrag ist weiter abrufbar (gespeicherte Arbeit). Nach einem **Prozessneustart** aus derselben Journaldatei gelingt die Anmeldung (das Konto kommt aus dem Journal), der Eintrag ist da, die Liste ist leer, und die Tür lehnt weiter ab. | Nur Chromium |
| **neu** `a7-titel-ueberlebt-neuladen.test.tsx` | Die Regeln des Merkers am gezeichneten DOM, im Tor ohne Browser: nach Absage und vollständig neuem React-Baum steht der Titel wieder da; ein anderes Konto im selben Tab sieht ihn nicht (die Abmeldung leert `sessionStorage` nicht) — auch nicht bei einem Sitzungswechsel OHNE Neuaufbau mit zwei vorhandenen Entwürfen (BEN-1, Runde 2); nach bestätigter Anlage und nach Leeren des Feldes ist er fort. | jsdom, festgelegtes `fetch` |
| `a7-desktop-journal-kein-stiller-verlust.test.ts` (JOB 4156) | Absage auf beiden Schreibmethoden des Ports; Wiederanlauf; Sätze im Katalog | `inject` bzw. Schlüssel. **Allein kein Bediennachweis** (BEN 4156 R3) |
| `a10-absage-bleibt-bedienbar.test.tsx` (JOB 4309) | Bedienung am DOM in DE/EN/NL, samt Kalibrierung der Weiterleitung | jsdom mit festgelegtem `fetch`, kein Neuladen |

**Produktänderung dazu (28.09.):** Bis zu dieser Fortschreibung ging der abgelehnte Titel beim
Neuladen still verloren (`useState` im Einstieg; im Kandidaten vom 24.09. nur als `A7-BEFUND`
gemeldet). Kriterium 3 verlangt, dass unbestätigte Arbeit das Neuladen übersteht. Der Einstieg
(`apps/web/src/components/gesamtanweisung/GesamtanweisungBereich.tsx`, `useUnbestaetigterTitel`)
merkt den Titel jetzt tab-gebunden in `sessionStorage`, je Konto getrennt, und löscht ihn nach der
bestätigten Anlage. Seit Runde 2 (BEN-1) trägt der Zustand den Kontoschlüssel, unter dem er
entstand: wechselt die bestätigte Sitzung bei montierter Fläche, wird er noch im selben Zeichnen
verworfen und aus dem Merker des neuen Kontos gelesen; geschrieben wird nur unter dem Schlüssel der
aktuellen Sitzung. Er ist kein zweiter Bestand: er nennt keine Kennung und erscheint nie in der
Liste. Ein neues Browserprofil (z. B. nach dem Prozessneustart) hat ihn nicht.

## Kriterium 4 — vorhandene Tastatur-/Listenabnahmen und frühere Gegenproben

Unverändert erhalten. Keine der folgenden Dateien wurde angefasst:

| Abnahme | Datei | Gegenproben / Kalibrierung |
|---|---|---|
| Menüweg ohne Maus, DE/EN/NL, im Tor (JOB 4362) | `tests/gesamtanweisung-tastaturweg/tastaturweg-im-echten-browser.test.ts` | `kalibrierung-im-echten-browser.test.ts` V1 `tabindex=-1` · V2 ohne Fokusring · V3 ohne `aria-expanded` · V4 Überschrift nicht gezeichnet · V5 Zeuge |
| Menüweg, Sprachen, Prozesswechsel gegen PostgreSQL (JOB 4323) | `tests/gesamtanweisung-nutzerweg/menueweg-tastatur-sprachen-prozess.integration.test.ts` | `menueweg-kalibrierung.integration.test.ts` K1–K10 (u. a. K3 kein deutscher Rückfall für EN, K4 Zeilen gelöscht zwischen Neustarts, K8 BENs `opacity:0` aus Runde 1); Zeuge `zeuge-kein-klick-kein-stiller-skip.test.ts` |
| Listenweg nach Prozesswechsel (JOB 4357) | `tests/gesamtanweisung-nutzerweg/liste-nach-prozesswechsel.integration.test.ts` | `liste-kalibrierung.integration.test.ts` L1 `display:none` · L2 durchsichtige Schrift · L3 `tabindex=-1` · L4 Bestand gelöscht; Zeuge `zeuge-liste.test.ts` |
| Liste an der Fläche (JOB 4357) | `tests/wiki-gesamtanweisung-abnahme/a12-liste-flaeche.test.tsx` | Fehler gegen leer, Antwort ohne `eintraege`, genau ein Link je Zeile |
| Absage bedienbar (JOB 4309 / BEN 4156 R3) | `tests/wiki-gesamtanweisung-abnahme/a10-absage-bleibt-bedienbar.test.tsx` | Kalibrierung: bestätigte Anlage leitet weiter; leerer Titel schreibt nicht |

**Gegenproben** (von Hand gefahren, danach vollständig zurückgenommen). 1–3 stammen aus dem
Kandidaten vom 24.09.; 4–5 sind am 28.09. gegen den Merker gefahren:

1. `sichtbarFuer` in `services/app/src/routes/gesamtanweisung-routes.ts` gibt immer `true` zurück:
   `verdeckung-am-http-endpunkt.test.ts` → 4 von 5 Fällen rot (Liste, Einzelabruf,
   Stände/Vergleich, Schreibtüren). Grün bleibt nur der Fall, der das Prädikat selbst befragt.
   Am 28.09. an der neuen Basis erneut gefahren: dasselbe Ergebnis.
2. Die Listenzeile in `GesamtanweisungBereich.tsx` zeigt immer `ga.stand.entwurf`, Fläche neu gebaut:
   `bestand-drei-sprachen-im-echten-browser.test.ts` → die drei Admin-Fälle (DE/EN/NL) rot.
3. `new FluechtigeAnweisungsablage(false)` in `services/app/src/build-app.ts` (Stand vor 4156 R3):
   `a7-journal-absage-im-echten-prozess.test.ts` → alle 4 Fälle rot.
4. `merkerSchreiben` schreibt nichts mehr: `a7-titel-ueberlebt-neuladen.test.tsx` → 2 von 4 Fällen
   rot („der abgelehnte Titel ist nach dem Neuzeichnen fort“, „das eigene Konto verliert seinen
   Titel“).
5. Merkerschlüssel ohne Kontokennung: `a7-titel-ueberlebt-neuladen.test.tsx` → der Fall „ein anderes
   Konto im selben Tab sieht den Titel NICHT“ rot.
6. Runde 2: die Merkerfassung aus Runde 1 (Zustand ohne Schlüssel, Nachladen per Effekt nur in ein
   leeres Feld) wieder eingesetzt: `a7-titel-ueberlebt-neuladen.test.tsx` → der Fall „BEN-1 ·
   Sitzungswechsel OHNE Neuaufbau“ rot („nach dem Wechsel zu B steht As Titel im Feld“), die
   übrigen vier grün — genau Bens Befund.

**Zusätzliche Browser und Bildschirmleser:** Nicht gemessen. Im Repository ist kein Sollumfang
dafür vereinbart; alle Browsernachweise dieses Bereichs benennen ausdrücklich nur Chromium.
