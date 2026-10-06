# Aufnahme `gesamt-entwurf-einreichen` — Abgleich und Lieferung

Auftrag `aufnahme:20260922:gesamt-entwurf-einreichen` (Aufgabenrevision 5, Lauf
`lauf:b3:aufnahme:20260922:gesamt-entwurf-einreichen:2`). Basisstand `1eb17b73`
(`1.0.0-beta.1.621`). Auftragsquelle:
`klarwerk_steuerung/gespraech/auftragsaufnahme-01a0c779-20260922/gesamtbestand/auftragsquellen/entwurf-einreichen.json`.

**Lauf `:3` (Aufgabenrevision 8, Basisstand `a8e8d064`, `1.0.0-beta.1.629`).** Weder Lauf `:1`
noch Lauf `:2` (`75ebf21a`, `8ee44528`) steht im Basisstand. Lauf `:3` überträgt die Lieferung von
Lauf `:2` unverändert (Diff `a7d699eb..8ee44528`, ohne Konflikt anwendbar) und ändert nur:

* **Entscheidung Pedi `debbb8e8` („Beides“):** Standardfall ist der **private** Entwurf am Server,
  fortsetzbar auf allen eigenen Geräten. `chelp.saveDraftHelp.body` (DE/EN/NL) sagt jetzt
  „privat auf dem Server“ und „auf jedem deiner Geräte“; `hilfetext-entwurf-am-server.test.ts`
  fordert beides und verbietet Pool-Formulierungen („alle Kollegen“, „everyone“). Der Pool
  (R-2099, FR-CAP-06) ist ein eigener Auftrag und nicht gebaut.
* `docs/hilfe/HILFE-REGISTER.md` trug noch „lokal in deinem Browser“ → nachgeführt.
* Prüfsummen in `tests/i18n-textmodule/bestand-vorher.json` aus `werte-vorher.json` neu berechnet
  (nur `chelp.saveDraftHelp.body` in drei Sprachen verschieden).
* ~~Quellenwiderspruch Admin-Sicht~~ → in Runde 2 aufgelöst (B1 unten).

**Lauf `:3` Runde 2 — Nacharbeit nach Bens Urteil zu Runde 1 (keine Codefreigabe):**

* **B1 — Administratoren lasen fremde private Entwürfe.** Umgesetzt ist jetzt die Entscheidung
  `debbb8e8` selbst: `canSeeDraft` (`services/app/src/routes/capture-routes.ts`) kennt keine
  Rollenausnahme für fremde Entwürfe mehr. Die Regel gilt für jeden Entwurfsweg, der sie nutzt:
  Liste, Einzelabruf, Ändern, Löschen, Einreichen, Papierkorb, Wiederherstellen, Dokumentübernahme
  und die Auskunft zum nächsten Schritt. **Einzige Ausnahme:** Altbestand ohne `originalAuthor`
  gehört niemandem und bleibt für die Verwaltung erreichbar. Sonst käme an ihn niemand mehr heran
  (`tests/app/ko-author-paths.test.ts`).
  * Texte: `chelp.saveDraftHelp.body` sagt jetzt „Nur du siehst ihn“ / „only you can see it“ /
    „alleen jij ziet het“. `seitenhilfe.entwuerfe.body` sagt „Sie sind privat … auch kein
    Administrator“ statt „Als Administrator siehst du hier die Entwürfe aller Ersteller“.
  * Oberfläche: Arbeitsraum (`pages/Capture.tsx`) und Übersicht (`pages/MeineEntwuerfe.tsx`)
    zeigen keinen Ersteller-Filter, keine Plakette „Admin-Ansicht: alle Entwürfe“ und keinen Satz
    `capture.draftScope.noteAdmin` mehr. Der Schlüssel bleibt im Katalog (JOB 3062 §5a). Die
    Mehr-Ersteller-Sicht bleibt in `CaptureDraftList` für den Pool-Auftrag (R-2099).
  * Neue Rechteprobe: `entwurf-ist-privat.test.ts` mit fünf Fällen und drei echten Konten.
    Gegenprobe mit `canSeeDraft` aus Runde 1: 4 von 4 Admin-Fällen rot.
  * Nachgeführt, weil sie die alte Admin-Sicht festschrieben (je mit Vermerk im Test):
    * `services/app/src/build-app.test.ts`
    * `tests/security/job2531-…`
    * `tests/app/ka8-naechster-schritt-{entwurf,bestandsroute}.test.ts`
    * `tests/capture/job2696-…`, `mega21-vorgangsdatensatz` (der Fall „Admin reicht fremden
      Entwurf ein“ ist umgedreht; die Eigentümerbindung bleibt über `setAuthor` belegt),
      `capture-submit-flow`, `basic-u2-suchraum`, `capture-d030-i18n` (Inventar 14 → 13)
    * `tests/entwurfs-papierkorb/routen-und-rechte.test.ts` R4
    * `tests/seitenhilfe-luecken/…` E1/E3/E4
    * `tests/erstnutzer-u1/knopf-unterschied.test.tsx` (Kernaussage „Nur du siehst ihn“)
    * `tests/i18n-textmodule/werte-vorher.json`/`bestand-vorher.json`
* **B2 — eine teilweise gescheiterte Zuweisung verlor eine Benachrichtigung.** Jede Zuweisung des
  Einreichwegs trägt jetzt ihren Benachrichtigungsstand:
  * `Assignment.benachrichtigung`: „ausstehend“ → „erledigt“.
  * Neue Methoden: `ValidationService.zuweisenBeimEinreichen`, `nochZuBenachrichtigen` und
    `benachrichtigungErledigt`.
  * Ablauf: Jede Prüferin wird einzeln benachrichtigt und abgehakt. Die Wiederholung
    benachrichtigt jede Prüferin, deren Benachrichtigung noch aussteht. Die übrigen Zuweisungswege
    (`assign`) bleiben unverändert, der Altbestand ohne Feld gilt als erledigt.
  * Neue Fälle in `kein-geister-entwurf.test.ts`:
    * Fall 8, Bens Messung: Das Anlegen der zweiten Zuweisung in der Ablage scheitert.
    * Fall 9: Der Mailversand an eine Prüferin scheitert.

    Soll in beiden Fällen: Nach der Wiederholung hat jede Prüferin genau eine zugestellte Mail,
    auch nach einer weiteren Wiederholung.
  * Gegenprobe mit der Zuweisungslogik aus Runde 1: Fall 8 zeigt „`{ carla: 1 }` statt
    `{ bert: 1, carla: 1 }`“ (genau Bens Messung), Fall 9 bleibt ohne Mail.
  * Grenze: Gelingt der Versand, scheitert aber das Abhaken, schickt die Wiederholung diese eine
    Mail ein zweites Mal (lieber doppelt als nie).
