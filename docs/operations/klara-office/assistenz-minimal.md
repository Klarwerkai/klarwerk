# Assistenz minimal — kurze Anleitung

Auftrag `produkt:20261011:assistenz-minimalistische-oberflaeche` (UI-MIN r1). Gilt für die
Assistenzfläche im Produktbetrieb (`KlaraVorschau` mit `betriebsart="produkt"`), die das Web
und — soweit er diese Fläche lädt — der Mac-Begleiter zeigen. Die gekennzeichnete Vorschau unter
`/klara-vorschau` bleibt unverändert.

## Öffnen

Auf die Figur klicken (oder sie mit Tab erreichen und Eingabe drücken). Es erscheinen nur vier
Bereiche:

1. **Kopf** – Avatar, dein gewählter Name (ohne Profil „Deine Assistenz“), **Menü**, **Einklappen**.
2. **Kontextzeile** – worauf sich die nächste Frage bezieht, etwa „Diese Seite“ oder „… ·
   Markierung“, dazu knapp „ohne KI“ bzw. „KI aus“, wenn das gilt. Ein Klick zeigt Ort, Fassung,
   Bezug (Seite / Markierung / Frei), Datenweg und KI-Lage.
3. **Gespräch** – leer nur „Wie kann ich helfen?“, sonst der vollständige gespeicherte Verlauf.
4. **Eingabe** – ein Feld, ein Mikrofon (wenn der Browser diktieren kann), **Senden**.

## Fragen und sprechen

- Tippen und **Senden** (oder Eingabe). Beim allerersten Senden fragt die Assistenz einmal nach
  der Einwilligung für dieses Gespräch; „Einverstanden und senden“ schickt genau deine Frage,
  „Nicht jetzt“ schickt nichts und lässt den Text stehen.
- **Mikrofon**: Was du sagst, erscheint als Text im Feld. Gesendet wird erst mit **Senden** —
  Diktat allein führt nichts aus. Ist das Mikrofon nicht erlaubt, steht ein Hinweis am Feld;
  Tippen geht immer.
- Ein angefangener Text merkt sich, auf welcher Seite er begonnen wurde. Wechselst du vor dem
  Senden die Seite oder das Objekt, fragt die Assistenz: „Wie begonnen“ oder „Hier“ — es wird nie
  still auf das neue Ziel gesendet. Kommt eine Frage nicht an (etwa weil eine Markierung nicht
  mehr lesbar ist), steht dein Text wieder im Feld.
- Ist der getippte Text ein klarer Ausführungsauftrag (Klara 05, etwa „Lege den Entwurf … an“),
  steht direkt unter dem Feld, welche Schritte er auslöst; Senden startet ihn über denselben
  Ausführungsweg wie im bisherigen Gespräch (keine Frage an die KI). Auch ein Auftrag behält den
  Ort, an dem er begonnen wurde: nach einem Seitenwechsel fragt die Assistenz erst „Wie begonnen“
  oder „Hier“ und startet ihn dann genau mit diesem Ziel. Der laufende Auftrag steht
  einzeln im Steuerbereich mit **Abbrechen** — auch bei offenem Menü und an der eingeklappten Figur.
- Ist die KI abgeschaltet, steht knapp „KI aus“ in der Kontextzeile; die Erklärung erscheint, wenn
  du sendest — gesendet wird dann nichts.
- Bei einer Markierung erscheinen höchstens zwei Vorschläge (**Erklären**, **Zusammenfassen**);
  Übersetzen, Umformulieren, Notizentwurf, Nachricht und Entfernen stehen unter „Weitere
  Möglichkeiten“.

## Menü

**Neues Gespräch** (fragt nur nach, wenn das bisherige danach in dieser Fläche nicht mehr
aufrufbar wäre; dein angefangener Text bleibt), **Verlauf**, **Meine Funktionen** (Geliefertes
und getrennt Geplantes), **Einstellungen** (Sprache/Vorlesen, Verbindungen, Darstellung,
Daten & Freigaben) und **Hilfe** (Seite erklären, nächsten Schritt zeigen, Tutorial begleiten,
Bedienung). Jede Unterseite hat „Zurück zum Gespräch“; Escape geht genau eine Stufe zurück.

Einwilligung widerrufen: **Menü → Einstellungen → Einwilligung widerrufen** (drei Aktionen).
Danach nimmt der Server keine Frage mehr an, bis du erneut einwilligst.

## Stoppen

Läuft etwas — Anfrage, Aufnahme, Vorlesen, Tutorialbegleitung —, steht es über dem Gespräch mit
eigenem **Stoppen** bzw. **Pause/Fortsetzen/Beenden**, auch bei offenem Menü. Eingeklappt stehen
dieselben Knöpfe an der Figur. Eine Aufnahme endet beim Einklappen. Stoppen verhindert weitere
Arbeit; bereits Gespeichertes bleibt und ist im Gespräch als „Gestoppt“ gekennzeichnet. Nach
Neuladen startet nichts von selbst neu.

