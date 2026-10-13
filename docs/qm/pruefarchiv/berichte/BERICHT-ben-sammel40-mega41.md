# BERICHT-ben-sammel40-mega41 - Gegenpruefung Kontrastfix mega41

Datum: 2026-07-28
Pruefbasis: `d3fe69d` plus kumulativer Arbeitsstand mega26-mega41
Auftrag: `_relay/ben/inbox/AUFTRAG-ben-sammel40-mega41.md`
Gepruefte Aenderung von mega41: `apps/web/src/styles/modern.css` und `tests/app/mega40-kontrast-modern.test.ts`
Pruefart: streng read-only; keine Tests und kein Build ausgefuehrt

## Kurzfazit

Die eigentliche Kontrastkorrektur ist fachlich richtig: Im modern-Thema wird `bg-brand text-white`
auf `--kw-funke-deep` gelegt; Weiss gegen `#C2500A` erreicht 4,72:1. Die aktive Nav-Badge wird
aktuell korrekt invertiert als weisse Papierflaeche mit Funke-dunklem Text dargestellt. Die sechs
bekannten Textflaechen und die zwei zusaetzlich gefundenen Abschwaechungen werden damit im heutigen
Quellstand auf AA gehoben. Classic bleibt durch die durchgaengige Klammer
`[data-theme="modern"]` unberuehrt.

Ein uneingeschraenktes Ship-GRUEN ist dennoch nicht belegt. Es bleiben zwei eng begrenzte, aber reale
Punkte: Die pauschale `opacity: 1`-Regel beseitigt einen vorhandenen Hover-Zustand, und die fuer die
Badge sicherheitskritische Kaskadenreihenfolge ist entgegen dem Bericht nicht durch einen wirksamen
Test gepinnt. Daher lautet das Gesamtverdikt GELB.

## 1. Block A - CSS-Bauform

### 1.1 GRUEN - Kontrastentscheidung und aktuelle Fundstellen

- `apps/web/src/styles/modern.css:60-62` setzt nur im modern-Thema die Kombination
  `.bg-brand.text-white` auf `--kw-funke-deep`.
- Der Token ist in `apps/web/src/styles/themes.css:114` als `194 80 10` (`#C2500A`) definiert.
- Die WCAG-Rechnung in `tests/app/mega40-kontrast-modern.test.ts:99-120` ergibt fuer Weiss gegen
  diesen Ton 4,72:1; der Kontrollpin steht in Zeile 961.
- Die Klassenkombination erreicht die sechs heutigen Texttraeger: Sidebar-Navigation
  (`Sidebar.tsx:156`), Rollenumschalter (`:240`), Topbar-Zahl (`Topbar.tsx:143`), aktiver
  Paletten-Treffer (`CommandPalette.tsx:121`) sowie Facettenzaehler und Filteraktion
  (`FacetFilter.tsx:195,372`).
- Rein grafische `bg-brand`-Flaechen ohne `text-white` bleiben auf dem hellen Funke. Das ist fuer den
  aktuellen Bestand die richtige Trennung.

### 1.2 GELB - Deckkraftregel uebergreift einen vorhandenen Hover-Zustand

`apps/web/src/styles/modern.css:66-70` setzt nicht nur abgeschwaechte Textkinder, sondern auch das
Flaechenelement selbst und ausnahmslos jeden Nachfahren auf `opacity: 1`:

```css
[data-theme="modern"] .bg-brand.text-white,
[data-theme="modern"] .bg-brand.text-white * {
  color: rgb(255 255 255);
  opacity: 1;
}
```

Das kollidiert aktuell mit `apps/web/src/components/FacetFilter.tsx:372`, wo der Aktionsknopf
bewusst `hover:opacity-95` traegt. Die neue Regel hat mit Attribut plus zwei Klassen eine hoehere
Spezifitaet als Tailwinds Hover-Utility und haelt die Opazitaet auch im Hover bei 1. Der vorhandene
Hover-Hinweis ist damit im modern-Thema wirkungslos. Das ist eine kleine, aber reale sichtbare
Regression und widerspricht der Aussage, es werde kein Verhalten beziehungsweise keine Interaktion
veraendert.

Zudem ist der Universalselektor fuer fremde Kinder breiter als die dokumentierte Absicht. Aktuell
entsteht daraus ausser dem Hover-Verlust kein weiterer belegter Produktfehler: Die Nav-Badges werden
spaeter invertiert, die Icon-Kachel ist eine eigene grafische Flaeche, und die beiden abgeschwaechten
Textkinder sollen gerade auf volle Deckkraft gehoben werden. Als Bauform ist `* { opacity: 1 }`
trotzdem zu grob, weil kuenftige semantische Kinder, Disabled-/Hover-Zustaende oder fremde
Komponenten mit eigener Opazitaet ebenfalls ueberschrieben wuerden.

