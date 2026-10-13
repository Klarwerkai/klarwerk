# BERICHT-ben-sammel42-mega43 - Gegenpruefung Klara im Werkbank-Design

Datum: 2026-07-28
Repo: `/Users/peterkohnert/Documents/dev_Klarwerk`
Basis: `5150cd5a0e4a6c6bb5e2fe3fdce8a02329bb7af5`
Auftrag: `_relay/ben/inbox/AUFTRAG-ben-sammel42-mega43.md`
Auftrags-SHA-256: `8bd5043a8acf9018aeb7d9a5f3045cff97a195f11dab3236c044f05a0c1d77f8`

## Kurzurteil

Der aktuelle Produktstand ist fuer die Auslieferung am Donnerstag geeignet: mega43 aendert am
Word-Panel ausschliesslich den Stilblock, erhaelt DOM, Texte und Verhalten bytegleich und fuehrt
keinen aktuellen Kontrastverstoss ein. Die sieben Testeraufgaben werden nicht beschaedigt; Aufgabe 6
profitiert sichtbar von der nun konsistenten Werkbank-Gestaltung.

Das formale Gesamturteil bleibt dennoch GELB. Drei als dauerhaft beschriebene Waechter sind
nachweislich enger als ihr Anspruch:

1. Der Farb-Sammler erkennt bei `rgba()` nur das RGB-Tripel und verwirft den Alphakanal.
2. Die Kontrastpruefung verwendet fuer Nicht-Trust-Flaechen eine manuelle Paarliste und laesst
   mindestens `h2` mit `--ink` auf `--surface` aus.
3. Eine kuenftig nichtleere `KI_STELLEN`-Liste wuerde Violett global freigeben, nicht nur am
   angegebenen Selektor.

Das sind keine aktuellen Live- oder VIP-Blocker, aber reale Luecken in der behaupteten
Drift-/Regressionsgarantie. Fuer ein vollstaendiges GRUEN muessen diese drei Testschaerfungen
nachgezogen werden.

## Befunde

### G1 - RGBA wird nicht zifferngleich geprueft

Verdikt: GELB

Beleg:

- `tests/app/mega43-klara-werkbank-palette.test.ts:104-118` normalisiert `rgb()` und `rgba()` nur
  auf `#RRGGBB`.
- `tests/app/mega43-klara-werkbank-palette.test.ts:182-203` erfasst zwar beide Schreibweisen,
  uebergibt aus `rgba()` aber nur die drei Kanaele R, G und B.
- Der sichtbare Wert `rgba(232, 99, 10, 0.45)` aus
  `apps/web/public/word-addin/taskpane.html:128` wird deshalb genauso behandelt wie derselbe Wert
  mit Alpha `0.05`, `0.90` oder `1`.
- Nur `--shadow-tile` besitzt zusaetzlich einen exakten Rezeptvergleich
  (`tests/app/mega43-klara-werkbank-palette.test.ts:312-325`). Der separate
  Hauptknopf-Schatten ist davon nicht erfasst.

Folge:

Die Aussage, jeder Farbwert werde "Ziffer fuer Ziffer" gebunden, ist fuer RGBA nicht vollstaendig.
Eine reine Alpha-Drift kann gruen bleiben. Hex und das RGB-Tripel von `rgba()` werden dagegen
bauformbasiert erkannt.

Zusaetzliche Grenze:

`stilBlock()` liest nur den `<style>`-Block (`tests/app/mega43-klara-werkbank-palette.test.ts:51-60`).
Ein spaeter direkt im HTML-Attribut eingefuehrtes Farbliteral wuerde den Sammler umgehen. Der
aktuelle Inline-Stil in `taskpane.html:304` referenziert lediglich `var(--muted)` und erzeugt daher
heute keine zweite Farbwahrheit.

Auflage:

RGBA als `{r,g,b,a}` bzw. kanonische RGBA-Zeichenkette pruefen und sichtbare Inline-Stile in dieselbe
Farbwertsuche einbeziehen oder durch einen eigenen Guard verbieten.

### G2 - Kontrastliste laesst eine aktuelle Textflaeche aus

Verdikt: GELB

Beleg:

- Die neun allgemeinen Paare stehen manuell in
  `tests/app/mega43-klara-werkbank-palette.test.ts:491-505`.
