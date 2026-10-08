# WCAG 2.1 AA — Auditstand Klarwerk Web

Auftrag `aufnahme:20260922:gesamt-barrierefreiheit` (R-0891, R-2074, SOLL:NFR-UX-02:
„WCAG 2.1 AA (Kontrast, Tastatur, Screenreader). AK: Accessibility-Audit.“).

Dieses Dokument ordnet **alle 50 Erfolgskriterien der Stufen A und AA** einem Prüfstand zu. Es
unterscheidet streng:

- **M (maschinell gemessen)**: Ein ausführbarer Test entscheidet das Kriterium am Produkt. Datei
  ist genannt. Ob er grün ist, belegt der jeweilige Prüflauf, nicht dieses Dokument.
- **T (teilweise)**: Ein Test misst die maschinell entscheidbare Hälfte (z. B. „ein Name ist da“).
  Die inhaltliche Hälfte (z. B. „der Name ist sinnvoll“) braucht eine menschliche Prüfung.
- **Q (Quelleninspektion)**: Aus dem Quelltext belegt, ohne eigenen Testlauf.
- **H (menschlich offen)**: Nur durch eine Person entscheidbar. Genannt ist, was konkret zu prüfen ist.
- **N/A (nicht anwendbar)**: Das Produkt enthält den Gegenstand nicht. Die Begründung ist angegeben.

Gemessene Flächen des maschinellen Audits (`tests-smoke/wcag21-aa-audit.spec.ts`): Anmeldemaske,
`/start`, `/fragen`, `/bibliothek`, `/erfassen`, `/validierung`. Seit nacharbeit-7 **jede Fläche
der Navigation** (`apps/web/src/app/navigation.ts`), die das Admin-Konto sieht: zusätzlich
`/aufgaben`, `/entwuerfe`, `/gesamtanweisungen`, `/wissensnetz`, `/extern`, `/konflikte`,
`/duplikate`, `/risiko`, `/lebenszyklus`, `/analytics`, `/admin` (Einstellungen und Verwaltung;
dorthin führt das Zahnrad-Menü „Einstellungen“), `/hilfe`, `/profil`. Die Stufe-2-Flächen
`/output`, `/import`, `/graph`, `/kapital` laufen nach dem Einschalten über den echten Bedienweg.
Dazu kommt `/wissen/:id` (Wissensdetail, mit einem eigens angelegten Wissensobjekt). Eine
Umleitung, etwa durch ein Rollen- oder Stufe-2-Tor, lässt den Fall scheitern, statt still eine
andere Seite zu messen. Gemessen wird im echten Chromium am echten Server, und zwar in **beiden** Themen:
Kontrast, Feldgrenzen und Symbole, Fokus und Tastaturweg laufen je Fläche einmal klassisch und
einmal modern (`data-theme="modern"`). Die übrigen Messungen laufen einmal. Jede Messart hat eine
Kalibrierung an einer fehlerhaften Fixture, die rot werden muss. Die Pflichtflächen (Hinweisbanner,
Impressum, Datenschutz, Sperrfläche, Rechtshinweise der Anmeldemaske) rechnet zusätzlich
`apps/web/src/legal/kontrast-dom-paarungen.test.tsx` in **beiden** Themen.

## Zuordnung

