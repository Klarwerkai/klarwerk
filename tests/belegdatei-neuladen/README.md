# Belegdatei nach PostgreSQL-Neustart und Anhangsumbenennung

Auftrag `aufnahme:20260922:belegdatei-neuladen`, Aufgabenrevision 18, Lauf `2-v9`. Basis `6430e975`,
Fassung `1.0.0-beta.1.626`. Hier wird der vorhandene Anhangsanker aus JOB 4077 an die Hinweise
angeschlossen, die BEN bei JOB 4077 offen gelassen hat. Es gibt **keine neue Quellenlogik und keine
Änderung am Produktcode**.

Lauf `2-v9` übernimmt den Kandidaten aus Lauf 1 (Zweig
`lauf/lauf_b3_aufnahme_20260922_belegdatei-neuladen_1`, letzte Runde `9ff54aad`) unverändert in
beiden Testdateien. Neu ist nur `original-ist-reiner-speicher.test.ts` für R-0146 (siehe
Widerspruch 3). Die Befunde aus Lauf 1 bleiben unten erhalten.

## Ausgangspunkt: BEN-4077

`archiv/4077/runde-2/ben-antwort.md`, Urteil GRÜN, Prüfstand `e56759a3`. Punkt 6, „nicht
blockierend“:

> PostgreSQL-Neuladen nach Prozessneustart ergänzend testen. Außerdem Umbenennung eines Anhangs mit
> erneuter Board-Abfrage prüfen; die aktuelle Auflösung erfolgt beim Anzeigen.

Unter „NICHT GEPRÜFT“ steht dort außerdem: „echter PostgreSQL-Bestand“.

## Was dieser Ordner liefert

| Datei | Läuft im Tor? | Kriterium | Was belegt ist |
|---|---|---|---|
| `name-ist-nicht-die-identitaet.test.ts` | ja (`tools/test`) | 2, 3 | Zwei Anhänge tragen denselben Namen, der Köder steht zuerst. Die Belegstelle führt trotzdem zur verankerten Datei und zu deren Bytes. Die Ableitung nennt bei geändertem Anhangsnamen den neuen Namen (nur an der gelesenen Kopie, die Speicherung prüft der Integrationslauf). Wird der Dateiname als Anker geschickt, kommt auf der Vorgabestufe 403; auf einer offenen Stufe wird die Quelle ohne Anker gespeichert. Die Kennung eines fremden Objekts wird mit 403 abgewiesen. |
| `original-ist-reiner-speicher.test.ts` | ja (`tools/test`) | 4 (R-0146) | Das Original wird mit genau dem Aufruf der Oberfläche hochgeladen (`kind: "document"`, `purpose: "anchor"`, `draftId`). Am erneut gelesenen Objekt stehen Zweck `anchor` und die Entwurfsbindung. Die einzige auswertende Route (`POST /api/media/analyze`) weist es mit 400 `UNSUPPORTED_KIND` ab. Die Rohbytes kommen unverändert zurück (mit Null- und Hochbytes). Ein Merkmal, das nur im Original steht, taucht im gelesenen Entwurf nicht auf. Gegenprobe (von Hand, nicht Teil des Laufs): nimmt `media/src/service.ts` testweise auch Dokumente an, wird der Fall rot (`expected 200 to be 400`). |
| `belegdatei-nach-neustart-und-umbenennung.integration.test.ts` | nein (Integrationslauf, `npm run test:integration`) | 1, 2, 3 | Ein echter Serverprozess wird mit SIGTERM beendet; danach wird nachgewiesen, dass die PID weg ist. Der Anker wird in der Zeile `kos` nachgelesen. Der Anhang wird im gespeicherten Bestand umbenannt, dann startet ein neuer Prozess auf derselben Datenbank. Geprüft werden `/api/validation/board`, `/api/kos/:id`, die Ableitungen `quellennachweis`/`originalweg` und `/api/objects/:id/raw` (Bytes vor und nach dem Neustart gleich). **Oberfläche:** Chromium meldet sich über die Maske am zweiten Prozess an. Auf `/wissen/:id` steht der neue Name unter „Quellen“, auch nach F5. Der Öffnen-Knopf des umbenannten Anhangs führt zur verankerten Kennung und liefert deren Bytes. Die Prüfkarte auf `/validierung` nennt ebenfalls den neuen Namen. Nach dem Neustart werden die Kennung eines fremden Objekts, der alte Name, der neue Name und eine erfundene Kennung mit 403 abgewiesen. Ein Leser ohne Berechtigung bekommt für den vertraulichen fremden Anhang dieselbe 404 wie für eine erfundene Kennung. |

### Wie der Integrationslauf seine Datenbank bekommt