- Nur die Trust-Paare werden ueber eine Bauform abgeleitet
  (`tests/app/mega43-klara-werkbank-palette.test.ts:507-514`).
- `h2` traegt `color: var(--ink)` (`taskpane.html:115`) und steht in den Karten auf
  `background: var(--surface)` (`taskpane.html:103-112`).
- Das Paar `ink` auf `surface` fehlt in der Liste.

Der aktuelle Wert ist sicher: `#0E1626` auf `#FFFFFF` ergibt unabhaengig nachgerechnet
`18.081247:1`. Es liegt also kein aktueller WCAG-Verstoss vor. Die versprochene Aussage "alle
texttragenden Paare" ist aber nicht bewiesen; ein spaeterer Tokenwechsel koennte diese Flaeche
unbemerkt verschlechtern. Auch Browser-Defaults, Vererbung und effektive Zustandsstile bleiben bis
zum bewusst vertagten Computed-Style-Pin ausserhalb dieses Quelltexttests.

Auflage:

Mindestens `ink/surface` aufnehmen. Dauerhaft besser ist eine selektor-/bauformbasierte Ermittlung
aller Text-/Hintergrundpaare oder der bereits vorgemerkte Computed-Style-Pin.

### G3 - Violett-Ausnahme ist nicht selektorgebunden

Verdikt: GELB

Beleg:

- `KI_STELLEN` ist aktuell leer und als Liste aus Selektor und Grund angelegt
  (`tests/app/mega43-klara-werkbank-palette.test.ts:165-175`).
- Die eigentliche Pruefung fragt jedoch nur `KI_STELLEN.length === 0`
  (`tests/app/mega43-klara-werkbank-palette.test.ts:327-339`).
- Sobald eine einzige legitime KI-Stelle eingetragen wird, passiert jede violette Fundstelle im
  gesamten Stilblock diesen Waechter. Weder Selektor noch Grund werden gegen die konkrete
  Violett-Verwendung geprueft.

Aktueller Stand:

Das alte sichtbare `#5b50c4` ist aus dem Produktstil entfernt. Es kommt in `taskpane.html` nur noch
im erklaerenden Kommentar vor (`taskpane.html:22`), den der Sammler bewusst entfernt. In
`themes.css:52` bleibt derselbe Wert korrekt als `--kw-ai` erhalten. Der heutige Rueckfall auf
Violett wird bei leerer Liste erkannt.

Auflage:

Jede Violett-Fundstelle muss einem konkret benannten und begruendeten Selektor zugeordnet werden;
ungenannte Violett-Verwendungen muessen auch bei vorhandenen KI-Stellen rot bleiben.

## 1. Bindung an die Werkbank-Palette

Verdikt: GELB wegen G1 und G3; der heutige Stand selbst ist konsistent.

Was traegt:

- Die Palette wird nicht als Liste heutiger Taskpane-Faelle gepflegt. `farbwerte()` scannt alle
  passenden Hex- und Komma-`rgb/rgba`-Literale im Stilblock.
- Jede einzelne Farbvariable in Klaras `:root` benoetigt eine Kommentar-Anschrift
  `← --kw-...` (`tests/app/mega43-klara-werkbank-palette.test.ts:205-229,275-309`).
- Aendert sich ein referenziertes Web-Token, faellt der exakte Vergleich zwischen Klara-Wert und
  dem Wert aus `themes.css` rot aus. Die semantische Token-Zuordnung schuetzt dabei auch dann, wenn
  der alte Farbwert zufaellig noch an anderer Stelle in der Palette vorkommt.
- Das Schattenrezept `--shadow-tile` wird als Rezept und inklusive Alpha exakt normalisiert und
  verglichen.
- Die einzige Ausnahme `#A8560A` nennt `--kw-brand-text`, ist ausfuehrlich begruendet und wird
  gegen den Root-Wert sowie das Fehlen einer Modern-Ueberschreibung geprueft
  (`tests/app/mega43-klara-werkbank-palette.test.ts:143-162,288-303,421-427`).
- Unbenutzte Ausnahmen erzeugen einen Befund (`tests/app/mega43-klara-werkbank-palette.test.ts:341-347`).
- Die Kalibrier-Sonden fuer geaenderten Farbwert, andere RGB-Schreibweise, Violett-Rueckfall,
  fehlende Anschrift und Schatten-Drift greifen dieselbe `befunde()`-Funktion an, nicht eine
  Testattrappe (`tests/app/mega43-klara-werkbank-palette.test.ts:434-465`).

