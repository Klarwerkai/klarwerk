# BERICHT-ben-sammel39 - Gegenpruefung mega40

**Datum:** 28.07.2026  
**Basis:** `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`  
**Auftrag:** `_relay/ben/inbox/AUFTRAG-ben-sammel39-mega40.md`  
**Auftrag-SHA-256:** `abcff3023e109dd670d3d64f3044a4d70357113074371773486cf2d78192ebaf`

## Kurzfazit

mega40 ist funktional sauber abgegrenzt: Der Standard bleibt ohne `data-theme` klassisch, der
Umschalter verwendet die bestehende Storage-Grenze, navigiert nicht und beruehrt keine laufende
Eingabe. Die neuen Modern-Regeln sind an das Wurzelattribut gebunden; i18n, Egress und die vier
geaenderten Bestandsbloecke zeigen keine funktionale Regression.

Eine uneingeschraenkte Auslieferungsfreigabe kann ich trotzdem noch nicht geben: Der mit 3,38:1
bewusst akzeptierte Kontrast Weiss auf Funke ist im Produkt nicht nur Grafik. Er traegt mehrere
kleine Texte. Das ist eine eng begrenzte, vor Auslieferung leicht beheb- und pruefbare Auflage.

## Befunde

### 1. GELB - 3,38:1 wird faelschlich als rein grafische Verwendung behandelt

**Beleg**

- `apps/web/src/styles/themes.css:88` setzt `--kw-brand` im Modern-Theme auf Funke `#E8630A`.
- `tests/app/mega40-kontrast-modern.test.ts:83-87` akzeptiert dafuer bewusst nur `>=3:1` und nennt
  die Verwendung ein grafisches Element bzw. eine aktive Nav-Pille.
- Die reale Verwendung traegt jedoch normalen, kleinen Text:
  - `apps/web/src/shell/Sidebar.tsx:154-157`: aktiver Navigationseintrag, `text-sm`.
  - `apps/web/src/shell/Sidebar.tsx:235-243`: aktiver Rollenname, `text-[11px]`.
  - `apps/web/src/shell/Topbar.tsx:143`: Benachrichtigungszahl, `text-[10px]`.
  - `apps/web/src/shell/CommandPalette.tsx:121`: aktiver Treffertext.
  - `apps/web/src/components/FacetFilter.tsx:195`: Zaehler, `text-[10.5px]`.
  - `apps/web/src/components/FacetFilter.tsx:372`: Aktionsknopf, `text-[14px]`.

**Bewertung**

Die 3:1-Grenze fuer grafische Objekte oder grossen Text ist auf diese Texte nicht anwendbar.
Dass der klassische Bestand an derselben Stelle nur 2,78:1 erreicht, macht das neue optionale
Theme nicht AA-konform. Besonders die Sidebar begleitet fast jede der sieben Testaufgaben; der
FacetFilter betrifft Bibliothek und Validierung.

**Knappe Auflage vor Auslieferung**

Im Modern-Theme texttragende `bg-brand text-white`-Flaechen auf `--kw-funke-deep` legen oder ein
eigenes AA-konformes Action-Token einfuehren. Rein grafische `bg-brand`-Balken koennen auf dem
hellen Funke bleiben. Der Kontrasttest muss anschliessend die realen texttragenden Klassen sammeln
und fuer diese `>=4,5:1` verlangen. `--kw-funke-deep` ist bereits vorhanden und misst mit Weiss
4,72:1; die Reparatur ist daher lokal und ohne Produktlogik moeglich.

### 2. GELB - H1 ist ehrlich fuer AppRoutes, aber nicht vollstaendig fuer alle Oberflaechen

**Beleg**

- `apps/web/src/main.tsx:8-12` wendet die gespeicherte Wahl vor dem React-Render global auf
  `<html>` an.
- `apps/web/src/App.tsx:26-42` rendert Reset, SSO, Setup und Login vor der AppShell.
- `apps/web/src/auth/AuthScreens.tsx:62-88` verwendet die global umgebogenen Farb-Token.

Damit gilt Modern nach einer gespeicherten Wahl auch fuer Login/Setup, Reset und SSO, obwohl diese
Oberflaechen in der als vollstaendig bezeichneten H1-Liste fehlen und dort kein Topbar-Umschalter
existiert. Das ist kein Funktionsblocker: Die Wahl ist bewusst browserweit, und nach der Anmeldung
ist der Schalter wieder erreichbar. Fuer die behauptete Vollstaendigkeit sollte H1 aber um
`Login/Setup`, `/reset` und `/sso/callback` mit "erbt Token/Sammler, ohne Shell und Umschalter"
ergaenzt werden.

## 1. Invarianz des Standards

**Verdikt: GRUEN**

