# Der Großbestand-Nutzerweg (JOB 4271)

Findet ein Mensch in einem **großen** Bestand das Dokument, das er braucht? Diese Vorrichtung
beantwortet die Frage nicht mit einer Meinung, sondern mit einem ausgeführten Lauf: **10.000
synthetische Einträge** in einer echten PostgreSQL, ein **neu angelegter Testnutzer ohne jede
Vorsortierung**, die **sichtbare Suche** im echten Chromium, **echte Tastendrücke** — und danach ein
unabhängiger Blick zurück in die Datenbankspalte.

## Dateien

| Datei | Was sie tut | Wo sie läuft |
|---|---|---|
| `bestand.ts` | Der Bauplan der 10.000 Einträge und der Seed über den **Produktweg** (`KoService.create` + `setValidationState`), samt Seedmanifest, Kennungshash und dem Schreiben der Laufartefakte. | reine Funktion + Seed |
| `nutzerweg.ts` | Der Bedienweg: Suchfeld tippen, auf das Ende der Auffrischung warten, Trefferzeile per Tastatur öffnen, den geöffneten Eintrag lesen. Browservorrichtung geliehen aus `tests/gast-nutzerweg/browserweg.ts`. | — |
| `zusagen.ts` | **Die Zusagen 3–6 als ausführbare Funktionen — einmal ausgeschrieben.** Der Hauptlauf ruft sie am großen Bestand, die Kalibrierung ruft *dieselben* Funktionen unter Verstellung. | — |
| `findet-im-grossbestand.test.ts` | Prüft den **Bauplan** — ohne Datenbank, ohne Browser, ohne Seed. | **Tor** |
| `findet-im-grossbestand.integration.test.ts` | Der **ausgeführte** Nutzerweg (G0–G6). | Cloud/Integration |
| `kalibrierung.integration.test.ts` | Sechs Verstellungen (KZ3a, KZ3b, KZ4, KZ5, KZ6, KZ1) — je Zusage Baseline, Mutation, Rücknahme. | Cloud/Integration |
| `vorprobe.integration.test.ts` | Misst Datenbank, Schreibrate über den Produktweg, Chromium, gebaute Fläche. Grundlage der Entscheidung „Seed über den Produktweg statt direktem SQL". | Cloud/Integration |

## Aufruf

```sh
# Tor (nur der Bauplan; startet KEINEN Seed und KEINE Cloudinstanz)
npx vitest run tests/wiki-grossbestand-nutzerweg

# Der ausgeführte Lauf — braucht KLARWERK_PG_TEST_URL und Chromium
npx vitest run --config vitest.integration.config.ts tests/wiki-grossbestand-nutzerweg
```

Fehlt PostgreSQL, Chromium oder die gebaute Fläche, steht der Grund **sichtbar auf stderr** und der
Lauf wird als übersprungen ausgewiesen — nie als bestanden.

**Laufartefakte — zwei Wege, beide vollständig.** Seedmanifest, Laufprotokoll und Kalibrierbelege
gehen auf zwei Wegen hinaus, damit sie **nach** dem Lauf abrufbar sind und nicht mit dem
Prüfcontainer verschwinden:

1. **Artefakttransport.** Geschrieben nach `<repo>/test-results/klarwerk-4271/`
   (übersteuerbar mit `$KLARWERK_4271_BERICHTE`). Das ist der **vorhandene** Transport der
   Cloudvorrichtung, kein neuer: `register/cloud/remote_job.py:181-184` packt `test-results` nach
   `test-artifacts.tar.gz`, `:185` hasht es, `register/cloud/runner.py:266-269` holt es herüber und
   prüft den sha256. Der Ordner steht in `.gitignore:21` — er hinterlässt keinen Diff und stört die
   Nachlauf-Prüfung „Prüfstand nach Lauf verändert" (`remote_job.py:165-167`) nicht.