Knappe Nacharbeit: `opacity: 1` nicht auf das Flaechenelement und nicht pauschal auf `*` legen,
sondern die tatsaechlichen Abschwaechungs-Bauformen gezielt behandeln, insbesondere
`.text-white/70` und `.opacity-90`. Der Hintergrund- und Grundtext-Fix kann unveraendert bleiben.

### 1.3 GRUEN - Classic bleibt unveraendert

Alle drei neuen Regeln beginnen mit `[data-theme="modern"]`. Der unveraenderte Invarianz-Sammler in
`tests/app/mega40-theme-invarianz.test.ts:152-189` verwirft jede Regel ausserhalb dieser Klammer und
ist fuer diese neue CSS-Struktur aussagekraeftig. Ohne `data-theme="modern"` greift keine der drei
Regeln; classic bleibt damit quellenlogisch pixelgleich. Ich habe den Test auftragsgemaess nicht
noch einmal ausgefuehrt.

## 2. Badge und Mess-Ehrlichkeit

### 2.1 GRUEN - Aktuelle Badge-Loesung und konservative Alt-Messung

- `modern.css:86-89` macht `bg-white/20 text-white` deckend weiss und setzt den Text auf
  `--kw-funke-deep`. Das ergibt 4,72:1 gegen `--kw-surface` und erhaelt die Pille sichtbar auf der
  dunklen aktiven Nav-Zeile.
- Der statische Sammler kann den aufrufenden `NavRow` wegen der Komponentengrenze nicht als
  Untergrund der Badge sehen. Seine Papier-Annahme erzeugt fuer den alten Weiss-Schleier deshalb
  konservativ 1,05:1. Diese Annahme kann einen roten Fall nicht gruen rechnen: Heller Text auf der
  angenommenen hellen Flaeche wird besonders streng bewertet.
- Der reale Altfall ist separat in `mega40-kontrast-modern.test.ts:968-975` modelliert: Weiss auf
  20 Prozent Weiss ueber Funke-dunkel ergibt 3,42:1. Die Trennung zwischen konservativer
  Sammler-Meldung und realer Kontrollrechnung ist ehrlich.
- Eine neue `bg-white/NN`-Badge wird vom Roh- und AST-Scan erfasst. Fuer andere Alpha-Stufen ohne
  Heilregel zeigt die Kalibrierung mit `bg-white/25` rot.

### 2.2 GELB - Reihenfolge der Badge-Regel ist nicht wirksam gepinnt

Der Kommentar in `modern.css:83-84` beschreibt korrekt eine echte Kaskadenabhaengigkeit:
`.bg-brand.text-white *` und `.bg-white/20.text-white` haben im relevanten Fall gleiche
Spezifitaet; die spaetere Badge-Regel muss gewinnen. Wird sie oberhalb der Nachfahrenregel
verschoben, wird der Badge-Text im realen DOM wieder weiss auf weisser Flaeche.

Der vorhandene Test verhindert diese Umsortierung jedoch nicht:

- Die Produkt-Badge wird in einer eigenen React-Komponente definiert; der AST-Sammler beendet die
  Verfolgung an fremden Komponenten (`mega40-kontrast-modern.test.ts:663-667`). Beim separaten Scan
  der Badge-Funktion kennt er den `bg-brand text-white`-Vorfahren daher nicht.
- Die geheilte Probe `Text 4` in Zeilen 984-1020 liegt direkt in einem `bg-surface`-Container und
  ebenfalls nicht als Kind einer `bg-brand text-white`-Flaeche.

Eine reine Umsortierung der beiden CSS-Regeln koennte deshalb den Produktionskontrast der aktiven
Nav-Badge brechen, waehrend die bestehende Kalibrierprobe weiter gruen bleibt. Das ist genau die im
Auftrag abgefragte stille Kippkante.

Knappe Nacharbeit: Eine verschachtelte Probe aufnehmen, bei der
`bg-white/20 text-white` tatsaechlich Kind eines `bg-brand text-white`-Elements ist, und deren
Kontrast ueber denselben Sammler pruefen. Alternativ zusaetzlich die erforderliche Regelreihenfolge
explizit pinnen; die verschachtelte Verhaltensprobe ist aussagekraeftiger.

