# SCRUM-384 — Umbauplan „Wissensseite & Wizard" (Arbeitsbrief, 2026-07-02)

**Auftrag Pedi:** „Tob dich aus" — UX-Umbau der Erfassung. Sichtabnahme Pedi+Tester = Done-Kriterium.

## Zielbild (verbindlich, aus Pedi-Screenshots + Tester)

1. **Wizard als Standardweg** (PMO-UX-0001): ein Fokus je Schritt — (1) Erzählen (Freitext/Diktat/Datei/Video) → (2) KI strukturiert → (3) Wissensseite prüfen/verfeinern → (4) Einreichen. Formular nur als Expertenpfad hinter „Erweitert".
2. **„Wissensseite bearbeiten"-Modal** statt Feld-Stapel — Referenz: `legacy-klarwerk/Klarwerk/demo/src/components/WikiEditor.jsx` (+ TeacherStudio.jsx; live klarwerk.kohnert.pro/classic/expert). Merkmale: Titel als Aussage · EINE Toolbar (H2/H3/¶/B/I/Listen/Link | Bild/Datei | Callouts Info/Hinweis/Warnung/Erfolg | ✦KI) · KI-Palette (Klarer/Strukturieren/Erweitern/Rechtschreibung + Anweisungsfeld + Fragen, Backend: /api/reasoner assist+instruction) · Reasoner schreibt Struktur INS Dokument (Callout + „Wann es gilt"-Bullets + „Vorgehen"-Nummern) · Vorschau-Toggle · Drag&Drop-Fußzeile · Aktionen deutsch: „Zur Validierung einreichen →" / „Verwerfen".
3. **Informationsdichte**: keine unaufgeforderten Hinweisblöcke; ALLE nötigen Felder mit ?-HelpTip (Komponente existiert).
4. **Nicht verlieren:** Sanitizer-Parität (SCRUM-355, kein data:/javascript:), Bedingungen/Maßnahmen strukturiert ableitbar (kein stiller Datenverlust), ehrliche Reasoner-Fallbacks (e544620), Video-Transkription (SCRUM-382), DE/EN, Tests grün (`tools/check`).

## Umsetzungsreihenfolge

1. `apps/web/src/components/WissensseiteEditor.tsx` — Port des WikiEditor (contentEditable-Dokument + Toolbar + Callouts + KI-Palette; Markup-Serialisierung kompatibel zum bestehenden body-Sanitizer).
2. Capture.tsx → Wizard-Rahmen (Stepper, ein Schritt sichtbar); Reasoner-Ergebnis öffnet das Modal statt des Feld-Stapels; „Erweiterte Details" bleibt eingeklappter Expertenpfad.
3. Dichte-Pass: Dauertexte → HelpTips; Submit-Flow deutsch.
4. DOM-freie Tests (Serialisierung, Struktur-Ableitung, Sanitizer) + FE-tsc + tools/check; Commit je Schritt; Pedi-Screenshot-Review nach Schritt 1 und 2.

## Kontext für die nächste Session

Alles committed (main, ahead; Push via „KLARWERK Sync"). App startet via „KLARWERK App" (Selbst-Aktualisierung erkennt neue Commits). Tickets: SCRUM-384 (Kriterien+Referenz in Kommentaren), SCRUM-386 (KI-Preset-Konfig), PMO-UX-0001, PMO-FEA-0006 (Datei-Import-KI, Folge-Slice).
