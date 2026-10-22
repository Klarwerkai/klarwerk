# Gemeinsamer endlicher Lieferweg

Der versionierte Vertrag steht in `tools/release-vertrag.mjs`. Lokal und im CI-Job
`pflicht` läuft `node tools/release.mjs check <Basiscommit> <neuer Ergebnisordner>`.
Quelle und endgültige Versionsnummer werden vorher normal committet. Der Befehl
installiert nichts und behauptet kein Volltorgrün.

Roottyp, Webtyp, Lint, Architektur, Geheimnis-Scan und berührte Unit-Testdateien plus
explizite kausale Vertragsfälle laufen seriell: zusammen maximal 600 Sekunden,
je Stufenprozess maximal 240 Sekunden, ein Worker, 60 Sekunden je Test. Jede Stufe
nutzt den normalen globalen Browserdeckel. Kein äußerer Deckel um diesen Gate-Befehl.
Originales `tests.json` bleibt unverändert; `pflicht.json` bindet Quelle, Baum,
Auswahl, tatsächliche Befehle, Anfang/Ende, Exit und Ergebnisse. Fehlend/leer/geändert
ist kein Erfolg. Vitest 2 erzwingt `.only` über `allowOnly:false`, nicht `forbidOnly`.

## Konkrete Bestandsdiagnosen und nachgelagerte Messungen

Die einmalige aktuelle Messung am 160a5e-Stand ergab 137 Lintfehler und 74
Architekturfehler. Der Architektur-JSON-Prozess lieferte dabei Exit 0; deshalb zählt
sein Diagnoseinhalt, nicht allein der Prozesscode. Die drei Secret-Funde waren
Testattrappen: zwei bleiben bytegleich im komprimierten Originalbeleg unter
`fixtures/entwurf-verlassen/`, einer ist eng mit der bestehenden Inline-Marke erklärt.
Der 17.289.686-Byte-Gegenbeleg ist weiterhin vollständig dekomprimierbar und per
Original-SHA gebunden. Sein Leser führt keinen alten Produktstand in diesem Gate aus.

`tools/release-ausnahmen.json` nennt jede vorläufig verbleibende Diagnose einzeln:
Pfad, Regel, Fingerprint, Grund, Root als Pflegeowner und feste Frist
**2026-10-23T18:00:00Z**. Die ES5-Word-Datei wird nicht unsicher auf ES6 umgebaut;
Typzyklen und Modulregeln werden nicht global ausgeschaltet. Lint-Fingerprints binden
auch die unveränderten Quelldateibytes, Architektur-Fingerprints genau die gemessene
Kante beziehungsweise den Zyklus samt Abhängigkeitstypen. Neue, geänderte, unbekannte,
doppelte und abgelaufene Funde bleiben rot. Es gibt keine automatische Verlängerung.
Die Rohcodes und alle tatsächlich verwendeten Einzelausnahmen bleiben im Ergebnis.
Ein formal freigegebener Pflichtbericht mit solchen Ausnahmen ist kein fehlerfreier
Gesamtbestand. Vor Versand werden Befristung und Originaldiagnosen erneut geprüft.

Genau `tests/tor-inventar/lastgrenze-wrapper.test.ts` enthält eine gemischte lange
Volltor-Laufzeitmessung und eine echte Vierfork-Kalibrierung. Diese Datei steht mit
Root, konkreter Frist und Grund ausdrücklich unter `deferredTests`; ihre geänderte
Zählsemantik decken echte synthetische Ein-Worker-Unterprozesse ab. Andere geänderte
Testdateien bleiben Pflicht. Die drei beauftragten AST-/Namensankersuiten laufen ganz,
mit ihren echten positiven und negativen Fällen; keine abgewählten Fälle zählen grün.

Berührte Integrationstests werden getrennt aufgezeichnet. Der bestehende CI-PG-Weg
führt `tools/pg-auswahl.mjs` vor der langen Gesamtdiagnose aus und lädt die tatsächliche
Auswahl samt unverändertem Rohresultat hoch. `KLARWERK_PG_PFLICHT=1` erzwingt auch mit
eigenem Reporter Fehler bei skip/todo/Leere. Ohne ausgewählte PG-Datei heißt das
`applicable:false`, kein behaupteter PG-Erfolg. Lokale SDK-/Docker-/PG-Proben gehören
nicht zu diesem Autorenlauf. Die zwei angepassten PG-Testdefinitionen erhalten ihre
eigene technische Laufannahme erst nach echten gezielten CI-Ergebnissen.

