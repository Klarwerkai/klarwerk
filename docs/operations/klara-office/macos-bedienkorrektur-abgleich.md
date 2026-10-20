# MACOS-20261014 · Ist-/Ziel-Abgleich der Klara-Oberfläche (MAC-01)

Auftrag `produkt:20261011:assistenz-minimalistische-oberflaeche` (Original `08abbc8ce7113845b115`),
ergänzt um die macOS-Bedienkorrektur vom 14.10.2026 (Peters Freigabe im PO-Chat 01a130c2; Kriterien
UI-01 bis UI-08 und MAC-01 bis MAC-05). Fensterauftrag `produkt:20261013:klara-fenster-bedienfehler`
(Original `110b00c5807dd9f33763`) wird hier erhaltend berücksichtigt; dieser Arbeitsbaum ist die
einzige UI-Baulinie, kein zweiter Assistenzkern, kein zweiter Fensterbauer.

**Was dieses Dokument ist:** ein Abgleich am Quelltext dieses Arbeitsbaums (Kandidat `14cdb31a` plus
die Änderungen von Nacharbeit 46). **Was es nicht ist:** eine Prüfung der installierten, laufenden Fassung
auf Peters Mac. Die tatsächlich genutzte Oberfläche je Host und aktiver Fassung ist hier nicht
gesehen worden — dafür fehlt die lokale Hostübergabe (siehe Abschnitt 4).

## 1. Hosts und wo ihre Oberfläche entsteht

| Host | Fundstelle | Rolle |
| --- | --- | --- |
| Native Mac-Begleitapp (Menüleisten-App) | `apps/desktop/klara-begleiter/Sources/Steuerung.swift`, `Fenster.swift` | Fenster, Figur, Menüleiste, Kürzel; lädt die Webfläche `/begleiter` |
| Webfläche der Begleitapp | `apps/web/src/pages/Begleiter.tsx` | Kopf, Kontextzeile (Word-Fenster), Gespräch, Eingabe, Menü |
| Klara im Web (Produktbetrieb) | `apps/web/src/components/klara-vorschau/KlaraVorschau.tsx` (Zweig `minimal`), `AssistenzMinimal.tsx` | Kopf, Kontextzeile, Gespräch, Eingabe, Menü, Vorgangsleiste |
| Word-Aufgabenfenster | `apps/web/public/word-addin/taskpane.*`, `begleiter.js` | Fragefeld in Word; Adapter zur Begleitapp |

## 2. Elemente → Zuordnung (Navigation / Inhalt / Kontextaktion / Klara-Gespräch / Detail / Einstellung / Meldung)

| Element (Testkennung) | Ort | Zuordnung |
| --- | --- | --- |
| Figur `klara-figur` / `begleiter-figur` | Web, Begleitapp | Optionaler Einstieg; nicht der einzige Weg zurück (Menüleiste „Gespräch öffnen“, Control-Option-K) |
| Kopf: Name, Menü `klara-menue-knopf`, Einklappen `klara-schliessen` | beide | Klara-Gespräch (Steuerung des Hosts) |
| Kontextzeile `klara-kontext-zeile` / `begleiter-kontext-zeile`, aufklappbar | beide | Detail (Herkunft, Fassung, Datenweg) — UI-01: worauf sich Klara bezieht |
| Gespräch `klara-verlauf`, Quellenzeile kompakt | beide | Klara-Gespräch / Ergebnis; Quellen auf Wunsch (Detail) |
| Eingabe `klara-eingabe`, Mikrofon, Senden | beide | Klara-Gespräch (Eingabe) |
| Höchstens zwei Vorschläge an der Markierung | beide | Kontextaktion |
| Vorgangsleiste `klara-vorgaenge` / Figur `klara-figur-vorgaenge` | beide | Vorübergehende Meldung mit Stopp |
| Menü: Neues Gespräch, Verlauf, Meine Funktionen, Einstellungen, Hilfe | beide | Einstellung / Navigation innerhalb Klara |
| Meine Funktionen: KI-Arbeitsweg, Notizen, Aufgaben | Web | Funktionen am eigenen Gespräch (nicht in der Grundansicht) |
| Einstellungen: Sprache, Unterstützungsmodus, Verbindungen, Darstellung, Daten & Freigaben | Web | Dauerhafte Einstellung |
| Menüleiste der App (Statusmenü) | Begleitapp | Einstieg, Position, Verbindung, Fassung |
| Titelleiste mit dem persönlichen Namen (sonst „Deine Assistenz“) und Systemknöpfen | Begleitapp (Gespräch) | Fensterbedienung (MAC-02); Name aus dem Profil über die Brücke (`art: "name"`, UI-MIN-15) |
| Hauptmenü Bearbeiten / Fenster | Begleitapp | Menübefehle und Kürzel (MAC-04, UI-05) |
| Arbeitsbereichsleiste links `arbeitsbereichsleiste`, Knöpfe `seitenleiste-ausblenden` / `seitenleiste-einblenden` | Web, Hauptfenster (breit) | Navigation (MAC-03); dieselben Ziele wie Kopfband und „Arbeitsbereiche“-Menü |
| Rechtsklick: Einklappen/Öffnen, Schließen | Begleitapp (jede Lage) | Fensterbedienung (übernommen aus BUG-KLARA-WINDOW-02) |
| Statusmenü: „… schließen/öffnen“, „Zur Figur einklappen“, Kürzelstatus, ggf. „Schließen wartet …“ | Begleitapp | Einstieg und ehrlicher Zustand |

