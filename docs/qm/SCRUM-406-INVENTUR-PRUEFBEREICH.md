# SCRUM-406 · Inventur: Bedienelemente im Prüfbereich (Vorarbeit, kein Code)

> [Cloud-Worker], 03.07.2026 · Basis: Quellcode-Stand v0.9.22-beta (Commit b543574).
> Zweck: vollständige Liste aller Funktionen, Auswahlen und Eingaben im Prüfbereich als
> Grundlage für die ?-HelpTip-Umsetzung NACH dem RC-Freeze. Je Element: Rolle/Sichtbarkeit,
> HelpTip-Bestand, und was der künftige Hilfetext erklären muss (Was? · Wann? · Was passiert
> danach — und was NICHT automatisch?). Zeilenangaben ≈ Stand heute.
>
> **Begriffs-Hinweis (ehrlich):** „Stufe 2" meint im Ticket den Quellen-Badge („externe Quelle,
> nicht peer-validiert", `sourceBadgeKey`/`ko.sourcesHint`) — NICHT den gleichnamigen
> Navigations-Schalter aus `lib/stufe2Hint.ts` (Admin-Module). Beide existieren; die Hilfetexte
> müssen die Verwechslung aktiv vermeiden.

## Bestand: vorhandene ?-HelpTips im Prüfbereich (nur 2!)

1. Validierungs-Board → „Entscheidungs-Hinweis" (`Validation.tsx` ~597, seit SCRUM-396).
2. KO-Detail → „Anlagen-Kopplung" (`KnowledgeDetail.tsx` ~1383, Audit B1).

Alles Übrige unten hat KEINEN HelpTip. Das HelpTip-Muster (`components/HelpTip.tsx`) ist
popover-basiert mit Link ins Hilfe-Center — unverändert wiederverwenden.

## A · Validierungs-Board (`pages/Validation.tsx`)