2. **Gesichertes Log.** Dasselbe Manifest **vollständig** auf stderr, in nummerierten Stücken mit
   Prüfsumme (`4271-MANIFEST BEGINN … / 0001/0103 … / ENDE …`). `manifestAusZeilen` setzt sie
   zusammen, prüft Stückzahl, Zeichenzahl und sha256 und wirft bei jeder Lücke. **Nichts wird
   herausgenommen** — auch nicht `kennungenJeGruppe`.

Der Kennungshash ist aus dem Manifest **allein** nachrechenbar: er läuft über die Verkettung der
Gruppen in der festen Reihenfolge `GRUPPEN_REIHENFOLGE`, die im Torfall `B9` gegen den Bauplan
geprüft wird. Damit steht keine Kennung doppelt in der Datei, und wer das Manifest hat, kann den
Hash nachrechnen.

## Der Bestand

| Gruppe | Anzahl | Aufgabe |
|---|---:|---|
| Zieldokument | 1 | `Zwirbelkopplung` steht **nur im Fließtext**, Trust 1, validiert. Kennung `BA-4271-07713` in der Aussage, Herkunft `Werk-Nord Linie 3` als Schlagwort. |
| Ähnlich benannte Ablenker | 20 | Titel und Dokumentnummern dicht am Ziel, **ohne** den gesuchten Begriff. |
| Deckel-Ablenkung | 160 | Trust 90, Begriff nur im Fließtext. |
| Fremde vertrauliche Einträge | 50 | Anderer Eigentümer, Stufe `vertraulich`, Begriff in Titel **und** Aussage, dazu ein Geheimwort. Negativkontrolle. |
| Herkunftsgruppe | 11 | Dasselbe Schlagwort wie das Ziel. |
| Füllbestand | 9.758 | Trägt keinen der Begriffe. |

Die Kalibrierung fährt **denselben Bauplan ohne Füllbestand** (`bauplan({ fuellbestand: 0 })`, 242
Einträge) plus eine Deckelfamilie aus 240 Ablenkern und einem Kalibrierziel — zusammen 483. Der
Torfall `B8` rechnet nach, dass der kleine Plan Zeichen für Zeichen der große ohne seine Füllzeilen
ist; liefen sie auseinander, kalibrierte die Kalibrierung etwas anderes, als der Hauptlauf misst.

## Was dieser Lauf gemessen hat

**Hauptlauf: Arbeitsprüfung `946192783eca4c419a40302060cc03aa`, Cloud-Lauf
`33ec2e07965dffc021b041be`, Start 2026-09-17 04:33:02 UTC, PostgreSQL 16.15 (Ubuntu 24.04,
x86_64).**

Die Produktbasis dieses Arbeitsbaums ist `efbaea4ba754a18e9a3a5e7c702b7a2be41510e0` (Prüfstand
Runde 2). Der Prüfcontainer arbeitet auf einem **privaten Schnappschuss** desselben Standes und
meldet dessen eigenen Commit `8f8380c591e98edfda7385e6daf60b0ccd9c7fc3` — beide Zahlen stehen hier,
damit keine für die andere gehalten wird.

| Abschnitt | Zeit |
|---|---:|
| `migrate` | 0,28 s |
| Seed 10.000 Einträge über den Produktweg (30,18 s gesamt) | 30,18 s |
| `apps/web` bauen | 8,35 s |
| Suchprojektion in Betrieb nehmen | **14,11 s** |
| Readiness der Projektion | 1,05 s |
| Instanz starten (mit bereits aktiver Projektion) | 1,20 s |
| Vorbereitung insgesamt | 55,56 s |
| Browserlauf G1a / G1b / G2 / G3 / G4 / G5 | 3,48 / 3,26 / 11,23 / 3,25 / 3,26 / 6,19 s |
| Aufräumen (Browser 0,02 s + Instanz/Pool 0,00 s + Datenbank 0,06 s) | **0,08 s** |
| Spitzenspeicher des **Prüfprozesses** (nicht Chromium, nicht PostgreSQL) | 716,3 MB |
| Zeilen in `kos` vor / nach dem Lauf | 0 / 10.000 |
| Kennungshash über die 10.000 erzeugten Kennungen | `bc4689d697877bce87cc988428e725adbc8ab5aad6709b673818d58989800d76` |