| SC | Stufe | Titel | Stand | Beleg / konkret offen |
|---|---|---|---|---|
| 1.1.1 | A | Nicht-Text-Inhalt | T | Audit: jedes nicht ignorierte Bild im AX-Baum hat einen Namen. **Offen (H):** ob Alternativtexte den Bildinhalt treffen; Bildbeschreibungen in Wissensobjekten stammen von Autorinnen. |
| 1.2.1 | A | Nur Audio / nur Video | N/A | Kein `<audio>`/`<video>` im Web-Client (`apps/web/src`, Quelleninspektion). |
| 1.2.2 | A | Untertitel (aufgezeichnet) | N/A | wie 1.2.1 |
| 1.2.3 | A | Audiodeskription oder Alternative | N/A | wie 1.2.1 |
| 1.2.4 | AA | Untertitel (live) | N/A | wie 1.2.1 |
| 1.2.5 | AA | Audiodeskription (aufgezeichnet) | N/A | wie 1.2.1 |
| 1.3.1 | A | Info und Beziehungen | T | Audit: Rollen/Namen im AX-Baum, Landmarken `header`/`nav`/`main`; Ansageregister `tests/app/a18-ansagen-ereignisse.test.tsx`. **Offen (H):** Überschriftenhierarchie und Tabellenstruktur inhaltlich. |
| 1.3.2 | A | Bedeutungstragende Reihenfolge | H | Vorlesereihenfolge gegen Sichtreihenfolge je Fläche mit Screenreader prüfen. |
| 1.3.3 | A | Sensorische Eigenschaften | H | Hilfetexte auf Formulierungen wie „rechts“, „orange“ prüfen. |
| 1.3.4 | AA | Ausrichtung | M | **Befund behoben:** das Web-App-Manifest sperrte die installierte App auf Hochformat (`"orientation": "portrait"`, `apps/web/public/manifest.webmanifest`). Weder ein Produktgrund noch eine Entscheidung im Bestand macht die Lage unerlässlich. Jetzt `"any"`. Vertrag: `tests/barrierefreiheit/ausrichtung-frei.test.ts` (Manifest frei, kein `screen.orientation.lock` im Quelltext). Reflow bei schmaler und breiter Lage: 1.4.10. |
| 1.3.5 | AA | Eingabezweck bestimmen | Q | `autoComplete` an Name, E-Mail, Passwort (`auth/AuthScreens.tsx`, `auth/ResetScreen.tsx`). Weitere personenbezogene Felder nicht inventarisiert. |
| 1.4.1 | A | Benutzung von Farbe | H | Belegt nur Einzelstellen (Hinweisbanner: Form und Text unterscheiden die Knöpfe). Status-/Reifefarben auf durchgehende Textbeschriftung prüfen. |
| 1.4.2 | A | Audio-Steuerelement | N/A | Kein selbststartendes Audio. |
| 1.4.3 | AA | Kontrast (Minimum) | M | Audit: jeder sichtbare Textknoten, gemalte Farbe gegen zusammengesetzten Hintergrund, 4,5:1 bzw. 3:1 (Großtext). Pflichtflächen in beiden Themen: `kontrast-dom-paarungen.test.tsx`, `tests/legal/mega62-kontrast-pflichtflaechen.test.ts`. **Behoben in dieser Runde:** `klarwerk.ai` in der Markenspalte (Weiß/40 auf Ink ≈ 3,7:1 → Weiß/60 ≈ 6,4:1, `BrandPanel.tsx`, `SsoCallback.tsx`); Titel-Platzhalter im Erfassungsblatt (`muted-2/60` ≈ 2,5:1 → `muted-2`, `erfassen/Blatt.tsx`). **Seit nacharbeit-5 zusätzlich gemessen:** Platzhaltertext (über `::placeholder`, mit Kalibrierung) und das jeweils andere Thema auf allen sechs Kernflächen. **Dabei gefunden und behoben (nacharbeit-6):** (1) Platzhalter „Wissen suchen“ im Kopfband, modernes Thema: `shell-muted-2` auf `night-2` = 4,43:1. Jetzt `shell-muted` mit ≈ 8,9:1 (`styles/modern.css`), im Mockup-Test V14 benannt abweichend (`tests/design/zielbild-h1-huelle.test.ts`). (2) Platzhalter „Bibliothek durchsuchen“: Mockup-Grau `#9AA2B1` = 2,3–2,4:1. Jetzt Tinte-2 (`muted`) wie auf Start und Fragen (`bibliothek/BibliothekListe.tsx`). **Bewusst nicht angefasst:** Auf den Klara-Flächen trägt das Hinweisgrau `#9AA2B1` eine dokumentierte Eigentümer-Vorgabe vom 04.09. (`tests/app/mega43-klara-werkbank-palette.test.ts`). Diese Flächen liegen nicht unter den sechs gemessenen. Der Kontrastpunkt bleibt dort als Entscheidung des Eigentümers offen. **Unbestimmte Fälle (seit nacharbeit-7):** Text über Hintergrundbildern, in durchscheinenden Ebenen oder in einem nicht lesbaren Farbformat gilt nicht mehr als bestanden. Jeder Fall wird mit Element und Grund einzeln als Befund gemeldet und muss bearbeitet werden (Kalibrierung: Text auf Verlauf). Auf den sechs Kernflächen trat in nacharbeit-6/-7 keiner auf. |
| 1.4.4 | AA | Textgröße ändern | M | Audit: Fenster 640 × 400 CSS-px (entspricht 200 % Zoom von 1280 × 800). Gemessen werden kein waagerechtes Scrollen und kein Text, der dabei neu abgeschnitten wird. Eine neu entstehende Kürzung mit Auslassungszeichen ist ebenfalls ein Befund, mit Element und Inhalt; Regel wie bei 1.4.12. Grenze: Viewport-Verkleinerung statt echtem Browser-Zoom. |
| 1.4.5 | AA | Bilder von Text | H | Keine bekannten Textbilder außer Logo (ausgenommen); nicht inventarisiert. |
| 1.4.10 | AA | Umbruch (Reflow) | M | Audit: 320 CSS-px, kein waagerechtes Scrollen der Seite. Bestand: TEST-A19 (390 px), Kopfband-Chromium-Tests 390–1440 px. |
| 1.4.11 | AA | Nicht-Text-Kontrast | M | **Erforderliche Grenzen, festgelegt (nacharbeit-7):** (A) Eingabefelder (einzeilig, Textbereich, Auswahl, Kombi- und Suchfeld): Wo das Feld liegt, zeigt allein seine Grenze; eine Beschriftung sagt, WAS einzugeben ist, nicht WO. Erforderlich ist deshalb, dass Füllung oder Rand (auch Innenschatten-Rand) des Feldes oder seiner eng anliegenden Hülle sich mit ≥ 3:1 von der Umgebung abhebt. Ausgenommen sind Schreibflächen eines Dokuments (`contenteditable`): Text und Schreibmarke zeigen dort, wo geschrieben wird. (B) Symbole: Trägt ein Bedienelement keinen sichtbaren Text, muss sein Symbol ≥ 3:1 gegen seine Fläche erreichen, ebenso jedes bedeutungstragende Bild-Symbol (`role="img"`). Symbole neben Text sind Schmuck. Gemessen auf allen Audit-Flächen in beiden Themen, mit Kalibrierung (blasser Rand und blasses Symbol rot, deutlicher Rand, deutliche Füllung und deutliches Symbol grün). Ein Bild-Symbol aus einer Bilddatei wird als unbestimmt gemeldet. Audit: Die Fokuskennzeichnung jedes per Tab erreichten Elements hebt sich mit ≥ 3:1 von der Fläche ab, auf der sie steht (beide Themen). **Befund behoben:** Der globale Fokusring `ring-brand/60` maß auf der Seitenfläche ≈ 1,85:1. Jetzt `ring-brand-text` (≈ 5,3–5,9:1 auf hellen Flächen). Auf dem dunklen Kopfband trägt der helle Offset-Streifen den Kontrast (`index.css`, Vertrag `tests/app/focus-visible-global-contract.test.ts`). **Grenze:** Gemessen werden berechnete Stile, nicht gemalte Pixel. Symbole aus Bilddateien und Verläufe werden als unbestimmt gemeldet, nicht gerechnet. |
| 1.4.12 | AA | Textabstand | M | Audit: Zeilenhöhe 1,5, Buchstabenabstand 0,12 em, Wortabstand 0,16 em, Absatzabstand 2 em als Stil mit Vorrang. Danach darf kein Element mit `overflow: hidden/clip` Text abschneiden, der vorher vollständig stand. **Auch eine neu entstehende Kürzung mit Auslassungszeichen** (`text-overflow: ellipsis`, `line-clamp`) ist ein Befund, mit Element und Inhalt (ben nacharbeit-10). Ausgenommen ist sie nur bei belegtem Zugang: Derselbe volle Text steht zur selben Zeit an anderer Stelle der Seite vollständig sichtbar. Ein `title` genügt nicht, weil Tastatur und Touch ihn nicht erreichen. Kalibriert mit einer neuen Kürzung (rot) und einer Kürzung mit sichtbarem Volltext (grün). **Behoben (nacharbeit-10):** Die 19 gezählten Kürzungen auf /analytics und /import. Sie sind per Quelleninspektion den Kürzungsstellen dort zugeordnet: Typ-Beschriftungen und Ziel der Audit-Einträge auf /analytics, Schrittnamen im Import-Stepper. Diese brechen jetzt um, statt abzuschneiden (`pages/Analytics.tsx`, `components/ImportStepper.tsx`). Ob es genau diese 19 waren, belegt erst der nächste Lauf: Er benennt jede verbleibende Kürzung einzeln. **nacharbeit-11:** Der Lauf benannte zwei weitere Kürzungen: die Kachelnamen „PDF-Datei (.pdf)“ und „OCR (Scan/Bild)“ in der Quellen-Galerie von /import (`FileTypePicker.tsx`, ab `sm` `truncate`). Sie brechen jetzt in jeder Breite um. Außerdem war die Kalibrierungs-Fixture für die neue Kürzung falsch: Sie war ein Block mit Zeilenbreite und wurde deshalb nie gekürzt. Jetzt `inline-block`. |
| 1.4.13 | AA | Inhalt bei Hover oder Fokus | M | Audit: Jedes per Tab erreichte Element wird fokussiert und überfahren. Erscheint ein `role="tooltip"`, muss er beim Überfahren stehen bleiben und mit Escape schließen. Gefundene Hinweise je Fläche: `hoverInhalte`. Native `title`-Hinweise steuert der Browser, sie sind nach WCAG ausgenommen. |
| 2.1.1 | A | Tastatur | T | Audit: Tab-Weg je Fläche. Bestand: Chromium-Tastaturwege (`tests/entwurf-pool/pool-tastatur-chromium.test.ts`, `tests/entwuerfe-verwalten/abnahmefolge-tastatur-chromium.test.ts`, `tests/anhang-upload-tastatur/foto-anhaengen-tastatur.test.ts`, `tests/admin-navigation/bedienbarkeit.test.tsx`). **Offen (H):** Gleichwertigkeit jeder Mausfunktion (Ziehen, Graph). |
| 2.1.2 | A | Keine Tastaturfalle | M | Audit: kein Element hält den Fokus über Tab und Escape. Bestand: Modalgrenze/`inert` (`tests-smoke/ui-smoke.spec.ts`, mega48). |
| 2.1.4 | A | Tastaturkürzel | Q | Globales Kürzel nur mit Modifier (`CommandPalette.tsx`: `metaKey || ctrlKey`). Anzeige plattformgerecht (R-0987, `lib/tastenkuerzel.ts`). Weitere Einzeltasten-Kürzel nicht inventarisiert. |
| 2.2.1 | A | Zeitbegrenzung anpassbar | H | Meldungen (Toast) räumen sich nach 4 s ab (`app/ToastContext.tsx`). Zu entscheiden, ob dort Information verloren geht, die nirgends sonst steht. |
| 2.2.2 | A | Pausieren, Stoppen, Ausblenden | H | Keine Laufschriften bekannt; Ladeanimationen nicht inventarisiert. |
| 2.3.1 | A | Dreimaliges Blitzen | H | Keine Blitzinhalte bekannt. |
| 2.4.1 | A | Blöcke umgehen | M | Audit: genau eine `main`-Landmarke je angemeldeter Fläche (Technik ARIA11). Ein sichtbarer Sprunglink fehlt (Empfehlung, kein AA-Muss). |
| 2.4.2 | A | Seite mit Titel | T | Audit: Titel nicht leer. **Offen (H):** ob der Titel die Seite benennt. |
| 2.4.3 | A | Fokusreihenfolge | H | Bestand: Fokusrückgabe nach Palette/Drawer (`tests/admin-navigation/bedienbarkeit.test.tsx`, `tests-smoke/mobile-drawer-focus-probe.spec.ts`). Reihenfolge je Fläche menschlich. |
| 2.4.4 | A | Linkzweck (im Kontext) | T | Audit: jeder Link hat einen Namen. Zweck menschlich. |
| 2.4.5 | AA | Mehrere Wege | Q | Kopfband-Navigation, „Arbeitsbereiche“, „Seite finden“ (Palette), Wissenssuche. |
| 2.4.6 | AA | Überschriften und Beschriftungen | H | Beschreibungskraft menschlich. |
| 2.4.7 | AA | Fokus sichtbar | M | Audit (30 Tab-Schritte je Fläche und Thema): Jedes Element wird im Fokus und ohne Fokus gemessen. Als Kennzeichnung zählt nur ein Umriss, Schatten, Rand oder `focus-within`-Umriss, der im Fokus mit nicht durchsichtiger Farbe dasteht und ohne Fokus fehlt. Seit nacharbeit-5 schlagen durchsichtige Umrisse und Schatten sowie unveränderte Dekorationsschatten in der Kalibrierung an. Globale Regel: `tests/app/focus-visible-global-contract.test.ts` (R-0980). Grenze: Ein Ring, den ein Vorfahr mit `overflow: hidden` abschneidet, sieht die Stilmessung nicht. |
| 2.5.1 | A | Zeigergesten | H | Graph/Ziehen auf Einzelzeiger-Alternative prüfen. |
| 2.5.2 | A | Zeigeraktion abbrechen | H | Nicht gemessen. |
| 2.5.3 | A | Beschriftung im Namen | T | Kopfband: sichtbares Wort = Name (`tests/fe002-kopfband/kopfband-fe002.test.tsx`). Übrige Flächen menschlich. |
| 2.5.4 | A | Bewegungsaktivierung | N/A | Keine Geräte-Bewegungssteuerung. |
| 3.1.1 | A | Sprache der Seite | M | Audit: `html[lang]` ∈ de/en/nl. |
| 3.1.2 | AA | Sprache von Teilen | H | Fremdsprachige Passagen in Wissensinhalten nicht ausgezeichnet; inhaltlich zu prüfen. |
| 3.2.1 | A | Bei Fokus | H | Titelfeld im Erfassungsblatt öffnet bei Fokus ein Vorschlagsmenü (kein Kontextwechsel); menschlich bestätigen. |
| 3.2.2 | A | Bei Eingabe | H | Nicht gemessen. |
| 3.2.3 | AA | Konsistente Navigation | M | Ein Kopfband auf jeder Route (`tests/design/zielbild-h1-kein-erklaertext.test.ts`). |
| 3.2.4 | AA | Konsistente Erkennung | T | Kürzelanzeige aus einer Quelle (`lib/tastenkuerzel.ts`); sonst menschlich. |
| 3.3.1 | A | Fehlererkennung | T | Fehler als `role="alert"` (Ansageregister A18, JOB-2064-Verträge). Vollständigkeit menschlich. |
| 3.3.2 | A | Beschriftungen oder Anweisungen | T | Audit: jedes Eingabefeld hat einen Namen. |
| 3.3.3 | AA | Fehlerempfehlung | H | Nicht gemessen. |
| 3.3.4 | AA | Fehlervermeidung (rechtlich, finanziell, Daten) | T | Ablehnung des Hinweises mit Bestätigungsschritt (`apps/web/src/legal/mega61-hinweisbanner.test.tsx`); zerstörende Knöpfe gesondert gekennzeichnet (`components/ui.tsx`, `danger`). |
| 4.1.1 | A | Syntaxanalyse | M | Audit: per ARIA/`for` referenzierte IDs eindeutig und vorhanden. |
| 4.1.2 | A | Name, Rolle, Wert | M | Audit: jedes bedienbare Element im AX-Baum von Chromium hat einen Namen. |
| 4.1.3 | AA | Statusmeldungen | M | `tests-smoke/a18-live-region-browser.spec.ts` (AX-Baum: Toast `status`/`polite`), JOB-2064-Verträge. |