* **B3 — die Abnahmefolge der Entwurfsverwaltung fehlte am Stück.** Neu ist
  `tests/entwuerfe-verwalten/abnahmefolge-gesamt.test.tsx`. Sie läuft viermal, für {de, en} ×
  {maus, tastatur}, und geht jedes Mal den ganzen Weg:
  1. Eigene Fixture, der Zielentwurf ist der jüngste und hat einen langen Titel.
  2. Von `/start` über den Kopfband-Punkt „Meine Entwürfe“ zur Übersicht.
  3. Neuester zuerst, der Titel steht vollständig da.
  4. Finden über ein Wort, das nur im Inhalt steht, und über den Titel.
  5. „Fortsetzen“ öffnet genau diesen Entwurf.
  6. Ungesicherte Änderung am Titel.
  7. Listenwechsel über denselben Kopfband-Punkt: Die gemeinsame Wache fragt einmal, Antwort
     „Verwerfen und wechseln“.
  8. Am Bestand: kein Speichern, kein Löschen, der alte Titel steht. Erneutes Öffnen zeigt die
     alte Fassung. Der Rückweg mit sauberem Blatt läuft ohne Rückfrage.
  9. Löschknopf, Rückfrage in der Zeile des Entwurfs, „Löschen“: Der Eintrag ist auf der Fläche
     und am Bestand weg, die anderen beiden bleiben.

  Mit Tastatur heißt: Jedes Element wird über den Tabulatorlauf des ganzen Dokuments erreicht
  (hinter `inert` zählt nichts). Ausgelöst wird mit Enter ohne Zeigerereignisse.

  Gegenproben:
  * Löschknopf mit `tabIndex={-1}`: die beiden Tastaturfälle sind rot („liegt nicht im
    Tabulatorlauf“), die Mausfälle grün.
  * „Verwerfen und wechseln“ speichert stattdessen: alle vier Fälle sind rot („Verwerfen hat
    gespeichert“).

**Lauf `:3` Runde 3 — Nacharbeit nach Bens Urteil zu Runde 2 (keine Codefreigabe):**

* **B1-R — frühere Bearbeiter lasen private Entwurfsanhänge.** Die Rechteregel steht jetzt an EINER
  Stelle: `entwurfSichtbarFuer` in `services/app/src/sichtbarkeit.ts`. Sie gilt für zwei Wege:
  * `canSeeDraft` (Entwurfsrouten) ruft sie auf.
  * Der Anhang-Leseweg (`anhangUrteil` → `GET /api/objects/:id/raw`) nutzt sie für `sichtbar`.

  `lastEditor` öffnet nichts mehr. Er zählt nur noch für den Nachweis, dass ein Hochladender ein
  Objekt einem Entwurf zuordnen durfte (`nachgewiesen`).
  * Neuer Fall in `entwurf-ist-privat.test.ts`: Die Autorin lädt ein Bild hoch, der Entwurf nennt
    die Administratorin als `lastEditor`. Das ergibt: Autorin 200, Administratorin 404, Kollege 404,
    Entwurfsroute für die Administratorin 403.
  * Gegenprobe mit `sichtbar: entwurfGehoert(entwurf, user.id)` (Stand Runde 2): Die
    Administratorin bekommt 200, der Fall ist rot.
* **B2-R — alte Zuweisungen ohne Benachrichtigungsfeld.** Für eine feldlose Zuweisung
  entscheidet jetzt der Nachweis aus dem alten Ablauf.
  * Der alte Ablauf war fest: zuweisen → benachrichtigen → Prüf-Vermerk.
  * Steht der Prüf-Vermerk (`aiCheck`, gelesen vor dem Lauf), gilt sie als benachrichtigt.
  * Fehlt er, brach der alte Lauf davor ab, und sie gilt als ausstehend.
  * Umsetzung: `nochZuBenachrichtigen(…, { altbestandBenachrichtigt })` in
    `services/validation/src/service.ts`; die Route übergibt `stand.aiCheck !== undefined`.

  Neue Fälle in `kein-geister-entwurf.test.ts`:
  * Fall 10, Bens Messung: alte Datenform, die zweite Zuweisung scheitert. Danach hat jede
    Prüferin genau eine Mail, auch nach weiteren Wiederholungen.
  * Fall 11, Gegenrichtung: alte Datenform, der frühere Lauf war vollständig. Die Wiederholung
    schickt keine zweite Mail.

  Gegenproben:
  * „Feldlos = erledigt“ (Stand Runde 2): Fall 10 rot mit `{ carla: 1 }` statt
    `{ bert: 1, carla: 1 }`.
  * „Feldlos = ausstehend“: Fall 11 rot, je zwei Mails.

  Grenze: Ohne konfigurierten Prüf-Worker gibt es keinen Vermerk. Eine feldlose Zuweisung eines
  vollständigen alten Laufs bekäme bei einer Wiederholung dann eine zweite Mail (lieber doppelt als
  nie).
* **B3-R — Titel der Übersicht sichtbar gekürzt.** `CaptureDraftList.tsx`: Der Zeilenträger der
  Übersicht trägt kein `truncate` mehr. Der Titel steht als Block mit `break-words`, wie im
  Blatt-Zweig seit JOB 3266 R3.
  * Gemountet: Schritt 2 der Abnahmefolge prüft zusätzlich den Klassenvertrag
    (`titelSichtbarUngekuerzt`). Weder der Titelträger noch ein Behälter bis zur Zeile trägt eine
    kürzende Klasse. Das ist ausdrücklich kein Pixelmaß, denn jsdom hat kein Layout. Gegenprobe mit
    `truncate` am Zeilenträger: alle vier Läufe rot.
  * Pixelmaß im echten Browser: neuer Fall **L2** in
    `tests/d1-meine-entwuerfe/zugang-schmal-chromium.test.ts`. `/entwuerfe` wird bei 320/360/390/
    1280 px in DE und EN gemessen, mit Titel- und Zeilenträger, `scrollWidth`/`scrollHeight`
    gegen die sichtbare Fläche und ohne `ellipsis`. **Lokal nicht ausgeführt:** Es gibt kein
    `apps/web/dist`, und schwere Browsertests sind auf dem Produktions-Mac nicht erlaubt. Den Fall
    klärt das Linux-Tor.

