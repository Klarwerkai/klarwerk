# BERICHT-ben-sammel41-mega42 - Gegenpruefung der zwei Restpunkte

Datum: 2026-07-28
Pruefbasis: `d3fe69d` plus kumulativer Arbeitsstand mega26-mega42
Auftrag: `_relay/ben/inbox/AUFTRAG-ben-sammel41-mega42.md`
Gepruefter mega42-Scope: `apps/web/src/styles/modern.css` und `tests/app/mega40-kontrast-modern.test.ts`
Pruefart: streng read-only; keine Tests und kein Build ausgefuehrt

## Kurzfazit

Mega42 schliesst beide GELB-Punkte aus meinem Bericht zu mega41. Die Deckkraftkorrektur liegt nicht
mehr auf dem Markenflaechen-Element oder jedem Nachfahren; dadurch kann `hover:opacity-95` am
Filter-Aktionsknopf wieder wirken. Die neue verschachtelte Badge-Probe bildet den wirklichen
Kaskadenkonflikt ab und wird bei vertauschter Regelreihenfolge mit 1,00:1 rot.

Die verbleibenden Grenzen sind keine aktuellen Ship-Blocker: Der neue A2-Waechter ist ein enger
Bauformwaechter und kein vollstaendiger CSS-Parser; die bereits vorgesehene Browser-Computed-Style-
Haertung bleibt ausserhalb dieses Auftrags. Fuer den aktuellen Bestand sind Kontrast, Interaktion
und Kaskadenabsicherung hinreichend belegt. Mega41 plus mega42 ist aus dieser Gegenpruefung GRUEN.

## 1. Block A - Zweiteilung von Farbe und Deckkraft

### 1.1 GRUEN - Hover-Regress geschlossen

`apps/web/src/styles/modern.css:70-73` sichert weiterhin den vollen weissen Textton fuer
`.bg-brand.text-white` und dessen Nachfahren. `opacity: 1` wurde daraus entfernt.

Die Deckkraft liegt jetzt ausschliesslich auf den zwei benannten Nachfahren-Bauformen:

```css
[data-theme="modern"] .bg-brand.text-white .text-white\/70,
[data-theme="modern"] .bg-brand.text-white .opacity-90 {
  opacity: 1;
}
```

Damit trifft keine modern-Regel mehr das Markenflaechen-Element des Filterknopfs mit einer eigenen
Deckkraft. `apps/web/src/components/FacetFilter.tsx:372` traegt weiterhin
`hover:opacity-95`; Tailwinds Hover-Regel kann deshalb wieder greifen. Die fruehere Kollision
zwischen `(0,3,0)` und der Hover-Utility `(0,2,0)` ist beseitigt, weil auf dem Knopf aus
`modern.css` nun ueberhaupt keine `opacity`-Deklaration mehr anliegt.

Die Unterzeile in `FacetFilter.tsx:375` traegt dagegen `opacity-90` und wird als gezielter
Nachfahre weiterhin auf 1 gehoben. Genau dort ist die Regel beabsichtigt. Der Fix trennt damit
Interaktions-Deckkraft und Text-Abschwaechung sauber.

### 1.2 GRUEN - Breite Farbzusicherung verursacht aktuell keinen Zustandsverlust

Ich habe die heutigen `bg-brand`-Textflaechen und ihre sichtbaren Kinder nach
`hover:text-*`, `focus:text-*`, `focus-visible:text-*` und `disabled:text-*` geprueft. Auf den
sechs relevanten `bg-brand text-white`-Flaechen beziehungsweise ihren konkreten Textkindern liegt
keine solche Farb-Zustandsutility:

- Sidebar aktiver Navigationseintrag und Rollenumschalter,
- Topbar-Benachrichtigungszahl,
- aktiver CommandPalette-Treffer,
- Facettenzaehler und Filter-Aktionsknopf.

Der breite weisse Farbwert unterdrueckt im aktuellen Bestand deshalb keine vorhandene farbliche
Hover-, Focus- oder Disabled-Rueckmeldung. Die beiden abgeschwaechten Kinder sind der
CommandPalette-Pfad `text-white/70` und die FacetFilter-Unterzeile `opacity-90`; beide sollen gerade
auf AA gehoben werden.

Die Aussage ist nicht vollstaendig zukunftsfest gepinnt: Eine spaetere `hover:text-*`-Utility in
einer fremden Kindkomponente koennte vom breiten Nachfahrenselektor ueberstimmt werden, ohne dass
der Deckkraft-Waechter anschlaegt. Das ist kein aktueller Fehler und kein Blocker dieser engen
Scheibe. Die Kontrastmessung bleibt die fachliche Sicherung; ein spaeterer Browser-Computed-Style-
Test ist fuer solche Kaskaden die staerkere allgemeine Haertung.

### 1.3 GRUEN - Start-CTA bleibt ehrlich interaktiv

`modern.css:239-243` setzt fuer `.kw-cta-primary:hover` weiterhin `opacity: 1`. Das ist keine
Wiederholung des mega41-Fehlers:

- Die Regel zielt auf eine benannte Markerklasse im eigenen Hover-Zustand, nicht pauschal auf jede
  Markenflaeche oder jeden Nachfahren.
- Im selben Hover-Regelblock liefern `transform: translateY(-1px)` und ein staerkerer
  `box-shadow` die sichtbare Rueckmeldung.
- Die Opazitaet wird dort bewusst stabil gehalten, damit die AA-Textflaeche nicht wieder
  abgeschwaecht wird.

Transform plus Schatten sind fuer diesen konkreten CTA eine tragfaehige Ersatzrueckmeldung. Ich
verlange nicht, dass der enge A2-Waechter diese Markerregel verbietet; daraus entsteht keine neue
Auflage.

## 2. A2-Waechter

### 2.1 GRUEN - Er erkennt die zwei verbotenen Altformen

`tests/app/mega40-kontrast-modern.test.ts:1107-1162` zerlegt die modern-Regeln in einzelne
Selektor-/Deklarationspaare. Komma-Selektoren werden einzeln bewertet. Fuer jede Regel mit
`opacity` wird der letzte Selektorverbund betrachtet:

- Ziel `*` wird als pauschaler Nachfahrenzugriff gemeldet.
- Ein Zielverbund mit `bg-brand` oder `bg-brand/NN` wird als Deckkraft auf dem
  Markenflaechen-Element gemeldet.

Die Kalibrierung in Zeilen 1174-1189 ist beweiskraeftig fuer den beauftragten Fehler: Die alte
Komma-Regel erzeugt genau zwei Meldungen, die gezielte `.opacity-90`-Regel keine, und eine reine
Farbregel ohne Deckkraft ebenfalls keine. Ein Rueckbau auf die alte mega41-Form wird damit rot.

### 2.2 Ehrliche Grenze - kein allgemeiner CSS-Parser, aber kein Ship-Blocker

Die Erkennung arbeitet absichtlich syntaktisch einfach. Normale Kommalisten und einfache
Nachfahren-, Kind-, Geschwister- und Klassenverbunde werden fuer die aktuelle Datei ausreichend
aufgeloest. Funktionale Pseudo-Klassen mit internen Kommas, CSS-Nesting oder exotische
Universalselektoren mit Pseudo-Anhang waeren keine vollstaendig abgesicherte Sprache; auch ein
Ziel wie `:is(.bg-brand)` wird nicht wie ein echter CSS-Parser normalisiert.

Diese Grenze macht die aktuelle Kalibrierung nicht falsch: Die beiden verbotenen Formen, die den
realen Fehler erzeugt hatten, werden strukturell gefunden. Eine pseudo-spezifische Regel wie
`.kw-cta-primary:hover` ist zudem gerade keine pauschale Stilllegung, sondern eine benannte
Zustandsregel. Fuer die heutige CSS-Datei reicht der enge Zuschnitt. Ich fordere fuer diesen Ship
keinen Ausbau zu einem vollstaendigen Selektorparser.

## 3. Block B - verschachtelte Badge-Probe

### 3.1 GRUEN - Kippkante jetzt wirksam gepinnt

Die Probe in `mega40-kontrast-modern.test.ts:1041-1051` stellt
`bg-white/20 text-white` tatsaechlich als Kind eines `bg-brand text-white`-Elements dar. Sie laeuft
ueber denselben Pfad wie Produktflaechen:

`scanneQuelle` -> `wirksameFlaeche` -> `messeTexte`.

Die Assertions belegen zusaetzlich, dass beide Flaechen gefunden werden, die Badge einen
`bg-brand`-Vorfahren besitzt und fuer die Markenflaeche als eigene Deckflaeche behandelt wird.
Damit muessen sowohl die breite Nachfahren-Farbregel als auch die spaetere Badge-Regel in
Dateireihenfolge ausgewertet werden.

Wird die Badge-Regel vor die Nachfahrenregel verschoben, gewinnt im Modell der spaetere weisse
Nachfahrenton: weisser Text auf der durch die Badge-Regel weissen Flaeche ergibt 1,00:1. Der im
Hand-Bericht zitierte rote Lauf passt exakt zu dieser Kaskade. Meine fruehere stille Kippkante ist
damit geschlossen.

### 3.2 GRUEN - Verhaltensprobe ist besser als ein Zeilen-Pin

Ein zusaetzlicher Test auf die reine Quelltextreihenfolge ist nicht erforderlich. Die
Verhaltensprobe misst das Ergebnis und wuerde auch dann rot, wenn eine dritte spaetere Regel den
Text erneut auf Weiss setzt. Ein Index- oder Zeilenvergleich waere gegen harmlose Umformulierungen
bruechiger und fachlich schwaecher.

Dass im ersten Anlauf zunaechst die Farbidentitaet statt des Kontrastfehlers meldete, ist kein
Warnsignal. Die endgueltige Assertionsreihenfolge stellt die fachlich staerkere Aussage
`messeTexte(...)` zuerst. Der Kommentarwert wurde auf den tatsaechlich gemessenen Wert 1,00:1
korrigiert. Das ist ein sauber dokumentierter Kalibrierungsprozess.