## 3. Pakete → Stand in diesem Arbeitsbaum

| Paket | Umgesetzt (Quelltext) | Gegenprobe | Offen |
| --- | --- | --- | --- |
| MAC-01 | Dieses Dokument, einschliesslich Abschnitt 5 (Auswertung der Fensteroriginale) und Abschnitt 6 (Arbeitsaufgabe im Hauptfenster) | — | Abgleich der **laufenden** Fassung je Host (s. 4) |
| MAC-02 | Gespräch der Begleitapp als Mac-Fenster: Titelleiste mit persönlichem Namen zum Verschieben, Schließen (= ausblenden, kein unsichtbarer Rest, kein Wiedererscheinen; mit laufendem Vorgang zuerst Figur mit Stopp, s. 5.3), Minimieren (= zur Figur einklappen), Größenänderung mit Mindestgröße 320 × 420 und gemerkter Größe; Monitorwechsel/Skalierung begrenzen Größe und Lage; Wiederöffnen über App-Start, Menüleiste, Control-Option-K; geschlossen bleibt geschlossen, eingeklappt bleibt eingeklappt. Figur bleibt randlos. | `tests/klara-office/begleiter-app-quellen.test.ts` Q5–Q8 (Quellenprüfung), `begleiter-seite-am-server.test.tsx` S1 (Name an die App) | Nativer Bau dieser Änderung, Bedienung am echten Mac (UI-04, UI-08, BUG-KLARA-WINDOW-02/03-Abnahme) |
| MAC-03 | Kompakter Klara-Host priorisiert Gespräch/Ergebnis/Eingabe; Einrichtung, Verlauf, Funktionen, Hilfe im Menü (UI-MIN-01/11); Funktionen aus main (Modus, KI-Arbeitsweg, Notizen, Aufgaben) nicht in der Grundansicht. Im Hauptfenster: eine zusammenhängende Arbeitsaufgabe auf der Kapital-Sicht mit geöffneter und eingeklappter Assistenz; die Kontextzeile nennt die geöffneten Daten (s. 6) | `minimal-am-server.test.tsx` M1, M15–M19; `hauptfenster-datenweg-am-server.test.tsx` H1/H2 | Ausblendbare Arbeitsbereichsleiste links jetzt umgesetzt (Nacharbeit 52, `arbeitsbereichsleiste-am-server.test.tsx` L1–L5); kein eigener Inspektor; doppelte Einstiege Kopfband/Leiste nicht zusammengeführt; Nachweis am echten Host und durch Peter |
| MAC-04 | Hauptmenü mit Bearbeiten (Widerrufen ⌘Z, Wiederholen ⇧⌘Z, Ausschneiden, Kopieren, Einsetzen, Alles auswählen) und Fenster (Einklappen ⌘M, Schließen ⌘W, Gespräch öffnen); vorhandenes Kürzel Control-Option-K erhalten | Q5 (Quellenprüfung) | Wirksamkeit am echten Mac; Screenreader |
| MAC-05 | Quellen, Prüfstatus, Rechte, Einwilligung bleiben erreichbar (UI-MIN-07/09/15) | M3, M7, M10 | Realer Nutzerweg, Fenstergrößen, Hell/Dunkel, Tastatur und Screenreader am Host; menschliche Nutzenbewertung |

## 4. Fehlende Voraussetzungen — konkret

