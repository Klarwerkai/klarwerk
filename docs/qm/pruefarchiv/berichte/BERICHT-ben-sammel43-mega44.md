# BERICHT-ben-sammel43-mega44 - Gegenpruefung der drei Waechter-Auflagen

Datum: 2026-07-28
Repo: `/Users/peterkohnert/Documents/dev_Klarwerk`
Basis: `5150cd5a0e4a6c6bb5e2fe3fdce8a02329bb7af5`
Auftrag: `_relay/ben/inbox/AUFTRAG-ben-sammel43-mega44.md`
Auftrags-SHA-256: `feb5cac721bb4b410ac1b1b59c7d8e15da242fb109791bc73cca3209d103633b`

## Kurzurteil

mega44 verbessert das Pruefwerkzeug deutlich und aendert keinen Produktcode. Alle 18 heutigen
farbsetzenden Quellen werden erreicht; die 13 gemessenen Paare sind aus Regeln und Markup
ermittelte, sinnvoll zusammengefasste Kombinationen. Die Alpha-Sonden, die Inline-Sonde und die
direkten Violett-Sonden pruefen echte Fehlerwege.

Die drei Auflagen aus sammel42 sind aber noch nicht vollstaendig geschlossen:

1. G2 bleibt offen, weil die vermeintliche Kaskadenaufloesung CSS-Spezifitaet nicht berechnet und
   bei `background-color` gegen `background` nicht die Deklarationsreihenfolge abbildet. Ein real
   sichtbarer roter Kontrastfall kann dadurch als sicheres Paar gemessen werden.
2. G1 ist praktisch verbessert, aber nicht streng: Alpha wird auf vier Nachkommastellen gerundet,
   und der Inline-Parser erkennt nur doppelt zitierte `style`-Attribute.
3. G3 ist fuer direkte Farbliterale selektorgebunden, nicht jedoch fuer Violett hinter einer
   CSS-Variablen. Eine Freigabe am Variablenursprung waere wieder global.

Der aktuelle mega43-Produktstand bleibt unveraendert auslieferbar und die sieben VIP-Aufgaben werden
nicht beeintraechtigt. Das Gesamturteil fuer den alleinigen Zweck dieser Runde - die dauerhafte
Schliessung der drei Waechter-Auflagen - bleibt GELB.

## Befunde zuerst

### F1 - Die Kaskadenaufloesung bildet CSS-Spezifitaet nicht ab

Verdikt: GELB, G2 nicht geschlossen

Beleg:

- `stilRegeln()` bewahrt die Quellreihenfolge
  (`tests/app/mega43-klara-werkbank-palette.test.ts:344-372`).
- `farbregelFuer()` laeuft anschliessend alle passenden Regeln durch und nimmt immer die letzte
  passende Regel (`:894-910`).
- `flaecheFuerPfad()` macht dasselbe fuer Hintergruende (`:855-879`).
- Es existiert keine Berechnung von ID-, Klassen- und Element-Spezifitaet. Eine Suche in der
  Testdatei findet keine Spezifitaetsfunktion und keine entsprechende Sonde.

Damit ist der Satz "Kaskade = Quellreihenfolge" technisch unvollstaendig. CSS entscheidet zuerst
nach Herkunft/Wichtigkeit und Spezifitaet; nur bei Gleichstand entscheidet die Quellreihenfolge.

Konservativitaet:

- Bei konkurrierenden `color`-Regeln bleibt ein Fehler oft wenigstens rot, weil die vom Sammler
  faelschlich als ueberschrieben betrachtete Regel als tote Regel gemeldet wird (`:1029-1037`).
- Fuer reine Hintergrundregeln existiert diese Leichenpruefung nicht. Dort kann ein wahrer roter
  Fall gruen bleiben.

Konkreter Bypass der Garantie:

Eine fruehere spezifische `.card`-Hintergrundregel kann im Browser gegen eine spaetere generische
`div`-Regel gewinnen. Der Sammler waehlt dagegen die spaetere `div`-Regel. Ein `h2` wuerde dann
gegen die falsche Flaeche gemessen. Weil Hintergrundregeln ohne `color` nicht Teil der
Vollstaendigkeitspruefung sind, entsteht dabei kein Ersatzbefund.

### F2 - `background-color` gegen `background` wird in fester statt realer Reihenfolge gewaehlt

Verdikt: GELB, G2 nicht geschlossen