## 3. Sammler-Qualitaet

### 3.1 GRUEN - Aktuelle Abdeckung und Zweig-Paarung

- Der Roh-Scan findet im aktuellen Bestand 19 Zeilen der beiden Bauformen. Die manuelle
  Gegenzaehlung ueber `apps/web/src` ergibt dieselben 19 Stellen: neun in `Sidebar.tsx`, zwei in
  `Analytics.tsx`, je eine in `Capture.tsx`, `Lifecycle.tsx`, `CommandPalette.tsx` und
  `Topbar.tsx`, zwei in `FacetFilter.tsx` sowie je eine in `ImportJsonUpload.tsx` und
  `CaptureFileImport.tsx`.
- Die AST-Abdeckung prueft in `mega40-kontrast-modern.test.ts:911-917`, dass jede Rohzeile einen
  AST-Fund besitzt. Fuer den heutigen Quellstand ist 19 gegen 19 plausibel und deckungsgleich.
- Die Zweigmarken `#t/#f` und `widerspricht()` in Zeilen 422-497 paaren die aktive Flaeche mit dem
  aktiven Textzweig. Der korrigierte Palettenwert 2,36:1 statt 2,03:1 aus dem falschen Zweig ist aus
  dem Codepfad nachvollziehbar.
- Die Ausnahmen sind auf exakte Datei- und Klassen-Signaturen begrenzt; unbenutzte Ausnahmen und
  Ausnahmen mit Text werden rot (`:934-957`). Fuenf Eintraege decken sechs grafische Fundstellen,
  weil Analytics dieselbe begruendete Balkenbauform zweimal verwendet.
- Die Kalibrierung prueft einen roten texttragenden Funke, eine rote unbekannte Alpha-Badge, eine
  geheilte Badge und eine rein grafische Flaeche. Sie ist fuer die modellierten Bauformen
  beweiskraeftig.

### 3.2 Grenzen - fuer Ship relevant eingeordnet

Die bekannten Grenzen sind im Testtext grundsaetzlich ehrlich benannt:

- Es ist eine statische Quelltextmessung, kein Browser-Computed-Style-Test.
- Fremde React-Komponenten werden nicht in den Elternpfad hinein verfolgt.
- Der Rohabgleich arbeitet zeilenweise; mehrere relevante Flaechen auf derselben Quellzeile waeren
  keine vollstaendige Mengen-Garantie.
- Die CSS-Auswertung bildet fuer die betrachteten Regeln die Kaskade ueber Dateireihenfolge ab, aber
  nicht die gesamte Browserkaskade mit allen moeglichen Selektorformen.

Diese Grenzen verhindern fuer den heutigen Bestand kein fachliches Urteil ueber die gemessenen
Flaechen. Die fremde-Komponenten-Grenze ist aber unmittelbar der Grund fuer die ungepinnte
Badge-Reihenfolge aus Punkt 2.2. Der nach Freitag vorgesehene Computed-Style-Pin bleibt sinnvoll und
unveraendert offen; er ist gemaess Auftrag nicht Voraussetzung dieser Scheibe.

## 4. Roter Lauf und zentrale Messwerte

Der im Hand-Bericht zitierte rote Lauf ist mit dem Testcode plausibel vereinbar:

- Ohne die drei CSS-Regeln fallen die sechs bekannten `bg-brand text-white`-Flaechen auf den hellen
  Funke zurueck.
- FacetFilter-Untertext mit `opacity-90` erreicht dann nur 3,00:1.
- Der aktive CommandPalette-Pfad mit `text-white/70` erreicht 2,36:1.
- Vier Badge-Varianten werden wegen der dokumentierten Papier-Annahme mit 1,05:1 rot.
- Die Kalibrierprobe `Los` ist ohne Heilregel ebenfalls rot, weshalb der zweite Fehler im zitierten
  Lauf logisch ist.

Die zentralen Werte stimmen mit den im Test implementierten WCAG- und Alpha-Formeln ueberein:
Weiss gegen `#C2500A` rund 4,72:1; Weiss gegen den alten hellen Funke rund 3,38:1; der reale
20-Prozent-Weiss-Schleier auf Funke-dunkel rund 3,42:1. Die zusaetzlichen 3,00:1 und 2,36:1 sind
wegen der jeweiligen 90-/70-Prozent-Abschwaechung erwartungsgemaess schlechter als 3,38:1.

