# Wissensbestand mit Vorschau und nachvollziehbarer Bilanz bereinigen

*Aufnahme 20260922 · gesamt-bestandsbereinigung, Revision 1. Lauf 1 auf Basis
`1.0.0-beta.1.730` (Commit `863a0974`). Zugeordnet: **R-0124** (alias F-0124) und **R-1115**
(alias F-1115). Die festgehaltene Fassung erzeugt der Starter nach dem Lauf; der echte
Lieferbeleg (Deployment, Livefassung) entsteht erst nach der Veröffentlichung.*

## Abgleich vor der Umsetzung

Beide Punkte stehen in der Quelle als `angedacht` / `nur_altquelle`; ein jüngerer Abschlussbeleg
war nicht zugeordnet. Abgeglichen wurde deshalb zuerst der Bestand:

| Punkt | Vorhanden auf `863a0974` | Lücke zum Zielzustand |
| --- | --- | --- |
| R-0124 | Aufräum-Kasten im Import-Bereich (`ImportCleanup.tsx`, Stufe 2) mit Vorschau → Bestätigen → Bilanz; Server `POST /api/admin/import/cleanup` (WP-D-CLEAN, WP-SHIP8-FIX/-CLOSE, WP-NIGHT-FIX): Vorschau zählt und verändert nichts, Bestätigung an den Vorschau-Digest gebunden, Bilanz aus dem echten Endzustand. | Die **erkannten Doppel-Kandidaten** (`duplicate: true` in der Review-Queue) wurden weder in der Vorschau noch in der Bilanz genannt — genau der Teil, den die Nachtestfrage vom 23.07. („nimmt auch die 17 Doppel-Kandidaten mit?“) offen liess. |
| R-1115 | Werkzeuge zum Entfernen: Aufräum-Kasten (Import-Beiträge Confluence/Jira → Papierkorb, Queue leeren), Demo-Purge `DELETE /api/admin/demo-seed`, weiches Löschen einzelner Beiträge, Bestandsreset (`services/db-tx/src/bestandsreset.ts`). | Die Quelle sagt selbst: **„kein Bauauftrag, sondern Aufräumen im Bestand“** — ein Betriebsschritt an der echten Instanz, kein Codeumfang. |

## Geliefert in diesem Lauf (R-0124)

- **Vorschau:** `importCleanupPreview()` liefert zusätzlich `duplicateCandidates` — wie viele der
  Kandidaten in der Zielmenge als Doppel erkannt sind. Teilmenge von `candidates`, nicht im Digest
  (die Ids sind es bereits). Der Kasten zeigt die Zeile immer, auch bei 0.
- **Bilanz:** `runImportCleanup()` liefert zusätzlich `removedDuplicateCandidates` — gezählt aus
  dem Ergebnis des bedingten DELETE (`removeByIds`), nicht aus der Vorschau. Bleibt die Queue nach
  Regel (3) stehen (ein Beitrag liess sich nicht löschen), steht dort ehrlich 0.
- **Abschlussbeleg:** der Beleg `import.cleanup` trägt `removedDuplicateCandidates` mit. Sieben
  flache Schlüssel = 5.040 Reihenfolgen, unter dem Deckel `MAX_PAYLOAD_ORDERINGS` der Kettenprüfung.
- **Texte:** neues Textmodul `apps/web/src/texte/aufraeumbilanz.ts` (DE/EN/NL); das byte-genau
  gepinnte Grundwörterbuch ist unverändert.
- Unverändert: Rechte (`users.manage`), Digest-Bindung, Drift-409, Papierkorb statt Endlöschung,
  alle bisherigen Zähler.

Belege (Testdateien, Ausführung auf dem Prüfweg):

- `tests/app/import-cleanup.test.ts` — zwei neue Fälle „R-0124“ (Vorschau/Bilanz/Beleg mit einem
  Doppel-Kandidaten; Bilanz 0 bei stehengebliebener Queue); die exakten Erwartungen der bisherigen
  Fälle um die beiden Felder ergänzt (Wert 0).
- `tests/bestandsbereinigung/doppel-kandidaten-im-kasten-mounted.test.tsx` — echte Komponente
  (jsdom): Zeile in Vorschau und Bilanz, Bilanzwert aus der Antwort statt aus der Vorschau, drei
  Sprachen.

## R-1115 — nicht ausgeführt, offen als Betriebsschritt