- **Fenster-Reparaturauftrag**: ÜBERHOLT (Nacharbeit 46). Die Führung hat die Originalverträge und
  die öffentlichen nativen Originaldateien bereitgestellt
  (`QUELLEN-FUEHRUNG-MAC-NATIVEORIGINALE-20261014T1914.json`), die Hilfe hat drei hashgeprüfte
  Vergleiche erstellt (`QUELLEN-HILFE-d6ff826cd221f2d95193.json`, `HILFE/d6ff826cd221f2d95193/*.diff`).
  Die Auswertung steht in Abschnitt 5.
- **Laufende Fassung je Host** (Begleitapp, Web, Word für Mac/Web) ist nicht gesehen: keine aktuelle
  Hostübergabe, kein Screenshot der aktiven Fassung vom 14.10.2026. Der Screenshot vom 13.10.2026 ist
  ein historischer Fehlerbeleg.
- **Nativer Bau und Start** dieser Swift-Änderung auf Peters Mac (UI-MIN-16, UI-08) stehen aus.
- **Screenreader-, Hell/Dunkel-, Größen- und Menschenbelege** (UI-06, MAC-05) stehen aus.

## 5. Fensteroriginale (BUG-KLARA-WINDOW-02, Original `90314201`) — ausgewertet und integriert

Grundlage: die drei Vergleiche der Hilfe (Kandidat `14cdb31a` gegen `90314201`) für `Fenster.swift`,
`Lage.swift`, `Steuerung.swift` und die Kriterien BUG-KLARA-WINDOW-01 bis -03 aus dem
Führungsbeleg. Integriert wurde in DIESE Fassung, ohne Kopie über den Arbeitsbaum: eigene MAC-02/04-
Änderungen (Hauptmenü Bearbeiten/Fenster, Mindestgröße 320 × 420, gemerkte Größe, `figur-vorgang`)
bleiben.

### 5.1 Übernommen

| Original | Kriterium | Jetzt in |
| --- | --- | --- |
| `Lage.vollstaendigSichtbar`, `aufFlaeche`, `eingepasst(_:auf:)`, `begrenzt(_:auf:)` | Bedienelemente nie ausserhalb bei kleinen Bildschirmen, Skalierung, Monitorwechsel | `Lage.swift`; `bildschirmeGeaendert`, `startRahmen`, `windowDidEndLiveResize`, `einblenden` |
| `Lage.bildschirm(am:)`, `beimZeiger` auf den Zielbildschirm | Wiederfinden über Control-Option-K auf dem Bildschirm des Zeigers | `Lage.swift`, `wiederfinden()` |
| `windowDidMove` mit Einpassen nach dem Loslassen | Verschieben über Monitore | `Steuerung.swift` |
| `applicationShouldHandleReopen` | Bewusstes Wiederöffnen über App-Start (Spotlight/Finder), auch ohne sichtbares Menüleistensymbol | `Steuerung.swift` |
| `klara.geschlossen` (über Neustart) | Kein eigenmächtiges Wiedererscheinen nach explizitem Schließen | `Steuerung.swift` (`merkeSichtbar`) |
| `nutzerEingeklappt`, `kuerzlichBedient` (`sendEvent`) | Eingeklappt bleibt eingeklappt bei Seiten-/Anmelde-/Verbindungswechsel | `Steuerung.swift` `setzeModus(_:durchPerson:)`, `Fenster.swift` |
| `performKeyEquivalent` ⌘W/⌘M | Schließen/Einklappen per Tastatur auch ohne aktives Hauptmenü | `Fenster.swift` (zusätzlich zum Hauptmenü aus MAC-04) |
| Rechtsklick-Einträge (`willOpenMenu`) | Schließen/Einklappen in jeder Lage, auch auf fremder Seite | `Fenster.swift`, `Steuerung.swift` |
| Kürzelstatus und `Logger` ohne Inhalte | Stilles Scheitern von Control-Option-K sichtbar | `Steuerung.swift` |

### 5.2 Bewusst nicht übernommen

- Browserkarte, Anmeldefolge, „In anderen Programmen …“ (BPA-01/BPA-04) aus demselben Original:
  eigene Aufträge mit eigenen Quellen (`BrowserBruecke`), die dieser Arbeitsbaum nicht enthält.
- Fester Fenstertitel „Klara“ (`Fensterstil.titel`): widerspricht UI-MIN-15; ersetzt durch den
  persönlichen Namen bzw. „Deine Assistenz“.
- Entfernen des Hauptmenüs: MAC-04/UI-05 verlangt Bearbeiten/Rückgängig im Gespräch; das Menü bleibt,
  ⌘W/⌘M wirken zusätzlich direkt am Fenster (keine Doppelauslösung, das Fenster antwortet zuerst).