Beleg:

`hintergrundDerRegel()` verwendet unabhaengig von der Deklarationsreihenfolge stets
`background-color` vor `background`
(`tests/app/mega43-klara-werkbank-palette.test.ts:839-842`).

CSS-Shorthand und Longhand ueberschreiben einander dagegen in Deklarationsreihenfolge. Beispiel:

```css
.card {
  background-color: var(--surface);
  background: var(--brand-deep);
}
```

Der Browser verwendet den spaeteren `background` und damit `--brand-deep`; der Sammler waehlt
`--surface`. Fuer die heutige Ueberschrift koennte damit ein schlechter realer Kontrast als
`--ink` auf `--surface` mit 18,08:1 erscheinen. Wortwaechter, Farbpalette und
`color`-Quellenabdeckung wuerden diesen Unterschied nicht melden.

Auch `inlineHintergrund()` gibt die erste passende Inline-Deklaration zurueck (`:844-853`), waehrend
im Browser die letzte wirksame Deklaration gewinnt.

Auflage zu F1/F2:

Spezifitaet plus Quellreihenfolge fuer jede Fundstelle auswerten und Shorthand/Longhand in echter
Deklarationsreihenfolge behandeln. Mindestens je eine rote Sonde muss einen
Spezifitaetskonflikt und einen `background-color`/`background`-Konflikt abdecken.

### F3 - Alpha-Identitaet besitzt eine unbenannte Vierstellen-Toleranz

Verdikt: GELB, G1 weitgehend, aber nicht streng geschlossen

Beleg:

`alphaText()` rundet jeden Alpha-Wert mit `toFixed(4)`
(`tests/app/mega43-klara-werkbank-palette.test.ts:136-144`). Deshalb werden etwa `0.45` und
`0.45001` beide zu `0.45` und dieselbe Alpha-Ausnahme akzeptiert.

Die vorhandene Sonde `0.45` nach `0.05` (`:1217-1224`) ist dennoch beweiskraeftig: Sie benutzt
dieselbe `befunde()`-Funktion, die Produktionsdatei wird tatsaechlich mutiert, und der neue Wert
kann weder die Ausnahme noch ein farblich passendes Werkbank-Rezept treffen. Gleiches gilt fuer
die Kachel-Sonde `0.05` nach `0.5` (`:1226-1230`).

Die Behauptung "reine Alpha-Drift wird zuverlaessig rot" ist somit fuer relevante groessere
Aenderungen belegt, nicht aber zifferngleich fuer jede numerisch verschiedene Deckung.

Weitere Einordnung:

- `alphaRezepte()` liest die vorhandenen Werkbank-Rezepte per Bauform aus dem Modern-Block
  (`:219-236`). Eine heutige Fallliste wird nicht dupliziert.
- Aendert sich das zugrunde liegende Token, aendert sich auch der kanonische Rezeptwert; die alte
  Klara-Farbe faellt dann aus der Rezeptmenge.
- Die Hauptknopf-Ausnahme `#E8630A/0.45` ist farblich sauber an `--kw-brand` gebunden
  (`:259-275,1166-1172`). Die Farbe kann nicht zu einem zweiten Orangeton driften.
- Die Ausnahme ist allerdings nicht an den Selektor `button.primary` gebunden. Derselbe
  Alpha-Farbwert koennte kuenftig an einer anderen Stelle verwendet werden und wuerde die
  Ausnahme ebenfalls als benutzt markieren (`:686-689`). Das ist kein Farbbypass, aber die
  Begruendung ist weiter gefasst als ihr Text.

### F4 - Inline-Erfassung deckt nur doppelt zitierte Attribute ab

Verdikt: GELB, G1-Inlinegrenze nur teilweise geschlossen

Die Entscheidung "einbeziehen statt verbieten" ist fachlich ueberzeugend: Ein Inline-Wert wird
nicht nur auf Palettenzugehoerigkeit geprueft, sondern kann als Text-/Flaechenpaar gemessen werden.
Der heutige Inline-Stil `color: var(--muted)` wird dadurch erstmals erfasst.

Die Umsetzung ist fuer die bestehende Schreibweise korrekt:

- `baue()` sammelt alle vom Markupparser gelieferten Inline-Stile (`:515-530`).
- `farbfunde()` prueft deren Farbliterale (`:533-550`).
- `kontrastPaare()` nimmt Inline-`color` als Quelle auf (`:969-980`).
- Die Sonde mit `style="color: #123456;"` ist ein realer roter Test (`:1238-1248`).