Beide Wege stehen in derselben Datei, kein eigener Wächter (es gilt `guardedLocalPgTestUrl` aus
`services/db-tx`):

1. `KLARWERK_PG_TEST_URL` gesetzt und von `guardedLocalPgTestUrl` angenommen → diese Instanz.
2. Nicht gesetzt → Testcontainers `postgres:16-alpine` (derselbe Weg wie der CI-Job `integration`,
   `.github/workflows/ci.yml`). Das deckt den Serverweg `container=true/postgres=false` ab, in dem
   laut Betriebshinweis vom 27.09. keine URL gesetzt wird.
3. URL gesetzt, aber vom Wächter abgelehnt, oder weder URL noch Container-Laufzeit → Grund auf
   stderr und `1 skipped`, nie `passed`. **Ein Skip ist kein Beleg** für die Kriterien 1 bis 3.

```sh
# mit bereitgestellter Instanz
KLARWERK_PG_TEST_URL=postgres://user:pass@127.0.0.1:5432/klarwerk_test \
  npx vitest run --config vitest.integration.config.ts tests/belegdatei-neuladen
# mit Container-Laufzeit, ohne URL
npx vitest run --config vitest.integration.config.ts tests/belegdatei-neuladen
```

Am Ende steht auf stderr eine Zeile `[KLARWERK] BELEGDATEI-NEULADEN PROTOKOLL` mit
PostgreSQL-Fassung, PIDs und Ports beider Prozesse, Chromium-Fassung und Dateiziel. Daran ist zu
erkennen, ob der Lauf wirklich ausgeführt wurde.

### Stand der Ausführung

- **Lauf 1, Runde 2 und 3 (25./26.09.2026):** lokal grün gegen PostgreSQL 16.14 aus
  `@embedded-postgres/darwin-arm64` (außerhalb des Repos) und Chromium 149.0.7827.55,
  `Tests 1 passed (1)`, zwei Prozesse mit verschiedenen PIDs und Ports. Gegenproben aus Runde 2,
  jeweils nur in der gebauten Fläche verfälscht, machten den Fall rot:
  - Die Auflösung nimmt den ersten Anhang → „Bibliothek, erstes Laden: expected ['Pruefprotokoll.pdf']“.
  - Der Öffnen-Knopf öffnet den ersten Anhang → das Dateiziel weicht von der verankerten Kennung ab.

  Dieser Weg war eine Host-PG-Installation auf dem Mac. Nach der heutigen Regel (keine
  PostgreSQL-/Browser-Schwerläufe und keine neue Host-PG-Installation auf dem Produktions-Mac) wird
  er nicht mehr empfohlen; die Anleitung dazu ist entfernt.
- **Lauf 1, Runde 3:** Der damalige Testserverweg (`testlauf.py`) führte nur `./tools/check` aus,
  und `vitest.config.ts` schließt `**/*.integration.test.ts` aus. Beleg `pa-1790370863-a7d37a0f`
  für `05825d76`: Ausgang `bestanden`, der Integrationslauf wurde dort nicht ausgeführt.
- **Lauf 2-v9 (28.09.2026):** Auf dem Mac nur die Tor-Hälfte ausgeführt (siehe Rückgabe). Der
  Integrationslauf ist **nicht** ausgeführt worden. Laut Betriebshinweis vom 27.09. sind PG-URL,
  Cloud-Chromium und Testcontainers auf dem Serverweg repariert. Das ist Umgebungsbereitschaft, kein
  Beleg für diesen Auftrag. Der Beleg für die Kriterien 1 bis 3 ist ein Serverlauf dieser Datei mit
  `passed` und der Protokollzeile, ohne Skip.

## Abgrenzung: was schon geliefert war und hier nicht neu gebaut wird

| Anliegen | Geliefert durch | Fassung / Commit | Beleg |
|---|---|---|---|
| Anker bestätigen, speichern, zum Dateinamen auflösen | JOB 4077 | `7c8d2e5a`, ship `1.0.0-beta.1.515` | `tests/quelle-dateiname-am-nachweis/*`; BEN R2 GRÜN (`e56759a3`) |
| Beleg führt bis zu den Originalbytes (Klara) | JOB 4224 | `dfbb7c4f` | `tests/klara-quellen-nutzerweg/*`. PG3 dort ist eine zweite App im **selben** Prozess und nutzt Testcontainers, kein Prozessneustart. |
| R-0146: Original beim Dateiimport speichern | WP-D2 | `e3652d94` | `tests/app/capture-from-file.test.ts` |
| R-0146: Original mit dem Entwurf verknüpfen (`purpose: "anchor"`, `anchorDocuments`, `verifyDraftAnchors`) | mega20 Block C/D | `d3fe69da` | `tests/capture/mega20-entwurf-referenz.test.ts` |
| R-0146: Import → Entwurf → Wiederöffnen gegen echtes PostgreSQL im Browser | JOB 4324 | `ebc82774`, ship `1.0.0-beta.1.577` | `tests/import-wiederoeffnen-nutzerweg/*`; BEN R2 GRÜN: P1/P3/P4/P5 grün, P2 (Verlassen-Weg) rot als Produktbefund |
| P2-Produktbefund aus JOB 4324 | JOB 4335 | `03779583` | gesonderter Auftrag; hier nicht erneut geprüft |
| Beleg/Original, Neustart gegen PG (UX-26) | UX-26 | `c44751d7`, `9002e9fb` | `tests/ux26-beleg-original/*`: Belegzeilen und Originalbytes nach Neustart, aber zweite App im selben Prozess, ohne Umbenennung |