Langes Volltor, Browser und der volle PG-Integrationsjob bleiben ehrliche nachgelagerte
Diagnosen mit Root als Besitzer und konkretem Fälligkeitsdatum im Bericht. Ihre roten
oder ungemessenen Ergebnisse werden nicht grün umbenannt und bilden keine pauschale
Ship-Sperre. Zwingend vor Coolify ist der aktuelle schnelle CI-Pflichtjob des exakten
Commits, kein alter, fremder oder nur geplanter CI-Lauf.

## Ein unabhängiges Urteil, ein baumgleicher Child

Ben beurteilt Prüfcommit, Baum und tatsächlichen Pflichtbericht genau einmal.
Die Urteilsakte enthält `completed:true`, wirklichen Exit `0`, `decision:"APP0"`,
`commit`, `tree`, `proofSha`, aufgezeichneten `writer`, unabhängigen `reviewer` mit
Kennung `ben:…`, Originalpfad `evidence` und `evidenceSha`. `allowAttestationChild:true`
gilt nur mit dieser ausdrücklichen Regel im Original:

> Metadatenregel: ein Child, identischer Baum, unveränderte Identitäten und echte Trailer.

`node tools/publish.mjs attest <pflicht.json> <Urteilsakte.json>` erzeugt danach mit
normalem Git genau einen leeren Child. Die vollständige Elternliste muss exakt
`[Prüfcommit]` sein, sein Baum identisch; Autor und Committer tatsächlich Codex.
Git selbst parst die echten Tor-/Baum-/Urteil-Trailer. Bodytext mit ähnlich aussehenden
Zeichenketten und doppelte Pflichttrailer genügen nicht. Keine alte History wird
umgeschrieben, kein Hook installiert/umgangen, kein add-A und kein Lock gelöscht.
Die gedeckte enge Metadatenwirkung braucht kein zweites Ben-ACK oder Hashkreislauf.

## Veröffentlichung durch Root

`bash scripts/deploy/klarwerk-ship.command` delegiert an `tools/publish.mjs`:

1. `intent <neue-absicht.json> <pflicht.json> <Urteilsakte.json> Klarwerkai/klarwerk`
   prüft Ergebnisse und nachgerechnete Testklassifikation aus dem echten Gitdiff.
2. `push <absicht.json>` prüft Pflicht, Ben, Fast-forward und den bestehenden
   Abhängigkeits-Audit, dann genau einen normalen Push. Der neue Commit kann seinen
   CI-Lauf erst danach erhalten; kein CI-vor-Push-Kreislauf.
3. `publish <absicht.json>` verlangt den jüngsten grünen GitHub-Actions-Check `pflicht`
   des exakten Commit. Öffentliche HTTPS-REST-API, kein gh und kein neuer Token.
   Der dünne Pythonadapter verwendet den bestehenden P3-Publisher unter
   `~/klarwerk_steuerung/register/ausfuehrung/veroeffentlichung.py`, dessen gespeicherte
   Absicht und Tokenübergabe ausschließlich per curl-stdin erhalten bleiben.
   Ein Exklusivmarker vor POST erlaubt höchstens einen Versand je Absicht.
4. `status <absicht.json>` liest lokale und bestehende P3-/Coolify-Ergebnisse.
   Sein HTTP-Adapter erlaubt nur GET, zusätzlich ist der P3-Halteschalter gesetzt.
   Auch wartend/429/unklar kann daraus kein POST entstehen. Danach nur diesen Lesepfad
   verwenden; keine Marker löschen oder denselben Versand blind wiederholen.

Python läuft mit `-B` beziehungsweise deaktivierter Bytecode-Erzeugung. Fremde WIP und
Nativebuild-Dateien bleiben erhalten; ein sauberer eigener Liefercheckout ist geeignet.
Releaseordner, Tags, echter Rollback und Live-Abnahme sind spätere Root-Betriebswirkungen.
Fünf Releases sind fünf zukünftige echte Lieferungen, keine künstliche Versionsserie.