## 4. Messwerte und Ehrlichkeit

Die Korrektur von 13 Fundstellen zu 13 Flaechen mit 15 Textknoten ist richtig. Zwei Flaechen tragen
je zwei getrennte Textknoten: der FacetFilter-Aktionsknopf und der aktive CommandPalette-Treffer.

Stichproben:

- FacetFilter-Unterzeile: `opacity-90` multipliziert den geerbten Zustand zunaechst mit 0,9; die
  gezielte CSS-Regel auf genau diesem Kind setzt die wirksame Opazitaet wieder auf 1. Der Wert
  bleibt dadurch 4,72:1, obwohl der Elternknopf keine Deckkraftregel mehr erhaelt.
- CommandPalette-Pfad: `text-white/70` speichert die Abschwaechung im Farbalpha. Die breite
  Farbzusicherung setzt auf diesem Nachfahren `rgb(255 255 255)` mit Alpha 1. Die zusaetzliche
  Deckkraftregel fuer `.text-white/70` ist aktuell ein dokumentierter No-Op, der Messwert bleibt
  dennoch nachvollziehbar 4,72:1.
- `CaptureFileImport.tsx:106` und `ImportJsonUpload.tsx:85` verwenden `bg-brand/5` mit dunklem
  `text-text` und messen plausibel 14,23:1.
- Die Empfehlungs-Pille `Capture.tsx:5133` ist eine 20-Prozent-Weissflaeche auf dunklem
  `bg-ink`-Kontext mit hellem Text; 9,66:1 ist fuer diese Kombination plausibel.

Die Vorher-/Nachher-Listen stammen aus der dokumentierten temporaeren Diagnose und sind nicht als
Dauerassertion im Test hinterlegt. Fuer die zwei kritischen Mechaniken existieren jedoch bleibende
Tests: die gesamte AA-Messung sowie die verschachtelte Badge-Probe. Die Praezisierung im
Hand-Bericht ist ehrlicher als die ungenaue Ausgangsformel und erzeugt keinen neuen Befund.

## 5. Hermetik, Egress und Scope

Die beiden mega42-Dateien enthalten keine URL, keinen `sendBeacon`, keinen WebSocket, kein
`XMLHttpRequest` und keine Secret-/Keychain-Aufloesung. `modern.css` ist reine Darstellung; der
Test liest lokale Dateien und fuehrt lokale AST-/Farb-Berechnungen aus. Mega42 aendert kein TSX,
kein i18n und keinen Servicepfad.

Die Egress-Ernte im Hand-Bericht besitzt diesmal Positivproben fuer URL und `sendBeacon`; ihre
unveraenderten Treffer stammen aus aelteren Testfixtures beziehungsweise expliziten Egress-Sperren.
Die `KLARWERK_SKIP_KEYCHAIN`-Disziplin und der Abschlusslauf ohne von aussen gesetzte Variable sind
als Hand-Evidence nachvollziehbar. Ich habe diese Laeufe auftragsgemaess nicht wiederholt und keine
ENV- oder Secret-Werte gelesen.

Die verschachtelte Badge ist nur ein String in der Testdatei. Es gibt keine neue Sonde im
Produktbaum und keine zusaetzliche Produktdatei.

## 6. Sieben Testeraufgaben in beiden Designs

1. Anmelden und umsehen: Classic bleibt unveraendert; modern erbt die Theme-Wahl und hat lesbare
   aktive Shell-Elemente.
2. Wissen erfassen und einreichen: Kein TSX- oder Vertragswechsel; die modern-Akzenttexte bleiben
   AA-konform.
3. Eine Frage stellen und ihr vertrauen oder nicht: Keine Aenderung an Antwort-, Beleg- oder
   Vertrauenslogik.
4. Etwas in der Bibliothek wiederfinden: Facettenzaehler und Filteraktion bleiben lesbar; der von
   mega41 verlorene Hover-Hinweis des Aktionsknopfs ist wiederhergestellt.
5. Ein Word-Dokument hineinbringen: Kein Import-, Anhang- oder Verarbeitungsvertrag ist betroffen.
6. Klara in Word: Kein Add-in-, Egress- oder Antwortpfad ist betroffen.
7. Das eigene Urteil: Die Shell-Badges sind lesbar und ihre Kaskadenreihenfolge ist nun durch eine
   echte Verhaltensprobe abgesichert.

Fuer keine dieser sieben Aufgaben ist aus mega42 ein funktionaler, sicherheitsrelevanter oder
belegter visueller Blocker offen. Der Stand kann in Pedis drei Handlaeufe und anschliessend in die
Auslieferung gehen.

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

GESAMTVERDIKT: GRUEN
SHA-256: ce3ae5b5c44357498bde8cd28fac4cc1b5af037deca612bb51328438ed9a72bc