**Der Export dieses Laufs, nach seinem Ende nachgemessen** (nicht während der Laufzeit behauptet):

| Beleg | Befund |
|---|---|
| `register/cloud/runs/33ec2e07965dffc021b041be/test-artifacts.tar.gz` | 224.046 Bytes, sha256 `79f48357…b90b3` — gleich dem Eintrag in `check.meta.json` |
| `4271-MANIFEST`-Stücke in `check.err` | 103 von 103, 390.803 Zeichen, sha256 `dfe5a859…8a197` stimmt mit der angekündigten Prüfsumme überein |
| Kennungen im wieder zusammengesetzten Manifest | **10.000**, davon 10.000 verschieden |
| Kennungshash, aus dem exportierten Manifest nachgerechnet | `bc4689d6…00d76` — gleich dem Wert im Manifest |

Die leere Suchzeile zeigt diesem Nutzer **9.950** Einträge — die 50 fremden vertraulichen fehlen
darin, wie sie sollen.

**Keine allgemeine Leistungszusage.** Diese Zahlen gelten für **diesen Lauf, an diesem Bestand, auf
diesem Prüfplatz**. Aus ihnen folgt nichts über Produktion, andere Bestandsgrößen oder andere
Maschinen.

## Ergebnis

Zwei der drei Suchwege tragen, einer nicht:

- **Über die Kennung** (`BA-4271-07713`) — gefunden, in 7 Tab-Anschlägen per Tastatur geöffnet.
  Sichtbarer Fließtext (144 Zeichen), sichtbare Quellenliste und sichtbare Fassung (`v1`) sind
  **gleich** der unabhängigen Lesung aus `kos.data` — verglichen wird „ist", nicht „enthält". In
  einem zweiten, frischen Browserkontext dasselbe Ergebnis. ✔
- **Über die Herkunft** (`Werk-Nord Linie 3`) — gefunden, in 29 Tab-Anschlägen geöffnet. ✔
- **Über Aufgabe/Inhalt** (`Zwirbelkopplung`) — **nicht gefunden.** Der Fall `G1b` war deshalb rot,
  und er blieb es: er war die Lieferung, nicht ihr Mangel. → **Ursache seit JOB 4303 behoben**, siehe
  den Nachtrag unter „Gefundene Produktfehler".

Dazu: keiner der 50 fremden vertraulichen Einträge in der Liste, keiner im Rumpf der Suchantwort,
keiner in einer der 10 aufgeklappten Vorschauen; der Rechteentzug sperrt denselben Bedienweg.

### Die Kalibrierung

**Arbeitsprüfung `230a3ed2882a4a8b807862a1b974b3ba`, 6 Fälle, alle bestanden.** Jeder Fall ruft
*dieselbe* Funktion aus `zusagen.ts` wie der Hauptlauf — dreimal: unverstellt, verstellt,
zurückgenommen. **Keine Mutation blieb grün.**

| Fall | Zusage | Verstellung | Gemessene Rotfärbung | Rücknahme |
|---|---|---|---|---|
| KZ3a | 3 | 41 Ablenker aus dem Papierkorb zurück: 200 → 241 Anwärter bei gleicher sichtbarer Trefferzahl (200) | „das Zieldokument … steht NICHT in der sichtbaren Trefferliste zu „Deckelprobegross" (200 Treffer)" | wieder in 405 Tab-Anschlägen geöffnet |
| KZ3b | 3 | `tabIndex="-1"` an allen Trefferzeilen | „… war in 200 Tab-Anschlägen nicht erreichbar — das ist die Halbheit „nur mit der Maus"" | wieder erreichbar in 7 Anschlägen |
| KZ4a | 4 | Fließtext durch die **gegenteilige Anleitung** ersetzt, **Suchwort und Titel erhalten** | „der SICHTBARE Fließtext ist nicht der Fließtext aus der Spalte" | wieder 144 Zeichen, gleich der Spalte |
| KZ4b | 4 | sichtbare Fassung `v1` → `v9` | „im Abschnitt „Provenienz" steht nicht die aktive Fassung v1 … expected 9 to be 1" | wieder `v1` |
| KZ5 | 5 | Stufe der 50 fremden Einträge `vertraulich` → `intern` (**Filtermutation**, nicht Adminzugriff) | „der fremde vertrauliche Eintrag … steht in der Trefferliste" | wieder 150 Treffer, keiner sichtbar |
| KZ6 | 6 | Rechteentzug zurückgenommen (`vertraulich` → `intern`) | Leersatz „nicht eingetreten in 60000 ms" — die Zeile stand wieder da | wieder entzogen, Fall läuft durch |
| KZ1 | 3 | Zieldokument über den Produktweg in den Papierkorb | „… steht NICHT in der sichtbaren Trefferliste zu „BA-4271-07713" (0 Treffer)" | zurückgeholt, wieder 1 Treffer |