| # | Element | Typ | Rolle/Sichtbar | HelpTip | Hilfetext muss erklären |
|---|---|---|---|---|---|
| A1 | Herkunftsfilter „Demo/Eigenes" (+ Zähler) | Pill-Buttons ~341 | alle | ✗ | Nur Ansicht/Auffinden; ändert keinen Review-Status |
| A2 | Review-Fokus „Alle/Neu/Überarbeitet" | Pill-Buttons ~369 | alle | ✗ | Neu vs. revidiert (Version>1); warum Überarbeitete gezielt prüfen |
| A3 | „Aktive Fokusfilter"-Leiste + Zurücksetzen | Chip-Zeile ~396 | bei aktivem Filter | ✗ | Was gerade gefiltert ist; Zurücksetzen betrifft nur die Ansicht |
| A4 | Suchfeld | Textinput ~421 | alle | ✗ | Wonach gesucht wird (Titel etc.) |
| A5 | Filter Wissensart / Kategorie / Schlagwort | 3× Select ~427–462 | alle | ✗ | Reine Eingrenzung, nichts geht verloren |
| A6 | „Nur mir zugewiesene" | Checkbox ~463 | alle | ✗ | Persönliche Review-Liste; Bezug zur Glocke/?mine=1 |
| A7 | „Mir zugewiesen"-Fokuskarte (Zähler, Reset) | Karte ~315 | bei mineOnly | ✗ | dito A6; Rückweg zur Gesamtliste |
| A8 | Trust-Plakette, Version, Prüfziel („n Prüfer"), Badges ÜBERTRAGEN/ZUGEWIESEN, Arbeitszustand | Anzeige-Pills ~553–580 | alle | ✗ | Bedeutung jedes Signals; Trust-Band-Töne; „Ziel n" = Quorum |
| A9 | Entscheidungs-Hinweis-Zeile | Text + HelpTip ~590 | alle | ✓ (SCRUM-396) | Bestand prüfen: Text ggf. auf neues Was/Wann/Danach-Schema heben |
| A10 | „Was prüfe ich?"-Führung (Checkliste, Wirkungen, Trust-Notiz) | `<details>` ~606 | alle | ✗ (ist selbst Hilfe) | Ggf. nur Feinschliff; Quelle: `reviewGuidance.ts` |
| A11 | „Details ansehen →" (Weg ins KO-Detail) | Link ~655 | alle | ✗ | Dort liegen Bearbeiten/Löschen/Quellen — bewusst nicht auf dem Board |
| A12 | **Prüfentscheidung: Freigeben / Rückfrage* / Ablehnen*** | 3 Buttons ~666 | alle Prüfer | ✗ (nur title-Tooltip) | Kernstück: Wirkung je Entscheidung, * = Pflicht-Kommentar, Quorum, KEINE Auto-Validierung |
| A13 | Pflicht-Feedback-Formular (Rückfrage/Ablehnen) | Textarea + Senden/Abbrechen ~725 | nach A12 warn/down | ✗ | Feedback = Hilfe zur Nacharbeit; wohin es geht (Kommentar am KO) |
| A14 | Zuweisen-Dropdown | Select ~706 | alle | ✗ | Was Zuweisung bewirkt (Aufgabe, Glocke) — und was nicht (keine Bewertung) |
| A15 | Entscheidung-gespeichert-Karte (+ nächste Schritte) | Karte ~233 | nach Entscheidung | ✗ | Ehrliche Folge je Verdict; Links KO ansehen/nutzen |

## B · Prüfentscheidung im KO-Detail (`pages/KnowledgeDetail.tsx`)

| # | Element | Typ | Rolle | HelpTip | Hilfetext muss erklären |
|---|---|---|---|---|---|
| B1 | Validieren / Bedingt / Ablehnen | 3 Buttons ~995–1013 | controller/admin | ✗ | Wie A12; zusätzlich: Unterschied zur Board-Entscheidung (kein Pflicht-Feedback hier!) — Inkonsistenz im Hilfetext ehrlich benennen oder im Slice angleichen |
| B2 | „Noch gültig" (Revalidierung) | Button ~1016 | alle | ✗ | Bewährungssignal vs. neue Peer-Prüfung; was es am Frische-Status ändert |
| B3 | „Konflikt melden" | Ghost-Button ~1023 | canReview | ✗ | Wann Konflikt statt Ablehnung; was danach passiert (Konflikt-Board) |
| B4 | Konflikt-Formular: Gegen-KO (Select), Konfliktart (Select), Beschreibung (Textarea), Senden | 4 Elemente ~1036–1087 | canReview | ✗ | Konfliktarten erklären (truth/…); Meldung löscht/ändert nichts automatisch |

## C · Quellen-Panel im KO-Detail (Kern des Tickets, ~1120–1275)

| # | Element | Typ | Rolle | HelpTip | Hilfetext muss erklären |
|---|---|---|---|---|---|
| C1 | Quellenliste + **Stufe-2-Badge** je Quelle | Anzeige ~1128 | alle | ✗ | **Stufe 2 = extern, NICHT peer-validiert, nie Ersatz für Prüfer** — zentraler Ehrlichkeits-Text |
| C2 | Quelle entfernen (X) | Icon-Button ~1160 | canEdit | ✗ | Entfernt nur die Verknüpfung; keine Auswirkung auf Validierungsstand |
| C3 | „Externe Quelle hinzufügen": Bezeichnung / URL / Auszug | 3 Textinputs ~1177–1193 | canEdit | ✗ | Die drei Felder einzeln (was gehört hinein, was macht einen guten Auszug) |
| C4 | Hinweistext `ko.sourcesHint` | Text ~1194 | canEdit | ✗ | Bestand; ggf. in HelpTip-Schema integrieren |
| C5 | „Quelle hinzufügen" | Button ~1195 | canEdit | ✗ | Quelle hängt am KO, wandert mit Versionen; wird NICHT automatisch geprüft |
| C6 | **Server-Proxy-Suche**: Suchfeld + „Suchen" | Form ~1210–1231 | canEdit | ✗ | Suche läuft über den Server (Proxy, kein Client-Leak); Ergebnisse sind Vorschläge, KEIN Auto-Anhängen |
| C7 | Treffer „Anhängen" | Button je Treffer ~1261 | canEdit | ✗ | Bewusste Übernahme als Stufe-2-Quelle |
| C8 | „Quelle/Beitrag melden" (Beitrag + Fundstelle + Senden) | Karte ~1278–1300 | alle | ✗ | Unterschied zu C3: wird Review-KOMMENTAR, kein Quellen-Eintrag |

## D · Konflikte-Seite (`pages/Conflicts.tsx`) — „Konflikt-/Lücken-Aktionen"

| # | Element | Typ | HelpTip | Hilfetext muss erklären |
|---|---|---|---|---|
| D1 | „Empfohlener nächster Schritt" | Anzeige ~204 | ✗ | Woraus die Empfehlung abgeleitet wird (Art+Status) |
| D2 | „Eskalieren" | Button ~213 | ✗ | Nur truth+offen; wer dann entscheidet |
| D3 | „Zweitmeinung einholen" + Formular | Button ~218 + Textarea | ✗ | Was eine gute Zweitmeinung enthält; ändert Status |
| D4 | „Auflösen" + Entscheidung + Bestätigen | Button ~228 + Textarea | ✗ | **Dokumentierend, nicht mutierend** (SCRUM-128); ggf. Revalidierungs-Empfehlung — nichts wird automatisch geändert |

## E · Weitere Karten im Prüf-Kontext des KO-Details (Vollständigkeit)

- **Bewährungssignal „Hat geholfen"** (~1101): ✗ — was das Signal bewirkt (Evidenz, kein Ersatz für Prüfung).
- **Anlagen-Kopplung** (~1380): ✓ HelpTip vorhanden — Bestand prüfen.
- **Gültigkeit & Schutz** (~1427): ✗ — Frische/Output-Eignung/Empfehlung sind abgeleitet, keine gespeicherten Werte.
- **Herkunft & Autor-Übertragung** (~1303): ✗ — was die Übertragung bedeutet (Original-Autor bleibt sichtbar).
- **Wissensobjekt löschen** (~1348): ✗ — wer darf (Autor/Controller/Admin), Inline-Bestätigung, endgültig.
- **Historie / Evidenz / Snapshots** (~1578/1594/1788): ✗ — Lesehilfe, niedrigere Priorität.
- **Kommentare** (~1851) und **Anhänge** (~1887): ✗ — Kommentar öffentlich am KO; Anhang-Regeln (nur Bilder, canEdit).
- **Rework-Feedback-Kontext** (~600–730, SCRUM-326/327): ✗ — wie Prüfer-Feedback beim Überarbeiten angezeigt wird.

## Zählung & Empfehlung für den Umsetzungs-Slice

**~35 Bedienelemente/Anzeigen, davon 2 mit HelpTip (≈6 %).** Empfohlene Priorität:
1. **A12/B1** Prüfentscheidung (Kern-Verwirrpunkt, inkl. Board-vs.-Detail-Inkonsistenz),
2. **C1–C8** Quellen-Panel komplett (expliziter Pedi-Anlass, Screenshot 03.07.),
3. **B2–B4 + D1–D4** Revalidierung/Konflikt,
4. **A1–A8** Filter/Signale, 5. Rest (E).

Alle Texte DE+EN (`i18n.ts`), HelpTip-Muster unverändert, jeder Text nach dem Schema
**Was macht das? · Wann nutze ich es? · Was passiert danach (und was NICHT automatisch)?**
Ehrlichkeits-Anker: Stufe 2 ≠ peer-validiert · keine Auto-Übernahmen · Auflösen dokumentiert nur.

**Offene Frage an Pedi (Review der Inventur):** Soll die Inkonsistenz B1 (Detail-Entscheidung
ohne Pflicht-Feedback bei Rückfrage/Ablehnen — Board erzwingt es) im selben Slice angeglichen
werden oder nur ehrlich im Hilfetext stehen?