Was nicht vollstaendig traegt:

- Alpha ausserhalb des gepinnten Schattenrezepts ist nicht Teil der Identitaet.
- Inline-Farbliterale ausserhalb `<style>` sind nicht erfasst.
- Die kuenftige Violett-Freigabe ist global statt selektorgebunden.

## 2. Stil-Isolation und bestehende Klara-Suiten

Verdikt: GRUEN

Eigene Gegenprobe gegen `5150cd5`:

- Der Inhalt vom Dateianfang bis einschliesslich `<style>` ist byte-identisch.
- Der Inhalt ab `</style>` bis Dateiende ist byte-identisch.
- Beide `cmp`-Vergleiche lieferten Status 0.
- Der Rumpf ab `</style>` hat in beiden Staenden nach derselben Messung 106308 Bytes,
  42 `id`-Attribute, 37 `data-t`-Attribute, 46 `class`-Attribute und 86 oeffnende Elemente.
- Die abweichende absolute Rumpf-/Elementzahl gegenueber der Hand entsteht aus einer anderen
  Schnitt-/Zaehldefinition; fuer die Isolationsaussage ist das unerheblich, weil die staerkere
  Byteidentitaet belegt ist.

Die Zaehlungen allein koennten Text-, Attributwert- oder Skriptaenderungen mit gleicher Anzahl
uebersehen. Die Byteidentitaet schliesst genau diese Luecke: Ausserhalb des Stilblocks wurde in
`taskpane.html` nichts geaendert.

Produktdiff ausser `_relay/` und `LOT/`:

- `M apps/web/public/word-addin/taskpane.html`
- `M apps/web/src/version.ts`
- neu und untracked: `tests/app/mega43-klara-werkbank-palette.test.ts`

Keine bestehende Klara-Testdatei ist geaendert. Die von der Hand gemeldeten gruenen Torlaeufe wurden
gemaess Auftrag nicht erneut ausgefuehrt.

## 3. Kontrast-Grenzfaelle

Verdikt: GELB nur wegen der unvollstaendigen Paarabdeckung G2; die drei Entscheidungen sind korrekt.

Unabhaengig mit der WCAG-Relativluminanzformel nachgerechnet:

| Paar | Wert | Urteil |
|---|---:|---|
| `#C2500A` auf `#FAF8F5` | `4.456039:1` | unter 4.5; nicht als Kleintext auf Papier verwenden |
| `#A8560A` auf `#FAF8F5` | `4.951993:1` | AA; richtige Farbe fuer aktiven Reiter |
| `#A8560A` auf `#FDEADD` | `4.496915:1` | unter 4.5; weiche Markenflaeche mit Markenlink nicht verwenden |

Die daraus folgenden Abweichungen sind richtig:

- Funke-dunkel wird nicht als Reitertext auf Papier eingesetzt.
- Der Marken-Textton wird fuer Reiter und Links verwendet.
- Die Belegzeile behaelt den Funke-Balken, aber nicht die weiche Markenflaeche.

Die Rechenfunktion ist nicht kopiert. Der neue Test liest die Funktionen `channel`, `luminance` und
`contrast` aus `tests/app/mega40-kontrast-modern.test.ts`, transpiliert genau diesen Quelltext und
verwendet die resultierende Funktion (`tests/app/mega43-klara-werkbank-palette.test.ts:353-386`).
Damit bleibt die Formel an einer Stelle. Der fehlende Export und die vermiedene doppelte
Testregistrierung sind als technische Begruendung tragfaehig.

## 4. Violett-Policy

Verdikt: GELB wegen G3.

Fuer den heutigen Stand ist die Entscheidung korrekt: aktive Sprache, Hauptknopf und Links sind
Bedienelemente, keine Aussage "KI hat hier gearbeitet". Violett als Markenakzent waere semantisch
falsch; der Funke ist hier richtig. Der Test pinnt zugleich, dass `#5B50C4` weiterhin die
KI-Kennfarbe `--kw-ai` in der Web-Wahrheit ist.

Die beabsichtigte Zukunftsfaehigkeit ist jedoch nicht umgesetzt: Ein echter kuenftiger KI-Indikator
kann zwar durch eine nichtleere `KI_STELLEN`-Liste freigeschaltet werden, doch diese Freischaltung
gilt dann unbeabsichtigt fuer das gesamte Panel. Damit ist die Policy heute wirksam, aber nicht
dauerhaft selektiv.