## Widersprüche und fehlende Belege

1. **Es gibt keinen Weg zum Umbenennen von Anhängen.** Das Kriterium lautet „Anhang umbenennen und
   erneut über die Oberfläche abfragen“. Das Produkt kennt aber nur `attach` und `detach`
   (`services/app/src/routes/ko-routes.ts`, am Stand `6430e975` unverändert). Einen Umbenennen-Weg
   zu bauen wäre eine neue Anforderung jenseits der Quelle („keine neue Quellenlogik“). Deshalb
   wird die Umbenennung direkt in der Datenbank ausgeführt (Integrationslauf) bzw. am gelesenen
   Stand (Tor). Belegt ist damit die Eigenschaft aus BEN-4077: Der Name wird beim Anzeigen
   aufgelöst. Ob Nutzer einen Umbenennen-Weg brauchen, entscheidet Pedi.
2. **„Über die Oberfläche“:** Die gebaute Fläche läuft im echten Chromium gegen den zweiten
   Prozess. Das Dateiziel wird am Öffnen-Knopf mitgeschrieben (`window.open` wird umhüllt, läuft
   aber weiter), und die Bytes werden im selben Browserprofil abgeholt. Den Download im neuen Tab
   direkt zu fangen war in Playwright ein Wettlauf (gemessen: neuer Tab ohne Antwort- und
   Download-Ereignis).
3. **R-0146 „Ausgewertet wird das Original nicht“ — in Lauf 2-v9 geschlossen.** Lauf 1 hatte hier
   keinen Test. Serverseitig lesen genau drei Stellen Bytes aus dem Objektspeicher
   (`object-routes.ts` Metadaten und Rohbytes, `media/src/service.ts`); nur die dritte wertet aus,
   und nur `kind === "video"`. Die Oberfläche lädt Importoriginale immer mit `kind: "document"`
   hoch. `original-ist-reiner-speicher.test.ts` belegt das am Draht. **Grenze:** Ein Client, der
   selbst gebaute Anfragen mit `kind: "video"` und `purpose: "anchor"` schickt, könnte die
   Transkription auslösen; die Route prüft den Zweck nicht. Das ist kein Weg der Oberfläche und
   wurde hier nicht geändert (keine neue Anforderung).
4. **Nebenbefund, nicht geändert:** `anhangVon` in `services/app/src/check-text-detection.ts` nennt
   den ersten Anhangsnamen eines Objekts, nicht den verankerten. Das ist keine Belegstellen-Auflösung.
   Bei zwei Anhängen kann dort aber ein anderer Name erscheinen als am Nachweis.
5. **Fehlender Beleg: Serverlauf des Integrationstests.** Seit Lauf 1 ist die Datei nur lokal
   (Host-PG) gelaufen, nie am gebundenen Kandidaten auf dem Server. In Lauf 2-v9 ist sie gar nicht
   gelaufen (Mac-Regel). Nötig ist ein Serverlauf mit Testcontainers oder gesicherter URL, Ergebnis
   `passed` mit Protokollzeile. Diesen Lauf beantragt Ben im Endprüfschritt, nicht die Baubahn.
6. **Befund aus Lauf 1, nicht geändert:** Der Download trägt nach der Umbenennung weiter den
   **alten** Namen (`Content-Disposition: attachment; filename="Pruefprotokoll.pdf"`). `/raw` nimmt
   den Namen aus dem Objektspeicher (`object-routes.ts`, `safeAttachmentName(obj.ref.name)`), nicht
   aus dem Anhang. Kennung und Inhalt stimmen; nur der vorgeschlagene Dateiname folgt der
   Umbenennung nicht. Ob das geändert wird, ist eine eigene Entscheidung und nicht Teil dieses
   Auftrags („keine neue Quellenlogik“).
