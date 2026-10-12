# Klara im Setup · Integrationsplan für AA-02 bis AA-04

Grundlage: [`BESTAND.md`](./BESTAND.md) und [`fundstellen.json`](./fundstellen.json). Der Plan setzt
**ausschließlich** die dort erfassten Einstellungen und Aktionen voraus (IDs E·O·A·T·H). Neue
fachliche Einstellungen oder Klara-Aktionen sind nicht Teil des Plans; `tests/klara-setup-shortcuts/
fundstellen.test.ts` prüft, dass jede hier genannte ID im Bestand steht.

Arbeitsannahme aus dem Auftrag: Kürzel wirken **innerhalb des aktiven Klarwerk-Kontexts** (Web-App,
H01). Systemweit ist nicht entschieden — siehe [`ENTSCHEIDUNG-SYSTEMWEIT.md`](./ENTSCHEIDUNG-SYSTEMWEIT.md).

## 0. Reihenfolge und Abhängigkeiten zu laufenden Kandidaten

1. AA-02 erst auf einem Hauptstand beginnen, der C02 (Profilablage) und C03 (Profilzeile) enthält
   oder deren Abbruch kennt — beide ändern genau die Dateien, die AA-02/AA-03 anfassen.
2. AA-04 berührt `KlaraVorschau.tsx` nur an einer Stelle (Öffnen über ein Ereignis, siehe 3.1).
   C01, C04 und C05 ändern dieselbe Datei großflächig; der Anschluss bleibt deshalb bewusst klein.
3. AA-03 und AA-04 gemeinsam integrieren (Vorgabe der Quelle).

## 1. AA-02 · Bereich „Klara“ in den Persönlichen Einstellungen

**Ort.** `/profil` (Zahnrad › Persönliche Einstellungen, jede Rolle, H01). Kein neuer Admin-Bereich,
keine neue Route: die vorhandene Zeile „Meine Assistenz“ (`zeile-assistenz`) wird zum Bereich
„Klara“ und öffnet wie bisher eine Detailkarte (`MeineAssistenzDetail`, `Detailkarte`). Der
vorhandene Direktweg `/profil?bereich=assistenz` bleibt gültig; ein zusätzlicher Wert
`?bereich=klara` darf auf dieselbe Karte zeigen.

**Benennung — Entscheidung nötig.** Seit `assistenz-name-avatar` heißt die bewegliche Assistenz
neutral „Assistenz“ bzw. mit dem persönlichen Namen; `tests/assistenz-profil/katalog.test.ts` (M4)
verlangt das für die Gesprächstexte. Peter wünscht „Klara“ als Bereichsname. Vorschlag: Zeile und
Kartentitel „Klara“ mit dem gewählten Assistenznamen als Wert (z. B. „Klara · Mia“). M4 betrifft
die Zeilentexte von `/profil` nicht; der Widerspruch zur Gestaltungsabsicht ist trotzdem eine
Product-Owner-Entscheidung und wird nicht still aufgelöst.

**Gruppen in der Detailkarte** (nur Bestand):

| Gruppe | Inhalt | Vorgehen |
| --- | --- | --- |
| Name und Erscheinung | E01, E02, E03 | unverändert `AssistenzFormular modus="aendern"` |
| Unterstützung | E05, E06 | dieselbe `KlaraModusWahl` mit derselben Ablage zusätzlich hier einbinden; im Gespräch bleibt sie stehen |
| Fähigkeiten | E07 | unverändert `FaehigkeitenBereich` |
| Sprachausgabe | E08 | dieselbe `KlaraSprachausgabe` einbinden; Beschriftung „gilt für diesen Browser“, weil die Ablage `localStorage` ist. Eine Übernahme ins Konto wäre ein Speicherwechsel und ist **nicht** Teil von AA-02 |
| Tastenkürzel | AA-03 | neuer Unterbereich mit kurzer Beschreibung und Geltungsbereich |
| Vorgaben der Organisation | O01, O02 | nur lesbarer Hinweis „von der Verwaltung festgelegt“; für `admin` Verweis auf `/admin` (vorhandene Fläche). Keine Kopie der Schalter, keine neue Berechtigung |
| Weitere Hosts | H02, H03 | Hinweis mit Zuständigkeit: Browser-Kürzel in Chrome (`chrome://extensions/shortcuts`), Word ohne Einstellungen |