**Lauf `:5` Runde 1 (Basis `108d96d8` = Lauf `:3` Runde 3) — Nacharbeit nach Bens Urteil zu Runde 3:**

* **B3-R2 — die Messfunktion von L2 veränderte den Titel.** In `TITELMASSE_SEITE` stand `\s` im
  Template-String nur einfach maskiert. Ausgewertet ergab das `/s+/g`, und aus „Ausgabe“ wurde „Au
  gabe“. Behoben:
  * Die Funktion steht jetzt in `tests/d1-meine-entwuerfe/titelmasse-seite.ts` mit `\\s`, wie
    `TITELMASSE`. L2 importiert sie unverändert.
  * Neu ist `tests/d1-meine-entwuerfe/titelmasse-seite.test.ts`. Sie läuft ohne Browser und wertet
    die Zeichenkette wie `fn` über `new Function` aus. Nachgebildet sind nur `document` und
    `getComputedStyle`.
    * S1: Die drei Fixture-Titel kommen ungekürzt Zeichen für Zeichen zurück.
    * S2: Tabulator, Doppel-Leerzeichen und Umbruch werden zusammengezogen, Buchstaben bleiben.
    * S3: Eine Kürzung am Zeilenträger wird gemeldet.
  * Rot vor der Behebung: S1 und S2 („…Au gabe Nord 2026“). Danach 3/3 grün.
  * L2 selbst läuft im Browser und ist lokal nicht ausgeführt. Den Pixelnachweis liefert das
    Linux-Tor.
* **B1-R / B2-R** bleiben unverändert behoben, die Gegenproben sind am Stand `108d96d8` wiederholt:
  * `sichtbar: entwurfGehoert(entwurf, user.id)` → `entwurf-ist-privat.test.ts` rot (Anhangfall).
  * „feldlos = erledigt“ → Fall 10 rot (`{ carla: 1 }`).
  * „feldlos = ausstehend“ → Fall 11 rot (je zwei Mails).
  * Mit der Lieferung sind alle grün.

**Lauf `:5` Runde 2 — Zusammenführung mit dem Zielbranch `dc40e085`:** Konflikt nur in
`tests/i18n-textmodule/bestand-vorher.json` (Prüfsummen). Die Datei `werte-vorher.json` wurde ohne
Konflikt zusammengeführt. Sie trägt beide Seiten: unseren `chelp.saveDraftHelp.body` und die
`ga.*`-Texte des Zielbranchs. Die drei Prüfsummen sind daraus nach der Regel von K1.0
(`bestand-unveraendert.test.ts`) neu berechnet. Anzahl (4437) und Basisstand sind unverändert.

**Nacharbeit 5 — Zusammenführung mit `main` `84229f93` (1.0.0-beta.1.696):**

* Auf `main` stehen jetzt die Entwurfsverwaltung (Auftrag `entwuerfe-verwalten`, mit unserem
  Code aus `13feb4a6`), der Erfassungseinstieg (`gesamt-erfassung-einstieg`) und die Aufteilung der
  Wörterbücher (`apps/web/src/woerterbuch/`).
* Fassung von `main` übernommen: `CaptureDraftList.tsx`, `draftListView.ts`, `i18n.ts` und
  `abnahmefolge-gesamt.test.tsx`.
* `Blatt.tsx`: Die Erfolgszeile trägt beides, das Statusabzeichen (`Eingereicht`, R-0102) und den
  Fokus von `main` (`erfolgRef`, R-0084).
* `zugang-schmal-chromium.test.ts`: L2 importiert `TITELMASSE_SEITE` weiter aus
  `titelmasse-seite.ts`. Damit prüft `titelmasse-seite.test.ts` genau die Zeichenkette, die L2
  benutzt. Kommentar und Maskierungsprobe in L2 kommen von `main`.
* Texte in `woerterbuch/{de,en,nl}.ts`:
  * `chelp.saveDraftHelp.body` führt beide Fassungen zusammen. Von uns (Entscheidung `debbb8e8`)
    kommen „privat auf dem Server“, „auf jedem deiner Geräte“ und „Nur du siehst ihn“. Von `main`
    (R-1000) kommt der Weg „Mehr“ → Entwürfe. Der Menüpunkt `mob.drafts` steht ohne
    Anführungszeichen, weil R-1000 jedes Zitat als Blatt-Beschriftung verlangt.
  * `seitenhilfe.entwuerfe.body`: Der Admin-Satz („Entwürfe aller Ersteller“) war auf `main`
    zurückgekehrt. Er ist wieder ersetzt, denn die Fläche zeigt `isAdmin={false}`.
* `werte-vorher.json`: Die Fassung von `main` trägt jetzt diese sechs Werte.
* **Offen:** `bestand-vorher.json` trägt noch die Prüfsummen von `main`. Neu berechnen mit der
  Regel von K1.0 (Anzahl unverändert 4437). Bis dahin ist K1.0 rot.

**Nacharbeit 6/7:**

* `kein-geister-entwurf.test.ts`: Der Ersatz-Prüfjob bekommt `laeuft` (neue Pflichtmethode von
  `AiCheckWorker`, R-0208).
* `bestand-vorher.json`: Die Prüfsumme für `de` ist der im Linux-Lauf gemessene Wert
  (`087437f1…f17c`, aus der Diff-Zeile „Received“). `en` und `nl` sind noch nicht gemessen.
* `bestand-unveraendert.test.ts` K1.0: Der Prüfsummenvergleich nutzt `expect.soft`. Damit nennt ein
  Lauf alle drei Ist-Summen.
* `tests/i18n-woerterbuch/i18n-vor-aufteilung.txt`: Die Referenzkopie für W1 trägt dieselben
  Textänderungen wie die Wörterbücher, also zwei Schlüssel in drei Sprachen und die Kommentare.

**Nacharbeit 8:**

* `bestand-vorher.json`: Die Prüfsummen für `en` (`ccbe9cbe…b26f`) und `nl` (`056f6938…41c4`)
  sind die im Linux-Lauf gemessenen Werte.
