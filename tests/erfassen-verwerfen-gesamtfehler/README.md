# Aufnahme `erfassen-verwerfen` — Abgleich und Lieferung

Auftrag `aufnahme:20260922:erfassen-verwerfen` (Aufgabenrevision 3, Lauf
`lauf:b3:aufnahme:20260922:erfassen-verwerfen:1`). Basisstand `bb866425` (`1.0.0-beta.1.611`).
Auftragsquelle: `klarwerk_steuerung/gespraech/auftragsaufnahme-01a0c779-20260922/gesamtbestand/auftragsquellen/erfassen-verwerfen.json`.

## Herkunft des „4231-Rests“

`archiv/4231/runde-2/ben.md:23` (Prüfpunkt 6 im GRÜN-Urteil zu JOB 4231): „vollständigen Ausfall
aller Punkte mit anschließendem Verwerfen prüfen; den Moduswechsel über die echte Leiste und
Wiederöffnen samt Originalquelle im Browser messen. A4 prüft bislang den Teilfehler, der
Moduswechsel verwendet einen Prop-Stellvertreter“; `:28` „NICHT GEPRÜFT: … Chromium-Dateiweg mit
echter Persistenz und Wiederöffnen“.

## Was am Basisstand gemessen wurde (vor jeder Änderung)

| Anliegen | Ergebnis am Basisstand |
| --- | --- |
| Vollausfall aller Punkte am Verlassen-Weg | Verhalten war bereits richtig (G1/G2 grün ohne Produktänderung): Dialog bleibt, Grund im Dialog, kein Speichernachweis, Verwerfen quittiert „verworfen“. Es fehlte nur der Test. |
| N-0061 (Verwerfen/Speichern und wechseln über „Erfassen“ auf derselben Route) | **Fehler bestand noch.** N1 las nach „Verwerfen und wechseln“ den verworfenen Titel und den alten Text im Editor, nur `?draft=` war weg. N2 und N3 ebenso (gerade gesicherter Stand bzw. ungespeicherte Neuanlage blieben stehen). G3: nach dem Verwerfen stand der Dateiweg samt Datei weiter da. |
| R-0075 Teil 1 (Verwerfen ⇒ leere Fläche) | Über „Eingabe verwerfen“ (Menü) bereits erfüllt; über den Wache-Dialog auf derselben Route **nicht** (= N-0061). |
| R-0075 Teil 2 (geleerter Text bleibt geleert) | Bestehende jsdom-Belege: `tests/capture/draft-body-clear-cycle-mounted.test.tsx`, `tests/capture/frontdoor-empty-body-save-mounted.test.tsx` (im Regressionslauf dieses Auftrags grün). Ein Chromium-/PostgreSQL-Beleg fehlte → C4. |
| ENTWURF-VERLASSEN (Pedi 10.09.) | Geliefert von JOB 3526 (LIVE `1.0.0-beta.1.276`) samt Resten 3572/3600/3621/3770/3822/3848/3864/3875/3912/4231/4324/4335/4339 (Statuszelle der Quelle). Der Knopf „Entwurf verlassen“ (`capture-entwurf-verlassen`) steht heute; er löscht nichts. Hier nur genutzt und geprüft (C1, C2, G1, G2), nicht umgebaut. |

## Was geändert wurde

* `apps/web/src/app/NavGuardContext.tsx` — `DirtyGuard.abschliessen?()`: nach „Verwerfen und
  wechseln“ bzw. gelungenem „Entwurf speichern und wechseln“ ruft die Wache bei jeder angemeldeten
  Wache diesen Rückruf, unmittelbar vor dem Wechsel.
* `apps/web/src/components/erfassen/Blatt.tsx` — das Blatt meldet `abschliessen` an: Diktat
  trennen, Blatt leeren (`blattLeeren`, der Zustandsteil von `resetForNewEntry` ohne Adresse),
  zurück aufs Blatt. `resetForNewEntry` = `blattLeeren` + Adresse leeren (Verhalten unverändert).

## Die Tests dieses Ordners

* `gesamtfehler-modusleiste-mounted.test.tsx` (jsdom, vollständige Seite `Capture`, jeder
  Moduswechsel über das Menü „Datei ▾“ des Blatts — kein Prop-Stellvertreter): G1, G2, G3, N1, N2,
  N3. Gegenprobe: ohne die Produktänderung sind G3, N1, N2, N3 rot, G1/G2 grün.
* `verwerfen-wiederoeffnen-pg-im-browser.integration.test.ts` (Chromium, echter Socket, echte
  PostgreSQL): C1 Vollausfall am Netz + „Hier bleiben“ + Verwerfen ohne neue Zeile; C2 über den
  Verlassen-Weg gesichert und in neuer Sitzung samt Quellenzeile und Originaldatei wieder geöffnet —
  der Abruf von `/api/objects/<id>/raw` wird vollständig mit der hochgeladenen `sample.docx`
  verglichen (`Buffer.equals`, SHA-256 im Beleg), und als Gegenprobe liefert dieselbe Adresse per
  Weiche gleich lange Nullbytes, die derselbe Vergleich zurückweisen muss; C3 N-0061 am echten
  Kopfband-Punkt „Erfassen“; C4 R-0075 geleerter Text bleibt nach dem Neuladen leer.
* `seite.tsx` — die Vorrichtung (Begründung im Kopf der Datei).

## Belege dieses Laufs (26.09.2026)

