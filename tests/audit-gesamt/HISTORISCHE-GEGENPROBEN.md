# Aktuelle Audit-Regression und historische Gegenproben

`vorher-nachher.integration.test.ts` ist der automatisch ausgewählte aktuelle PostgreSQL-Weg.
Er prüft am jeweiligen Kandidaten unverändert streng:

- Anlage gegen einen geführten offenen Fremdschreiber: genau ein `ko.created`, lückenlose Kette.
- Abgewiesenes `ko.created`: weder Wissensobjekt noch Fassung oder Auditzeile bleibt wirksam.
- Geführter Export und zwölf parallele Exporte über zwei Instanzen: 13 Belege und lückenlose Kette.

Diese Regression lädt keine alte Fassung und wendet keinen Rückwärtspatch an. Fehlt ihr
PostgreSQL-Prüfmittel, schlägt sie fehl; es wird kein übersprungener Fall als bestanden behandelt.

## Erhaltener historischer Originalnachweis

Die Originalabnahme vom 5. Oktober 2026 gilt für
`1688a90ca0343ee4452064b86857da9d44a2e5f0` / `1.0.0-beta.1.691`:

- [Prüfbericht](/Users/peterkohnert/Documents/ChatGPT/Klarwerk/PRODUKTION-20261003/auftraege/auftrag-e9e0ec043396999482b7/PRUEFUNG/PRUEFUNG.json): der damalige PG-Vorher-/Nachher-Lauf hat Exit 0;
  seine sechs tatsächlich ausgeführten Fälle sind mit null nicht ausgeführten Fällen verzeichnet.
- [PG-Rohlog](/Users/peterkohnert/Documents/ChatGPT/Klarwerk/PRODUKTION-20261003/auftraege/auftrag-e9e0ec043396999482b7/PRUEFUNG/pg-vorher-nachher.log): am historischen `758e76c1` traten
  `audit_pkey`, neun fehlgeschlagene parallele Exporte und nur 3 statt 13 Exportbelege auf.
  Dieselben Sollprüfungen bestanden am damaligen Kandidaten; die Datei meldet 6/6 bestanden.
- [Unabhängiges Ben-Urteil](/Users/peterkohnert/Documents/ChatGPT/Klarwerk/PRODUKTION-20261003/auftraege/auftrag-e9e0ec043396999482b7/BEN/ANTWORT.json): `erfuellt`, Umfang `originalauftrag`,
  keine Befunde oder fehlenden Nachweise; insgesamt 341 Fälle ohne Übersprünge dokumentiert.
- [Lieferbeleg](/Users/peterkohnert/Documents/ChatGPT/Klarwerk/PRODUKTION-20261003/auftraege/auftrag-e9e0ec043396999482b7/LIEFERUNG/LIEFERUNG.json): .691 mit diesem Commit veröffentlicht und
  über den damaligen Health-Stand bestätigt.

Diese erhaltenen Primärbelege werden hier verlinkt, nicht erneut ausgeführt oder als heutiger Lauf
gezählt. Dass das Gitobjekt `758e76c1` heute nicht verfügbar ist, bleibt eine Materialisierungslücke
der heutigen historischen Diagnose. Die damaligen Original-, PG- und Ben-Nachweise bleiben gültige
historische Belege; daraus entsteht keine rückwirkend fehlende Abnahme oder Wiedereröffnung.

## Historische Diagnose

Die ursprünglichen sechs Testdefinitionen und ihre Sollprüfungen bleiben in
`vorher-nachher.historisch.ts` erhalten. Die Datei wird ausschließlich über den benannten
Diagnoseaufruf gesammelt, nicht über das normale `*.integration.test.ts`-Muster:

```sh
bash tools/browserdeckel.sh smoke ./node_modules/.bin/vitest run \
  tests/audit-gesamt/vorher-nachher.historisch.ts \
  --config tests/audit-gesamt/historisch.config.ts \
  --allowOnly=false --passWithNoTests=false --pool=forks --minWorkers=1 --maxWorkers=1 \
  --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=1 \
  --no-file-parallelism --testTimeout=60000
```

Dieser Aufruf benötigt einen ausdrücklich verfügbaren PostgreSQL-Prüfplatz. Er wurde bei dieser
lokalen Neuordnung nicht ausgeführt; Typ-/Stilgrün ist kein historischer oder aktueller PG-Beleg.

Die historische Materialisierung lädt ausschließlich die fest benannte, lokal vorhandene
Gitfassung in einen temporären Ordner (`services`, zugehörige Webquellen und `package.json`).
Sie verändert keinen aktuellen Produktcode. Vorhandene Prüfabhängigkeiten werden verlinkt,
nicht neu installiert; ihre Importverträglichkeit mit der alten Fassung bleibt auszuführen.

- `6c576c7014302bc85b86af85c50794e0aefe7d64` ist als Commit vorhanden und wird direkt materialisiert.
- `758e76c118482f11a3f322403d71d188e3fda277` fehlt. Die Lauf-2-Diagnose meldet diese Quelllücke
  ausdrücklich als Fehler. Kein Fetch, kein Ersatzstand und keine Rekonstruktion werden behauptet.

Die vollständigen Originaldateien unter `vorher/` bleiben unverändert: `fassung.json`,
`behebung-rueckwaerts.patch`, `fassung-758e76c1.patch` und der damalige `LIESMICH.md`.
Ihre Erzeugungsangaben beschreiben den damaligen Patchweg, nicht die heutige Materialisierung.
Insbesondere ersetzt ein historischer Hinweis auf ein damals vorhandenes `758e76c1` keinen
heutigen Quellnachweis. Bereits erfüllte historische Nachweise bleiben historische Belege und
sind keine erneute Voraussetzung jeder aktuellen Regression.

Grundlage der Trennung ist der echte CI-Job 123766284577 auf `2ab2476`: drei historische Fälle
scheiterten an der Patchanwendung vor der Fachprüfung; alle drei aktuellen Nachherfälle bestanden.
Das ist Vorgeschichte dieses Stands und kein vorweggenommenes Grün der neu geordneten PG-Datei.
Der neue enge PostgreSQL-Nachweis läuft anschließend im bestehenden regulären CI-Weg.
