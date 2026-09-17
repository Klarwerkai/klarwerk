# Produktionsabhängigkeiten: Exposition je Meldung, an den tatsächlich erreichbaren Pfaden

**Stand:** 17.09.2026 · **Gemessen auf dem Basisstand:** `6a362b1` (1.0.0-beta.1.554) · **JOB 4272, Runde 3**

Dieser Ordner beantwortet für jede der sieben von `npm audit --omit=dev` gemeldeten
Produktionsabhängigkeiten **eine** Frage: *erreicht diese Meldung Klarwerk, und über welchen
Aufrufpfad?* Er beantwortet ausdrücklich **nicht** die Frage, ob der Scanner grün ist.

Ein grüner Scanner ersetzt keine Funktionserhaltung. Was hier steht, ist je Meldung: an welchem
Pfad gemessen wurde, was daran heute gilt, was gehoben wurde, und was offen bleibt.

Der Recherchebefund `recherche/pruefung/ABHAENGIGKEITEN-SICHERHEIT.md` (16.09.2026, Stand `.542`)
wird **nicht abgelöst und nicht fortgeschrieben** — er ist die Messung von damals und bleibt als
solche stehen. Dieser Ordner legt die Wartung daneben, mit eigenem Datum und eigenem Stand.

**Es gibt hier keine eigenen Versionsangaben.** Die Tabelle nennt den *Ort* in `package-lock.json`;
die Zahl daneben liest `gebundene-versionen.test.ts` aus genau diesem Ort und hält sie dagegen.
Laufen Lockdatei und Einordnung auseinander, wird dieser Test rot.

## 1. Die acht Zeilen — sieben Pakete, `brace-expansion` doppelt

Das Urteil beantwortet: *erreicht eine der am 17.09. gemeldeten Advisories Klarwerk am **heute
gebundenen** Stand?*

| Paket | Ort in package-lock.json | Gebundene Version | Urteil |
|---|---|---|---|
| `@fastify/static` | `node_modules/@fastify/static` | 9.1.3 | nicht exponiert |
| `brace-expansion` (unter `@fastify/static`) | `node_modules/@fastify/static/node_modules/brace-expansion` | 5.0.12 | nicht exponiert |
| `brace-expansion` (Wurzel, dev-markiert) | `node_modules/brace-expansion` | 2.1.7 | nicht exponiert |
| `fast-uri` | `node_modules/fast-uri` | 3.1.8 | nicht exponiert |
| `fastify` | `node_modules/fastify` | 5.8.5 | exponiert |
| `find-my-way` | `node_modules/find-my-way` | 9.6.0 | nicht exponiert |
| `nodemailer` | `node_modules/nodemailer` | 6.10.1 | exponiert |
| `sharp` | `node_modules/sharp` | 0.35.4 | nicht exponiert |