## 5. Einordnung der fuenf offenen Punkte

1. Fehlende weiche Markenflaeche: traegt. Die Kopfentscheidung ist kontrastseitig korrekt und
   bewahrt eine einheitliche Linkfarbe. Keine Auflage.
2. Keine `crit`-Statusstufe: traegt. Das bestehende Skript setzt Status auf `ok` oder `warn`;
   `kind === "ok" ? "ok" : "warn"` ist an `taskpane.html:1143` und `:1429` belegt. Eine
   ungenutzte `crit`-Regel waere totes CSS. Keine Auflage in mega43.
3. Werkbank immer im Panel, Web umschaltbar: korrekt als Scope-Folge benannt. Das Panel besitzt
   keinen Theme-Schalter. Es entsteht eine moegliche visuelle Differenz fuer Classic-Nutzer, aber
   kein Funktions- oder VIP-Blocker.
4. Quelltext statt berechneter Darstellung: ehrlich benannt. Die einzige neue id-Regel
   `#ask-sources-block` setzt kein `display` und kann `.hidden { display:none }` daher nicht
   ueberschreiben. Der vertagte Computed-Style-Pin bleibt sinnvoll. G2 zeigt zusaetzlich, dass
   bereits die Quelltext-Paarabdeckung nachzuschaerfen ist.
5. Deaktivierter Hauptknopf mit `opacity:0.5`: unveraendertes Bestandsverhalten und fuer
   deaktivierte Steuerelemente kein WCAG-Kontrastblocker. Optisch blass-orange, aber keine Auflage
   fuer diese Scheibe.

## 6. Version

Verdikt: GRUEN

`apps/web/src/version.ts:9` enthaelt als einzige aktuelle harte App-Versionsquelle
`1.0.0-beta.1.26`. Die sichtbare Topbar importiert `APP_VERSION`
(`apps/web/src/shell/Topbar.tsx:35,515`). Deploy-, Lokalstart- und Desktop-Helfer lesen dieselbe
Datei. Eine Suche in `apps/`, `services/`, `tests/`, `tools/`, `scripts/`, `desktop-app/` und
`package.json` fand keine sichtbare `1.0.0-beta.1.25` mehr. Die Paketversion `0.0.0` ist ein anderer
Vertrag und keine konkurrierende sichtbare Beta-Nummer.

## 7. VIP-Testaufgaben und Donnerstag-Ship

1. Anmelden und umsehen: GRUEN. Login-DOM und -Skript sind bytegleich; die neue Kopfzeile verbessert
   die visuelle Orientierung.
2. Wissen erfassen und einreichen: GRUEN. Kein Erfassungsweg wurde geaendert.
3. Eine Frage stellen und ihr vertrauen oder nicht: GRUEN. Antwort-, Status- und Quellenlogik sind
   unveraendert; Statusfarben und Quellenbalken sind klarer.
4. Etwas in der Bibliothek wiederfinden: GRUEN. Die Bibliothek ist ausserhalb des mega43-Diffs.
5. Ein Word-Dokument hineinbringen: GRUEN fuer mega43. Der bekannte Bildverlust ist ausdruecklich
   eigener Scope und wird durch diese reine Stilaenderung weder verbessert noch verschlechtert.
6. Klara in Word: GRUEN fuer den aktuellen Produktstand. Das Panel wirkt konsistent mit der
   Werkbank, die aktuellen Textpaare sind kontraststark und alle Funktionen bleiben erhalten.
7. Eigenes Urteil: GRUEN. Quellen, Status und ehrliche Leere bleiben funktional unveraendert und
   werden nicht durch neue Dekoration verdeckt.

Ship-Ruling:

Aus Produktsicht spricht nichts gegen die Auslieferung am Donnerstag. Die drei GELB-Punkte betreffen
die Dauerhaftigkeit der neuen Testwaechter, nicht eine aktuelle Fehlfunktion oder einen aktuellen
Kontrastverstoss. Sie sollten als eng begrenzte Testhaertung vor dem naechsten Paletten-/KI-UI-Umbau
geschlossen werden.

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
SHA-256: ff288b2e2ae080991524be8f02a49bfedd64cba75ca44abdc9447e9e1333d193