### 5.3 Schließen bei laufendem Vorgang (Ben, Nacharbeit 46)

BUG-KLARA-WINDOW-02 verlangt, dass Schließen das störende Fenster vollständig entfernt; UI-MIN-06/14
verlangen, dass keine laufende Erfassung oder Ausführung unsichtbar wird. Umsetzung (Nacharbeit 47,
`Schliessen.swift`): Schließen klappt zur Figur ein und FRAGT die Webfläche mit einer Anfragenummer
nach ihren laufenden Vorgängen (`vorgaenge-melden`). Ausgeblendet wird nur,

- wenn gar keine eigene Webfläche geladen ist (keine Verbindung, Fehlerseite) — dort läuft nichts;
- oder wenn die Antwort auf GENAU DIESE Anfrage eingegangen ist und die Webfläche „0 laufende
  Vorgänge“ meldet (sofort oder später, sobald der letzte Vorgang endet).

Weder der lokal gesetzte Modus „figur“ noch eine verstrichene Zeit gelten als Bestätigung; die frühere
1,5-s-Frist ist entfernt. Antworten auf ältere Anfragen und Meldungen vor der Antwort zählen nicht;
eine unlesbare Anzahl gilt als „läuft“. Ein erneutes Schließen stellt eine neue Anfrage und blendet
nicht sofort aus; nach einem Neuladen der Webfläche wird die offene Anfrage neu gestellt. Laufen Frage,
Vorlesen oder eine Word-Aktion (auch „Stopp angefordert“ bis zur Bestätigung durch Word), bleibt die
kleine Figur mit je einem Stopp stehen (`figur-vorgang`). Das Statusmenü sagt „Schließen wartet auf
laufende Vorgänge“ bzw., solange die Antwort fehlt, „Schließen wartet auf die Bestätigung der
Webfläche“. Bewusstes Öffnen hebt das wartende Schließen auf. Entwurf und Gespräch bleiben in der
geladenen Webfläche. Eine Aufnahme endet beim Einklappen (Begleiter.tsx) und wird bis dahin als
Vorgang mitgezählt.

Unbekannter Stand ist keine 0 (Nacharbeit 54 · MAC5-01): Scheitert ein Kontextabruf, verwirft die
Webfläche die Auswahl (kein alter Dokumenttext als aktuelle Auswahl). Die zuletzt bestätigt
laufenden Word-Aktionen bleiben dagegen kontogebunden sichtbar, als „lief zuletzt noch …“, mit
Stopp. Vor der ersten Antwort und nach einem Fehler meldet die Webfläche der App mindestens 1. Eine
überholte, später eintreffende Antwort setzt einen jüngeren Stand nicht zurück. Bei Kontowechsel
bleibt nichts vom vorigen Konto. Auf dem Server (MAC5-02) wird nur der Verlauf beendeter Aktionen
gekürzt; laufende Aktionen bleiben im Kanal und im Kontext, gleich wie viele jüngere fertig sind.

Einstellungen (Nacharbeit 54 · MAC5-04): „Einstellungen …“ (⌘,) steht im App- und im Statusmenü und
wirkt auch direkt am Fenster. Der Befehl öffnet das Gespräch auf der vorhandenen Unterseite
„Einstellungen“ der Begleiter-Webfläche. Es gibt keine zweite Einstellungsverwaltung; Entwurf und
Stopps bleiben.

Nacharbeit 56 (Ben · MAC5-04-REST): Derselbe Befehl öffnet zusätzlich den zentralen Klara-Bereich in
Klarwerk (Profil › Klara, vorhandener Direktweg `/profil?bereich=klara`) im Browser. Die Begleiter-
Unterseite verweist ebenfalls dorthin. Der Begleiter bleibt geladen. Ist der Browser nicht
angemeldet, verlangt Klarwerk dort die Anmeldung.

Nacharbeit 56 (Ben · MAC5-01-REST): Eine eben beauftragte Word-Aktion zählt sofort. Solange der
Kanal antwortet, gilt sie als „wird übergeben“. Danach steht sie mit ihrer Kennung aus der Antwort
und mit Stopp da, bis ein nach der Annahme gestarteter Kontextabruf den Stand liefert. Ältere
Abrufe bestätigen keinen Leerlauf, und die App bekommt bis dahin keine 0.