Ich habe den roten Lauf und die gruene Suite nicht erneut ausgefuehrt; bewertet wurden der zitierte
Lauf, die Berechnungsfunktionen und die betroffenen Quellstellen.

## 5. Ehrlichkeits-Nachtraege H1

Die C1-Aussage ist korrekt begrenzt:

- `apps/web/src/App.tsx:27-32` gibt `/reset` und `/sso/callback` vor der `AppShell` zurueck.
- `App.tsx:37-41` gibt Ersteinrichtung und Login ebenfalls vor der Shell zurueck.
- `apps/web/src/main.tsx:10-12` ruft `initDesignTheme()` vor dem ersten React-Render auf.
- Der Umschalter sitzt nur in der Topbar; diese Auth-Oberflaechen haben daher keinen Umschalter,
  erhalten aber die global gesetzte Theme-Wahl und deren Token/CSS-Regeln.

Der Bericht behauptet fuer diese Oberflaechen nur Vererbung, nicht eine eigene Gestaltung. Der
mega40-Nachtrag, dass genau der Umschalt-Button als neues Element hinzugekommen war, ist ebenfalls
praeziser als die alte pauschale Aussage. Mega41 selbst aendert kein TSX und kein DOM.

## 6. Hermetik, Egress und Pruefmethode

Die beiden mega41-Dateien enthalten keine Netzwerk- oder Secret-Aufloesung: `modern.css` ist reine
Darstellung, der Test liest lokale Dateien mit `node:fs`, `node:path` und dem TypeScript-Parser.
Mega41 fuegt weder i18n-Schluessel noch einen Egress-Aufruf hinzu. Die im Hand-Bericht ausgewiesene
NUL-Korrektur ist methodisch ueberzeugend: `grep` mit einem NUL-Argument unter zsh war ungeeignet;
`LC_ALL=C tr -cd '\0' | wc -c` zaehlt die Bytes direkt, und eine NUL-haltige sowie eine NUL-freie
Kontrolle pruefen beide Richtungen.

Die Aussagen zu `KLARWERK_SKIP_KEYCHAIN`, Gesamttor, UI-Smoke und Egress-Ernte wurden als vorhandene
Hand-Evidence gelesen, nicht erneut ausgefuehrt. Im mega41-Diff ist kein neuer Codepfad erkennbar,
der diese Hermetik in Frage stellt.

## 7. Sieben Testeraufgaben in beiden Designs

1. Anmelden und umsehen: Classic bleibt unveraendert; modern erbt die Wahl auch auf Auth-Routen.
2. Wissen erfassen und einreichen: Kein TSX-/Vertragswechsel durch mega41; Kontrastfix wirkt nur auf
   die vorhandenen Akzentflaechen.
3. Eine Frage stellen und ihr vertrauen oder nicht: Keine funktionale Aenderung; Antwort- und
   Vertrauenslogik ist ausserhalb dieses CSS-Slices.
4. Etwas in der Bibliothek wiederfinden: Kontrast der Facetten ist verbessert, aber der vorhandene
   Hover-Hinweis des Filter-Aktionsknopfs ist im modern-Thema unterdrueckt.
5. Ein Word-Dokument hineinbringen: Kein Pfad oder Vertrag wurde durch mega41 geaendert.
6. Klara in Word: Kein Add-in-/Egress-/Antwortvertrag wurde durch mega41 geaendert.
7. Das eigene Urteil: Keine Aenderung an Status, Daten oder Aktionen; die Shell-Badges sind aktuell
   besser lesbar, ihre Kaskadenreihenfolge ist aber nicht regressionsfest gepinnt.

Damit spricht nichts gegen Pedis drei Handlaeufe als naechsten Verifikationsschritt. Fuer die
Auslieferung fehlt jedoch das uneingeschraenkte GO, bis der Hover-Regress und die stille
Badge-Reihenfolge-Kippkante mit der beschriebenen kleinen Nacharbeit geschlossen sind.

## No-op-Nachweis

- Produktcode geaendert: nein.
- Index geaendert: nein.
- Build ausgefuehrt: nein.
- Tests oder Anwendung ausgefuehrt: nein.
- Commit: nein.
- Push: nein.
- Jira: weder gelesen noch geschrieben.
- Secrets/ENV-Werte: nicht gelesen oder ausgegeben.
- Einzige Schreibaktion: dieser angeforderte Bericht in `_relay/ben/outbox/` samt SHA-Zeile.

GESAMTVERDIKT: GELB
SHA-256: 08dbbb370d8f02ea360bcdf32fada81029011533c04f27d41e62c704d5e2f447