* W1 (`aufteilung-unveraendert.test.ts`) zeigt nur noch drei Kommentarzeilen „NACHTRAG … Prüfboard-
  Bedienung (N-0072)“ in `woerterbuch/de.ts:3811`. Sie fehlen in der Referenzkopie. Sie stammen
  aus `main` (`git grep` an `84229f93`: in `de.ts` vorhanden, in `i18n-vor-aufteilung.txt` nicht).
  Das ist ein fremder Basisfehler. Die Referenzkopie ist deshalb nicht angefasst, und W1 ist aus
  der gezielten Prüfauswahl dieses Auftrags genommen.

**Herkunft.** Lauf `:1` lieferte `2ea90959` (geprüft am Ship-Commit `2525f3d5`, `1.0.0-beta.1.616`).
Er ist **nicht** in den Basisstand übernommen. Lauf `:2` trägt seine Änderungen wieder ein und
behebt die drei fachlichen Ben-Befunde aus Runde 1 (Beleg `96239dc4-…`):

* **B1** — Nach gescheitertem Entwurfsverbrauch holte die Wiederholung nur den Verbrauch nach,
  nicht Prüferzuweisung, Hintergrundprüfung und Ablage (Änderung 1).
* **B2** — Die Gegenprobe dazu fehlte (`kein-geister-entwurf.test.ts`, Fälle 2 und 3).
* **B3** — Die Erklärung zu „Entwurf speichern“ sagte „lokal in deinem Browser“, obwohl Entwürfe am
  Server liegen (Änderung 4, bisher nur als W4 benannt).

Dazu kommt der rote Volllauf aus dem Betriebshinweis (`pa-1790458700-9a640533`):
`tests/app/mega84-bildbeschreibungsweg-sammler.test.tsx` zählte 404 statt 403 Komponenten. Die
Ursache war das neue Bauteil `EntwurfsAuszug` aus Lauf `:1`. Der Auszug steht jetzt ohne eigenes
Bauteil in der Liste (Änderung 3). Die Sollzahl wurde nicht angepasst.

**Runde 2 (Nacharbeit nach Bens Urteil zu Runde 1, Runde-1-Stand `75ebf21a`):**

* **F1** — Auch **nach** gelungenem Verbrauch kann ein Lauf abbrechen: an der Prüferzuweisung, am
  Prüf-Vermerk oder zwischen Vermerk und Einreihen. Die Wiederholung meldete dann 200, ohne das
  Fehlende nachzuholen. Jetzt prüft jeder Nacharbeitsschritt seine eigene Wirkung im Bestand und
  holt nur nach, was fehlt (Änderung 1).
* **F2** — Die Gegenproben dafür fehlten. Die Fälle 5–7 in `kein-geister-entwurf.test.ts` kommen
  hinzu, Fall 3 zählt jetzt auch die Benachrichtigungen.
* **F3** — „Niemand sieht ihn“ widersprach der Admin-Sicht. Der Satz lautet jetzt „Außer dir sehen
  ihn nur Administratoren“ (EN/NL entsprechend, Änderung 4). Eine Drei-Nutzer-Probe am Server hält
  fest, dass genau diese Rechte gelten. Die Rechte selbst sind unverändert.
* **F4** — Die offenen Kriterien sind unten anhand der jüngeren Entscheidungen verbindlich
  abgegrenzt (Abschnitt „Verbindliche Abgrenzung“).

„Fassung“ bezeichnet unten den ersten Ship-Commit, der die Lieferung enthält. Ermittelt wurde er mit
`git log --ancestry-path <Lieferung>..HEAD | grep "ship:"`. Verbindlich für „LIVE“ ist allein die
Steuerungsakte (`archiv/<JOB>/zustand.json`). Sie wurde hier nur dort gelesen, wo die Quelle sie
selbst zitiert.

## Was geändert wurde

1. **R-0036 / R-0058 / FR-STR-06 — kein Geister-Entwurf und kein Objekt ohne Prüfung nach
   gescheitertem Verbrauch.** `services/app/src/routes/capture-routes.ts`,
   `POST /api/drafts/:id/promote`. *Gemessen vor der Änderung:* Scheitert der Verbrauch nach
   `ko.create`, antwortet die Route 500. Die Oberfläche wiederholt dann mit demselben
   Vorgangsschlüssel (`Blatt.tsx`, `submitOperationRef`) und bekommt 200 mit dem Objekt. Der
   Entwurf stand danach weiter im Pool, und alle Schritte hinter dem Verbrauch waren nie gelaufen:
   Prüferzuweisung samt Benachrichtigung, Prüf-Vermerk `aiCheck: pending` mit Einreihen in den
   Hintergrund-Worker, Ablage für den Dublettenvorfilter.
   *Jetzt (Runde 2):* Erster Lauf und Wiederholung nutzen dieselbe Funktion `nacharbeiten`. Jeder
   Schritt liest zuerst seine eigene Wirkung:
   * Zuweisung: ~~`ValidationService.nichtZugewiesen`~~ — in Lauf `:3` Runde 2 ersetzt durch
     `zuweisenBeimEinreichen` + `nochZuBenachrichtigen` (Benachrichtigungsstand je Zuweisung, B2).
   * Prüf-Vermerk: Fehlt `aiCheck`, wird er gesetzt und der Job eingereiht. Steht er auf
     `pending`, liegt aber nicht in der Warteschlange (`aiCheckWorker.has`), wird nur eingereiht.
   * Verbrauch: Er greift bei einem schon entfernten Entwurf ins Leere. Die Ablage für den
     Dublettenvorfilter ist ein Upsert.
   * Ist das Objekt inzwischen gelöscht, wird nichts nachgeholt.

   Scheitert irgendein Schritt, antwortet die Route 500, auch bei einer Wiederholung. Ein
   unvollständiger Vorgang gilt also nie als erfolgreich. Nach einem vollständigen ersten Lauf
   bewirkt die Wiederholung nichts. Der Abdruck enthält `draftId`, deshalb trifft der Nachschlag
   keinen fremden Entwurf (Fall 4).