Nacharbeit 57 (Ben): Eine Ablehnung gilt nur dann als belegt, wenn eine 4xx-Antwort (außer 408)
gelesen wurde; die Kanalroute prüft vor dem Anlegen. Fehlt die Antwort (Verbindung, Lesen, Parsen,
5xx, 408), kann der Kanal die Aktion schon angelegt haben. Die Fläche zeigt dann „Auftrag vielleicht
angenommen – Stand wird geprüft“ und meldet der App keine 0. Erst ein nach dem Fehlschlag gestarteter
Kontextabruf klärt das; läuft die Aktion, steht sie dann mit Kennung und Stopp da. Der Auftrag wird
nicht automatisch erneut gesendet.

Nacharbeit 58 (Ben · MACG57-POST-GET-01): Ein jüngerer Kontextabruf klärt einen unklaren Auftrag
nicht mehr, denn der ursprüngliche POST kann vor dem Anlegen noch in der Anmeldeprüfung warten. Jede
Beauftragung trägt jetzt einen zufälligen Auftragsschlüssel. Fehlt die Antwort, fragt der Begleiter
den Kanal nach genau diesem Schlüssel (`POST /api/me/klara/begleiter/auftraege/:schluessel/klaeren`):

- Ist die Aktion angelegt, antwortet der Kanal „angenommen“ mit ihrer Kennung; der Begleiter zeigt
  sie mit Stopp.
- Sonst antwortet er „nicht angelegt“ und sperrt den Schlüssel. Ein später eintreffender POST legt
  dann nichts mehr an (409 `geklaert_nicht_angelegt`).

Derselbe Schlüssel legt nie eine zweite Aktion an. Scheitert die Klärung selbst, bleibt die
Ungewissheit sichtbar (keine 0 an die App), und der Begleiter fragt im Abruftakt erneut.

Nacharbeit 59 (Ben): Eine Sperre wird nie mehr verdrängt. Jeder Auftrag mit Schlüssel trägt seinen
Ausstellungszeitpunkt, die Serverzeit des zuletzt gelesenen Kontexts. Der Kanal nimmt ihn nur innerhalb
von 120 s an (409 `schluessel_abgelaufen`). Ein Vermerk bleibt mindestens 240 s nach Annahme oder
Klärung; erst dann kann kein verspäteter POST seines Schlüssels mehr angenommen werden. Sind die 64
Plätze je Konto mit noch wirksamen Vermerken belegt, weist der Kanal neue Klärungen und Aufträge ab
(409 `zu_viele_auftraege`), statt eine Sperre zu verdrängen. Der Begleiter bleibt dann bei „unklar“ und
fragt erneut.

Nacharbeit 60 (Ben): Eine an Word übergebene Aktion endet nur mit Words eigener Meldung.

- Verstummt ein Fenster, bleibt es inaktiv samt Aktion und Stopp im Kanal. Der Begleiter zeigt dann
  „Verbindung zu Word verloren, Ende nicht bestätigt“; ein Stopp geht mit der nächsten Meldung des
  Fensters hinaus.
- Meldet sich dasselbe Fenster neu an, behält der Kanal dessen laufende Aktionen.
- Nur nie abgeholte Aktionen verfallen nach der Frist (Word hat sie nie erhalten).
- Ein neuntes Fenster verdrängt nur ein Fenster ohne laufende Aktion; haben alle eine, wird die
  Anmeldung abgewiesen (409 `zu_viele_fenster`).

Der Office-Adapter der Begleitseite (`begleitung.js`) führt Aufträge der Figur jetzt neben dem Melden
aus. Takt und Abbruchanforderungen (`abbrechen`) erreichen sie während der Ausführung. Eine Frage
prüft den Abbruch vor dem Senden, nach dem Abruf und nach dem Lesen der Antwort; eine abgebrochene
Frage übernimmt keine Antwort und meldet `gestoppt`. Ein Einfügen ist bis zum Anstoß des Schreibens
abbrechbar; danach meldet es `erledigt` mit dem Grund `abbruch_nach_dem_schreiben`.

Nacharbeit 61 (Ben): Der Abbruch eines Einfügens wird bis unmittelbar vor `insertText` geprüft,
auch nach der asynchronen Zielprüfung (`fuegeEin` in `office-host-word.js`). Ein Stopp davor meldet
`gestoppt` mit `vor_dem_schreiben`, und es wird nichts eingefügt. Erst nach tatsächlichem
Schreibbeginn gilt `abbruch_nach_dem_schreiben`.

Abmelden beendet keine übergebene Aktion mehr:

- Nie abgeholte Aktionen enden als `gestoppt` (`fenster_abgemeldet`).
- Läuft eine übergebene Aktion, bleibt das Fenster abgemeldet stehen: inaktiv, ohne Auswahl, ohne
  neue Aufträge, aber mit Aktion und Stopp.
