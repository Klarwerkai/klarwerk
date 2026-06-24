# Entwickler-Brief: KLARWERK Frontend (Control Room)

> **An:** Claude Code / Frontend-Entwicklung
> **Zweck:** Umsetzung des KLARWERK-Frontends in einer echten Codebasis auf Basis der beiliegenden Hi-Fi-Design-Referenz.
> **Stand:** 24.06.2026

---

## 0. Auftrag in einem Satz

Baue das Frontend der Wissenskontinuitäts-Plattform **KLARWERK** als produktionsreife Web-App, die exakt dem beiliegenden Hi-Fi-Design (`KLARWERK Control Room.dc.html`) entspricht und die fachlichen Anforderungen aus `Frontend-Anforderungsbeschreibung.md` erfüllt. Das Backend ist live (alle Modul-APIs vorhanden); nur das Frontend wird neu gebaut.

---

## 1. Über die Design-Dateien (WICHTIG)

Die beiliegende Datei **`KLARWERK Control Room.dc.html`** ist eine **Design-Referenz**, kein Produktionscode zum 1:1-Kopieren. Sie ist als „Design Component" (HTML + ein kleines Laufzeit-Framework `support.js`) gebaut und zeigt Aussehen, Aufbau und Verhalten.

**Deine Aufgabe:** dieses Design in der **bestehenden Umgebung der Zielcodebasis** nachbauen (React/Vue/etc. mit deren Patterns, Routing, State-Lib, Komponenten). Falls noch keine Umgebung existiert, empfehle ich **React + TypeScript + Vite, React Router, TanStack Query** (Server-State), **react-i18next** (DE/EN) und eine Komponentenschicht mit Tailwind oder CSS-Modules. Inline-Styles der Referenz NICHT übernehmen — sie sind nur Artefakt des Prototyp-Formats.

**Fidelity: Hi-Fi.** Farben, Typografie, Abstände, Radien und Interaktionen sind final und pixelgenau umzusetzen.

---

## 2. Produktkontext & verbindliche Leitplanken