„Unentschieden" bleibt ein erlaubtes Urteil dieses Berichts; in Runde 3 steht es an keiner Zeile
mehr, weil die beiden vormals unentschiedenen Pakete (`fast-uri`, `brace-expansion`) **gehoben**
wurden und damit ausserhalb jedes gemeldeten Bereichs liegen — die Frage nach ihrem Aufrufpfad
musste dafür nicht beantwortet werden und **ist es auch nicht** (s. „Nicht gemessen").

**Drei Zeilen stehen heute anders da als in Runde 2**, weil die gebundene Version eine andere ist:
`fast-uri` 3.1.2 → 3.1.8, `brace-expansion` 5.0.6 → 5.0.12 und `sharp` 0.34.5 → 0.35.4. Eine vierte
Hebung — `fastify` 5.8.5 → 5.12.1 — **wurde vorgenommen, gemessen und wieder zurückgenommen**, weil
sie den Typprüfer des Produkts bricht; der Beleg steht in Abschnitt 2.

### `@fastify/static` — nicht exponiert

**Advisorybedingung.** GHSA-83w8-p2f5-377r (high, `<=10.1.0`) und GHSA-8pvw-jcv7-9cmj (moderate,
`<=10.1.1`) beschreiben beide, wie eine nicht-kanonische Pfadform an einer **Rechteprüfung über
statischen Dateien** vorbeiführt.

**Aufrufpfad.** `services/app/src/web-static.ts:4` importiert das Paket, `:109` registriert es —
und das ist die **einzige Registrierung** im ganzen Produkt. Ausgeliefert wird genau ein
Verzeichnis: `apps/web/dist`, die gebaute SPA (`services/app/src/server.ts:61-66`).

**Urteil.** Die Bedingung ist nicht erfüllt: über diesem Verzeichnis liegt keine Rechteprüfung, die
umgangen werden könnte. Die SPA ist öffentlich per Bauart — ein Browser lädt sie, bevor sich
irgendjemand angemeldet hat. Die drei Hooks davor (`server.ts:47-58`: Security-Header,
Kanonik-Redirect, noindex) sind keine Autorisierung. Zusätzlich gemessen: sieben Traversal-Formen
(`..`, `..%2f`, `%2e%2e`, `.%2e`, doppelter Schrägstrich) liefern die Datei neben dem Baum **nicht**
aus.

**Wie diese Aussage gehalten wird — und warum sie in Runde 2 NICHT gehalten war.** Der erste
Wächter zählte *Dateien mit Import*. BEN hat gezeigt, dass das nicht trägt: eine zweite,
rechtegeschützte Registrierung **in derselben Datei** (ohne Berechtigung 401, mit Berechtigung 200)
blieb unsichtbar, der Import blieb einer. Seit Runde 3 messen **zwei** Riegel, und beide sind gegen
genau diese Mutation kalibriert (Abschnitt 4):
1. **Am Quelltext** die *Aufrufstellen* `.register(fastifyStatic` — zwei Aufrufe in einer Datei sind
   zwei Funde (`waechter.ts::statischeRegistrierungen`).
2. **Am laufenden Aufbau**, was beim Registrieren wirklich geschieht: wie viele Bäume, unter welchem
   Präfix, mit welcher Wache (`onRequest`/`preParsing`/`preValidation`/`preHandler`) an welcher
   Route, mit welchem app-weiten Hook (`waechter.ts::beobachteAuslieferung` + `schutzBefunde`).

### `brace-expansion` 5.0.12 (unter `@fastify/static`) — nicht exponiert

**Advisorybedingung.** GHSA-3jxr-9vmj-r5cp, GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895 (alle high):
Rechen- bzw. Speichererschöpfung bei **fremdgesteuerten Klammermustern**.

**Aufrufpfad.** Transitiv: `@fastify/static` 9.1.3 → `glob` → `minimatch` → `brace-expansion`.
Dass diese Kette im Produktionsbaum liegt, ist belegt.

**Urteil.** Gehoben auf 5.0.12 (Runde 3, `npm update --package-lock-only brace-expansion`, innerhalb
`^5`, kein Majorwechsel). Das Nachher-Audit nennt den Knoten nicht mehr. **Die offene Frage aus
Runde 2 ist damit nicht beantwortet, sondern gegenstandslos geworden:** ob eine *anfragegesteuerte*
Zeichenkette bis in `brace-expansion` durchreicht, wurde weiterhin **nicht** gemessen — siehe
„Nicht gemessen".

### `brace-expansion` 2.1.7 (Wurzel) — nicht exponiert

**Der Grund, warum der Befund die Doppelbewertung verlangt hat.** Diese Fassung ist in
`package-lock.json` als `"dev": true` geführt — Werkzeugkette, nicht Betrieb. `npm audit --omit=dev`
führt sie deshalb gar nicht auf: der gemeldete `nodes`-Eintrag für `brace-expansion` nannte
ausschliesslich den Pfad unter `@fastify/static`. Sie liegt nicht im ausgelieferten Baum. Der
Unterschied ist in `gebundene-versionen.test.ts` als eigener Fall festgehalten (`dev`-Kennzeichnung
beider Knoten). Ihre Nummer ist mitgewandert (2.1.1 → 2.1.7), weil `npm update brace-expansion`
beide Knoten anfasst; an der Einordnung ändert das nichts.

### `fast-uri` — nicht exponiert

**Advisorybedingung.** Sechs Advisories (u. a. GHSA-v2hh-gcrm-f6hx, GHSA-fph4-wmhf-6fwf, letztere
mit Bereich `>=3.1.2 <3.1.6`, sie traf die vorige Bindung 3.1.2 also genau): Hostverwechslung und
SSRF, wenn das Ergebnis **als Sicherheitsentscheidung vor einem anderen URL-Parser** benutzt wird.

**Aufrufpfad.** Kein direkter. Gesucht wurde über `services/` und `apps/web/src` nach `fast-uri` —
**kein Treffer**. Erreicht wird es transitiv über `ajv`, `fast-json-stringify` und
`@fastify/ajv-compiler`. Der Weg, über den dort eine **anfragegesteuerte** Adresse ankäme, wäre das
Schema-Schlüsselwort `format: "uri"`; danach wurde ebenfalls gesucht — **kein Treffer** in einem
Klarwerk-Schema.

**Urteil.** Gehoben auf 3.1.8 (innerhalb `^3`, kein Majorwechsel) — ausserhalb aller gemeldeten
Bereiche; das Nachher-Audit nennt das Paket nicht mehr. Die Frage nach einem erreichbaren Pfad
bleibt damit **unbeantwortet, nicht verneint** — „nicht gefunden" war nie „nicht vorhanden".

### `fastify` — exponiert; die Hebung wurde probiert und musste zurückgenommen werden

Hier liegen **zwei** Advisories mit **zwei verschiedenen** Bedingungen. Der Warnstand vom 16.09.
nannte nur die erste.

**(a) GHSA-w2qp-rph6-63g4** (moderate, `<5.12.1`) — Schemaumgehung durch Coercion-Abweichung bei
**primitiver Body-Wurzel**. Die Lücke ist auf der gebundenen Version 5.8.5 **wirklich da**, in
Runde 2 gemessen (Cloud-Lauf `4ff043e98dcb61c356bb8d1b`): eine Route mit `body: {type:"number"}`
nahm den Körper `"42"` mit Status 200 an und reichte dem Handler einen *String*. Die Bedingung fehlt
allerdings in Klarwerk: es gibt genau zwei Routen mit Body-Schema — `ask-routes.ts:288`
(`askBodySchema`, `:23`) und `check-text-routes.ts:556` (`bodySchema`, `:57`) — und **beide haben
`type: "object"`**. → für (a) **nicht exponiert**.

**(b) GHSA-3m5p-2c4r-xxw2** (moderate, `>=5.8.3 <5.12.1`) — Fälschung der `X-Forwarded-*`-Kette,
wenn `trustProxy` als **Hop-Count** konfiguriert ist. Genau diese Konfiguration baut Klarwerk:
`services/app/src/addon-auth-throttle.ts:101-103` gibt bei einem positiven ganzzahligen
`KLARWERK_TRUST_PROXY` eine **Zahl** zurück, und `build-app.ts:1848` setzt sie als `trustProxy`.
Der Wert entscheidet über `request.ip`, und `request.ip` trägt die Drossel des Add-in-Zugangs —
eine Fälschung wäre also nicht kosmetisch, sondern eine Umgehung einer Sperre. **Das ist die
Exposition dieser Zeile**, und sie hängt nicht an einer Bedingung, die Klarwerk nicht erfüllt.
→ für (b) **exponiert**, sobald diese unterstützte Konfiguration benutzt wird. Ehrlich dazu: ob die
laufende Instanz `KLARWERK_TRUST_PROXY` als Hop-Count setzt, ist von hier aus **nicht messbar** —
die Betriebsumgebung liegt nicht im Repo. Belegt ist, dass der Codepfad existiert.

**Urteil der Zeile: exponiert — und die kompatible Behebung ist VERSUCHT und NACHWEISLICH
BLOCKIERT.** Das ist kein „kein Fix verfügbar", sondern ein gemessenes Hindernis:

1. Die einzige Version ausserhalb **beider** Bereiche ist 5.12.1 (beide Advisories nennen `<5.12.1`).
   Sie liegt innerhalb `^5` — es wäre kein Majorwechsel.
2. Sie wurde gebunden (`npm install --package-lock-only fastify@5.12.1`) und im Cloud-Prüfplatz mit
   frischem `npm ci` **installiert und gefahren**. Ergebnis, Lauf `0d8ed788e92c1478163febfb`,
   `npx tsc --noEmit -p tsconfig.json`, Exit 2, **sieben** Fehler — der tragende zuerst:
   - `services/app/src/build-app.ts(1867,5): error TS2769: No overload matches this call.`
     Das ist der Aufbau selbst: `Fastify({ trustProxy: resolveTrustProxy(), logger: … })`.
     Die Überladung für den gewöhnlichen HTTP/1-Server passt unter `exactOptionalPropertyTypes:
     true` nicht mehr; TypeScript wählt daraufhin `Http2SecureServer`, und daraus folgen fünf
     Folgefehler (`1874`, `1954`, `1978`, `2825`, `2836`) — **sechs Fehler in `build-app.ts`**, alle
     vom selben Muster: `Http2ServerRequest is missing … headersDistinct, trailersDistinct`.
   - **Der siebte Fehler, und Runde 3 hat ihn nicht genannt** (BENs Korrekturpflicht 3, nachgelesen
     in `register/cloud/runs/0d8ed788e92c1478163febfb/tor.out:18`):
     `tests/produktionsabhaengigkeiten/kalibrierung.test.ts(217,16): error TS2352: Conversion of
     type 'FastifyRegister<…>' to type '(plugin: unknown, optionen: unknown) => Promise<unknown>'
     may be a mistake …`. Er liegt in einer **Testdatei dieses Ordners**, nicht im Produkt, und hat
     dieselbe Ursache: mit 5.12.1 wählt TypeScript `Http2SecureServer`, und der dort ausgeschriebene
     Typumweg passt dann nicht mehr. Runde 3 hat „sechs Produktfehler" gemeldet und damit den
     eigenen Ordner aus der Zählung gelassen — die Zahl war falsch, die Zuordnung zur Datei fehlte.
3. **Die Zuordnung, und zwar genau so weit, wie sie belegt ist.** Derselbe Arbeitsbaum, nur `fastify`
   zurück auf 5.8.5: `npx tsc --noEmit -p tsconfig.json` → **Exit 0**
   (Lauf `10fd94f2237663e5720c8098`); zwischen beiden Läufen hat sich an `services/` keine Zeile
   geändert. **Was daran NICHT stimmt und in Runde 3 so dastand:** der Lauf war nicht auf
   Produktdateien beschränkt. Er typprüft den ganzen Baum, und der siebte Fehler lag in diesem
   Ordner. Belegt ist deshalb: die Versionsänderung ist die einzige Ursache **aller sieben** Fehler
   (Vorher/Nachher unterscheiden sich nur in ihr) — und der Bruch trifft **das Produkt**
   (`build-app.ts`, sechs Fehler) **und** die Prüfseite (eine Zeile). Der Satz „isoliert auf
   Produktcode" wäre eine Behauptung über einen Umfang, den dieser Lauf nicht hatte.
4. Die Reparatur läge in `services/app/src/build-app.ts` — **ausserhalb der Zielpfade dieses
   Auftrags** (`package.json`, `package-lock.json`, `tests/produktionsabhaengigkeiten/**`). Eine
   Änderung dort wäre ungeprüfter Code aus einer fremden Bahn; der Auftrag verbietet sie
   ausdrücklich, und der Torlauf wäre rot.

**Deshalb ist die Hebung zurückgenommen** (Auftrag §6: „dann nicht den Test anpassen, sondern die
Versionsänderung zurücknehmen und den Befund berichten"). `package.json` steht wieder auf
`"fastify": "^5.0.0"`, die Lockdatei wieder auf 5.8.5. **Was offen bleibt und Pedi vorgelegt gehört:**
ein Auftrag, der `build-app.ts` UND die Lockdatei zusammen hält und beides in einem Zug hebt.
Bis dahin bleibt die Exposition aus (b) bestehen.

### `find-my-way` — nicht exponiert

**Advisorybedingung.** GHSA-c96f-x56v-gq3h (high, `<=9.6.0`) bindet den beschriebenen Absturz
ausdrücklich an einen **HTTP/2-Server**.

**Aufrufpfad.** Transitiv über `fastify` → `find-my-way` 9.6.0. Der Router läuft also mit.

**Urteil.** Die Bedingung ist nicht erfüllt, und zwar zweifach gemessen (`kein-http2.test.ts`):
(1) am **laufenden** Server — `buildApp()` erzeugt eine Instanz von `node:http`-`Server`
(`build-app.ts:1847-1850` setzt keine `http2`-Option); (2) an der **Quelle** — keine `.ts`-Datei
unter `services/` nennt `http2`. Beide Fälle sind Stolperdrähte: wird http2 eingeschaltet, werden
sie rot und verlangen die Einordnung neu; beide sind dagegen kalibriert (Abschnitt 4, Fall e).

**Warum hier NICHT gehoben wurde, obwohl das Nachher-Audit die Meldung weiter führt.** Der Auftrag
bindet die Behebung an das Urteil: gehoben wird, was **exponiert oder unentschieden** ist
(Lieferung 5). `find-my-way` ist weder das eine noch das andere. Der Scanner meldet es trotzdem,
weil er die HTTP/2-Bedingung nicht kennt — genau der Unterschied, um den es diesem Auftrag geht.
**Zur Entscheidung vorgelegt:** `npm audit` weist für dieses Paket `fixAvailable: true` aus, eine
Hebung wäre also vermutlich kompatibel zu haben; sie wurde hier bewusst **nicht** vorgenommen, weil
sie ein Nebenbei-Upgrade ohne Exposition wäre (Auftrag §4).

### `nodemailer` — exponiert

**Advisorybedingung.** GHSA-2x7j-588g-ccc2 (high, `<9.1.0`, quadratische Laufzeit im Adressparser)
und GHSA-cc9r-2j5m-2m83 (moderate, `>=6.9.16 <9.1.0`, Fehlparsen von RFC-5322-Kommentaren bis zur
Umgehung der Empfängerdomänenprüfung) sitzen beide im **Adressparser**.

**Aufrufpfad.** `services/notifications/src/smtp.ts:1` importiert, `:16` erzeugt den Transport,
`:24-26` übergibt `to: message.to` — die Empfängeradresse geht **unverändert** in den Parser. Das
ist gemessen und nicht gelesen (`mailadressen-bleiben-unveraendert.test.ts`, Fall A, gegen ein
Transport-Doppel). Ohne `SMTP_HOST` entsteht gar kein Mailer (`smtp.ts:36-40`) — ohne SMTP-Zugang
ist der Pfad tot.

**Was am gebundenen Stand gemessen wurde** (Fall B, gegen nodemailers eigenes `jsonTransport`, ohne
Verbindung, ohne Versand, nur synthetische `.invalid`-Adressen):
- eine gewöhnliche Adresse überlebt den Parser unverändert;
- `"seltsam, name"@…` — nach RFC 5322 **eine** Adresse — wird am Komma zerlegt und kommt als
  **andere** Adresse (`name@…`) heraus;
- eine Adresse in 40 verschachtelten Kommentarklammern verliert ihren Empfänger **ganz**
  (`envelope.to` leer) — eine so gebaute Nachricht ginge still an niemanden;
- die quadratische Laufzeit aus GHSA-2x7j-588g-ccc2 wurde mit diesen Eingaben **nicht
  reproduziert** (12.800 Trennzeichen in 157 ms, Cloud-Lauf `2eaa6532017b3edae58ef27b`). Das ist
  eine Fehlanzeige für diese Eingabeformen und kein Beweis der Abwesenheit.

**Urteil: exponiert — und nicht kompatibel behebbar.** Der erste Stand ohne die Advisories ist
`9.1.0`; die gebundene Bindung ist `^6.9.0`. Zwischen 6 und 9 liegen **drei** Hauptwechsel mit
geänderter Oberfläche; das ist kein Versionsschritt, sondern ein Umbau des Versandwegs, und er
gehört als eigener Auftrag entschieden — nicht nebenbei in eine Abhängigkeitswartung.
**Was stattdessen begrenzt** (gelesen, nicht behauptet): der Parser wird nur über
`smtp.ts:24-26` erreicht; ohne `SMTP_HOST` gibt es gar keinen Mailer; die Empfänger sind
Kontoadressen aus dem eigenen Bestand, nicht beliebige Fremdeingaben aus einer Anfrage. Das
verkleinert die Fläche, es schliesst sie nicht. **Diese Zeile bleibt offen, und sie gehört Pedi
vorgelegt.**

### `sharp` — nicht exponiert (war exponiert); der Aufrufpfad bleibt

**Advisorybedingung.** GHSA-f88m-g3jw-g9cj (high, `<0.35.0`, geerbte libvips-CVEs) und
GHSA-rgj7-g3m4-5g8c (high, `<0.35.4`, libheif) betreffen die Verarbeitung **nicht
vertrauenswürdiger Bilddaten** in nativen Decodern.

**Aufrufpfad.** `services/app/src/import/bildverkleinerung.ts:34` importiert `sharp`; der Weg ist
`POST /api/drafts/from-docx` → `mapImage` → dieses Modul. Der Bildinhalt stammt aus einer
**hochgeladenen Fremddatei**. Das ist der einzige der sieben Fälle, in dem die Advisorybedingung
ohne jeden Vorbehalt erfüllt war.

**Urteil.** Gehoben auf 0.35.4 — die kleinste Version, die **beide** Bereiche verlässt. Das ist
unter `^0.34` ein **Wechsel mit Hauptwirkung**; die Begründung steht ausgeschrieben in Abschnitt 2
und ist als Entscheidung für Pedi ausgewiesen. **Der Aufrufpfad selbst bleibt unverändert
bestehen:** fremde Bilddaten laufen weiter durch native Decoder. Was sich geändert hat, ist die
Version dieser Decoder — nicht die Tatsache, dass sie erreicht werden. Eine künftige libvips-CVE
träfe Klarwerk sofort wieder.

**Was begrenzt, aber nicht ersetzt.** `BILD_MAX_EINGABE_PIXEL` (40 MP, am Kopf geprüft, vor jeder
Speicheranforderung), `BILD_MAX_EINGABE_BYTES` (32 MiB), `BILD_ZEITGRENZE_MS` (8 s),
`BILD_GLEICHZEITIG` (2) und `failOn: "error"`. Diese Grenzen deckeln **Menge und Dauer**. Gegen
einen Speicherfehler *innerhalb* eines zulässig grossen, wohlgeformten Bildes helfen sie nicht.

**Die Funktionserhaltung ist gemessen**, nicht angenommen: `bildimport-bleibt-heil.test.ts` fährt
ein echtes PNG durch eine echte `.docx` durch das echte `sharp` (kein Doppel) — auf der gehobenen
Version, im Cloud-Lauf, der die geänderte Lockdatei per `npm ci` wirklich installiert hat.

## 2. Behebung — was getan wurde, warum diese Version, und was offen bleibt

### Getan (alle über `--package-lock-only`, kein `npm audit fix` in irgendeiner Form)

| Paket | alt → neu | warum diese Version | Majorwechsel? |
|---|---|---|---|
| `fast-uri` | 3.1.2 → 3.1.8 | höchster Stand innerhalb `^3`; verlässt `>=3.1.2 <3.1.6` und die übrigen gemeldeten Bereiche | nein |
| `brace-expansion` | 5.0.6 → 5.0.12 | höchster Stand innerhalb `^5`; verlässt die drei gemeldeten Bereiche | nein |
| `sharp` | 0.34.5 → 0.35.4 | kleinste Version ausserhalb **beider** Bereiche (`<0.35.0` libvips, `<0.35.4` libheif) | **ja** — s. u. |

`package.json` wurde an **einer** Stelle mitgeführt, weil eine Lockdatei allein wieder wegfallen
kann: `"sharp": "^0.34.4"` → `"^0.35.4"`. Ohne das hätte das nächste `npm install` den alten Stand
wieder auflösen dürfen. Die beiden transitiven Pakete stehen nicht in `package.json` und sind nur
über die Lockdatei gebunden — deshalb steht sie in den Zielpfaden dieses Auftrags.

**Jede Zeile des Lockdatei-Diffs, gezählt und zugeordnet** (32 geänderte Einträge, 2 neue, 0
entfernte — gegen `git show HEAD:package-lock.json` verglichen):
- 26 × `@img/sharp-*` / `@img/sharp-libvips-*` auf 0.35.4 bzw. 1.3.3, dazu die zwei **neuen**
  Plattformpakete `@img/sharp-freebsd-wasm32` und `@img/sharp-webcontainers-wasm32` — Zubehör von
  `sharp` 0.35.4, nicht von Hand geschrieben;
- `sharp`, `fast-uri`, beide `brace-expansion`-Knoten — die drei Hebungen oben;
- `process-warning` 5.0.0 → 5.1.0 — **Rückstand aus dem zurückgenommenen `fastify`-Versuch**:
  5.12.1 verlangte den neueren Stand, und `npm` stuft beim Zurücknehmen nicht ab. 5.1.0 liegt
  innerhalb dessen, was `fastify` 5.8.5 akzeptiert; das Paket steht auf keiner Advisoryliste.
  Es wird hier genannt, weil es sonst eine unerklärte Zeile im Diff wäre;
- das Feld `version` der Lockdatei selbst: `1.0.0-beta.1.230` → `1.0.0-beta.1.554` — es war
  gegenüber `package.json` veraltet und wird von jedem `npm install` nachgezogen.

### Die eine Entscheidung, die Pedi sehen soll: `sharp` 0.34 → 0.35

Pedis Wortlaut: „keine Majorwechsel ohne eigene Begründung". Hier ist sie, ausgeschrieben:

- `sharp` ist das **einzige** der sieben Pakete, dessen Advisorybedingung Klarwerk ohne Vorbehalt
  erfüllt: fremde, hochgeladene Bilddaten laufen durch native Decoder
  (`bildverkleinerung.ts:34`, Weg über `POST /api/drafts/from-docx`).
- Beide Advisories sind **high** und beide verlangen `>=0.35.4`. Innerhalb `^0.34` gibt es keinen
  Stand, der sie verlässt — „kompatibel beheben" ist an dieser Zeile nicht möglich.
- Der Schritt 0.34 → 0.35 ist in `sharp`s eigener Zählung ein gewöhnlicher Freigabeschritt; die
  benutzte Oberfläche (`.rotate()`, `.resize()`, `.webp()`, `.metadata()`, `failOn`,
  `limitInputPixels`) ist über beide Stände dieselbe. Das ist **gelesen**, nicht vermutet — und es
  ist trotzdem kein Ersatz für eine Messung.
- **Die Messung ist deshalb Teil dieser Lieferung**, nicht ihre Voraussetzung: der Bildimport läuft
  im Cloud-Lauf mit echtem PNG durch das echte, neu installierte `sharp`. Wäre er rot geworden,
  wäre laut Auftrag §6 die Versionsänderung zurückgenommen und der Befund berichtet worden — nicht
  der Test angepasst.
- **Das bleibt riskant**, und das steht hier so: der Wechsel bringt andere native Binärdateien mit
  (`@img/sharp-*` 0.35.4, `libvips` 1.3.3). Was diese Binärdateien auf einer anderen Plattform als
  der des Prüflaufs tun, ist von hier aus nicht gemessen.

### Was NICHT gehoben wurde, und warum

- **`fastify` 5.8.5 → 5.12.1** (kein Majorwechsel, kompatibel, und trotzdem nicht machbar): die
  Hebung wurde vorgenommen, im Cloud-Prüfplatz mit `npm ci` installiert und gefahren — sie bricht
  den Typprüfer an `services/app/src/build-app.ts:1867`, einer Datei ausserhalb der Zielpfade.
  Beleg, Gegenbeleg und der nötige Folgeauftrag stehen oben bei der Zeile. **Das ist die zweite
  offene Zeile für Pedi**, und die dringendere von beiden, weil `trustProxy` an einer Sperre hängt.
- **`nodemailer` 6.10.1 → 9.1.0+** (drei Hauptwechsel): exponiert, aber nicht kompatibel behebbar.
  Begründung und die verbleibende Begrenzung stehen oben bei der Zeile. Offen, für Pedi.
- **`@fastify/static` 9.1.3 → 10.1.3** (Hauptwechsel): **nicht exponiert** — die Advisorybedingung
  (ein geschützter statischer Pfad) ist nicht hergestellt, und zwei Wächter halten das fest. Ein
  Hauptwechsel ohne Exposition wäre ein Nebenbei-Upgrade.
- **`find-my-way` 9.6.0**: **nicht exponiert** — die HTTP/2-Bedingung ist nicht erfüllt, ein
  Wächter hält sie. Begründung und der vorgelegte Gegenpunkt stehen oben bei der Zeile.

### Zurückgenommen: die Installationsbehauptung aus Runde 2

Runde 2 hat hier behauptet, im Tor gebe es keinen Installationsschritt, der Torlauf benutze „immer
den geteilten, unveränderten Bestand", und eine Lockdateiänderung ginge deshalb ungeprüft durch.
**Das war falsch, und es hat eine Runde gekostet.** BEN hat es widerlegt, Codex hat den Code selbst
gelesen: `register/cloud/remote_job.py:123 ff.` führt vor jeder Arbeitsprüfung **und** vor dem Tor
`npm ci` und `npm ci --prefix apps/web` aus; BENs Installationsprotokoll nennt
`added 418 packages, and audited 419 packages in 6s`.

Richtig bleibt nur die erste der beiden damaligen Tatsachen: `node_modules` ist im Arbeitsbaum ein
Symlink auf den geteilten Bestand des Produkts, ein lokales `npm install` wäre also ein Eingriff in
alle gleichzeitig laufenden Jobs. Genau deshalb ist die Lockdatei ausschliesslich über
`npm install --package-lock-only` bzw. `npm update --package-lock-only` geändert worden — sie fasst
`node_modules` nicht an — und **jede** Aussage über das Verhalten der gehobenen Pakete stammt aus
einem Cloud-Lauf, der per `npm ci` frisch aus dieser Lockdatei installiert hat. Lokal wäre sie
nicht zu belegen gewesen; dort läuft weiterhin der alte Bestand.

## 3. `npm audit` vorher und nachher

| | betroffene Pakete | high | moderate |
|---|---|---|---|
| **Vorher** (Recherchebefund 16.09., Stand `.542`, und nachgemessen 17.09.) | 7 | 6 | 1 |
| **Zwischenstand** (mit `fastify` 5.12.1 — dem Stand, der den Typprüfer bricht) | 3 | 3 | 0 |
| **Nachher** (17.09., endgültiger Stand der Lockdatei, `npm audit --omit=dev --json`) | **4** | **3** | **1** |

Weg sind: `fast-uri`, `brace-expansion`, `sharp`.
Geblieben sind vier, und für jede steht hier die **Exposition**, nicht „kein Fix verfügbar":

- **`@fastify/static`** — bleibt, weil der Fix ein Hauptwechsel ist. **Nicht exponiert:** die
  Advisorybedingung (Rechteprüfung über statischen Dateien) ist nicht hergestellt; zwei Wächter
  halten das fest, beide kalibriert.
- **`fastify`** (moderate) — bleibt, weil die kompatible Version 5.12.1 den Typprüfer des Produkts
  in einer Datei ausserhalb der Zielpfade bricht. **Exponiert** über (b), den `trustProxy`-Hop-Count.
  Der Zwischenstand oben ist die Messung, dass die Hebung wirkt — sie ist nur hier nicht einbaubar.
- **`find-my-way`** — bleibt, weil der Auftrag die Hebung an das Urteil bindet und das Urteil
  „nicht exponiert" lautet: die Advisory verlangt HTTP/2, `buildApp()` baut einen `node:http`-Server.
  Ein Wächter hält die Bedingung, kalibriert.
- **`nodemailer`** — bleibt, weil der Fix drei Hauptwechsel entfernt ist. **Exponiert:** der
  Adressparser wird über `smtp.ts:24-26` unverändert mit der Empfängeradresse erreicht, und zwei
  der drei gemessenen Eingabeformen zeigen am gebundenen Stand ein Fehlparsen der beschriebenen
  Klasse.

Der Nachher-Lauf war nötig, weil sich die Ausgabe durch die eigene Lockdateiänderung verändert hat —
genau der Fall, den Lieferung 8 dafür vorsieht. Er ist nicht die Abnahme: die Abnahme ist der
Torlauf auf der geänderten Lockdatei.

**Und der ist gefahren.** `./tools/check` im Cloud-Prüfplatz, der die geänderte Lockdatei per
`npm ci` frisch installiert: **Exit 0, `✓ check grün`** (Arbeitsprüfung
`3fab1bb9960a42ee9df22f46101c2ab3`, Cloud-Lauf `faa17770399f9b7822af04ac`; darin `54 passed` im
Playwright-Teil). Erst damit steht hier „behoben" und nicht „unentschieden" — §9 des Auftrags bindet
genau diese Aussage an einen erfolgreichen Torlauf. Kein fremder Test ist durch die Hebung rot
geworden; hätte einer das getan, stünde er hier als Ergebnis und wäre nicht angepasst worden.

## 4. Lieferung 7 — jede Mutation am PRODUKT, jeder Regressionstest unverändert

Das ist der Nachweis, den Runde 3 nicht hatte. BENs Zurückweisung wörtlich: „Das belegt
Hilfsfunktionen, aber keinen roten Lauf der vorgeschriebenen Regressionstests gegen mutierten
Produktcode." Der Weg geht deshalb andersherum als in Abschnitt 4b: eine vollständige
**Produktkopie** in einem Wegwerfordner unter `os.tmpdir()`, **genau eine** verstellte Stelle im
PRODUKTCODE, und der **unveränderte** Regressionstest darin gefahren — mit seinem wirklichen
Exit-Code und seiner wirklichen Fehlermeldung (`produktkopie.ts`, `produktmutationen.test.ts`).

**Die Nullprobe steht bewusst zuerst.** Ohne sie wäre jede Rotfärbung unten mehrdeutig: sie könnte
auch von einer unbrauchbaren Kopie kommen. Erst weil der ganze Ordner in der **unverstellten** Kopie
grün ist, ist ein rotes Ergebnis der Verstellung zuzuschreiben. Ein Abbruch (`code === null`) und ein
roter Lauf ohne Fallzahlen gelten ausdrücklich **nicht** als kalibrierter Fall.

Alle Zahlen und Meldungen unten stammen aus Cloud-Lauf `2cc0517f9c8ec35cfa93e252`
(Arbeitsprüfung `a4762d31dae54b7690105ee6423148dc`, Exit 0, `Test Files 8 passed (8)`,
`Tests 53 passed (53)`) und sind auf dem abgegebenen Stand zeichengleich bestätigt
(Cloud-Lauf `f0058077fa3bc26a049e76ba`, Arbeitsprüfung `5a17e096141944a6b275f2b0a16b660e`,
Exit 0, dieselben acht Dateien und 53 Fälle).

| Fall | Verstellung im Produktcode der Kopie | unveränderter Regressionstest | Exit | Fälle des inneren Laufs | wörtliche Meldung |
|---|---|---|---|---|---|
| NULLPROBE | **keine** | ganzer Ordner (7 Dateien) | 0 | `Test Files 7 passed (7)` · `Tests 43 passed (43)` | — |
| a | `import/bildverkleinerung.ts`: `BILD_MAX_KANTE = 1280` → `4096` | `bildimport-bleibt-heil.test.ts` | 1 | `2 failed \| 1 passed (3)` | `expected 4096 to be 1280 // Object.is equality` |
| b | `routes/ask-routes.ts:288`: `schema: { body: askBodySchema }` → `schema: {}` | `http-validierung-bleibt-streng.test.ts` | 1 | `5 failed (5)` | `Primitiver Body "hallo" kam mit 200 durch: {"result":{"answered":false,…: expected 200 to be 400` |
| c | `web-static.ts`: der Asset-Zweig im `notFoundHandler` wird nie mehr genommen | `statische-auslieferung-bleibt-laut.test.ts` | 1 | `1 failed \| 8 passed (9)` | `Ein fehlendes Bündel kam still als SPA-HTML zurück (Status 200)` |
| d | `notifications/src/smtp.ts:26`: `to: message.to` → `to: message.to.toUpperCase()` | `mailadressen-bleiben-unveraendert.test.ts` | 1 | `2 failed \| 4 passed (6)` | `Die Empfängeradresse kam verändert bei nodemailer an: übergeben "klara.pruefung@beispiel.invalid", angekommen "KLARA.PRUEFUNG@BEISPIEL.INVALID" — eine Einladung ginge an jemand anderen` |
| e | `build-app.ts:1866`: `http2: true` in die Fastify-Optionen | `kein-http2.test.ts` | 1 | `2 failed (2)` | `http2 taucht in services/ auf — die find-my-way-Einordnung „nicht exponiert" ruht auf genau dieser Fehlanzeige: app/src/build-app.ts: expected [ 'app/src/build-app.ts' ] to deeply equal []` |
| f | `package-lock.json`: `node_modules/sharp` 0.35.4 → `0.0.0-verstellt` | `gebundene-versionen.test.ts` | 1 | `1 failed \| 5 passed (6)` | `sharp: der Bericht sagt 0.35.4, die Lockdatei sagt 0.0.0-verstellt (node_modules/sharp)` |
| g | `server.ts`: `onRequest`-Rechteprüfung **VOR** `registerWebStatic` in `configureWebDelivery` | `statische-auslieferung-bleibt-laut.test.ts` | 1 | `1 failed \| 8 passed (9)` | `Der Auslieferungsaufbau in server.ts hat sich geändert. … expected [ 'registerSecurityHeaders', …(12) ] to deeply equal [ 'registerSecurityHeaders', …(8) ]` |
| h | `web-static.ts`: `onRequest`-Rechteprüfung unmittelbar **vor** der Static-Registrierung | `statische-auslieferung-bleibt-laut.test.ts` | 1 | `6 failed \| 3 passed (9)` | `/assets/app.js verlangt ohne Berechtigung eine Anmeldung (Status 401) — über einer statisch ausgelieferten Datei liegt damit eine Rechteprüfung, und genau die ist die Bedingung von GHSA-83w8-p2f5-377r und GHSA-8pvw-jcv7-9cmj` |
| i | `web-static.ts`: zweite, **gekapselte** `@fastify/static`-Registrierung unter `/intern/` mit `onRequest`-Wache | `statische-auslieferung-bleibt-laut.test.ts` | 1 | `3 failed \| 6 passed (9)` | `/intern/assets/app.js verlangt ohne Berechtigung eine Anmeldung (Status 401) — …` |

**Die Fälle g, h und i sind BENs Abnahme zu Korrekturpflicht 1**, wörtlich: „unveränderter Stand
grün; eine vorgeschaltete Rechteprüfung gezielt rot; eine zweite geschützte Registrierung gezielt
rot." Sie liegen an drei verschiedenen Riegeln, und das ist Absicht:
- **g** fällt an der **Kette im Quelltext** auf (`auslieferungsKette`). `configureWebDelivery` ist
  nicht exportiert und `server.ts` startet beim Import einen Server — die Kette ist nicht
  aufrufbar, also wird jeder Aufruf in ihrem Rumpf am Syntaxbaum gelesen und gepinnt. Aus neun
  Aufrufen werden durch die eingefügte Prüfung dreizehn.
- **h** fällt am **Zugriff ohne Berechtigung** auf (`zugangsBefunde`) — genau die 401, die BENs
  Gegenprobe erzeugt hat und die der alte Wächter nicht sah. Zusätzlich am Hookregister.
- **i** fällt an der **Reihe der `register`-Aufrufe**, am Präfix und ebenfalls an der 401 auf. Die
  gekapselte Form ist die, die WIRKLICH schützt: die `preHandler`-Option von `@fastify/static`
  wacht nicht (gemessen, s. Abschnitt 4b).

**Warum der alte Wächter bei h und i schwieg** (BENs Befund, Cloud-Lauf
`8bbfa0116713d2ca336cc6cf`, `schutzBefunde=[]`): Er prüfte Verzeichnistext und Aufrufzahl, und seine
Hook-Beobachtung begann erst mit `beobachteAuslieferung` — ein vorher registrierter Hook war
unsichtbar. Beides ist ersetzt: das Hookregister wird jetzt **an der Instanz** gelesen (Endstand,
reihenfolgeunabhängig), und der Zugang wird **gefragt** statt erschlossen.

**Preis, ehrlich benannt:** dieser Nachweis kostet eine Produktkopie (`services`, `apps`, `tests`;
Abhängigkeiten werden verlinkt, nicht kopiert) und zehn eigene Vitest-Läufe — im Lauf oben 26,8 s
für die Datei. Er ist der teuerste Test dieses Ordners und der einzige, der die Zusage belegt.

## 4b. Die Prüffunktionen selbst — und was ihre Kalibrierung NICHT belegt

Jede prüfende Funktion steht in `waechter.ts` und wird **zweimal** gefahren: am echten Stand muss
sie schweigen, an einer verstellten, isolierten Kopie muss sie reden. Die zweite Hälfte steht in
`kalibrierung.test.ts`; keine Verstellung berührt eine Produktdatei.

**Grenze dieser Tabelle, und sie ist BENs Befund aus Runde 3:** Drei ihrer Fälle stellen den
Produktweg NACH (eine eigene Route statt `POST /api/ask`, eine eigene `sharp`-Kette statt
`bildverkleinerung.ts`, ein unmittelbarer Zeichenvergleich statt `smtp.ts`). Sie belegen damit, dass
die einzelne Prüffunktion unterscheiden kann — **nicht**, dass der Regressionstest rot wird, wenn
sich das Produkt ändert. Das Zweite steht in Abschnitt 4 und nur dort.

| Fall | Datei | Verstellung (isoliert) | wörtliche Ausgabe der Verstellung |
|---|---|---|---|
| a | `bildimport-bleibt-heil.test.ts` | dieselbe `sharp`-Kette mit Grenze 4096 statt `BILD_MAX_KANTE` | `Die Ableitung ist 1600×1200 — die Zielkante 1280 greift nicht mehr` |
| b | `http-validierung-bleibt-streng.test.ts` | dieselbe Route **ohne** `schema.body` | `Eine fehlerhafte Anfrage kam mit 200 durch statt mit 400: {"ok":true}` |
| c | `statische-auslieferung-bleibt-laut.test.ts` | `notFoundHandler` liefert `index.html` **auch** für Assets | `Ein fehlendes Bündel kam still als SPA-HTML zurück (Status 200)` |
| d | `mailadressen-bleiben-unveraendert.test.ts` | Weitergabe als `message.to.toLowerCase()` | `Die Empfängeradresse kam verändert bei nodemailer an: übergeben "Klara.Pruefung@Beispiel.Invalid", angekommen "klara.pruefung@beispiel.invalid" — eine Einladung ginge an jemand anderen` |
| e | `kein-http2.test.ts` | `Fastify({ http2: true })`; zusätzlich `http2: true` im Quelltext | `HTTP/2 ist eingeschaltet (Http2Server): GHSA-c96f-x56v-gq3h greift ab jetzt` |
| f | `gebundene-versionen.test.ts` | **eine** Version in einer Lockdateikopie verstellt | `fastify: der Bericht sagt 5.8.5, die Lockdatei sagt 0.0.0-verstellt (node_modules/fastify)` |

Dazu die Kalibrierung, die es in Runde 2 nicht gab und deretwegen sie rot war — **BENs Mutation**,
eine zweite, rechtegeschützte `@fastify/static`-Registrierung **in derselben Quelldatei**, bei
unverändertem Import:

| Riegel | Verstellung | Ausgabe |
|---|---|---|
| Quelltext | zweite `.register(fastifyStatic …)` in der Kopie von `web-static.ts` | zwei Funde statt einem, mit Zeilennummern |
| Aufbau | zweite Registrierung mit `prefix: "/geschuetzt/"` und `preHandler` (ohne Kopf 401, mit Kopf 200 — im Fall selbst nachgemessen) | `2 statt einer @fastify/static-Registrierung …` · `eine Registrierung liegt unter dem Präfix "/geschuetzt/"` · `eine Registrierung bringt eine Wache mit: preHandler` |
| Aufbau | Wache **direkt an einer Route** (`app.get(…, { preHandler }, …)`) | `die Route /geschuetzte-akte trägt eine Wache: preHandler` |
| Aufbau | **gekapselter** geschützter Bereich (`app.register(async scope => …)` mit `onRequest`-Wache, ohne Kopf 401, mit Kopf 200) | `2 statt einer @fastify/static-Registrierung …` |

**Ein Zwischenbefund, der den Riegel geformt hat und deshalb hier steht** (Cloud-Lauf
`fd7b06f9283bbfa327d27290`): Eine Wache, die als **Option** an `@fastify/static` mitkommt, taucht in
der Routentabelle (`onRoute`) **nicht** als `preHandler` auf. Ein Riegel, der nur die Routentabelle
liest, hätte BENs Mutation ein zweites Mal durchgelassen. Deshalb wird die Wache an **beiden**
Stellen gelesen — an der Registrierung und an der Route —, und beide Formen sind oben je mit einem
eigenen Fall belegt.

Übersicht, was die Wächter halten:

| Datei | hält fest |
|---|---|
| `gebundene-versionen.test.ts` | Tabelle oben ≡ `package-lock.json`; kein zweiter Ort für Versionen |
| `kein-http2.test.ts` | die Bedingung, unter der `find-my-way` „nicht exponiert" ist |
| `statische-auslieferung-bleibt-laut.test.ts` | eine Registrierung, kein Präfix, keine Wache; 404 statt SPA; kein Traversal; **die ganze Auslieferungskette aus `server.ts` Aufruf für Aufruf, ihr Hookregister und der Zugriff OHNE Berechtigung auf jeden ausgelieferten Baum** |
| `produktmutationen.test.ts` | dass jede der neun Verstellungen am Produkt genau ihren Regressionstest rot macht — und dass die unverstellte Kopie grün ist |
| `bildimport-bleibt-heil.test.ts` | echtes Bild durch echtes `sharp`; Original unangetastet; defektes Bild bleibt mit Grund |
| `http-validierung-bleibt-streng.test.ts` | jede Body-Wurzel ist ein Objekt; primitive Körper werden abgewiesen |
| `mailadressen-bleiben-unveraendert.test.ts` | Klarwerk reicht die Adresse unverändert durch; der gebundene Parser, gemessen |
| `kalibrierung.test.ts` | dass die Prüffunktionen überhaupt unterscheiden können — nicht mehr (s. 4b) |

**Eine Nachführung ausserhalb dieses Ordners, und warum sie sein musste.** Der neue Kopfkommentar
von `statische-auslieferung-bleibt-laut.test.ts` nennt `Cache-Control` — das ist eine der sieben
Achsen des Klara-Regressionsinventars. Der Wächterlauf wurde dadurch rot
(`tests/app/klara-regressionsinventar.test.ts`, K2: „neu im Baum, aber nicht im gepinnten
Inventar — Inventar nachfuehren"). Die Datei ist dort **eingetragen** worden, nicht der Wächter
angepasst und auch nicht der Kommentar umformuliert, bis er nicht mehr trifft: sie fährt
`registerWebStatic` und damit denselben Aufbau, der `/word-addin/taskpane.html` ausliefert — fällt
der laute 404 weg, bekommt ein installiertes Add-in HTML unter einem `.js`-Pfad. Der Eintrag ist
also sachlich richtig und nicht bloss ein Beruhigen des Wächters. `nurName` (K5) bleibt bei 68,
weil „klara" nicht im Pfad steht.

Mehrere dieser Fälle werden **rot, wenn ein Paket gehoben wird**. Das ist ihre Aufgabe. Ein rot
gewordener Fall ist dann kein Defekt, sondern der Anlass, die Einordnung neu zu machen — **nicht**,
den Test anzupassen.

## Nicht gemessen

- **Echter SMTP-Versand.** Kein Server, keine Verbindung, kein Empfänger, keine echte Adresse. Fall
  B misst nodemailers Parser gegen dessen eigenes `jsonTransport`.
- **Die nativen Decoder von `sharp` in ihrer Tiefe** — auch nicht auf der gehobenen Version.
  Gemessen ist, dass der Importweg mit einem echten PNG funktioniert und ein defektes Bild ehrlich
  meldet. Ob eine libvips-/libheif-CVE auf 0.35.4 auslösbar ist, wurde **nicht** untersucht.
- **Die `@img/sharp-*`-Binärdateien auf anderen Plattformen** als der des Cloud-Prüflaufs.
- **Ob eine anfragegesteuerte Zeichenkette `brace-expansion` erreicht** und **ob Klarwerk `fast-uri`
  als Sicherheitsentscheidung benutzt.** Beide Fragen waren in Runde 2 „unentschieden" und sind es
  sachlich geblieben; die Hebung hat sie gegenstandslos gemacht, nicht beantwortet. Was sie
  entscheiden würde, steht bei den Zeilen.
- **Ob `KLARWERK_TRUST_PROXY` im Betrieb als Hop-Count gesetzt ist.** Die Betriebsumgebung liegt
  nicht im Repo; belegt ist nur der Codepfad.
- **Was `fastify` 5.12.1 im laufenden Betrieb täte.** Gemessen ist nur, dass die Typprüfung mit ihr
  scheitert — an sieben Stellen, davon sechs im Produkt (`build-app.ts`) und eine in
  `kalibrierung.test.ts` dieses Ordners. Ob die übrigen Tests mit ihr grün blieben, ist **nicht**
  gemessen worden — der Torlauf kommt hinter der Typprüfung, und die war rot.
- **Die Auslieferungskette aus `server.ts` wurde nicht AUSGEFÜHRT, sondern gelesen und
  nachgestellt.** `configureWebDelivery` ist nicht exportiert, und `server.ts` startet beim Import
  einen Server — eine echte Ausführung ist von einem Test aus nicht möglich. Was die Nachstellung
  hält, ist die gepinnte Aufrufreihe (Fall g macht sie gezielt rot); was sie NICHT hält, ist eine
  Änderung, die dieselbe Aufrufreihe behält und trotzdem anders wirkt.
- **Hooks INNERHALB einer gekapselten Registrierung** stehen nicht im Hookregister der Wurzel. Sie
  fallen über die Reihe der `register`-Aufrufe und über die Zugangsprobe auf (Fall i), nicht über
  das Register selbst.
- **Der Zugang wurde ohne jeden Kopf gefragt.** Gemessen ist: die ausgelieferte Datei kommt ohne
  Berechtigung mit 200. Nicht gemessen ist, wie sich die Auslieferung gegenüber einem angemeldeten
  Zugang verhält — für die Advisorybedingung ist genau die erste Frage die entscheidende.
- **Die Produktkopie ist eine Kopie des Arbeitsbaums, kein Betrieb.** Sie verlinkt die
  Abhängigkeiten statt sie neu zu installieren; sie belegt daher das Verhalten der Testfälle, nicht
  das einer frisch aufgesetzten Umgebung.
- **Jeder Angriff gegen die Produktion.** Es wurde nichts gegen eine laufende Instanz gefahren.
- **Die übrigen Einzel-Advisories im Auditbericht**, soweit sie über die hier benannten hinausgehen
  — sie sind nicht alle einzeln gegen Klarwerk validiert.
- **Das Verhalten der gehobenen Pakete im lokalen Arbeitsbaum.** Dort zeigt `node_modules` auf den
  geteilten, alten Bestand; jede Aussage über die neuen Versionen stammt aus einem Cloud-Lauf mit
  frischem `npm ci`.