Nicht ins Setup: E04 (Ablaufband), E09/E10 (Sitzungs-Bedienzustand), O03 (Betrieb).

**Werte und Rechte.** Kein Umzug von Daten: alle Gruppen lesen und schreiben über ihre bisherigen
Wege (`/api/me/assistenz`, `/api/me/assistenz/eigeninitiative`, `/api/me/faehigkeiten/…`,
`localStorage`). Damit bleiben Werte, Fassungsschutz (409 bei veralteter Fassung) und die Regel
„nur eigenes Konto, sonst 403“ unverändert. Fehleranzeige wie bisher in der Detailkarte
(`assistenz.laden.fehler` + Wiederholen).

**Tastatur und Darstellung.** `Zeilenkarte`/`Detailkarte` aus `components/einstellungen` wie alle
Profilzeilen; Seitenhilfe über `useSeitenhilfeAnmeldung` (keine Sprechblasen, Wächter
`tests/design/zielbild-h6-kein-erklaertext.test.ts`).

**Prüfung (Vorschlag für AA-02).** Erweiterung von `tests/assistenz-profil/assistenz-mounted.test.tsx`
(Zeile, Gruppen, Direktweg, Werte bleiben) und ein Smoke in `tests-smoke/` für
Zahnrad › Persönliche Einstellungen › Klara mit Tastatur.

## 2. AA-03 · Kürzel festlegen und speichern

**Unterstützte Aktionen (Liste in der Oberfläche).** Nur Einstiegsaktionen aus dem Bestand:

| Aktion | Bestand | Ziel im Code |
| --- | --- | --- |
| Klara öffnen | A01 | `oeffnen()` in `KlaraVorschau.tsx` (Produktbetrieb) |
| Seitenhilfe öffnen | A02 | Öffnen der Fläche in `KlaraAssistant.tsx` |

A02 nur, wenn Peter es bestätigt; „mindestens Klara öffnen“ verlangt die Quelle. Keine weiteren
Aktionen.

**Standardbelegung.** Keine garantierte Standardbelegung. Vorschlag: ausgeliefert **unbelegt**;
Control+Command+K nur als Vorschlag in der Aufnahme anbieten, nachdem AA-04 ihn gegen die
Konfliktliste geprüft hat. „Zurücksetzen“ stellt dann den definierten Standard her (unbelegt oder
der bestätigte Vorschlag).

**Ablage.** Neues Feld `tastenkuerzel` in `assistenz_profile.data` (vorhandene Ablage, kein zweiter
Speicher, keine neue Tabelle). Eigener Schreibweg nach dem Muster der Eigeninitiative
(`schreibeEigeninitiative`): ein Profilschreiben übernimmt den gespeicherten Kürzelstand und ändert
ihn nie, ein Kürzelwechsel ändert die Profilfassung nicht. Routen
`GET/PUT /api/me/assistenz/tastenkuerzel` mit `requireUser` und `nenntFremdesKonto` → 403.
Ins Prüfprotokoll nur das Ereignis. Andere Konten bleiben unberührt, weil das Konto allein aus der
Sitzung kommt. Achtung C02: ändert dieselben zwei Dateien.

**Darstellung und Layouts.** Gespeichert wird die physische Taste (`KeyboardEvent.code`) plus
Modifikatoren — so bleibt die Belegung bei deutschem und englischem Layout dieselbe Taste.
Angezeigt wird das Zeichen des aktuellen Layouts, wo der Browser es liefert
(`navigator.keyboard.getLayoutMap`, nur Chromium), sonst der Code-Name. Mac-Symbole ⌃ ⌥ ⇧ ⌘ über
die eine Anzeigequelle `lib/tastenkuerzel.ts` (erweitern, nicht duplizieren).

**Bedienung.** Liste je Aktion: aktuelles Kürzel, Geltungsbereich „In Klarwerk, solange das Fenster
aktiv ist“, Knöpfe „Festlegen/Ändern“, „Entfernen“, „Standard wiederherstellen“. Aufnahme: nächste
Tastenkombination mit mindestens einem Modifikator; Escape bricht ab und behält die alte Belegung.
Speichern zeigt „wird gespeichert“ → „gespeichert“ erst nach Serverantwort; bei Fehler bleibt der
bestätigte Stand sichtbar.