- `themes.css:21-66` bildet die klassischen Farb- und Schattenwerte der alten
  `tailwind.config.ts` vollstaendig und wertgleich ab.
- `tailwind.config.ts:12-49` bindet die Farben als RGB-Kanaele mit `<alpha-value>`. Dadurch bleiben
  normale Utilities und Alpha-Modifier wie `border-ink/30`, `bg-brand/5` oder
  `text-trust-pos-text/70` semantisch erhalten.
- Ohne gespeicherte Modern-Wahl entfernt `applyDesignTheme` das Attribut vollstaendig
  (`designTheme.ts:35-44`). Die Modern-Selektoren koennen den Standard dann nicht treffen.
- Der Sammler in `mega40-theme-invarianz.test.ts:129-190` ist kein Fallkatalog. Er zerlegt
  Komma-Selektoren und prueft Selektoren innerhalb von Media-Bloecken. Die globale
  `@keyframes kw-rise`-Definition ist ohne die ausschliesslich modern gebundene
  `animation`-Zuweisung inert.
- Der Umzug des Klara-Outline von Hex nach `rgb(var(--kw-ai))` ist im Standard wertgleich.

Die dateibasierte Sicherung reicht fuer die Freitagsauslieferung als Invarianzschutz, weil Werte,
Bindungen und Selektorgating strukturell gepinnt sind und der von der Hand gemeldete hermetische
UI-Smoke den Standardpfad durchlief. Als dauerhafte Haertung nach Freitag empfehle ich einen kleinen
Playwright-Computed-Style-Pin: je eine Fixture fuer Grundfarbe, Alpha-Modifier, Trust-Paar und
Schatten im Standard sowie ein Screenshot der unveraenderten Shell. Das ist eine Beweishaertung,
kein aktueller Ship-Blocker.

## 2. Umschalter

**Verdikt: GRUEN**

- `Topbar.tsx:67-89` rendert einen echten `button type="button"` mit `aria-pressed`; er verwendet
  weder Link noch Navigate noch NavGuard.
- Der Klick aendert nur React-Zustand und denselben Key `kw.designTheme`. Es gibt keine zweite
  persistierte Wahrheit: `initDesignTheme` und `usePersistentEnum` lesen dieselbe bestehende
  `safeLocalStorage`-Grenze.
- Fremdwerte fallen in `initDesignTheme` und im Enum-Hook auf `classic` zurueck. Fehler beim
  Ermitteln, Lesen oder Schreiben des Speichers werden durch `persistentToggle.ts:12-18`,
  `:53-61` und `:64-76` abgefangen.
- `main.tsx:10-12` wendet die Wahl vor `createRoot(...).render(...)` an.
- Der Button setzt keinen Dirty-State, ruft keine Navigation auf und kann daher weder Eingaben
  verwerfen noch den Ort wechseln.
- Der gemountete Test belegt Klick, Remount, Dirty-Seite und kaputten Storage. Die
  Tastaturaktivierung wird nicht als echter Keydown im Browser gefahren; fuer einen nativen Button
  ohne Rollen-Nachbau und ohne negativen Tabindex ist die HTML-Semantik hier als Nachweis
  ausreichend.

Die bekannte `/mobile`-Grenze wartet: Die gespeicherte Wahl gilt dort, aber die Route besitzt
absichtlich keine Topbar. Keine der sieben Aufgaben verlangt, innerhalb `/mobile` das Design
umzuschalten; Klara in Word ist eine getrennte Oberflaeche.

## 3. Texte und i18n

**Verdikt: GRUEN**

Der direkte mega39/mega40-Hunkvergleich zeigt ausschliesslich die drei neuen Keys
`topbar.design.classic`, `topbar.design.modern` und `topbar.design.hint` in DE, EN und NL.
Bestehende Werte wurden im mega40-Inkrement nicht entfernt oder ersetzt. Die deutschen und
niederlaendischen Werte enthalten echte Umlaute. `DesignTogglePill` rendert nur `t(...)`; im JSX
steht kein hartkodierter Designtext.

## 4. Abdeckung und Kontrast

**Verdikt: GELB**

Die Gestaltungsdeklaration ist im Kern ehrlich:

- Eigene Seitenregeln gibt es nur fuer `/start` und `/fragen`.
- Bibliothek, Validierung und die uebrigen AppRoutes erben nur Root-Token, die drei Sammler und
  die Shell, soweit die Shell dort vorhanden ist.
- Die Start- und Fragenmarker sind reine Klassen; es wurden keine Inhalte umgehaengt.
- Die gemessenen Textpaare fuer Tinte, Muted, Shell, Trust und den dunklen Funke sind plausibel und
  liegen ueber 4,5:1.