Der Attributparser `attribut()` akzeptiert jedoch ausschliesslich doppelte Anfuehrungszeichen
(`:391-394`). Gueltiges HTML wie

```html
<span style='color: #123456'>...</span>
```

wird nicht als Inline-Stil erfasst. Dass der Tag-Tokenizer selbst einfache Anfuehrungszeichen
vertraegt (`:411`), schliesst diese Luecke nicht; der nachgelagerte Attributleser verwirft den Wert.
Unzitierte gueltige Attribute waeren ebenfalls ausserhalb.

Auflage:

Attributwerte fuer einfache und doppelte Anfuehrungszeichen lesen oder die erlaubte
Attributschreibweise mit einem separaten roten Guard festschreiben.

### F5 - Violett ist nur bei direkten Literalen selektorgebunden

Verdikt: GELB, G3 weitgehend, aber nicht strukturell geschlossen

Was traegt:

- `kiFreigabe()` bindet eine direkte Violett-Fundstelle exakt an den angegebenen Selektor und
  verlangt einen Grund mit mehr als 40 Zeichen (`:649-660`).
- Jede nicht freigegebene direkte Fundstelle bleibt rot (`:755-767`).
- Ein Eintrag ohne verwendete Violett-Fundstelle wird als Leiche gemeldet (`:768-773`).
- Die Zweitstellen-Sonde fuegt eine erlaubte `.ki-hinweis`-Textfarbe und daneben eine nicht
  erlaubte `.zweite-stelle`-Rahmenfarbe ein. Sie erwartet genau einen Violett-Befund
  (`:1256-1268`). Der saubere Einzelfall, die Leiche und ein zu kurzer Grund sind ebenfalls
  getrennt gepinnt (`:1270-1285`).

Was nicht traegt:

`farbfunde()` ordnet ein Farbliteral dem Ort seiner Deklaration zu. Bei einer ueblichen
Custom-Property steht das Violett aber in `:root`, waehrend die eigentliche Verwendung nur
`color: var(--ai)` enthaelt. Die Farbwertsuche sieht dann:

- eine Violett-Fundstelle bei `:root`,
- an der echten KI-Stelle lediglich einen Variablenverweis ohne Farbliteral.

Wird `:root` freigegeben, kann dieselbe Variable danach an beliebig vielen nicht benannten Stellen
verwendet werden, ohne weitere Violett-Fundstelle. Wird `:root` nicht freigegeben, kann ein sauber
tokenisierter kuenftiger KI-Indikator nicht gruen werden. Die aktuelle Sonde umgeht diese
Architekturfrage, indem sie das Violett direkt im Zielselektor wiederholt.

Auflage:

Violett-Freigaben muessen aufgeloeste Variablenverwendungen pro Zielselektor pruefen, nicht nur den
Ort des Literals.

## 1. Kaskadenaufloesung und aktuelle Sicherheit

Verdikt: aktueller Stand GRUEN, dauerhafte G2-Garantie GELB

Fuer den heutigen Stilblock ist die Quellreihenfolge zufaellig ausreichend:

- `.lang button.active` steht nach `.lang button` und gewinnt auch im Browser.
- `.tabs button.active` steht nach `.tabs button`.
- `.src-badge-validiert` und `.src-badge-pruefung` stehen nach `.src-badge`.
- Die aktuellen deckenden Hintergrundregeln konkurrieren nicht mit spaeteren Regeln hoeherer oder
  niedrigerer Spezifitaet.
- Die aktuellen `background`-Regeln mischen innerhalb derselben Regel nicht Shorthand und
  `background-color`.

Damit wird der heute von der Hand beschriebene falsche 1,31:1-Fall des Sprachknopfs korrekt
vermieden. Die aktive Regel gewinnt sowohl nach realer Spezifitaet als auch nach der vereinfachten
letzten-Quellregel.

Die Aufloesung ist aber nicht allgemein konservativ genug: F1/F2 zeigen einen spaeter moeglichen
echten roten Hintergrundfall, der ohne Befund gegen die falsche Flaeche gemessen werden kann.

Zustandsselektoren werden ehrlich nur begrenzt behandelt:

- Ein unlesbarer Pseudo-/Attributselektor mit eigener `color`-Regel erzeugt ohne Ausnahme einen
  Befund (`:983-999`).