## Hell und dunkel

Die Assistenz (Figur und Gespräch) folgt der Hell-/Dunkeleinstellung des Systems. Der Rest der
Web-App hat keinen Dunkelmodus und bleibt hell.

## Was diese Lieferung nicht belegt

- Der native Mac-Begleiter (Kandidat `ff96149e…`, Auftrag `klara-office-mac-maskottchen`) ist
  in diesen Stand zusammengeführt (App-Quellen, Word-Adapter, Kanal, Routen, Prüfungen). Seine
  Fläche `/begleiter` (`pages/Begleiter.tsx`) zeigt jetzt dieselben vier Bereiche und dasselbe
  Menü. Fragt man ohne verbundenes Word nach der Markierung, erscheint GENAU DANN die Hilfe „Für die
  Markierung benötige ich die Word-Verbindung.“ mit dem Verbindungsweg; sie wechselt erst nach einer
  tatsächlichen Anmeldung des Word-Fensters auf „verbunden“. Gebaut, installiert und auf Peters Mac
  gestartet ist diese Fassung damit NICHT — das ist die lokale Lieferung
  (`scripts/klara-office/begleiter-*.sh`, `begleitapp-mac.md`).
- Mac-Begleiter, eingeklappt (Nacharbeit 5): Läuft etwas — Anfrage, Vorlesen, Aufnahme oder eine
  Word-Aktion in IRGENDEINEM verbundenen Word-Fenster —, meldet die Fläche der App den Modus
  `figur-vorgang`; die App vergrössert das Figurfenster (240 × 236) und unter der Figur steht jeder
  Vorgang einzeln mit Fensternamen. Ohne Vorgang wird es wieder so klein wie die Figur. Die
  Swift-Änderung (`Steuerung.swift`) ist in dieser Runde nicht nativ gebaut worden.
- Word-Aktionen stoppen (`POST …/aktionen/:aktion/stopp`): Solange Word die Aktion noch nicht
  abgeholt hat, heisst der Knopf **Zurückziehen** — Word erhält sie dann nie. Führt Word sie schon
  aus, heisst er **Stoppen**: der Abbruch geht mit der nächsten Meldung an genau dieses Word-Fenster
  (`abbrechen`), die Zeile zeigt „Stopp angefordert“, und der Knopf bleibt da, bis Word das Ende
  bestätigt. Bei einer Frage bricht `begleiter.js` den Abruf des Fragefelds selbst ab (Nacharbeit 8):
  vor dem Senden geht sie gar nicht hinaus, danach wird der laufende Abruf samt Lesen der Antwort
  abgebrochen; das Word-Fragefeld zeigt „In der Begleitapp gestoppt.“ statt einer Antwort. Erst dann
  meldet Word `gestoppt`. Wird „Mit Begleitapp verbinden“ ausgeschaltet, während das Fragefeld noch
  auf Words Markierung wartet, ist die Frage dauerhaft entwertet: ein verspäteter Rückruf von Word
  löst keinen Abruf mehr aus; abgebaut wird der Abbruch erst, wenn das Fragefeld sicher fertig ist
  (Nacharbeit 10). Ein Einfügen, das noch nicht geschrieben hat, schreibt nichts. War Word schon
  fertig, steht „erledigt“ da — eine bereits eingefügte Änderung nimmt nur Word selbst mit
  „Rückgängig“ zurück; die Assistenz behauptet keine Rücknahme. Grenze: hat der Klarwerk-Server die
  Frage schon empfangen, rechnet er sie zu Ende; das Ergebnis wird verworfen (Verbindung beendet) und
  erscheint weder im Fragefeld noch im Begleiter noch im Dokument.
- Fragen zur Markierung stellt man im Begleiter im EINEN Eingabefeld (getippt oder diktiert). Sie
  gehen an das gebundene Word-Fenster; ohne Verbindung erscheint bei jedem Senden die
  Verbindungshilfe, bis Word verbunden ist („An Word senden“) oder „Ohne Dokument fragen“ gewählt
  wird. Der angefangene Text liegt kontogebunden in der Sitzung der App, mit Word-Fenster und
  Auswahlstand (ohne Markierungstext), und übersteht Einklappen und Neuladen. Hat sich Fenster oder
  Markierung seither geändert, fragt die Fläche „Wie begonnen“ / „Hierhin“. Nicht angekommene
  Entwürfe bleiben bis „Zurückholen“ oder „Verwerfen“ — im Web ebenso, auch über ein weiteres Senden
  und Neuladen hinweg.
- Vergleichsbasis für UI-MIN-10: Der Sitzungsschalter `klarwerk.assistenz.vergleich = frueher`
  zeigt im Web die bisherige Produktfläche (nur für die Vergleichssonde, kein Bedienelement).
- Echte Mikrofon-/Vorleseprobe, Word-Markierung und menschliche Sichtung bleiben getrennt offen.