KZ4a ist BENs eigene Mutation aus Runde 1 — an ihr war der damalige Inhaltsnachweis **grün**
geblieben.

### Gefundene Produktfehler (gemeldet, **nicht** repariert)

**1 · Der Trefferdeckel greift vor dem Sichtbarkeitsfilter.** 211 Einträge tragen den Begriff; 50
davon darf der Testnutzer nicht sehen. Sie tragen den höchsten Vertrauenswert und besetzen deshalb
50 der 200 Deckelplätze, bevor die Route sie wegfiltert. Sichtbar bleiben 150 — und herausgefallen
ist ausgerechnet das gesuchte Dokument.
`services/library-analytics/src/service.ts:1789` reicht `opts.trim` **nicht** an `findSearchHits`
weiter; `services/app/src/routes/library-routes.ts:578-580` filtert erst danach.
Gemessen in `G1a`; dass der Deckel wirklich die Ursache ist, zeigt `KZ3a` an einem Bestand ohne
einen einzigen vertraulichen Eintrag.

> **NACHTRAG JOB 4303 (18.09.2026) — behoben.** `opts.trim` reist jetzt durch `findSearchHits` bis
> in die Suchprojektion; beide Adapter (Speicher und PostgreSQL) setzen ihn auf der **Grundmenge**
> durch, **vor** dem Deckel. Der Deckel füllt sich damit nur noch mit Einträgen, die der Suchende
> sehen darf. `G1a` ist entsprechend **abgelöst**: er schreibt nicht mehr den Fehlerwert 150 fest,
> sondern die Zusage der Korrektur (161 sichtbare Anwärter, keiner der 50 fremden Einträge in der
> Liste). Die Naht selbst wird ohne Browser und ohne 10.000er-Seed von
> `deckel-auf-sichtbarer-grundmenge.test.ts` bewacht.
>
> **Was JOB 4303 dabei NICHT gemessen hat:** den ausgeführten Browserweg. Der Cloud-Prüfplatz trug
> in dieser Runde kein PostgreSQL 16 („Prüfimage ohne PostgreSQL16; Integrationslauf nicht
> ausführbar", Arbeitsprüfung `e1fd8f7312a94b25913d0c5d16ec6602`, Exit 78), und ein lokaler
> Ersatzlauf ist untersagt. `G1a` und `G1b` sind in dieser Runde **weder ausgeführt noch bestanden**;
> ihr ausgeführter Nachweis steht aus.

**2 · Eine Instanz mit 10.000 Wissensobjekten wird nicht von selbst bereit.** Die Inbetriebnahme der
Suchprojektion braucht in diesem Lauf 14,1 s. Sie hängt im `onReady`-Hook
(`services/app/src/build-app.ts:1874`), und `Fastify({ … })` (`:1847-1850`) setzt kein
`pluginTimeout` — es gilt die Vorgabe von 10 s. Der erste Start gegen diesen Bestand endete in
Runde 1 mit `A callback for 'onReady' hook timed out` (Cloud-Lauf `073cf260afe650c6e22df4c3`). Der
Prüfstand nimmt die Projektion deshalb **vor** dem Start in Betrieb; im Betrieb gäbe es diesen
Vorgriff nicht.

**3 · Zwei gleichzeitige Anlagen schießen sich am Prüfprotokoll ab.** Sechs parallele
`KoService.create` gegen dieselbe Datenbank brechen mit
`duplicate key value violates unique constraint "audit_pkey"` ab.
`AuditService.record`/`recordOnce` (`services/audit/src/service.ts:33-35` und `:63-66`) lesen
`last.seq` und schreiben `seq + 1` ohne Serialisierung. Der Seed geht dem aus dem Weg
(`bestand.ts`, `GLEICHZEITIG = 1`), statt ihn zu verdecken. Gemessen: Cloud-Lauf
`f87d247ac90e63ee0eff87b3` (Runde 1).

## Nicht gemessen

- **Ein automatisierter neuer Testnutzer ersetzt keine menschliche Usability-Abnahme mit unbekannten
  Personen. Diese Grenze bleibt offen.** Der Lauf zeigt, dass ein Weg technisch trägt — nicht, dass
  ein Mensch ihn findet, versteht oder als angenehm erlebt.
- **`./tools/check`.** Der Torlauf dieses Standes wird vom Taktgeber außerhalb dieser Sitzung
  gefahren; hier gemessen sind nur die betroffenen Testgruppen und der Wächterlauf.
- **Der Inhalt des Artefaktarchivs selbst.** Nachgemessen sind seine Existenz nach Laufende, seine
  Größe und sein sha256 gegen `check.meta.json`. Das Auspacken war in dieser Sitzung nicht möglich
  (`tar` gesperrt); die Vollständigkeit des Manifests ist deshalb am **zweiten** Weg belegt — an den
  `4271-MANIFEST`-Stücken in `check.err`, zusammengesetzt, geprüft und nachgerechnet.
- **Die Rangfolge in der Trefferliste.** Der Lauf prüft, ob das Dokument in der sichtbaren Liste
  steht und per Tastatur zu öffnen ist. Ob es dort weit genug oben steht, um gefunden zu *werden*,
  ist eine andere Frage — die Fläche bewertet nur die bereits gelieferten Felder
  (`apps/web/src/lib/librarySearch.ts:1-4`, ohne Fließtext), und ein Volltexttreffer bekommt dort
  keinen Punkt.
- **Offline.** Kein Teil dieses Auftrags. Der angehaltene Zustand wird nur insoweit berührt, als
  jede negative Aussage voraussetzt, dass die Liste nachweislich frisch ist.
- **Produktionsdaten, Produktionsgrößen, Produktionshardware.** Ausschließlich synthetische Einträge
  in einer Wegwerf-Datenbank mit `test` im Namen, am Ende entfernt.
- **Andere Suchwege.** Klaras Frageweg, die Textprüfung und die Wissensprüfung teilen sich den
  Kandidatendeckel, werden hier aber nicht gefahren.
- **Die Suche nach der technischen Kennung (UUID).** Die Projektion indiziert nur Titel, Aussage,
  Fußnoten, Fließtext, Kategorie und Schlagwörter; eine eingefügte UUID trifft deshalb nichts. Als
  „Kennung" misst dieser Lauf die **fachliche** Dokumentnummer, wie ein Mensch sie auf dem Blatt
  liest.
- **Die Fokussichtbarkeit der Abschnitts-Aufklapper** (`<summary>` in `MehrAbschnitte.tsx`). Gemessen
  ist sie am Knopf „Mehr" (sichtbar, `outline: solid 2px` plus Ring, Fall `G6`); an den
  `<summary>`-Elementen wird sie betätigt, aber nicht behauptet.
- **Der Inhalt jenseits von Fließtext, Quellen und Fassung.** Verglichen werden Titel, der ganze
  sichtbare Fließtext, die ganze Quellenliste und die Fassungszahl. Anhänge, Belege, Kommentare und
  die übrigen zehn Abschnitte hinter „Mehr" werden nicht gegen die Spalte gehalten.
- **Gleichzeitige Nutzung.** Jeder Fall fährt allein; über das Verhalten bei mehreren gleichzeitigen
  Suchenden sagt dieser Lauf nichts.