KLARWERK erfasst, validiert, klärt, beantwortet und pflegt industrielles Erfahrungswissen. Eine austauschbare KI-Schicht („Reasoner") hilft beim Strukturieren/Beantworten, **entscheidet aber nie über Wahrheit**. Diese Grundsätze müssen sich in jeder Oberfläche widerspiegeln:

- **G-1 Vertrauen = Evidenz.** Jede Aussage trägt sichtbar einen Reifegrad (siehe §5).
- **G-2 Keine erfundenen Antworten.** Ohne belastbare Grundlage → Wissenslücke statt Antwort.
- **G-3 KI ist Hilfsmittel.** Reasoner-Inhalte sind **immer** visuell/sprachlich als Entwurf erkennbar (Violett, gestrichelt, Label „nicht validiert").
- **G-4 Herkunft sichtbar.** Autor, Originalautor, Version, Status, Gültigkeit an jeder Darstellung und jedem Output.
- **G-5 Kein stilles Überschreiben.** Widersprüche werden zu sichtbaren, geführten Konflikten.
- **G-6 Rollen bestimmen Sicht & Handlung.** Unerlaubtes wird gar nicht erst angezeigt (zusätzlich serverseitig abgesichert).
- **G-7/N-4 Sicherheit im Client.** Keine Geheimnisse (KI-Keys) im Bundle; alle KI-/Mailaufrufe serverseitig.
- **G-8 Zweisprachigkeit DE/EN**, ressourcenbasiert erweiterbar (inkl. KI-Antworten & Interviews).
- **G-9 Desktop + Mobile/PWA** (Schwerpunkte siehe §8).
- **G-10 Nachvollziehbarkeit.** Audit-Log unveränderlich.

---

## 3. Design-Tokens

### Farben
| Rolle | Token | Hex |
|---|---|---|
| Seiten-Hintergrund | `bg/page` | `#f3f4f6` |
| Flächen / Karten / Sidebar | `bg/surface` | `#ffffff` |
| Tiefdunkel (Ink, primäre Buttons, dunkles Panel) | `ink` | `#16222c` |
| Text Standard | `text` | `#1b1e21` / `#23272b` |
| Text gedämpft | `muted` | `#687078` |
| Text schwach / Meta | `muted-2` | `#8a929a` · `#9aa1a8` · `#aab1b8` |
| Trennlinien | `hairline` | `#e4e7ea` · `#f0f1f3` · `#eceef0` |
| **Marke / Akzent (Auswahl, aktive Nav, primäre CTA-Akzente)** | `brand` | **`#ED7D0E`** |
| Marke heller (Score-Verlauf) | `brand-300` | `#f5a04a` |

### Semantik — Vertrauens-Ampel (NUR hierfür verwenden)
| Zustand | Text | Füllung | Hintergrund |
|---|---|---|---|
| Positiv / Validiert / Gesichert | `#256b46` | `#3aa06a` | `#e2f1e8` |
| Achtung / Prüfung / Belastbar | `#9a6a12` | `#c8861a` | `#faf1db` |
| Kritisch / Abgelehnt / Konflikt | `#9e352e` | `#c0473f` | `#f8e7e5` |
| Info / Offen | `#1c5d70` | — | `#e4eef1` |

### Semantik — KI / Reasoner (NUR für KI-erzeugte Inhalte)
| Token | Hex |
|---|---|
| Violett (Label, Rahmen, ✦) | `#5b50c4` |
| Violett hell (✦ auf dunklem Button) | `#9d93f0` |
| Violett Flächen | `#ecebfb` · `#f6f4fd` |
| Gestrichelter Rahmen | `#b9b2ec` |

> **Farb-Disziplin:** Orange = Marke/Auswahl. Grün/Gelb/Rot = ausschließlich Reife/Status. Violett = ausschließlich KI/Reasoner. Primäre Aktions-Buttons sind `ink` (`#16222c`), **nicht** farbig — so konkurriert nichts mit dem Marken-Orange.

### Typografie
- **IBM Plex Sans** (400/500/600/700) — gesamte UI.
- **IBM Plex Mono** (400/500/600) — IDs, Codes, Zahlen, Badges und alle **Großbuchstaben-Mikrolabels** (`letter-spacing` ~0.5–1.5px, Größe 10.5–11px, Farbe `muted-2`).
- Skala: H1 24px/600 (Dashboard-Begrüßung 27px), H3 15–15.5px/600, Body 13.5–14.5px/1.6, Klein 12.5px, Mikro-Label 10.5–11px.

### Radius / Schatten / Abstände
- Radius: Karten **13px**, Buttons 8–10px, Inputs 9px, Pills/Badges 5–7px, Nav-Zeilen 10px, Avatare 50%.
- Schatten: Karten flach (nur 1px Border `hairline`); Dropdown/Popover `0 14px 40px rgba(16,24,32,.16)`; Logo-Kachel `0 1px 3px rgba(16,24,32,.14)`.
- Layout: Content-Padding `30px 36px`; Karten-Padding 18–22px; Grid-Gaps 12–20px; Inhaltsbreiten je Screen 760–1240px.

### Logo
Zielscheibe: weiße abgerundete Kachel (Radius 10–11px, leichter Schatten) mit zwei konzentrischen orangen Kreisen — äußerer Ring `stroke #ED7D0E` ~3.4px, innerer gefüllter Punkt r≈3. Wortmarke **KLARWERK** (`#16222c`, 700, `letter-spacing` 2px), Untertitel **REASONING SYSTEM** (Mono, `#a2a8af`, `letter-spacing` 1.5px).

---

## 4. Globale Struktur (App-Shell)

Zwei Top-Level-Modi:
1. **App-Chrome** (eingeloggt): linke Sidebar (252px) + Topbar (60px) + scrollbarer Content.
2. **Vollbild** (ohne Chrome): Login/Auth und Mobile/PWA-Vorschau.

**Sidebar (hell, `#fff`, Border rechts):** Logo → rollenbasierte Nav-Gruppen → Rollen-Umschalter (+ Stufe-2-Toggle für Admin) + Nutzer/Logout am Fuß. Nav-Zeilen: Icon in heller Kachel (27px, Radius 8px, `rgba(16,24,32,.05)`) + Label. **Aktiv = Zeile in `brand`-Orange, weißer Text, `outline:2px solid #ED7D0E; outline-offset:2px`** (Ring mit weißem Spalt). Gruppen-Header in Mono-Großbuchstaben `#a2a8af`.

**Navigation ist radikal rollenbasiert** (G-6, N-2). Standardrolle = **Experte** (fokussiert, kein „Adminsystem"). Höhere Rollen schalten Gruppen frei; Stufe-2-Module sind im Standard **nicht** sichtbar.

**Nav-Gruppen & Items (nach Rolle):**
- *Arbeitsbereich (alle relevanten Rollen):* **Start** · **Meine Aufgaben** (Badge, ab Experte) · **Wissen erfassen** (ab Experte) · **Fragen** · **Bibliothek**
- *Qualität & Pflege (ab Controller):* Validierung (Badge) · Konflikte (rote Badge) · Risiko & Lücken · Lebenszyklus (Badge)
- *Steuerung (Admin):* Analytics & Audit · Admin
- *Erweitert · Stufe 2 (Admin, nur wenn Schalter „Erweiterte Module" aktiv):* Output Factory · Import & Quellen · Wissensgraph · Kapital-Sichten — jeweils mit „2"-Marker
- *Fuß:* Hilfe

**Rollen-Sichtbarkeit (Sidebar-Matrix):**

| Bereich | Viewer | Experte | Controller | Admin |
|---|:--:|:--:|:--:|:--:|
| Start · Fragen · Bibliothek | ✓ | ✓ | ✓ | ✓ |
| Meine Aufgaben · Wissen erfassen | – | ✓ | ✓ | ✓ |
| Validierung · Konflikte · Risiko & Lücken · Lebenszyklus | – | – | ✓ | ✓ |
| Analytics & Audit · Admin | – | – | – | ✓ |
| Stufe 2 (Output/Import/Graph/Kapital) | – | – | – | nur bei aktivem Schalter |

**Stufe-2-Schalter:** Im Sidebar-Fuß (nur Admin) blendet ein Toggle **„Erweiterte Module · Stufe 2"** die Stufe-2-Gruppe ein/aus. Standard = aus. So bleibt Stufe 1 das klare Kernprodukt; Stufe-2 ist vorbereitet, aber nie dominant.

**Topbar:** globale Suche (⌘K, U-2) · „Mobil"-Umschalter · Hilfe (?) · DE/EN-Pille · Benachrichtigungs-Glocke mit Badge + Popover (U-3) · Reasoner-Status („aktiv", muss echte Server-Verfügbarkeit spiegeln, U-8).

---

## 5. Das Vertrauens-/Evidenz-System (Kern, überall einheitlich)

**Status-Pill** (Mono, 600, Radius 5–7px) — Map `status → {label, text, bg}`:

| key | Label | Text | BG |
|---|---|---|---|
| `entwurf` | Entwurf | `#687078` | `#eef0f1` |
| `offen` | Offen | `#1c5d70` | `#e4eef1` |
| `pruefung` | In Prüfung | `#9a6a12` | `#faf1db` |
| `validiert` | Validiert | `#256b46` | `#e2f1e8` |
| `abgelehnt` | Abgelehnt | `#9e352e` | `#f8e7e5` |
| `revalidierung` | Re-Validierung | `#9a6a12` | `#faf1db` |
| `konflikt` | Konflikt | `#9e352e` | `#f8e7e5` |

**Konfidenz/Reifegrad (0–100):** horizontaler Balken (Breite = Wert%) + Mono-Zahl + Qualitäts-Label. Schwellen: `<65` **Vorläufig** (`#9aa1a8`) · `65–84` **Belastbar** (`#c8861a`) · `≥85` **Gesichert** (`#3aa06a`). Muss überall ohne Klick erkennbar sein (A-4).

**Wissensarten (5)** als Mono-Tag mit Glyph: Intuition `∿` · Best Practice `★` · Lernkurve `↗` · Technik `⚙` · Negativwissen `⊘`. Setz- und filterbar, visuell unterscheidbar.

**KI-Kennung:** Reasoner-Inhalte = gestrichelter violetter Rahmen + Fläche `#f6f4fd` + Label „REASONER-ENTWURF · NICHT VALIDIERT" + ✦. Niemals wie validiertes Wissen aussehen.

**Herkunftszeile (G-4):** Autor · Originalautor · Domäne · Version — am Objekt und an jedem erzeugten Output.

---

## 6. Screens / Views

> Copy ist als deutsche Referenz im Prototyp hinterlegt; alle Strings über i18n-Keys führen (DE/EN).

1. **Login / Auth (Vollbild, 2-spaltig).** Dunkles Marken-Panel (`#16222c`) links + Formular rechts (480px). Sub-Zustände: **Login** · **Registrieren** (Name, E-Mail, Passwort ≥ 8) · **Wartet auf Freigabe** (Hinweis, bis Admin freischaltet) · **Ersteinrichtung** (erstes Konto = Admin bei leerer Instanz). Klare Abweisung falscher/nicht freigegebener Anmeldungen. (§7.2)
2. **Start / Persönliche Arbeitszentrale (rollenabhängig).** Begrüßung + **rollenabhängiger Primär-CTA** (Experte „Wissen erfassen", Controller/Admin „Validierung öffnen", Viewer „Frage stellen"). Führt mit **„Heute zu tun"** (priorisierte Aufgabenliste, Sprung zu Meine Aufgaben) + **rollenabhängigen KPIs** (2–3, je Rolle unterschiedlich) + **Schnellzugriff**-Karte + kompaktem KI-Hinweis. Darunter „Wissens-Gesundheit" + „Zuletzt geändert". Handlungsorientiert statt dekorativ. (§7.1, U-1)
   - **Heute-zu-tun-Priorität:** Experte → Entwürfe/Rückfragen/Revalidierung/Lücken; Controller → zugewiesene Validierungen/Konflikte/Lücken; Admin → Engpässe/überfällige Validierungen/Freigaben.
2a. **Meine Aufgaben (ab Experte).** Zentrales, rollenübergreifendes Aufgaben-Pattern: bündelt Entwurf fortsetzen, einreichen, Validierung, Rückfrage, Konflikt, Wissenslücke, Revalidierung, Autorenübergabe, (Stufe 2) Importkandidat. Sortiert nach Priorität **Kritisch · Heute · Später**; Filter (Typ, Priorität, Domäne); je Aufgabe Typ-Tag + Prioritäts-Pill + direkte CTA mit Sprung zum Objekt; Stapel-Aktion für Prüfer. (§7.1 / D)
3. **Erfassen / Expert Studio.** Modus-Tabs (Freitext · Formular · Diktat · Geführtes Interview). Links Rohtext-Eingabe + Anhänge (Foto/Kamera, Dokument-Upload mit OCR), „Mit Reasoner strukturieren". Rechts der **Reasoner-Entwurf** (violett): Kernaussage, Bedingungen, Maßnahme, Tags, Wissensart, Konfidenz → „Prüfen & einreichen". Entwurf geräteübergreifend fortsetzbar; Originalautor bleibt. (§7.3, §7.4, W-1)
4. **Wissensobjekt-Detail / Wiki.** Kopf: Status-Pill, Wissensart, Version/Asset, Titel + Vertrauenspanel (Konfidenz + grün/rot-Zähler). Aktionen rollenabhängig: Bearbeiten, Validieren, Konflikt melden, „Hat geholfen", „Noch gültig?". Body: Aussage, Bedingungen, hervorgehobene Maßnahme, Tags; Sidebar: Herkunft + Versions-Historie (Timeline). (§7.5, L-1)
5. **Validierung / Validation Board.** Filter-Chips (Mir zugewiesen, Status, Domäne, Volltext). **Stapel-Leiste** (ab Controller): „Alle auswählen", „Stapel bestätigen", „Zuweisen" + Auswahl-Kästchen je Zeile, in Prioritätsreihenfolge. Zeilen mit Fortschritt (grün/gelb/rot-Balken, „x/3 grün") + Bewertungs-Buttons ✓ bestätigen / ~ bedingt / ✗ ablehnen. Kommentar nur erzwingen bei bedingt/abgelehnt. Schwelle (konfigurierbar; default 3× grün, 0× rot) → automatisch „validiert"; rote Bewertung → Rückgabe an Autor; widersprechende Ablehnung → Konfliktvorschlag. (§7.6, L-2, W-2 / G)
6. **Konflikte / Conflict Board.** Karten mit Klassifikation (Kontext/Zeit/Rolle/Erfahrung/Wahrheit), Gegenüberstellung Position A vs. B inkl. Quellen. **Nur Wahrheitskonflikte** zeigen den Eskalationspfad (Eskaliert → Zweitmeinung → Controller-Entscheidung → Gelöst). (§7.7, L-3, W-3)
7. **Fragen / Query Console.** Eingabe + Beispiele. **Antwort** (aus validiertem Wissen): Evidenzlevel, Aussage, Argumentationsschritte, Quellen-Verlinkung, „Hat geholfen". **Oder Lücke:** „Keine belastbare Grundlage" + „Wissenslücke anlegen" (G-2). (§7.8, W-4)
8. **Bibliothek.** Volltext/intelligente Suche + Filter (Art, Status, Domäne, Tags, **Vertrauen**) + **gespeicherte Filter** + **Sortierung** (zuletzt geändert, Vertrauen, Risiko …). **Umschaltbare Ansicht: Liste ↔ Karten** — Standard = **Liste** (kompakte Meta-Zeile: Status · Art · Domäne · Asset · Version · Konfidenz-Bar · Autor) für große Mengen (≥100.000, virtualisieren); Karten optional. **Mehrfachauswahl** (Checkbox je Zeile) für berechtigte Rollen. Export (JSON/Markdown/MediaWiki/PDF), Re-Validierung anstoßen. (§7.10 / F)
9. **Risiko & Lücken.** Bus-Faktor/Einzelquellen-Risiko je Domäne (Balken) + Liste offener Wissenslücken (Priorität, Zuweisung). (§7.9)
10. **Lebenszyklus / Pflege.** „Stimmt das noch?"-Banner bei Anlagenänderung (gekoppelte Objekte prüfen); Re-Validierungs-Liste mit „Noch gültig" / „Überarbeiten → neue Version" / „In Prüfung"; **Autorenübergabe** (nur Admin; Autor ändert sich, Originalautor bleibt in Fußnote); Gültigkeits-Verteilung. (§7.14, L-1, W-5)
11. **Output Factory (Stufe 2).** Builder (Output-Typ: SOP/Checkliste/Troubleshooting/Schulung/Management-Summary; Quellenauswahl **nur validiert**) + Live-Vorschau mit vollständiger Herkunftskennzeichnung; Export Markdown/PDF. (§7.12)
12. **Import / Source-Review (Stufe 2).** Datei-Dropzone (txt/md/pdf/docx/Bild, OCR) + Review-Warteschlange: je Kandidat Annehmen → Validierung / Ablehnen / Nachinfo; initial unvalidiert/importiert mit verlinkter Quelle. (§7.11, L-5)
13. **Wissensgraph (Stufe 2).** Knoten (Wissensobjekt/Domäne/Experte) + Kanten, Konfliktkanten gestrichelt rot, Legende. (§7.9)
14. **Analytics & Audit.** Kennzahlen (validiert/Woche, Antwort ohne Lücke, Ø Vertrauen, offene Konflikte), Verteilung nach Wissensart, **unveränderliches Audit-Log** (wer/was/wann). (§7.13, G-10)
15. **Kapital-Sichten (Stufe 2, echte Live-Daten).** Knowledge Capital Score + Reifegrad-Reise; Knowledge Statement (Aktiva/Risiko/Netto in €); Knowledge-House-Visualisierung; 9-Faktoren-Priorisierung; Pilot-Bericht 30/60/90 (PDF). Erst „erfüllt", wenn auf echten Daten/Regeln basierend. (§7.17)
16. **Admin / Nutzerverwaltung.** Tabelle (Name, Rolle, Status); Anlegen, Freigeben, Rolle ändern, Passwort zurücksetzen (Sitzungen verfallen), Löschen; je Aktion Audit-Eintrag; **Selbstschutz: Admin kann sich Admin-Rolle nicht selbst entziehen**. (§7.15, RB-4)
17. **Profil.** Konto, Rolle, eigene Kennzahlen, Sprachwahl, Abmelden (Sitzung serverseitig beenden). (U-6, U-7)
18. **Hilfe.** Durchsuchbare, zweisprachige, kontextnahe Themen-Karten. (U-4)
19. **Mobile / PWA (Vollbild, Geräterahmen).** Installierbar (Vollbild, Icon, Offline-Start). Dominante Aktion = Entwurf festhalten (großes Diktat-CTA + Notiz/Foto/Interview/Nachschlagen), Entwurfsliste mit Offline-/Sync-Status, app-eigene Inline-Bestätigung destruktiver Aktionen. (§7.16, P-2…P-5)

---

## 7. Interaktionen, Animation & Zustände

- **Navigation:** SPA-Routing, eine Route je View; aktiver Zustand in Nav gespiegelt.
- **Implementiert im Prototyp (als Verhaltensreferenz):** Rollen-Umschalter (baut Nav um), DE/EN-Umschalter, Erfassen→Reasoner→Einreichen (Objekt landet offen im Board), Bewertungen grün/gelb/rot mit Schwellenlogik, Fragen→Antwort/Lücke, Benachrichtigungs-Popover, Mobile-Vorschau, Login-Sub-Zustände.
- **Animation:** dezente Einblend-Transition beim View-Wechsel (~0.3–0.35s, nur Translate/Opacity), Popover-Fade 0.2s, Toast-Slide. Keine verspielten Effekte.
- **Zustände (N-3, U-8, U-9):** optimistische Aktualisierung mit serverseitigem Abgleich; ehrliche Lade-/Fehler-/Offline-/„KI nicht verfügbar"-Zustände; kein Datenverlust bei Ansichtswechsel/Vorschau↔Bearbeiten/Gerätewechsel (N-8).
- **Mobil:** destruktive Aktionen → app-eigene Inline-Bestätigung (kein nativer Dialog).

---

## 8. Plattform

- **Desktop „Control Room":** Primär für Strukturieren, Validieren, Konfliktklärung, Analyse, Verwaltung; große Listen/Filter/Parallelaufgaben; muss bei ≥100.000 Objekten such-/filterbar bleiben (Virtualisierung empfohlen, N-1).
- **Mobile/PWA:** Erfassung an der Anlage; gut lesbar/bedienbar (Touch, Handschuhe, wechselndes Licht; Hit-Targets ≥ 44px, N-5). Gemeinsamer Entwurfs-Pool Desktop↔Mobil (P-3); Offline-Queue/Sync als Stufe 2 (P-5).

---

## 9. Rollen & Berechtigungen (clientseitig abbilden, serverseitig maßgeblich)

Rang: Viewer < Experte < Controller < Admin (jede höhere schließt niedrigere ein).
- **Viewer:** Suchen, Lesen, Fragen, „Hat geholfen". Sicht: Überblick, Fragen, Bibliothek, Hilfe, Profil.
- **Experte:** + Erfassen/Strukturieren, Entwürfe, eigene Objekte pflegen, an Validierung beitragen, Lebenszyklus.
- **Controller:** + Validierung zuweisen/bewerten, Status setzen, Konflikte klassifizieren/auflösen, Re-Validierung, Risiko & Lücken, Import.
- **Admin:** + Nutzerverwaltung, Autorenübergabe, Audit-Einsicht, Analytics, Kapital-Sichten, Systemeinstellungen.

Regeln: nicht erlaubte Bereiche/Aktionen **nicht anzeigen** (RB-1); Deep-Links auf Unerlaubtes sauber abweisen (RB-2); Rollenwechsel ohne Neuaufbau des mentalen Modells (RB-3); Admin-Selbstschutz (RB-4).

---

## 10. State & Daten (Vorschlag)

- **UI-State:** `view/route`, `role`, `lang`, ausgewähltes Objekt, Capture-Entwurf (`rawText`, strukturierter Entwurf), Ask-Query/Result, Bewertungen, Toast, Auth-Sub-Zustand, Notif-offen.
- **Server-State (TanStack Query o. ä.) gegen vorhandene Modul-APIs:** Wissensobjekte (Liste/Detail/Versionen), Validierungsaufgaben, Konflikte, Wissenslücken, Importkandidaten, Nutzer, Audit, Benachrichtigungen, Analytics.
- **Datenobjekte** siehe §6 der Anforderungsbeschreibung (WO mit allen Feldern, 5 Wissensarten, Entwurf, Validierungsaufgabe, Konflikt, Wissenslücke, Importkandidat, Nutzer, Audit-Eintrag).

---

## 11. Backend-Abhängigkeiten (Scope-Stufen)

- **Stufe 1 (Kern):** Foundation, Auth/Onboarding, Capture (ohne Foto/Objektspeicher), Reasoner-Strukturierung/Interview, WO-Detail, Validierung, Konflikte, Ask, Bibliothek/Export, Analytics-Kernkennzahlen + Audit, Lebenszyklus, Admin, Mobile-Kern.
- **Stufe 2 / an Backend-Lücken gekoppelt:** Wissenslücken & „Frage→Lücke" → **gaps-API**; Import/Source-Review → **imports-API**; Output Factory → **Output-Logik**; externe Quellen → **External-Knowledge-Proxy**; Wissensgraph → **Graph-Daten**; Kapital-Sichten → **Wissenskapital-Kennzahlen (datenbasiert)**; Foto/Anhänge → **Objekt-/Dateispeicher**.

Diese Bereiche im UI vollständig mitdenken, in der Umsetzung jedoch erst aktivieren, wenn die jeweilige API steht.

---

## 12. Abnahmekriterien

- **A-1** Experte hält an der Anlage ohne Schulung in < 2 min mobil ein verwertbares Wissensobjekt fest (Entwurf).
- **A-2** Prüfer erkennt offene Aufgaben sofort, schließt eine Validierung in wenigen Schritten ab.
- **A-3** Betrachter erhält begründete, mit Quellen/Vertrauen versehene Antwort — oder ehrliche Lücke, nie eine erfundene Aussage.
- **A-4** Vertrauensgrad, Status, Herkunft an jeder Stelle ohne Klick erkennbar.
- **A-5** Jeder sieht ausschließlich rollengerechte Funktionen.
- **A-6** Widerspruch → nie stiller Datenverlust, immer sichtbarer geführter Konflikt.
- **A-7** Oberfläche bleibt bei sehr großen Beständen und vielen offenen Aufgaben übersichtlich und schnell.

---

## 13. Dateien im Paket

- `KLARWERK Control Room.dc.html` — **Hi-Fi-Design-Referenz** (alle Screens, interaktiv; im Browser öffnen). Rolle/Sprache/Akzentfarbe sind im Prototyp umschaltbar; Standardrolle = Admin (zeigt die gesamte Navigation).
- `Frontend-Anforderungsbeschreibung.md` — vollständige fachliche Anforderungsbeschreibung (Quelle der §-Verweise).
- `BRIEF.md` — dieses Dokument.
- `screenshots/` — Hi-Fi-Screenshots aller Screens + `INDEX.md` (Zuordnung Datei → Screen → §).

**Empfohlene Reihenfolge der Umsetzung:** App-Shell + Tokens + Vertrauens-System → Auth → geschlossener Kernkreislauf (Erfassen → Validieren → Konflikt/Lücke → Fragen → Lebenszyklus) → Bibliothek/Analytics/Admin → Mobile → Stufe-2-Bereiche, sobald die APIs verfügbar sind.