- Die Begleitseite meldet die Ergebnisse der alten Runde nach ihrem Ende an genau dieses Fenster nach;
  erst dann verschwindet es. Dazu gehören auch beim Trennen gestoppte Fragen, nie begonnene Aufträge
  und ein abgeschlossenes Schreiben. Ein vom abgemeldeten Fenster selbst gemeldetes `gestoppt` gilt
  auch ohne angeforderten Abbruch.

Nacharbeit 62 (Ben · MACG60-VERMERK-LEBENSDAUER-01): Ein Auftragsvermerk weicht erst, wenn seine
Mindestaufbewahrung (240 s) abgelaufen ist und seine angenommene Aktion beendet gemeldet ist. Solange
die Aktion läuft, antwortet die Klärung weiter „angenommen“ mit genau dieser Aktion. Gegen einen
verspäteten Doppelstart schützen weiter der Vermerk selbst und danach der abgelaufene
Ausstellungszeitpunkt. Laufende Aktionen sind je Konto auf 8 Fenster × 3 begrenzt; sie belegen daher
höchstens 24 der 64 Plätze.

Nacharbeit 63 (Ben):

- **Endbelege:** Die Antwort auf eine Meldung mit Ergebnissen nennt unter `quittiert`, wozu nichts mehr
  offen ist. Die Nachmeldung entfernt nur diese Ergebnisse. Ist die Abmeldung gescheitert oder gar
  nicht erfolgt, wiederholt die Begleitseite zuerst die Abmeldung und meldet erst danach nach. Die
  Schutzregel für `gestoppt` bleibt unverändert.
- **Klärung:** Sie trägt den Ausstellungszeitpunkt des Auftrags. Ein fehlender Vermerk gilt nur dann
  als „nicht angelegt“, wenn der Auftrag höchstens eine Frist (120 s) alt ist; ein angenommener wäre
  dann sicher noch vermerkt. Bei einem älteren Auftrag antwortet die Klärung „unbekannt“: angenommen
  werden kann er nicht mehr, und dazu läuft nichts (der Vermerk einer laufenden Aktion wird nie
  bereinigt). Der Begleiter sagt dann genau das.

Nacharbeit 64 (Ben): Ein Serverneustart belegt weder Nichtannahme noch Ende.

- **Kanalinstanz:** Jede Kanalinstanz hat eine eigene Kennung (`kanal` im Kontext). Aufträge mit
  Schlüssel tragen sie mit; einer aus einer früheren Instanz wird nie angenommen
  (409 `kanal_neu_gestartet`).
- **Klärung:** „nicht angelegt“ und „unbekannt“ gelten nur innerhalb derselben Instanz. Für einen
  Auftrag aus einer früheren Instanz entscheidet das Zielfenster. Hat es sich noch nicht mit seinem
  Bestand gemeldet, lautet die Antwort „offen“: Der Begleiter behält den Vorgang (keine 0) und fragt
  weiter. Hat es seinen Bestand gemeldet und führt den Auftrag nicht aus, lautet sie
  „nicht_laufend“: Dazu läuft nichts, ob er angenommen war, bleibt offen.
- **Bestand der Word-Fenster:** Beide Word-Adapter (`begleiter.js`, `begleitung.js`) melden bei jeder
  Anmeldung vollständig, was sie noch ausführen (`laufend`, mit Schlüssel). Der Kanal übernimmt
  unbekannte Aktionen; sie sind wieder sichtbar, stoppbar und klärbar.
- **Begleiter:** Wechselt die Kanalinstanz, behält er alles bisher als laufend Bekannte mit
  „Klarwerk wurde neu gestartet, Ende nicht bestätigt“ und Stopp. Das gilt, bis das jeweilige
  Fenster in der neuen Instanz seinen Bestand gemeldet hat.

Nacharbeit 65 (Ben):

- **Herkunft der Annahme:** Eine Annahme, per POST-Antwort oder Klärung, behält im Begleiter ihre
  Kanalinstanz. Nur ein Abruf derselben Instanz löst sie über die Abrufnummer auf. Eine Annahme aus
  einer anderen Instanz wandert zu den Vorgängen „neu gestartet, Ende nicht bestätigt“ und bleibt
  dort mit Stopp, bis ihr Fenster in der aktuellen Instanz seinen Bestand gemeldet hat.
- **Abbruch über die Übernahme:** Die Bestandsmeldung trägt pro Auftrag auch einen schon
  angenommenen Abbruch (`abbruch`). Der Kanal behält ihn bei der Übernahme, sodass ein späteres
  `gestoppt` übernommen wird; ein unberechtigtes bleibt abgewiesen.