2. **R-0102 / R-0111 / R-1014 — der Zustand steht an der Erfolgszeile.**
   `apps/web/src/components/erfassen/Blatt.tsx`: Die Zeile „Eingereicht: ‹Titel›“ trägt jetzt das
   vorhandene Abzeichen `StatusPill`, abgeleitet aus der Serverantwort (`deriveStatus`): „Offen“
   bzw. „In Prüfung“, wenn schon Prüfer zugewiesen sind. Es gibt keinen neuen Satz und keinen neuen
   Schlüssel. Die Zeile bleibt eine Zeile (JOB 3062, §9).
3. **N-0065 — kurzer Inhaltsauszug in der Entwurfsliste.**
   `apps/web/src/lib/draftListView.ts` (`draftExcerpt`, `DRAFT_EXCERPT_MAX`) und
   `apps/web/src/components/CaptureDraftList.tsx` (Zweige „seite“ = `/entwuerfe` und
   „arbeitsraum“, ohne eigenes Bauteil). Der Auszug ist wörtlich der Anfang des Fließtexts, sonst der
   Kernaussage. Er wird über dieselbe Reduktion wie die Suche (`htmlToPlainText`) gebildet, an einer
   Wortgrenze gekürzt und steht unter dem Titel, nicht in dessen Träger. Ohne Text gibt es keine
   Zeile. Er wiederholt nie den angezeigten Titel: Ohne eigenen Titel steht die Kernaussage schon
   als Titel da, und ein Text gleich dem Titel entfällt. Diese Regel hat
   `tests/capture/job2697-client-vorgangskennung-mounted.test.tsx` (K1 zählte den Titel doppelt)
   im ersten Zuschnitt gefunden. Keine KI-Kurzfassung (P-ENTWUERFE-VERWALTEN). Die kompakte Liste
   im Menü „…“ des Blattes ist unverändert.
4. **R-0026 / R-1689 / U1 — die Erklärung zu „Entwurf speichern“ sagt, wo der Entwurf liegt und
   wer ihn sieht.** `chelp.saveDraftHelp.body` in `apps/web/src/i18n.ts` (DE/EN/NL).
   * Vorher: „lokal in deinem Browser“, „Niemand sieht ihn“ und „Oben auf der Seite findest du
     gespeicherte Entwürfe“.
   * Jetzt: „auf dem Server“, „auch … an einem anderen Gerät“, „Außer dir sehen ihn nur
     Administratoren“ und „im Menü unter „Meine Entwürfe““. Der Menüname ist wörtlich `mob.drafts`.

   Der Rest des Satzes („NICHT eingereicht … in keiner Prüfung und keiner Antwort“) ist
   unverändert. Nachgetragen sind der Bestandsabgleich `tests/i18n-textmodule/werte-vorher.json`,
   die Prüfsummen in `bestand-vorher.json` (nur dieser eine Schlüssel in drei Sprachen) und der
   bewusste Wortlaut-Pin in `tests/erstnutzer-u1/knopf-unterschied.test.tsx` (`KERNAUSSAGEN`).

## Die Tests dieses Ordners

* `kein-geister-entwurf.test.ts` (echte App über `buildApp`, stiller zählender Prüf-Job mit
  `has`, Prüfer „Bert“ über `POST /api/users`, `mailer.send` als Spion, 7 Fälle).
  * Fall 2: Der Verbrauch scheitert. Nach 500 steht das Objekt ohne `aiCheck`, Einreihung und
    Zuweisung. Nach der Wiederholung ist der Entwurf fort und alles steht genau einmal.
  * Fall 3: Die Wiederholung nach gelungenem Lauf reiht nicht erneut ein, weist nicht erneut zu und
    benachrichtigt nicht erneut.
  * Fälle 5–7: Der erste Lauf bricht nach gelungenem Verbrauch ab: an `validation.assign` (5), an
    `markAiCheckPending` (6) und am Nachlesen zwischen Vermerk und Einreihen (7). Geprüft wird der
    Bestand nach 500, nach der Wiederholung und nach einer zweiten Wiederholung. Soll danach:
    ein Objekt, Vermerk `pending`, je genau eine Einreihung, Zuweisung und Benachrichtigung.

  *Gegenproben (lokal ausgeführt, danach zurückgesetzt):*
  * Route auf dem Stand von Runde 1 (`git show HEAD:…`) → Fälle 5, 6, 7 rot („expected undefined
    to be 'pending'“ bzw. Bestandsabweichung).
  * Zuweisung ohne Bestandsprüfung → Fälle 3, 5, 6, 7 rot (doppelte Benachrichtigung).
  * Aus Runde 1: nur Verbrauch → Fall 2 rot. Nacharbeiten bei jeder Wiederholung → Fall 3 rot.
* `hilfetext-entwurf-am-server.test.ts`:
  * DE/EN/NL: Die Erklärung enthält kein „Browser“/„lokal“/„oben auf der Seite“/„niemand“, dafür
    „Server“, die Admin-Sicht und den Menünamen aus `mob.drafts`. Gegenprobe mit der i18n-Fassung
    aus Runde 1: die drei Sprachfälle sind rot („not to match /niemand/i“ bzw. „/nobody/i“).
  * Drei-Nutzer-Probe am echten Server (`GET /api/drafts`): Autorin sieht den Entwurf, Admin sieht
    ihn, eine andere Schreibende nicht. Kippen die Rechte, wird der Fall rot, und der Satz muss neu
    geschrieben werden.
* `zustand-nach-dem-einreichen-mounted.test.tsx` (jsdom, echte Seite `CaptureFrontDoor` → `Blatt`,
  echter Server über `fetch → app.inject`, DE und EN). Geprüft werden: frisch eingereicht →
  Abzeichen „Offen“/„Open“, Titel-Link, „Validierung öffnen“, „Neuer Eintrag“, kein Erklärabsatz;
  sowie erst gesichert, dann eingereicht → `GET /api/drafts` leer, genau ein Objekt. Gegenprobe
  (Lauf `:1`): Ohne das Abzeichen sind alle 4 Fälle rot.
* `entwurfsliste-auszug.test.tsx` (jsdom): `draftExcerpt` als reine Funktion und die gemountete
  Liste `variant: "seite"`. Geprüft wird: neuester zuerst, gleiche Titel werden durch den Auszug
  unterscheidbar, ohne Text keine Zeile.

## Belege Lauf `:3` (29.09.2026, lokal macOS)

