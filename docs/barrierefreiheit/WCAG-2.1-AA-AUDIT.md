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
`/start`, `/fragen`, `/bibliothek`, `/erfassen`, `/validierung`. Gemessen wird im echten Chromium am
echten Server, in der Thema-Einstellung der Smoke-Instanz. Die Pflichtflächen (Hinweisbanner,
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
| 1.3.4 | AA | Ausrichtung | H | Keine Ausrichtungssperre bekannt; Hoch-/Querformat auf Tablet nicht gemessen. |
| 1.3.5 | AA | Eingabezweck bestimmen | Q | `autoComplete` an Name, E-Mail, Passwort (`auth/AuthScreens.tsx`, `auth/ResetScreen.tsx`). Weitere personenbezogene Felder nicht inventarisiert. |
| 1.4.1 | A | Benutzung von Farbe | H | Belegt nur Einzelstellen (Hinweisbanner: Form und Text unterscheiden die Knöpfe). Status-/Reifefarben auf durchgehende Textbeschriftung prüfen. |
| 1.4.2 | A | Audio-Steuerelement | N/A | Kein selbststartendes Audio. |
| 1.4.3 | AA | Kontrast (Minimum) | M | Audit: jeder sichtbare Textknoten, gemalte Farbe gegen zusammengesetzten Hintergrund, 4,5:1 bzw. 3:1 (Großtext). Pflichtflächen in beiden Themen: `kontrast-dom-paarungen.test.tsx`, `tests/legal/mega62-kontrast-pflichtflaechen.test.ts`. **Behoben in dieser Runde:** `klarwerk.ai` in der Markenspalte (Weiß/40 auf Ink ≈ 3,7:1 → Weiß/60 ≈ 6,4:1, `BrandPanel.tsx`, `SsoCallback.tsx`); Titel-Platzhalter im Erfassungsblatt (`muted-2/60` ≈ 2,5:1 → `muted-2`, `erfassen/Blatt.tsx`). **Offen:** Platzhaltertext ist kein Textknoten und wird vom Audit nicht gemessen; Text über Hintergrundbildern und in durchscheinenden Ebenen wird gezählt, nicht gerechnet (Anhang je Fläche: `kontrastUnbestimmt`); Flächen außer den sechs gemessenen; das jeweils andere Thema auf den Kernflächen. |
| 1.4.4 | AA | Textgröße ändern | H | 200 % Browserzoom nicht gemessen. |
| 1.4.5 | AA | Bilder von Text | H | Keine bekannten Textbilder außer Logo (ausgenommen); nicht inventarisiert. |
| 1.4.10 | AA | Umbruch (Reflow) | M | Audit: 320 CSS-px, kein waagerechtes Scrollen der Seite. Bestand: TEST-A19 (390 px), Kopfband-Chromium-Tests 390–1440 px. |
| 1.4.11 | AA | Nicht-Text-Kontrast | H | Fokusring (`ring-brand/60`), Feldränder, Symbole nicht gemessen. |
| 1.4.12 | AA | Textabstand | H | Nicht gemessen. |
| 1.4.13 | AA | Inhalt bei Hover oder Fokus | H | Menüs und Zeigehinweise auf Schließbarkeit (Escape) und Hover-Stabilität prüfen. |
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
| 2.4.7 | AA | Fokus sichtbar | M | Audit: jedes per Tab erreichte Element (30 Schritte je Fläche) trägt Umriss oder Ring. Globale Regel: `tests/app/focus-visible-global-contract.test.ts` (R-0980). |
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

Bilanz: 10 M, 10 T, 3 Q, 20 H, 7 N/A (Summe 50).

## Ausdrücklich menschliche oder externe Prüfungen

Diese Punkte lassen sich mit den vorhandenen Mitteln nicht entscheiden. Sie bleiben offen und
werden nicht durch Tests ersetzt:

1. **Tatsächliche Vorleseausgabe** (R-1090, A18) mit NVDA/JAWS (Windows) und VoiceOver (macOS/iOS)
   auf den sechs Kernflächen. Gemessen ist nur die Rechnung des Browsers (AX-Baum).
2. **Industriebedingungen** (R-0891): Bedienung mit Handschuhen (Zielgrößen, Abstände) und
   Lesbarkeit bei wechselndem Licht. Dafür sind Gerät und Einsatzort nötig.
3. Die mit **H** markierten Kriterien oben. Mit ihnen und Punkt 1 ist das Audit vollständig.
4. Ein **unabhängiges Barrierefreiheitsaudit** durch eine prüfende Stelle, falls eine Ausschreibung
   es verlangt. Das Werkzeug `axe-core` ist im Repository nicht installiert. Die maschinellen
   Prüfungen hier stützen sich auf die Rechnung von Chromium (CDP, `getComputedStyle`).