- Der Zielzustand (Test-Objekte und mehrfach importierte Dokumente aus dem sichtbaren Bestand
  nehmen) verlangt Zugriff auf die echte Instanz. Dieser Lauf hat keinen Produktions- oder
  Instanzzugriff und darf ihn nicht haben; es wurde **nichts** am Bestand verändert.
- Die Quelle bindet die Ausführung an eine **offene Frage an Pedi vor dem nächsten Kundentermin**
  (Notiz zu F-1115). Eine Antwort ist in den Quellen nicht dokumentiert.
- Was der Betrieb dafür nutzen kann, ist vorhanden: der Aufräum-Kasten (mit der neuen Vorschau der
  Doppel-Kandidaten) für Import-Beiträge und die Queue; das weiche Löschen einzelner Beiträge für
  Test-Objekte und die überzähligen Importe eines Dokuments (Papierkorb, 30 Tage
  wiederherstellbar); der Demo-Purge für Demodaten.
- Der Erfüllungsstand heute ist **ungeklärt**: nötig ist eine Sichtung der Instanz durch einen
  Menschen mit Adminrechten (welche Objekte sind die vier Test-Objekte, welche zwei der drei
  Leitfaden-Importe gehen, was gilt für den Entwickler als Autor).

## Abgrenzung: vorhandene Teilumfänge und gesonderte Aufträge

- **WP-D-CLEAN** und Folgen (WP-SHIP8-FIX F1/F2, WP-NIGHT-FIX, WP-SHIP8-CLOSE-2…9, WP-SHIP8-FINAL)
  — der Aufräum-Kasten samt Atomarität und ehrlicher Bilanz ist abgeschlossen und wird
  wiederverwendet; nur die Doppel-Zähler sind dazugekommen.
- **gesamt-dubletten-rueckzug** (`docs/entscheidungen/dubletten-rueckzug.md`) — Rückzug der
  eigenen Seite eines Überschneidungsbefunds (Wissensobjekte), nicht die Doppel-Kandidaten der
  Import-Queue. Nicht berührt.
- **JOB 3050** (Dublettenregel beim Einreihen) — bestimmt, wann `duplicate` gesetzt wird; nicht
  geändert, die neuen Zähler lesen das Feld nur.
- **E9 Bestandsreset** (`OFFEN.md` Abschnitt 4) und **L2/L5 Jahresring/Testbestand** (`OFFEN.md`
  Abschnitt 7) — eigene Einträge; nicht Teil dieses Laufs.

## Quellenwidersprüche und fehlende Belege

1. **R-0124 „erledigt“ gegen „offene Nachtestfrage“.** Die Altquelle führte F-0124 als erledigt,
   belegt war nur die Frage aus Ship 8 und die Beschreibung der Fläche. Der Bestand bestätigt den
   Kasten, aber ohne Doppel-Kandidaten — die Frage war also berechtigt; geschlossen in diesem Lauf.
2. **R-1115 „erledigt“ gegen „nicht ausgeführt“.** Die Altquelle führte F-1115 als erledigt; die
   Notiz sagt „belegt ist nur der Befund samt Liste“ und „Nicht ausgeführt“.
3. **E9 steht zweimal in `OFFEN.md`:** Abschnitt 3 „OFFEN — entschieden: Bestandsreset“, Abschnitt
   4 „ERLEDIGT — Bestandsreset gefahren, Papierkorb leer, am 30.07. im Screenshot belegt“. Der
   Erledigt-Eintrag ist jünger als der Befund vom 27.07. und könnte die Werkstattreste von R-1115
   miterledigt haben. Er ist aber keinem der beiden Punkte zugeordnet, nennt die Instanz nicht und
   belegt nur den leeren Papierkorb, nicht den sichtbaren Bestand. Doppelte Kennungen im Register
   (darunter E9) benennt `OFFEN.md` selbst als Befund I42.
4. **„17 Doppel-Kandidaten“ (23.07.)** — eine historische Zahl einer bestimmten Instanz; heute
   nicht nachgeprüft. Die Vorschau zeigt künftig die aktuelle Zahl.
5. **Fehlende Belege dieses Laufs:** keine Testausführung (lokal untersagt; Lauf auf dem
   Prüfweg), keine Sichtung einer echten Instanz, keine Bedienung durch einen Menschen.