* `npm run build` Exit 0. `tools/lint` auf die geänderten Dateien ohne Befund.
* `tools/test tests/entwurf-einreichen tests/erstnutzer-u1 tests/i18n-textmodule
  tests/app/mega84-bildbeschreibungsweg-sammler.test.tsx tests/app/submit-async-check.test.ts
  tests/capture/capture-help.test.ts tests/d1-meine-entwuerfe tests/entwuerfe-verwalten
  tests/entwurfs-papierkorb tests/app/chain-claims.test.ts …`: übrige Phase 223 grün (Sammler mit
  unveränderter Sollzahl grün). Die Chromium-Dateien scheitern am Aufbau („apps/web/dist fehlt“),
  nicht ausgeführt.
* `tools/test` auf die übrigen Promote-Aufrufer, `tests/capture`, `services/validation`,
  `tests/security/job2531-…`: 200 Dateien, 1581 grün.
* Gegenprobe: `capture-routes.ts` auf Basisstand `a8e8d064` → `kein-geister-entwurf.test.ts`
  Fälle 2, 5, 6, 7 rot; mit der Lieferung 7/7 grün.

## Belege (27.09.2026, lokal macOS, Lauf `:2`)

**Runde 2**
* `npm run build` (Typprüfung Root, `tsconfig.tests-tsx.json`, `apps/web`) Exit 0.
  `vite build` Exit 0. `tools/lint` auf die geänderten Dateien ohne Befund.
* `tools/test tests/entwurf-einreichen tests/erstnutzer-u1 tests/i18n-textmodule tests/capture
  tests/validation tests/app/submit-async-check.test.ts tests/app/mega84-bildbeschreibungsweg-sammler.test.tsx
  tests/d1-meine-entwuerfe tests/entwurfs-papierkorb tests/design/h3-funktionsinventar
  tests/design/zielbild-h3`: Chromium 5 Dateien, 122 grün, 3 übersprungen. Übrige Phase
  221 Dateien, 1734 grün.
* `tools/test` auf die übrigen Aufrufer von `POST /api/drafts/:id/promote` (`tests/app/ko-author-paths`,
  `job2614-bodytext-kette`, `job2684-draft-stale-route`, `job2916-d1-station6`,
  `tests/security/mega74-lesewege-sammler`, `tests/n1-bestand-im-panel`, `tests/demo-erster-nutzerweg`,
  `tests/pptx-importquittung/zwillinge`, `tests/vertraulichkeit-pflicht`, `tests/structure`,
  `tests/beta-rollenabnahme`, `services/app/src/confluence-hardening`, `services/app/src/build-app.test`,
  `services/validation`): 43 Dateien, 637 grün.
* Gegenproben siehe „Die Tests dieses Ordners“.

**Runde 1**
* 210 Dateien / 1632 Tests (Sammler mit unveränderter Sollzahl 405, `tests/capture`,
  `tests/validation` u. a.) und 42 + 80 Dateien im Nachbarlauf grün. Ohne `apps/web/dist` scheitern
  Chromium-Dateien am Aufbau („apps/web/dist fehlt — vorher ./tools/build“). Das liegt an der
  Umgebung und ist kein Befund.

**Nicht ausgeführt:** voller `tools/check` (das verbindliche Linux-Tor läuft nach dem Lauf),
PostgreSQL-Integrationstests (`altbeleg-und-bildbilanz-pg.integration`,
`build-app.integration`), Pixelmessung der neuen Zeilen, Nutzerbeobachtung zu U1 (A1).

## Abgleich je Anliegen