- **Quittierung:** Beide Word-Adapter entfernen Ergebnisse nur noch nach ausdrücklicher Quittierung
  (`quittiert`). Ein abgewiesenes Ergebnis geht mit dem nächsten Takt erneut hinaus, nicht sofort
  in Schleife.

Nacharbeit 66 (Ben): Der Begleiter hält jeden angeforderten Stopp fest, pro Aktion, Fenster und
Konto, bis das Ende belegt ist. Belegt ist es, wenn die Aktion beendet erscheint oder in derselben
Kanalinstanz bzw. im gemeldeten Bestand ihres Fensters fehlt. Zeigt der Kontext dieselbe Aktion
weiter laufend, aber ohne Abbruchanforderung, stellt er den Stopp erneut zu. Das deckt etwa einen
Serverneustart nach der 202-Bestätigung ab, der den Abbruch verliert, bevor Word ihn erhalten hat.
Neu beauftragt wird nichts.

Nacharbeit 67 (Ben): Entscheidend ist nicht die Kanalinstanz beim Klick, sondern die Instanz, in
der die Aktion tatsächlich gesehen wurde. Zählen dürfen nur Abrufe, die nach dem Klick gestartet
wurden. Ein Stopp während der Wiederanmeldung, also unter „neu gestartet“ mit 404, bleibt daher
auch über leere Abrufe derselben neuen Instanz bestehen. Er geht hinaus, sobald Word die Aktion neu
meldet. Entfernt wird er nur, wenn die Aktion beendet gesehen wird, in derselben Instanz nach dem
Sehen fehlt oder im gemeldeten Bestand ihres Fensters fehlt.

Einklappen (gelber Knopf, ⌘M, Menü, Rechtsklick und der erste Schritt von Schließen; Nacharbeit 49):
Mit geladener eigener Webfläche verkleinert die App das Fenster nicht selbst. Erst die Meldung der
Webfläche (`figur` bzw. `figur-vorgang` mit je einem Stopp) setzt die passende Größe. Bleibt sie aus,
bleibt die bisherige Fläche mit ihren Stopps stehen — kein vorzeitiges Abschneiden auf 96 × 96. Nur
ohne eigene Webfläche (keine Verbindung, Fehlerseite) klappt die App selbst ein.

### 5.4 Offen aus dem Fensteroriginal

BUG-KLARA-WINDOW-01 (laufender Host und Fassung bestimmt, Reproduktion) und die Abnahmen von -02/-03
(Nutzerweg im tatsächlichen Host: öffnen → kleiner ziehen → verschieben → einklappen → öffnen →
schließen → darunterliegende Anwendung bedienen → bewusst öffnen; vorher/nachher, geprüfte Fassung)
sind Hostnachweise. Sie fehlen; ein grüner Quellen- oder Komponententest ersetzt sie nicht.

## 6. MAC-03 / UI-01–04 · eine Arbeitsaufgabe im Hauptfenster

Synthetische Aufgabe: Die Verwaltung pflegt die realen Lagebild-Werte für „Gesamt“ auf der
Kapital-Sicht (`/kapital`, `components/LagebildWerte.tsx`, Auftrag
`produkt:20261013:lagebild-reale-werte-eingabe`). Alle Schritte liegen auf EINER Seite.

| Schritt | Ort im Hauptfenster | Beleg |
| --- | --- | --- |
| Daten auswählen | Bereichswahl `lagebild-bereich-wahl` | H1/H2 |
| Prüfen | angezeigter Stand `lagebild-anzeige` (Version), Zeitraum, Stand | H1/H2; `lagebild-karte-mounted` K2 |
| Quelle verstehen (Zahl → Herkunft, Beleg, Stand) | `lagebild-zeile` mit Herkunft „gemessen“ und Beleg | H1/H2; K2 |
| Prüfstatus der Zahl (UI-03) | an jeder erfassten Zahl `lagebild-pruefstatus` „Prüfstatus: offen – nicht fachlich geprüft“; am berechneten Ergebnis `lagebild-ergebnis-pruefstatus` | H1/H2 (jede Zeile); K1/K2 |
| Ergänzen/korrigieren | „Bearbeiten“ → Formular → Speichern auf dem gelesenen Stand (409 bei parallelem Stand) | H1/H2 (am echten Server Stand 2); K2–K4, K6, K7 |
| Ergebnis verwenden | Rechnung `lagebild-ergebnis` aus dem neuen Stand | H1/H2; K2 |
| Worauf sich Klara bezieht (UI-01) | Kontextzeile „Diese Seite · Lagebild-Werte Ganzes Unternehmen, Stand N“, folgt Auswahl und Speichern | H1/H2 |
| Klara offen, Dokument bedienbar (UI-04) | Assistenz offen, Karte vollständig bedienbar, Entwurf bleibt | H1 |
| Klara ausgeblendet, bewusst wieder geöffnet (UI-04) | Eingeklappt: derselbe Weg; danach Entwurf und aktueller Bezug | H2 |