Bilanz: 15 M, 10 T, 3 Q, 15 H, 7 N/A (Summe 50).

## Befunde des ersten Laufs über alle Flächen (nacharbeit-8) und ihre Behebung

Der erste Lauf über alle Navigationsflächen war rot. Die Kalibrierung war grün, die Befunde sind
also echte Produktbefunde. Sie gingen auf wenige gemeinsame Ursachen zurück, die zentral behoben
sind:

| SC | Befund | Behebung |
|---|---|---|
| 1.4.11 | Eingabefelder, Auswahllisten, Textbereiche mit Haarlinie `border-hairline`: 1,24–1,26:1, auf fast allen Flächen | Eine Regel in `index.css` für Felder und ihre unmittelbare Hülle: Tinte-2 zu 80 % (≈ 3,3–4,0:1). Trenner und Kartenränder bleiben Haarlinie. |
| 1.4.11 | Kopfband-Suche, modernes Thema: Fläche `night-2` auf `night` 1,13:1 | Innenrand `shell-muted-2` (≈ 5,0:1) in `styles/modern.css`, ohne Massänderung |
| 1.4.11 | Titelzeile des Erfassungsblatts ohne Grenze | Als Dokument-Schreibfläche markiert (`data-kw-dokumentflaeche`), wie der Rumpf. Begründung am Feld in `erfassen/Blatt.tsx`. |
| 1.4.11 | Ausklapp-Pfeil am Mehr-Knopf des Blatts `#9AA2B1`: 2,57:1 | Pfeil in der Farbe seines Knopfes (`erfassen/Menue.tsx`) |
| 1.4.3 | Platzhalter ohne eigene Klasse in Tailwind-Grau `#9CA3AF`: 2,54:1 (/analytics, /hilfe) | Grundfarbe aller Platzhalter Tinte-2 (`index.css`, Base-Layer) |
| 1.4.3 | Link `text-brand` auf /import: 2,78:1 bzw. 3,38:1 | `text-brand-text` (`ImportJsonUpload.tsx`) |
| 1.4.3 | Kommende Import-Schritte mit `opacity-60/70` (bisher als unbestimmt gemeldet) | Abschwächung entfernt (`ImportStepper.tsx`). Der Audit rechnet Deckkraft seither, statt sie unbestimmt zu lassen. |
| 1.1.1 / 4.1.2 | Dutzende namenlose Lucide-Symbole (/hilfe, /import, /extern, Wissensdetail) | Zentral: `lib/schmuckSymbole.ts`, gebunden in `main.tsx`. Namenlose Lucide-Symbole ohne Rolle werden für Hilfstechnik verborgen. Gegenprobe: `tests/barrierefreiheit/schmuck-symbole.test.tsx`. |
| 2.4.7 | Modernes Thema: der Karten-Schatten (`.rounded-card.border-hairline`) verdrängte den Fokusring (Vorlagen auf /output, Arbeitsweise-Link auf /hilfe) | Fokus-Zustand derselben Karten trägt Ring und Schatten (`styles/modern.css`); ebenso `.kw-cta-primary` |