Die Ausnahme Weiss auf hellem Funke ist dagegen fuer die tatsaechlichen Textverwendungen nicht
tragbar. Punkt 1 ist deshalb eine Vor-Auslieferungs-Auflage. Zusaetzlich ist die H1-Liste um die
Auth-Oberflaechen zu ergaenzen.

## 5. Hermetik und Egress

**Verdikt: GRUEN**

In den elf Produktdateien von mega40 existiert kein neues `fetch`, `XMLHttpRequest`, `WebSocket`,
`sendBeacon` und kein neuer Host. Die vier neuen mega40-Tests sind dateibasierte Tests bzw. ein
gemounteter Topbar-Test mit gemockten Endpoints; sie besitzen keine Provider- oder Keychain-Kante.
Die Egress-Ernte und `KLARWERK_SKIP_KEYCHAIN`-Disziplin sind im Hand-Bericht belegt. Ich habe diese
Laeufe auftragsgemaess nicht erneut ausgefuehrt.

## 6. Verhaltensinvarianz

**Verdikt: GRUEN**

Der direkte Vergleich der mega39- und mega40-Diffbloecke ergibt:

- `Topbar.tsx`: neuer Umschalter und reine Klasse `kw-topbar`.
- `Start.tsx`: nur `kw-cta-primary` und `kw-start-purpose`.
- `ConfidenceBar.tsx`: nur `kw-confidence`.
- `i18n.ts`: nur neun neue Design-Key-Zeilen.
- `Sidebar.tsx`: nur `kw-sidebar`.
- `main.tsx`: einmalige Theme-Initialisierung.
- `index.css`, `themes.css`, `modern.css`, `tailwind.config.ts`: Praesentation und Tokenbindung.
- `contrast-tokens-d5.test.ts`: dieselbe klassische Zusicherung liest nur die umgezogene
  Tokenquelle.

Kein bestehender Handler, Testid, fachlicher Text, Rollenentscheid, Navigationsziel oder
Servicevertrag wurde durch mega40 geaendert. Die Aussage "keine DOM-Struktur geaendert" muss nur
um den beauftragten neuen Button praezisiert werden; bestehende Elemente wurden nicht entfernt
oder umgeordnet.

## 7. Die sieben Testaufgaben

| Testaufgabe | Standard | Modern | Bewertung im mega40-Scope |
|---|---|---|---|
| 1. Anmelden und umsehen | unveraendert | Login erbt Token; Shell und Schalter nach Login | GRUEN, H1-Doku ergaenzen |
| 2. Wissen erfassen und einreichen | unveraendert | nur Token/Sammler/Shell | GRUEN |
| 3. Frage stellen und vertrauen oder nicht | unveraendert | Belegkarte/Siegel/Einblenden rein optisch | GRUEN |
| 4. In der Bibliothek wiederfinden | unveraendert | nur Token/Sammler; Facet-Textkontrast betroffen | GELB bis Kontrastfix |
| 5. Word-Dokument hineinbringen | unveraendert | Erfassungsweg erbt Optik, Importlogik unberuehrt | GRUEN |
| 6. Klara in Word | unveraendert | taskpane ausdruecklich unberuehrt | GRUEN |
| 7. Eigenes Urteil | unveraendert | Validierung erbt Optik; gemeinsame Nav-/Brandtexte betroffen | GELB bis Kontrastfix |

## Auslieferungsruling

Pedis drei Handlaeufe koennen mit diesem Stand beginnen; sie sollten den Modern-Kontrast der
aktiven Sidebar, Rollenwahl, Benachrichtigungszahl, Command Palette und FacetFilter explizit
ansehen. Fuer die Auslieferung des Modern-Themes fehlt noch die kleine AA-Kontrastkorrektur samt
realem Verwendungs-Pin. Nach dieser Korrektur sehe ich aus mega40-Sicht keinen weiteren
funktionalen oder sicherheitsrelevanten Blocker. Die Auth-Oberflaechen sind in H1 nachzutragen;
der Computed-Style-Pin ist eine sinnvolle Haertung nach Freitag.

## No-op-Nachweis

- Branch/HEAD nur gelesen: `main` / `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`.
- Produktdiff vor Bericht: `af3a8c79a13b8c26d43cc0712e64f2484509d0fcc81e74889c5f9fad2935ef9f`.
- Indexdiff vor Bericht: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- Statussignatur vor Bericht: `3258161df167b6a8dd74a6ec51f617a55f9f2d469653c918139e8cc8ba2fc144`.
- Kein Produktcode geaendert, kein Build und kein Test ausgefuehrt.
- Kein Commit, kein Push, kein Jira-Zugriff.
- Einzige dauerhafte Schreiboperation ist dieser verlangte Bericht unter `_relay/ben/outbox/`.

GESAMTVERDIKT: GELB
SHA-256: 37a775c29d7a6e271113d27500ac81dd274aa178ac9eee123d9fbc792d7767b7
