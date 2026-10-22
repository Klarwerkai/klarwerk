# Gemeinsamer endlicher Lieferweg

Der schnelle Pflichtvertrag steht in `tools/release-vertrag.mjs`. Lokal und im CI-Job
`pflicht` läuft `node tools/release.mjs check <Basiscommit> <neuer Ergebnisordner>`.
Quelle und endgültige Versionsnummer müssen vorher normal committet sein. Der Befehl
ändert keine Version, installiert nichts und behauptet kein Volltorgrün.

Die sechs Pflichtstufen laufen seriell, zusammen höchstens 600 Sekunden, je Prozess
höchstens 240 Sekunden: Roottyp, Webtyp, vollständiges Lint, Architektur,
Geheimnis-Scan und berührte Unit-Testdateien plus explizite kausale Vertragsfälle.
Einheitlich ein Worker, keine Dateiparallelität, 60 Sekunden je Test. Jede Stufe nutzt
den normalen globalen Browserdeckel. Ein äußerer Deckel darf diesen Befehl nicht
umschließen. Rohes `tests.json` bleibt unverändert; `pflicht.json` bindet Originalbytes,
Befehle, Quelle/Baum, Zeiten, Exitcodes und Auswahl. Fehlend/rot/leer/geändert ist rot.
Berührte Integrationstests stehen separat im Ergebnis. Sie laufen ausschließlich im
vorhandenen verpflichtenden CI-Integrationsjob; nie im Unit-Kollektor mitzählen.

Die Bestandsrotfälle aus 1.2 bleiben echte rote Ergebnisse. Der aktuelle Vertrag hat
keine Ausnahmen; unbekannte und abgelaufene Ausnahmebelege werden abgewiesen. Eine
spätere einzelne Befristung braucht eine eigene versionierte Entscheidung mit
Fingerprint, Beleg, Besitzer, Grund und Frist. Root bearbeitet 1.2 und die nachgelagerten
Volltor-/Browserdiagnosen binnen 24 Stunden nach dem jeweiligen Pflichtlauf. Das
konkrete Fälligkeitsdatum steht im Ergebnis. Ein abgelaufener Befund wird konkret an
Root eskaliert; hier wird keine alte Regel still grün geschaltet.

## Ein unabhängiges Urteil, ein baumgleicher Child

Ben beurteilt den Prüfcommit, seinen Baum und den tatsächlichen Pflichtbericht genau
einmal. Die Urteilsakte enthält `completed:true`, den wirklichen Exit `0`,
`decision:"APP0"`, `commit`, `tree`, `proofSha`, den aufgezeichneten `writer`, eine
unabhängige `reviewer`-Kennung `ben:…`, Originalpfad `evidence` und `evidenceSha`.
`allowAttestationChild:true` ist nur zulässig, wenn Ben im Original ausdrücklich schreibt:

> Metadatenregel: ein Child, identischer Baum, unveränderte Identitäten und echte Trailer.

`node tools/publish.mjs attest <pflicht.json> <Urteilsakte.json>` erzeugt danach mit
normalem Git genau einen leeren Child. Autor und Committer müssen tatsächlich Codex
sein. Keine alten Autoren werden umgeschrieben, keine Hooks installiert/umgangen,
kein add-A und keine Locks gelöscht. Die echten Tor-/Baum-/Urteil-Trailer entstehen
erst jetzt. Der Child muss denselben geprüften Baum haben und genau diesen Elterncommit;
er braucht nach der ausdrücklich gedeckten Metadatenregel kein zweites Ben-ACK.

## Normale Veröffentlichung durch Root

`bash scripts/deploy/klarwerk-ship.command` delegiert an folgende Unterbefehle von
`tools/publish.mjs`:

1. `intent <neue-absicht.json> <pflicht.json> <Urteilsakte.json> Klarwerkai/klarwerk`
   bindet dieselben tatsächlichen Ergebnisse. Die Testauswahl wird aus dem echten Gitdiff
   nachgerechnet; Rohresultate, Trailer und Urteilsoriginal werden erneut gebunden.
2. `push <absicht.json>` prüft lokale Pflicht, Ben, Fast-forward und den bestehenden
   Abhängigkeits-Audit, dann genau einen normalen Push. Kein CI-Nachweis vor diesem Push:
   der neue Commit muss seinen CI-Lauf erst erhalten können.
3. `publish <absicht.json>` verlangt den jüngsten grünen GitHub-Actions-Check `pflicht`
   UND `integration` des exakten Commit. Öffentliche GitHub-REST-API per HTTPS, kein `gh`,
   kein neuer Token. Erst danach nutzt der dünne `tools/publish-transport.py`-Adapter den
   vorhandenen P3-Publisher `~/klarwerk_steuerung/register/ausfuehrung/veroeffentlichung.py`.
   Der Transport, seine gespeicherte Absicht und seine geheimnisfreie curl-stdin-Übergabe
   bleiben erhalten. Ein Exklusivmarker VOR POST erlaubt höchstens einen Versand je Absicht.
4. `status <absicht.json>` liest lokale und bestehende P3-/Coolify-Ergebnisse. Sein
   HTTP-Adapter erlaubt ausschließlich GET; zusätzlich ist der P3-Halteschalter gesetzt.
   Auch wartend/429/unklar kann daraus kein neuer POST entstehen. Nach unklarem Ausgang
   nur diesen Lesepfad verwenden; niemals Marker entfernen oder denselben Versand wiederholen.

Ein Commit nach der Prüfung, geänderter Baum, fehlendes echtes Urteil, fehlender oder
übersprungener CI-Check sperrt konkret. Ein sauberer eigener Liefercheckout erhält
fremde WIP und Nativebuild-Dateien in anderen Checkouts. Releaseordner, Tags, echter
Rollback und Live-Abnahme sind nachfolgende Betriebswirkungen von Root. Fünf Releases
sind fünf zukünftige echte Lieferungen, keine künstliche heutige Versionsserie.