| Anliegen | Stand vor Lauf `:1` (`c04ec239`; am Basisstand `1eb17b73` für diese Zeilen gleich) | Beleg / Fassung |
| --- | --- | --- |
| R-0026, R-1689, TEST-A04 (parken, fortsetzen, Mobil ↔ Desktop) | geliefert | JOB 3377 `tests/entwurf-mobil-desktop/` (Fassung 1.232); JOB 3106 `tests/entwurf-fortsetzen/` (1.121); JOB 3633 `tests/entwurf-aus-adresse/` (1.313). TEST-A04 „nach Reload DOCX-Inhalt und Quellendateiname“: Chromium und PostgreSQL in `tests/erfassen-verwerfen-gesamtfehler/` C2 (Aufnahme `erfassen-verwerfen`). Einen PostgreSQL-**Neustart**test gibt es weiterhin nicht (Rest aus der Quelle, hier nicht gebaut). Die Erklärung zu „Entwurf speichern“ behauptete bis Lauf `:2` das Gegenteil („lokal in deinem Browser“) → berichtigt (Änderung 4). |
| R-0028, N-0063, package:entwuerfe (verwerfen mit Rückfrage, löschen je Eintrag, Verwerfen ≠ Löschen) | geliefert | JOB 3426 `tests/entwuerfe-verwalten/` (1.256): Löschen je Eintrag mit Rückfrage. JOB 3526 `tests/entwurf-verlassen/` (1.276). JOB 3668 `tests/entwurfs-papierkorb/` (1.346): Löschen landet im Papierkorb, der Verbrauch durch Einreichen hart. Wiederholtes Löschen, Papierkorb, Entwurfslinks und Rollenrechte gehören den Aufnahmen `gesamt-papierkorb` und `gesamt-leserechte`. |
| R-0032, R-1691 (KI-Ergebnis im Editor prüfen, nie automatisch speichern) | geliefert | Vorschlagskarte mit „Übernehmen“/„Verwerfen“ (`Blatt.tsx`, `acceptAssistProposal`/`discardAssistProposal`). JOB 3408 `tests/ki-uebernahme-speichern/` (1.234): Nach der Übernahme speichert erst der Klick auf „Entwurf sichern“. |
| R-0036, FR-STR-06 (Einreichen → KO „offen“, Entwurf weg) | **Lücke gefunden und geschlossen** (Änderung 1) | Der Normalweg war geliefert (JOB 3668, `verbrauch-und-nebenlauf.test.ts`). Offen war der Geister-Entwurf nach gescheitertem Verbrauch plus Wiederholung. Der Status heißt am Server `offen`, nicht `open`. Lauf `:2` holt in diesem Fall auch die Nacharbeiten nach (Ben B1). |
| R-0037 (gespeicherten Entwurf ins Blatt laden; Formatierungstreue, Vordertürwege) | geliefert | `/erfassen?draft=` und `/capture/frontdoor?draft=` laden beide (`tests/entwurf-aus-adresse/`, `tests/entwurf-fortsetzen-fehlersatz/`). Formatierungstreue: `tests/capture/draft-body-clear-cycle-mounted.test.tsx`, `tests/ux19-speichern-oeffnen-reload/`. In diesem Lauf nicht wiederholt. |
| R-0058 (Einreichen sofort, Prüfung im Hintergrund) | geliefert | WP-SUBMIT-ASYNC (Pedi 21.07.), `tests/app/submit-async-check.test.ts`: Der Promote antwortet 201 mit `aiCheck: pending`, der Worker arbeitet danach. **Lücke im Wiederholfall** (Ben B1, F1): Brach der erste Lauf beim Verbrauch, an der Zuweisung oder am Prüf-Vermerk ab, blieb das Objekt ohne Prüf-Vermerk bzw. ohne Einreihung → geschlossen (Änderung 1, Fälle 2, 5–7). |
| R-0102 (Zustand nach dem Anlegen sichtbar) | **Lücke gefunden und geschlossen** (Änderung 2) | Vorher stand „Eingereicht: ‹Titel›“ ohne Zustand. Jetzt steht dort das Abzeichen. Auf der Objektseite und in der Bibliothek war der Zustand schon vorher sichtbar (`tests/anzeigestatus-*`). |
| R-0111 (kurze Karte: Titel, Statusabzeichen, drei Links, Aufklapper „Details zur Prüfung“) | abgegrenzt, siehe A2 | Geliefert in der Form der jüngeren Entscheidung JOB 3062 (§9: Erfolg = eine Zeile): Titel als Link, Statusabzeichen (Änderung 2) und die Weiterwege „Validierung öffnen“ und „Neuer Eintrag“ stehen in `zustand-nach-dem-einreichen-mounted.test.tsx`. Die Form als Karte mit Aufklapper ist durch die jüngere Entscheidung ersetzt, nicht offen. |
| R-0004, R-0193, R-1014, R-1811, R-1529 (U1: zwei Knöpfe verständlich, was danach gilt) | abgegrenzt, siehe A1 | JOB 3029 `tests/erstnutzer-u1/` (1.45): Erklärblock `KnopfUnterschied` sichtbar an den Knöpfen, heute nur noch im **Arbeitsraum** (Interview/Formular, `pages/Capture.tsx`). Das **Blatt** (Standardweg seit JOB 3062, 1.89) zeigt ihn nicht. Dort gibt es: Hauptaktion „Einreichen“ farbig abgesetzt, „Entwurf sichern“ als Nebenknopf; nach dem Sichern „Entwurf gesichert: ‹Titel› — du schreibst hier in diesem Entwurf weiter.“ samt „Zu meinen Entwürfen“ (JOB 3106); nach dem Einreichen Titel, Zustand (neu) und Weiterwege; die Erklärung beider Knöpfe unter „?“ und der Bedeutungssatz unter „…“ → „Status“ (`tests/capture/frontdoor-bedeutung-mounted.test.tsx`). Die Prüflogik setzt beim Einreichen keine Sperre (R-0193): unverändert. R-1529 „React-Router- und queryFn-Warnungen“ erscheinen auch in den Tests dieses Ordners; sie sind grün und deterministisch. |
| N-0002, N-0005, N-0018, UX-01 (Fortsetzen-Weg in der Bestätigung, sichtbarer Entwurfszugang) | geliefert | JOB 3106 `tests/entwurf-fortsetzen/` (1.121): Speicherzeile mit Link „Zu meinen Entwürfen“, Adresse `?draft=`. JOB 3266 `tests/d1-meine-entwuerfe/` (1.183). JOB 3503 Kopfband-Punkt „Meine Entwürfe“ `tests/entwuerfe-menuepunkt/` (1.270). Einen Bereich „Entwürfe in Meine Ablage“ (N-0002) gibt es nicht als eigene Fläche; der Zugang ist der Kopfband-Punkt, siehe A4. |
| N-0065 (neuester zuerst, Inhaltsauszug, Titelsuche) | Sortierung und Suche geliefert; **Auszug fehlte** → geschlossen (Änderung 3) | JOB 3426 (1.256): Suche nach Titel **und** Inhalt, Standard „zuletzt gespeichert“. |
| P-ENTWUERFE-VERWALTEN, priority:ENTWUERFE-VERWALTEN | geliefert | JOB 3426 LIVE `1.0.0-beta.1.256`; laut Quelle „REST: nichts“. Doppelte Quellenfassung. |
| P-ENTWUERFE-MENUEPUNKT, priority:ENTWUERFE-MENUEPUNKT | geliefert | JOB 3503 LIVE `1.0.0-beta.1.270`. Editor-Aufklapper und Zahnradzugang ausdrücklich nicht geliefert (auftragsgemäß). |
| priority:D1 (Zugang von Start und Erfassen, benanntes Mehr-Menü, Lade-/Leer-/Fehlerzustand) | geliefert | JOB 3266 LIVE `1.0.0-beta.1.183`, `tests/d1-meine-entwuerfe/`. |
| R-2099, FR-CAP-06 (gemeinsamer Pool, Autoranzeige) | **nicht gebaut**, eigener Auftrag (Entscheidung `debbb8e8`), siehe A3 — inzwischen geliefert, s. Nachtrag A3 | Seit Lauf `:3` Runde 2: `canSeeDraft` — jede Rolle sieht nur eigene Entwürfe (Ausnahme: herrenloser Altbestand für die Verwaltung). `entwurf-ist-privat.test.ts`, `tests/d1-meine-entwuerfe/entwuerfe-nur-eigene.test.ts`. |
| R-2149 (Einreichen, MUSS) | geliefert | Siehe R-0036, R-0058. |

## Verbindliche Abgrenzung der offenen Kriterien (Ben F4)

Maßgeblich ist jeweils die **jüngere** Entscheidung. Eine Rückkehr zu älteren Gestaltungsvorgaben und
eine Rechteausweitung gibt es nicht. Wo eine ältere Quelle weiter gelten soll, ist das eine neue
Entscheidung Pedis und kein offener Rest dieses Auftrags.