**Prüfung (Vorschlag).** Neue Tests unter `tests/klara-tastenkuerzel/` (Dienst, Route mit fremder
Kennung, Profil-Nichtüberschreiben, PG-Integration) und Smoke für Festlegen/Abbrechen/Entfernen/
Zurücksetzen/Neuladen.

## 3. AA-04 · Ausführung und Konflikte

### 3.1 Ein Ausführungsweg

Ein einziger `keydown`-Hörer für Klara-Kürzel, eingehängt in `KlaraEbene` (`AppShell.tsx`), mit
`removeEventListener` im Effekt-Abbau und Neuaufbau bei jeder Belegungsänderung — so gibt es keine
doppelten oder verwaisten Hörer. Er löst über ein Fensterereignis aus (Muster
`klarwerk:assistenzflaeche` in `assistenzFlaechen.ts`); `KlaraVorschau` ruft daraufhin sein
vorhandenes `oeffnen()` auf. `oeffnen()` setzt nur `offen: true` auf dem einen Zustand (E09): ein
wiederholtes Auslösen erzeugt keine zweite Instanz und lässt Verlauf und Eingabe stehen
(idempotent). Die bestehende Regel „nie zwei offene Flächen“ gilt weiter.

Der Hörer ignoriert: `event.repeat`; laufende Aufnahme in AA-03; offene modale Fläche
(`useModalBoundary`, wie die Palette); Kombinationen ohne Modifikator in Textfeldern und
`contenteditable` (normales Schreiben bleibt). Bearbeitungskürzel werden gar nicht erst zugelassen
(3.2).

### 3.2 Konfliktliste (Ablehnung mit konkreter Meldung, alte Belegung bleibt)

| Gruppe | Beispiele | Grund |
| --- | --- | --- |
| Klarwerk intern | jede Kombination mit K und ⌘ oder Strg (T01), Escape, Enter, Tab, Pfeile, Home (T02–T04) | T01 prüft nur `metaKey \|\| ctrlKey` — Control+Command+K **löst die Palette mit aus**. Entweder ablehnen oder T01 auf exakte Modifikatoren umstellen; Letzteres ändert die gelieferte Palette und braucht Peters Zustimmung plus die vorhandenen Palettentests (u. a. `tests/navigationsnamen/palette-*.test.tsx`, `tests/schnellwahl/`) |
| Doppelbelegung | dieselbe Kombination für A01 und A02 | gleicher Geltungsbereich |
| Bearbeiten | ⌘/Strg + C, V, X, Z, A, B, I, U, F | etablierte Bearbeitungskürzel |
| Browser | ⌘/Strg + W, T, N, Q, R, L, P, S, Zahlen | vom Browser vorbelegt oder nicht abfangbar |
| macOS | ⌃⌘Q (Sperren), ⌃⌘F (Vollbild), ⌃⌘Leertaste (Zeichen), ⌘Leertaste, ⌘Tab | Systembefehle laut Apple-Referenz der Quelle |
| VoiceOver | jede Kombination mit ⌃⌥ (VO-Taste) | VoiceOver-Befehle; nie als Standard |

Die Liste wird gegen die beiden Apple-Referenzen der Quelle abgeglichen, bevor sie ausgeliefert
wird; sie ist keine Garantie freier Kombinationen. Fremde App-Kürzel sind im Browser nicht
erkennbar; die Oberfläche behauptet keine vollständige Erkennung.

### 3.3 Prüfung (Vorschlag)

Unit-Tests für den Hörer (genau eine Auslösung, Wechsel aktiviert neu/deaktiviert alt, entfernt =
wirkungslos, Wiederholung ignoriert, Textfeld/Modal/Aufnahme) und Smoke „Kürzel setzen → Klara
öffnet → ändern → entfernen“. Hostnachweis am Mac und Screenreader-Prüfung gehören zu AA-05.

## 4. Nicht Teil von AA-02 bis AA-04

Neue Klara-Aktionen; Kürzel in Word (Office-Tastaturüberschreibungen wären neue Hostarbeit);
Belegung der Chrome-Erweiterung aus der Web-App heraus (Chrome erlaubt das nicht); systemweite
Registrierung; Umzug der Sprachausgabe ins Konto; Änderungen an fremden Kandidaten C01–C05.