- `button.primary:disabled` setzt nur `opacity` und besitzt die benannte WCAG-Ausnahme
  (`:277-290,942-955`).
- Zustandsbedingte Hintergruende ohne eigene `color`-Deklaration koennen dagegen ausserhalb des
  Modells bleiben. Das ist im Dateikopf als Computed-Style-Grenze benannt, unterstreicht aber, dass
  der neue Sammler keine vollstaendige Browserkaskade beweist.

## 2. Achtzehn Quellen und dreizehn Paare

Verdikt: GRUEN fuer die heutige Abdeckung

Es sind nicht fuenf farbsetzende Stellen verloren gegangen. Alle 17 `color`-Regeln im
`<style>`-Block plus der eine Inline-Stil werden ueber `erreicht` nachgewiesen
(`:1302-1314`). Nicht gemessene und nicht befreite Quellen lassen den Test rot werden.

Die Differenz zwischen 18 Quellen und 13 eindeutigen Paaren entsteht durch Zusammenfassung
identischer Vorder-/Hintergrundkombinationen:

- `.brand small` und `.lang button` teilen `--shell-muted` auf `--ink`.
- `.lang button.active` und `button.primary` teilen `--surface` auf `--brand-deep`.
- `.muted`, `.src-badge` und der Inline-Stil teilen `--muted` auf `--surface`.
- `.status.ok` und `.src-badge-validiert` teilen das positive Trust-Paar.
- `.status.warn` und `.src-badge-pruefung` teilen das Warn-Paar.

Zugleich erzeugt `.muted` wegen verschiedener Fundstellen zwei Paare:
`--muted` auf `--surface` und `--muted` auf `--warn-bg`. Daher ist 18 minus 13 keine einfache Liste
von fuenf Ausnahmen.

Die einzige `REGEL_AUSNAHME`, `button.primary:disabled`, setzt keine Textfarbe und gehoert nicht zu
den 18 Quellen. Sie behandelt nur die unveraenderte Opazitaetsabschwachung. Unbenutzte
Farb-, Alpha-, Regel- und KI-Ausnahmen werden jeweils rot (`:776-789,1057-1063,768-773`).
Werkbank-Alpha-Rezepte haben bewusst keine Leichenregel, weil sie extern aus `themes.css` gelesen
und nicht in diesem Test als lokale Freibriefe gepflegt werden. Diese Einordnung ist tragfaehig.

Eine neue einfache, lesbare `color`-Regel wird automatisch aufgenommen. Eine Regel ohne
Markupfundstelle faellt konservativ gegen alle bekannten deckenden Flaechen
(`:1017-1027`); die Sonde `spaeter-erzeugt` pinnt diesen Weg (`:1366-1374`). Pseudo-, Attribut- und
Kombinatorselektoren werden nicht automatisch verstanden, aber bei eigener `color`-Deklaration
wenigstens rot statt still.

## 3. Alpha-Bindung

Verdikt: GELB wegen F3

Die Grundidee traegt:

- Werkbank-Rezepte werden aus `themes.css` ermittelt, nicht lokal fallweise aufgeschrieben.
- Die Hauptknopf-Ausnahme bindet die Basisfarbe an `--kw-brand`.
- Unbenutzte Alpha-Ausnahmen werden rot.
- Die vorhandenen roten Alpha-Sonden pruefen echte Mutationen und sind nicht tautologisch.

Nicht vollstaendig getragen wird nur die absolute Aussage jeder numerisch verschiedenen
Alpha-Drift sowie die ortsgenaue Begruendung der einen Ausnahme.

## 4. Inline-Stile

Verdikt: GELB wegen F4

Einbeziehen ist gegenueber einem blossen Literalverbot die fachlich staerkere Entscheidung. Fuer
die im Produkt einheitlich verwendeten doppelt zitierten Attribute funktioniert die Kette aus
Farbpruefung und Kontrastpaar. Eine kuenftige einfache oder unzitierte Attributschreibweise kann
sie jedoch umgehen; ohne einen Schreibweisen-Guard ist die allgemeine Zukunftszusage zu breit.

## 5. Violett

Verdikt: GELB wegen F5