Messkorrektur (nacharbeit-9): Feldgrenzen werden im **Ruhezustand** gemessen. Das E-Mail-Feld der
Anmeldemaske trägt `autoFocus` und stand bei der Messung im Fokus. Dann gilt
`focus:border-ink/30` aus `TextInput`, und der Ring der Fokusregel trägt die Kennzeichnung. Dieser
Zustand wird im Tab-Weg eigens nach 2.4.7/1.4.11 gemessen.

Messkorrektur (kein Abschwächen): Eine Feldhülle wird jetzt über die **Zeilenhöhe** erkannt statt
über die Breite. Die Fragezeile trägt ihren Rand an der `<form>` neben Knöpfen, die alte
Breitengrenze ließ diesen Rand ungesehen.

## Vollständigkeit

Der **technische** Auditumfang ist seit nacharbeit-7 geschlossen, soweit er sich an
Zuständen messen lässt, die man über die Navigation erreicht. Das betrifft alle Navigationsflächen
inklusive Stufe 2 und Wissensdetail, beide Themen, Feldgrenzen und Symbole nach festgelegter
Regel, und unbestimmte Fälle einzeln. Ob die Messung grün ist, belegt der Prüflauf des Smokes, nicht
dieses Dokument.

### Technische Grenzen (benannt, nicht übergangen)

