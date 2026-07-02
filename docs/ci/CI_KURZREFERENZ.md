# KLARWERK CI — Kurzreferenz für alle Teams & Agenten

> Quelle: **Brand Book V1.0 (Juli 2026)** — `docs/ci/brand-book/KLARWERK Brand Book.dc.html`
> (Original von Pedi, 02.07.2026; identische Kopie im Guru-Repo `docs/ci/`).
> Diese Kurzreferenz ist der maschinen-/agentenfreundliche Extrakt. Bei Widerspruch gilt das Brand Book.

## Leitsatz

**„Vertrauen ist Evidenz — nie behauptet."**
Markenwerte: **Belastbar · Industriell · Klar · Ehrlich.** Substanz vor Effekt, Hierarchie vor Dekoration.

## Logo

Zielscheibe (konzentrischer Ring + Punkt) auf heller, abgerundeter Kachel; Wortmarke KLARWERK in Versalien, weit gesperrt, Untertitel „Reasoning System". Schutzraum = halbe Bildmarken-Höhe ringsum. Mindestgröße digital 24 px / Print 8 mm — darunter nur Bildmarke. Verboten: drehen, verzerren, umfärben, unruhiger Grund.

## Farben (verbindlich)

| Rolle | Wert |
|---|---|
| **Klarwerk-Orange** (EINZIGE Markenfarbe; nur Aktionen/Highlights) | `#ED7D0E` (PANTONE 152 C) |
| **Stahl-Dunkel** (Text auf Weiß, Kontrastflächen) | `#16222C` |
| Text / Text 2 | `#1B1E21` / `#687078` |
| Rahmen / Fläche / Weiß | `#E4E7EA` / `#F3F4F6` / `#FFFFFF` |
| Semantik: Gesichert / Belastbar / Konflikt | `#3AA06A` / `#C8861A` / `#C0473F` |
| Semantik: KI / Reasoner (IMMER kennzeichnen) | `#5B50C4` |

Farbverhältnis-Richtwert: ~62 % Weiß/Neutral · ~24 % Stahl · ~14 % Orange. Ampel + Violett sind rein semantisch, nie Dekoration. Orange nie für Fließtext auf Weiß (WCAG AA; dafür Stahl-Dunkel).

## Typografie

**IBM Plex Sans** (400/500/600/700) für Überschriften + Text · **IBM Plex Mono** für Labels, Eyebrows, Kennzahlen, IDs, Statusmarker. Skala digital: H1 44–56/600 · H2 30–36/600 · H3 20–22/600 · Body 16–18/400 (Zeilenhöhe 1,6–1,7) · Label 11–13 Mono.

## Icons & UI

Line-Icons, Strichstärke ~1,8, runde Enden, industrielles Motiv — keine Füllflächen, keine Emoji, keine Platzhalterquadrate. Cards/Zeilen: Radius 12–14 px, Rahmen `#E4E7EA`, dezenter Schatten. Buttons: Primär Orange · Sekundär Stahl · Tertiär Outline. Status-Pills: Validiert/In Prüfung/Konflikt/✦ Reasoner.

## Bildwelt

Dokumentarisch, echte Umgebungen und Menschen bei konkreter Tätigkeit; ruhige Farbwelt (Stahl + warmes Licht), leicht entsättigt; Orange nur als kleiner Akzent. **Verboten:** KI-Roboter/Humanoide, blauer Tech-Glow/Neon, Stockfoto-Posen, überladene Collagen, verzerrte Screenshots. Formate 16:9 & 4:3 (Web), 1:1 & 4:5 (Social); Radius 12–16 px Web, 0 bei Vollbild.

## Bewegtbild / Promo-Video (Kap. 07)

Empfohlener Aufbau ~60–90 s: Logo-Auftakt (Zielscheibe „trifft", Stille, 6 s) → Problem → Lösung/Produkt (UI-Screencast, Knowledge Object) → CTA (Claim + Logo + „Beta anfragen"). Ruhige Kamerafahrten, wenige Schnitte, harter Schnitt oder sanfte Blende — kein Zoom-Bounce, kein „AI-Glitch", kein Hype-Sounddesign. IBM Plex durchgängig, Fakten in Mono, Orange als einziger Akzent. **Untertitel Pflicht (DE/EN)**, Title-Safe beachten. End-Card: Zielscheibe + Claim. KI-/generierte Inhalte IMMER kennzeichnen (violett/„Reasoner-Entwurf") — nie KI-Ausgabe als validierte Wahrheit inszenieren.

## Sprache

Nüchtern, kompetent, aktiv, ohne Hype und Superlative; echte Umlaute. Kernbegriffe konsistent: **Knowledge Object · Reasoning System · Trust/Reifegrad · Validierung · Quelle & Kontext · Erfahrungswissen · Evidenz.** Markenversprechen: „KLARWERK sichert das Erfahrungswissen, das sonst mit den Menschen geht — als validierten, wiederverwendbaren Wissensbaustein."

## Ist-Abgleich (Stand 02.07.2026, Boss-Session)

Website-Tailwind `brand #ED7D0E` ✓ CI-konform · App nutzt Ampel-/Violett-Semantik ✓ · Veo-Video-Prompt (KWEB-106) auf CI nachgeführt (Akzent-Hex, Untertitel-Pflicht, Zielscheiben-End-Card). Offene CI-Feinabgleiche (Fonts der App vs. IBM Plex, Icon-Strichstärken) = Folge-Slice nach Beta-Freeze.