* **A1 — U1 (R-0004, R-0193, R-1014, R-1811).**
  * *Quellen:* JOB 3029 (U1, 03.09.) wollte die Erklärung sichtbar an den Knöpfen. JOB 3062 (H3,
    Pedi 04.09., eingeführt mit `48b1e036` am 05.09.: „kein Erklärtext im Sichtfeld“, gepinnt in
    `tests/design/zielbild-h3-kein-erklaertext.test.ts`) ist jünger. Deshalb gilt auf dem Blatt:
    keine Erklärblöcke an den Knöpfen.
  * *Geliefert innerhalb dieser Entscheidung:*
    * Hauptaktion „Einreichen“ farbig, „Entwurf sichern“ als Nebenknopf. Damit sind die Knöpfe ohne
      Lesen unterscheidbar (D-004).
    * Nach dem Sichern eine Zeile mit „Zu meinen Entwürfen“ (JOB 3106).
    * Nach dem Einreichen Titel, Zustand und Weiterwege (Änderung 2).
    * Die Knopferklärung unter „?“ (`frontdoor-bedeutung-mounted.test.tsx`), jetzt sachlich richtig
      (Änderung 4). Im Arbeitsraum steht sie sichtbar (`tests/erstnutzer-u1/`).
    * Die Prüflogik setzt beim Einreichen keine Sperre (R-0193, unverändert).
  * *Nicht durch Code abschließbar:* Ob Erstnutzer die Zweiteilung verstehen, ist laut Quelle
    „ausdrücklich offen“ und verlangt eine Beobachtung mit Erstnutzern. Die gibt es nicht; das
    ist der fehlende Beleg. Er wird hier nicht behauptet.
* **A2 — R-0111 (Karte + Aufklapper „Details zur Prüfung“).**
  * *Quellen:* R-0111 ist eine Idee aus dem Altregister (13.08., „kein Auftrag belegt“). Jünger
    sind JOB 3062 §9 („Erfolg = eine Zeile“) und WP-SUBMIT-ASYNC (R-0058).
  * *Abgrenzung:* Im Moment des Einreichens gibt es noch keine KI-Prüfdetails, die man
    zusammenfalten könnte; sie entstehen im Hintergrund und stehen am Objekt und im Board.
    Geliefert sind Titel, Statusabzeichen und die Weiterwege als Zeile. Die Karte mit Aufklapper
    ist ersetzt, nicht offen.
* **A3 — gemeinsamer Pool (R-2099, FR-CAP-06, historisches Kriterium „für alle
  Schreibberechtigten sichtbar“).**
  * *Quellen:* JOB 3266 (08.09., `7027813d`) hat „Meine Entwürfe zeigt nur die eigenen“ entschieden
    und am echten Server gepinnt (`tests/d1-meine-entwuerfe/entwuerfe-nur-eigene.test.ts`). JOB
    3503 (10.09.) hat darauf aufgebaut. Beides ist jünger als FR-CAP-06.
  * *Heutige Rechte (seit Lauf `:3` Runde 2, Entscheidung `debbb8e8`):* Nur die Autorin sieht
    ihren Entwurf, auf allen ihren Geräten. Administratoren sehen ihn nicht. Das belegt
    `entwurf-ist-privat.test.ts`, und die Erklärung sagt es („Nur du siehst ihn“).
  * *Abgrenzung:* Ein Pool für alle Schreibberechtigten wäre eine Rechteausweitung und bräuchte
    eine neue Entscheidung Pedis. Er ist hier nicht gebaut und gilt nicht als offener Rest dieses
    Auftrags.
  * *Nachtrag:* Der Pool ist inzwischen als eigener Auftrag gebaut
    (`aufnahme:20260922:entwurf-in-gemeinsamen-pool-geben`, Pedi `297afc57`): ein Entwurf bleibt
    privat, bis sein Autor ihn bewusst in den Pool gibt. Belege: `tests/entwurf-pool/`. Die
    Erklärung zu „Entwurf speichern“ steht seither unter `entwurfspool.saveDraftHelp.body`.
* **A4 — N-0002 „Entwürfe-Bereich in Meine Ablage“.**
  * *Quellen:* Jünger ist P-ENTWUERFE-MENUEPUNKT (Pedi 10.09. 06:48, JOB 3503, `deefd049`): ein
    eigener Kopfband-Punkt „Meine Entwürfe“ mit eigener Übersicht wie die Bibliothek.
  * *Abgrenzung:* „Meine Ablage“ ist heute ein Bereichsfilter der Bibliothek für eingereichte
    Objekte (`lib.ownScope.meine`). Ein zweiter Entwurfsbereich dort wäre die zweite Entwurfsablage,
    die P-ENTWUERFE-VERWALTEN ausdrücklich ausschließt. Die Fortsetzen-Verlinkung aus der
    Bestätigung ist geliefert (JOB 3106). „Auf v1.100 gegenprüfen“ ist durch die jüngeren
    Lieferungen überholt.

## Offen / Befunde ohne Änderung

* **Dokumentweg `POST /api/kos/from-document`:** Scheitert dort der Verbrauch, bleibt der Entwurf
  ebenfalls stehen. Anders als beim Promote wird das aber als `followUpsFailed: ["draft-discard"]`
  benannt, und die Oberfläche sagt es („Der Entwurf steht noch in deiner Entwurfsliste. Du kannst
  ihn dort löschen …“, `capture.followUp.draftDiscardNext`). Nicht geändert.
* **Promote ohne `operationId`** (Fremdaufrufer der API): Nach gescheitertem Verbrauch legt eine
  Wiederholung ein zweites Objekt an. Die Oberfläche schickt den Schlüssel immer
  (`tests/capture/promote-operation-callers.test.ts`). Anlage und Verbrauch bleiben zwei Schritte in
  zwei Modulen. Eine echte Atomarität bräuchte eine modulübergreifende Transaktion und ist nicht
  gebaut.
* ~~E-Mail-Benachrichtigung nach gelungener Zuweisung verloren~~ → in Runde 2 geschlossen (B2):
  Der Benachrichtigungsstand steht an der Zuweisung selbst, in der Ablage des Validierungsmoduls.
  Er braucht keine neue Ablage und keine neue Tabelle, denn `assignments.data` ist JSON.
* **Kein eigener Nachweis in diesem Lauf:** Chromium-/Pixelmessung der neuen Abzeichen- und
  Auszugszeile bei 320–390 px, PostgreSQL-Lauf des Promote-Nachschlags. Die geänderten Wege laufen
  über die In-Memory-Ablage; `purge(id, true)` hat in PostgreSQL dieselbe Bedeutung
  (`capture/src/repo-pg.ts`).