1. **Zustände hinter einer Handlung** werden auf den Flächen nur so weit gemessen, wie der
   Tab-Weg (30 Schritte) und das Überfahren sie öffnen. Gemeint sind aufgeklappte Abschnitte der
   Verwaltung, Dialoge, Fehlerzustände von Formularen und Ergebnislisten mit Daten. Bestehende
   Einzelbelege dazu: Ablehnungsweg des Hinweisbanners und Sperrfläche
   (`kontrast-dom-paarungen.test.tsx`), Modalgrenze (`tests-smoke/ui-smoke.spec.ts`, mega48),
   Toast (`tests-smoke/a18-live-region-browser.spec.ts`).
2. **Pixel statt Stil:** Gemessen werden berechnete Stile. Was nur über gemalte Pixel
   entscheidbar ist (Text über Bildern, Symbole aus Bilddateien), wird als unbestimmt gemeldet
   und ist dann einzeln zu bearbeiten.
3. **Klara-Flächen** (Word-Seitenleiste, Ruhe) gehören nicht zur Web-Navigation. Ihr Hinweisgrau
   `#9AA2B1` steht unter einer dokumentierten Eigentümer-Vorgabe (siehe 1.4.3).

### Ausdrücklich menschliche oder externe Prüfungen

Diese Punkte lassen sich auch maschinell nicht entscheiden. Sie bleiben offen und werden nicht
durch Tests ersetzt:

1. **Tatsächliche Vorleseausgabe** (R-1090, A18) mit NVDA/JAWS (Windows) und VoiceOver (macOS/iOS)
   auf den Audit-Flächen. Gemessen ist nur die Rechnung des Browsers (AX-Baum).
2. **Industriebedingungen** (R-0891): Bedienung mit Handschuhen (Zielgrößen, Abstände) und
   Lesbarkeit bei wechselndem Licht. Dafür sind Gerät und Einsatzort nötig.
3. Die inhaltliche Hälfte der **T**-Kriterien und die **H**-Kriterien oben. Dort geht es um
   Bedeutung und Gestaltungsabsicht (Sinn von Alternativtexten und Überschriften,
   Lesereihenfolge, Farbe als einziges Merkmal, Zeitgrenzen der Meldungen, Zeigergesten).
4. Ein **unabhängiges Barrierefreiheitsaudit** durch eine prüfende Stelle, falls eine Ausschreibung
   es verlangt. Das Werkzeug `axe-core` ist im Repository nicht installiert. Die maschinellen
   Prüfungen hier stützen sich auf die Rechnung von Chromium (CDP, `getComputedStyle`).