Die direkten Sonden schliessen den von sammel42 konkret gemeldeten globalen
`KI_STELLEN.length`-Fehler. Die Selektivitaet ist fuer direkte Literale real. Fuer die im Panel
sonst konsequent genutzte CSS-Variablenbauform ist sie nicht pro Verwendung durchgesetzt und damit
noch nicht dauerhaft geschlossen.

## 6. Ehrlichkeit der Grenzen

Verdikt: GELB

Positiv:

- Der Dateikopf sagt explizit, dass Browser-Voreinstellungen, Vererbung in Elemente ohne eigene
  Farbregel und Zustands-/Pseudo-Regeln dem spaeteren Computed-Style-Pin vorbehalten bleiben
  (`:44-53`).
- Nicht-Text-Kontraste werden ausdruecklich ausgeschlossen.
- Unbekannte Farbwoerter werden nicht still ignoriert, sondern durch
  `unbekannteFarbwoerter()` gemeldet (`:553-628`).

Ueberbehauptung:

Die Kommentare nennen "Kaskade = Quellreihenfolge" und sprechen davon, welche Farbregel gewinnt
(`:801-808,894-910`). Das ist keine vollstaendige CSS-Kaskade. Die allgemeine Computed-Style-Grenze
entschaerft diese falsche technische Zusicherung nicht. Der Bericht sollte stattdessen klar sagen,
dass nur bei den heutigen einfachen, gleichartig geordneten Selektoren die Gewinner korrekt
bestimmt werden.

## 7. Sind G1, G2 und G3 geschlossen?

| Auflage | Urteil | Grund |
|---|---|---|
| G1 Alpha und Inline | GELB | Relevante Alpha-Drift und doppelt zitierte Inline-Stile sind erfasst; Vierstellen-Rundung und weitere gueltige Attributformen bleiben offen. |
| G2 automatische Kontrastpaare | GELB | Heutige 18 Quellen sind vollstaendig; Spezifitaet sowie Shorthand-/Longhand-Reihenfolge koennen spaetere echte Rotfaelle verdecken. |
| G3 selektives Violett | GELB | Direkte Literale sind selektiv; Custom-Property-Verwendungen sind nicht pro Zielselektor gebunden. |

Damit sind die konkreten mega43-Sonden verbessert, die dauerhaften Zusicherungen aber noch nicht
vollstaendig geschlossen.

## 8. VIP-Aufgaben und Ship-Ruling

Der Produktcode ist seit mega43 unveraendert. Deshalb gilt fuer alle sieben Aufgaben:

1. Anmelden und umsehen: kein Einfluss.
2. Wissen erfassen und einreichen: kein Einfluss.
3. Eine Frage stellen und ihr vertrauen oder nicht: kein Einfluss.
4. Etwas in der Bibliothek wiederfinden: kein Einfluss.
5. Ein Word-Dokument hineinbringen: kein Einfluss; der bekannte Bildverlust bleibt eigener Scope.
6. Klara in Word: das bereits als auslieferbar bewertete Werkbank-Design bleibt unveraendert.
7. Eigenes Urteil: Quellen-, Status- und Bedienlogik bleiben unveraendert.

Ship-Ruling:

Gegen die Auslieferung des aktuellen Produktstands am Donnerstag spricht aus dieser Runde nichts.
Es gibt keinen neuen Produkt-, Funktions- oder aktuellen Kontrastbefund. Das GELB betrifft
ausschliesslich die noch zu weit formulierte Dauerhaftigkeitsgarantie des Pruefwerkzeugs.

## Read-only-Nachweis

- Kein Produktcode geaendert.
- Keine bestehende Datei geaendert.
- Genau dieser eine Bericht wurde erzeugt.
- Kein Build ausgefuehrt.
- Keine Test-Suite ausgefuehrt.
- Keine Anwendung gestartet.
- Kein Commit erzeugt.
- Kein Push ausgefuehrt.
- Jira weder gelesen noch geschrieben.
- Index-SHA vor und nach der Pruefung:
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- Produktdiff-SHA vor und nach der Pruefung:
  `c910a62e34c246118479c3e17cfb9b4e8b74b17c73dd6cc58dbb2ba045d4229b`.
- Status-SHA vor und nach der Pruefung:
  `ce9807bf5606cf8c087d31fba13d069d74f935ba22761231b7cb8a066a8fe57c`.

GESAMTVERDIKT: GELB
SHA-256: abb43da55b418a717eb31749de1f0dfdbe9d12a44c0bf369e3d81cae46060056