* Testserver `b6-9cb9b90649-g1`, Chromium 149.0.7827.55, PostgreSQL 16.15, Prüfauftrag
  `pa-1790425740-5fad51e2` (Zwischenstand `5cbc8be6`): C1–C4 grün; zusätzlich
  `import-wiederoeffnen-pg-im-browser` P1–P5 grün (auch das früher rote P2 (b)),
  `speicherknopf-ganzdokument-pg-im-browser`, `entwurf-aus-adresse/adresse-entwurf-chromium` (8/8)
  und die jsdom-Datei (6/6) grün.
* Prüfauftrag `pa-1790427027-44543cd7` (Stand `0baaf410`, samt Wiederfinden in C3): C1–C4 4/4,
  jsdom 6/6 grün.
* **Berichtigung Runde 2 (BENs Befund):** Die beiden Läufe oben haben in C2 die Originaldatei nur
  über Status und LÄNGE geprüft (936 Bytes) — ein Vergleich „Byte für Byte“ war das nicht; BEN hat
  gezeigt, dass 936 Nullbytes dieselbe Prüfung bestanden. Für die Originalquelle gilt allein der
  Beleg der Runde 2:
* **Runde 2**, Prüfauftrag `pa-1790429012-7707155e` (Testserver `b6-55e2ed4505-g1`, HEAD
  `1fbb90a5`, Chromium 149.0.7827.55, PostgreSQL 16.15): C1–C4 4/4, jsdom 6/6 grün. C2 meldet:
  Original `/api/objects/<id>/raw`, 936 Bytes, SHA-256
  `e4664416077af7a27fba458492d8e99fa1e16483739e9a7205ce1108c8f31edc` = hochgeladene
  `tests/fixtures/sample.docx` (lokal mit `shasum -a 256` gegengeprüft); Gegenprobe mit 936
  Nullbytes zurückgewiesen („erste Abweichung bei Byte 0, SHA-256 4db2fd52… statt e4664416…“).
* **Runde 3 (nach Zusammenführung mit `c04ec239`, `1.0.0-beta.1.612`, Word-Web/SharePoint-Einbettung
  inkl. `services/app/src/security-headers.ts`; keine Überschneidung mit diesem Auftrag):**
  Prüfauftrag `pa-1790430417-477dc94d` (HEAD `781a989a`): C1–C4 4/4 (C2 wieder SHA-256
  `e4664416…` = hochgeladen, Nullbyte-Gegenprobe zurückgewiesen), `import-wiederoeffnen-pg-im-browser`
  P1–P6 grün, jsdom 6/6. Lokal `tools/test tests/erfassen-verwerfen-gesamtfehler
  tests/datei-verlassen-quittung tests/entwurf-verlassen`: 13 Dateien, 89 Tests grün.
* Lokal (macOS, jsdom): Nachbarbestände `tests/entwurf-verlassen`, `tests/datei-verlassen-quittung`,
  `tests/capture`, `tests/app/navguard*`, `tests/entwuerfe*`, `tests/entwurf*` u. a. — 233 Dateien,
  1902 Tests grün.

* **Runde 4 — Torreparatur ausserhalb des Auftragsinhalts:** Der Volllauf `lt-1790433786-e163cf0e`
  (Commit `93abad15`) war rot in `tests/insel-update/sicherung-eindeutig.test.ts` (S1/S2, Exit 2,
  „pg_restore kann den erzeugten Dump nicht lesen“). Ursache: der Test ersetzte `pg_dump`, aber nicht
  `pg_restore`; auf einem Prüfplatz mit `postgresql-client` las das echte `pg_restore --list` den
  Attrappen-Dump (JOB 4057-Zweig in `scripts/backup/backup.sh`). Unabhängig von diesem Auftrag, am
  Zielbranch gleich. Behoben mit `PG_RESTORE_ATTRAPPE` in `tests/insel-update/insel-probe.ts`;
  Beleg `pa-1790442758-e6772760` (HEAD `290c3b44`): 2/2 grün, lokal `tests/insel-update` 80/80.

## Abgrenzung

* „Meine Entwürfe“-Link (Pedis Befund 10.09.) gehört JOB 3503 — hier weder geprüft noch angefasst.
* `package:entwuerfe`: wiederholtes Löschen, Entwurfspapierkorb, Entwurfslinks und Rollenrechte
  gehören den Aufnahmen `gesamt-papierkorb`, `gesamt-leserechte`, `gesamt-entwurf-einreichen`. Aus
  dieser Karte deckt dieser Auftrag nur „ungespeicherte Änderung verwerfen, gespeicherten Inhalt
  unverändert wiederfinden“ (C1, C3).

## Offen / Befunde ohne Änderung

* Der Satz beim **Vollausfall** ist derselbe wie beim Teilfehler
  (`capture.file.draftsPartial`): „Nicht alle Punkte … Bereits angelegte Entwürfe bleiben
  erhalten.“ — beim Vollausfall wurde nichts angelegt. Ein eigener Satz verlangt neue Texte in drei
  Sprachen samt `tests/i18n-textmodule/werte-vorher.json` und dem Inventar in
  `tests/import-anleitung-modus/sprachwechsel-import-meldungen.test.tsx`; nicht Teil dieses Laufs.
* „Erfassen“ im Kopfband bei einem geöffneten, **unveränderten** Entwurf fragt nicht (kein
  Verlust) und wechselt nach `/erfassen` — dort steht der Entwurfsinhalt weiter im Blatt, nur ohne
  `?draft=`. N-0061 spricht ausdrücklich vom bestätigten Verwerfen; dieser Fall ist nicht geändert.
* Im Chromium-Fall C1 lädt der Ganzdokument-Weg das Original VOR der (scheiternden) Anlage hoch
  (`Capture.tsx`, Ref-Cache); ein verwaistes Objekt im Objektspeicher ist kein sichtbarer
  Speichernachweis, wird hier aber nicht gezählt.