Geschlossene Lücke (UI-01): Vorher nannte die Kontextzeile auf der Kapital-Sicht nur „Diese Seite“
und das Objekt „Kein bestimmtes Objekt“. Jetzt liest sie Bereich und Stand der angezeigten Karte (nur Name und
Standnummer, keine Werte oder Belege) und liest auf `/kapital` fortlaufend nach.

Geschlossene Lücke (UI-03, Nacharbeit 47): Die Lagebild-Werte haben keine fachliche Prüfung (Datenmodell:
Wert, Herkunft, Beleg, Stand). Statt dazu zu schweigen, zeigt jede erfasste Zahl ihren tatsächlichen
Prüfstatus „offen – nicht fachlich geprüft“, und das berechnete Ergebnis sagt, dass es auf nicht
fachlich geprüften Werten beruht. Eine Prüfautomatik oder Freigabefunktion wurde nicht gebaut; der
Status ist eine wahre Kennzeichnung, kein erfundener Prüfvorgang.

Navigation des Hauptfensters (MAC-03, Ben/Führung Nacharbeit 52): Links steht jetzt eine ausblendbare
Arbeitsbereichsleiste (`shell/Arbeitsbereichsleiste.tsx`, Liste `SeitenleistenPunkte` in
`shell/KopfbandPunkte.tsx`). Sie zeigt dieselben Ziele wie Kopfband und „Arbeitsbereiche“-Menü, mit
denselben Rechten (`canSee`), derselben Aktivregel, denselben Zählern und dem Ungespeichert-Wächter.
Ausgeblendet ist sie nicht im Baum, und `<main>` bekommt die Breite. Der Seiteninhalt wird beim
Umschalten nicht neu montiert, und der Fokus wandert auf den jeweils vorhandenen Knopf. Eine offene
Modalfläche sperrt die Leiste. Die eigene Wahl bleibt (lokal gemerkt). Ohne eigene Wahl ist die
Leiste ab 1440 px eingeblendet, darunter ausgeblendet. Das ist eine Umsetzungsentscheidung, damit die
breiten Seiten ihren Platz behalten: Bibliothek 380 + 720 px, Wissensnetz 880 px + Leiste. Das Kopfband
bleibt unverändert, damit die Navigation auch bei ausgeblendeter Leiste direkt erreichbar ist. Der
Datenweg (Lagebild) ist mit ein- und ausgeblendeter Leiste bei offener Assistenz belegt
(`tests/assistenz-minimal/arbeitsbereichsleiste-am-server.test.tsx` L1–L5). Die Vorgabe „keine
Seitenleiste“ aus JOB 3060 H1 ist damit abgelöst.

Nacharbeit 54 (Ben/Führung MAC5-03/-05):

- **Doppelte Einstiege zusammengeführt.** Ist die Leiste eingeblendet, zeigt das Kopfband die
  Bereiche (Punkte und „Arbeitsbereiche“-Menü) nicht ein zweites Mal. Suche, „Seite finden“ (⌘K),
  Meldungen, Zahnrad und Konto bleiben im Kopfband. Ist die Leiste ausgeblendet oder das Fenster
  schmal, trägt das Kopfband bzw. das Menü die Bereiche wie bisher. So bleiben alle erlaubten Ziele
  erreichbar, mit denselben Rechten, Zählern und dem Ungespeichert-Wächter.
- **Details an der Zahl.** Jede erfasste Lagebild-Zahl hat einen Knopf „Details“. Er öffnet einen
  Bereich an genau dieser Zahl mit Beleg, Zeitraum und Stand (Zeit, Person). Am Wert sichtbar bleiben
  Angabe, Herkunft und der knappe offene Prüfstatus. Die Fassung steht sonst nur knapp („Stand N“).
  Am Ergebnis öffnet „Rechenweg“ die Formel und die Grundlage. Geldwert, Art, Prüfstatus, Gründe und
  der Demo-Hinweis bleiben sichtbar. Ein allgemeiner Inspektor ist nicht gebaut.

Host-, Screenreader- und Menschennachweis fehlen.
