# Klara im Setup · Bestand der Einstellungen, Aktionen, Kürzel und Hosts (AA-01)

Auftrag `produkt:20261012:klara-setup-shortcuts-bestand` · Quelle `PO-KLARA-SETUP-SHORTCUTS-20261012-v1`,
Abschnitt AA-01 · erhoben am 12.10.2026 auf Basis `25f2ea02c` (1.0.0-beta.1.944).

Maschinenlesbar und mit wörtlichen Ankern: [`fundstellen.json`](./fundstellen.json). Jeder Eintrag mit
Stand **geliefert** ist dort mit Datei und Ankerzeichenkette belegt; `tests/klara-setup-shortcuts/
fundstellen.test.ts` prüft, dass jede Datei existiert und den Anker enthält. Zeilennummern stehen
bewusst nicht in der Liste — sie wandern mit jeder Lieferung.

**Stände.** *geliefert* = im Hauptstand dieser Basis enthalten. *Kandidat* = nur auf einem laufenden
Auftragszweig, nicht im Hauptstand, keine Abnahme. *beauftragt* = nur als Arbeitsauftrag vorhanden,
kein Code. Diese Erhebung ist Quelleninspektion; sie ist keine Bedien- oder Hostabnahme.

## 1. Was heute „Setup“ ist

Ein eigenes „Setup“ gibt es im Produkt nicht unter diesem Namen. Die Einstellungsflächen hängen am
Zahnrad „Einstellungen und Hilfe“ im Kopfband (`apps/web/src/shell/ZahnradMenue.tsx`):

| Eintrag | Ziel | Wer | Inhalt mit Klara-Bezug |
| --- | --- | --- | --- |
| Persönliche Einstellungen | `/profil` | jede Rolle | Zeile „Meine Assistenz“ (E01–E03, E07) |
| Einstellungen (Überschrift „Verwaltung“) | `/admin` | nur `admin` | KI-Freigabe/Modelle (O01), externe Abfrage (O02) |

„Ersteinrichtung“ meint im Code die Admin-Erstanlage (`auth.title.setup`) und das Einrichtungsband
der Assistenz (E04). Peters „Setup“ entspricht fachlich den **Persönlichen Einstellungen**; die
organisationsweiten Teile bleiben im Admin-Bereich (siehe Integrationsplan).

## 2. Einstellungen

### 2.1 Persönlich (je Konto oder je Gerät)

| ID | Einstellung | Stand | Host | Ort heute | Speicher | Geltung |
| --- | --- | --- | --- | --- | --- | --- |
| E01 | Name der Assistenz | geliefert | Web | `/profil` › Meine Assistenz; Ersteinrichtung | Server `assistenz_profile` | Konto |
| E02 | Motiv (Avatar), 13 freigegebene | geliefert | Web | wie E01 | Server `assistenz_profile.data.avatar` | Konto |
| E03 | Reduzierte Bewegung | geliefert | Web | wie E01 | Server `assistenz_profile.data.bewegung` | Konto |
| E04 | Ersteinrichtung abgeschlossen | geliefert | Web | Band in der App-Hülle | Server `eingerichtetAm`; „Später“ nur Sitzung | Konto |
| E05 | Unterstützungsmodus (Nachfrage · Hinweise · übertragene Aufgaben) | geliefert | Web | **nur im Gespräch**, nicht in `/profil` | Server `assistenz_profile.data.eigeninitiative` | Konto |
| E06 | Hinweise „Später“/„Nicht mehr anbieten“ | geliefert | Web | am Hinweis, keine Übersicht | Server, wie E05 | Konto |
| E07 | Fähigkeiten: Favoriten, bestätigte Routinen | geliefert | Web | `/profil` › Meine Assistenz | Server `assistenz_profile.data.faehigkeiten` | Konto |
| E08 | Automatisch vorlesen, Vorlesetempo | geliefert | Web | im Gespräch („Sprachausgabe“) | **Browser `localStorage`** `klarwerk.klara.sprachausgabe` | Gerät/Browserprofil |
| E09 | Position, Andocken, Parken, Ansicht, offen/minimiert | geliefert | Web | an Figur und Gespräch | Browser `sessionStorage` | Sitzung (Bedienzustand) |
| E10 | Klara-Vorschau (Demo) ein/aus | geliefert | Web | `/klara-vorschau` | Browser `sessionStorage` | Sitzung (Bedienzustand) |

Sprache der Oberfläche (`/profil` › Sprache) wirkt auch auf Klara, ist aber keine Klara-Einstellung
und wird hier nicht mitgezählt.

### 2.2 Organisationsweit

| ID | Einstellung | Stand | Wirkung auf Klara | Speicher | Recht |
| --- | --- | --- | --- | --- | --- |
| O01 | KI-Freigabe, KI-Abschaltung, Modellzuordnung | geliefert | Gespräch und Fähigkeiten lesen „Keine KI“ und Freigaben bei jedem Schritt frisch | Server, `/api/reasoner/config` | `users.manage` (admin) |
| O02 | Stufe der externen Wissensabfrage | geliefert | gibt die Fähigkeit Wikipedia-Suche frei oder nicht | Server, `external_knowledge_policy` | `users.manage` (admin) |
| O03 | `KLARWERK_ADDON_API` (älteres Office-Bündel `/addin/*`) | geliefert | Route registriert oder 404 | Server-Umgebung | Betreiber, keine Oberfläche |

### 2.3 Rollen- und Berechtigungsregeln (zu übernehmen, nicht zu erweitern)

- Persönliche Assistenz-Einstellungen (E01–E07): jede angemeldete Rolle (`requireUser`); das Konto
  kommt **ausschließlich** aus der Sitzung; nennt eine Anfrage eine fremde Kontokennung, antwortet
  der Server 403 und ändert nichts (`nenntFremdesKonto` in `assistenz-profil-routes.ts`).
  Ins Prüfprotokoll gehen nur Ereignisse, nie Name oder Hinweisschlüssel.
- Klara-Gespräch und Office-Sitzungen: `ko.read` — das hat jede Rolle (`viewer: ["ko.read"]`).
  Eine eigene `klara.*`-Berechtigung gibt es nicht und ist nicht vorgesehen.
- Organisationsweite Werte (O01, O02): `users.manage`, also nur `admin`.
- Browser-Erweiterung und Word-Add-in: eigene Anmeldung am Server; dort gelten dieselben Rechte.

## 3. Aktionen

| ID | Aktion | Stand | Host | Auslösung heute |
| --- | --- | --- | --- | --- |
| A01 | Persönliche Assistenz öffnen/schließen („Klara öffnen“) | geliefert | Web | Klick/Eingabe/Leertaste auf der Figur; Escape schließt |
| A02 | Seitenhilfe (?-Knopf) öffnen, Element zeigen | geliefert | Web | Klick; nie zugleich mit A01 offen |
| A03 | Figur bewegen, andocken, zurücksetzen, Vollbild | geliefert | Web | Pfeiltasten/Home an der Figur, Knöpfe |
| A04 | Frage/Auftrag senden; Modi Erkläre · Zeige · Begleite | geliefert | Web | Formular, Knöpfe |
| A05 | Auswahl übersetzen, umformulieren, als Notiz, als Nachricht | geliefert | Web | Auswahlkarte |
| A06 | Private Notizen, persönliche Aufgaben | geliefert | Web | im Gespräch |
| A07 | Fähigkeit mit Vorschau ausführen | geliefert | Web | Meine Assistenz › Fähigkeiten |
| A08 | Browser-Seitenleiste öffnen; „In Klarwerk übernehmen“ | geliefert | Browser-Erweiterung | Symbol, Kontextmenü, T05 |
| A09 | Klara in Word: fragen, Markierung als Entwurf senden | geliefert | Office (Word) | Aufgabenbereich |

Für Tastenkürzel geeignet sind nach heutigem Bestand die **Einstiegsaktionen** A01 und A02 — sie
öffnen eine vorhandene Fläche und lösen selbst nichts Fachliches aus. A04–A07 brauchen Kontext
(Auswahl, Eingabe, Vorschau) und sind keine sinnvollen globalen Kürzelziele; sie werden nicht
vorausgesetzt.

## 4. Vorhandene Tastenkürzel

| ID | Kürzel | Wirkung | Stand | Bemerkung |
| --- | --- | --- | --- | --- |
| T01 | ⌘K / Strg+K | Befehlspalette „Seite finden“ | geliefert | kein Klara-Kürzel; prüft nur `metaKey \|\| ctrlKey` + K — **auch Control+Command+K würde die Palette umschalten** |
| T02 | Escape | schließt Gespräch, Seitenhilfe, Zeige-Modus | geliefert | |
| T03 | Pfeile, Umschalt+Pfeile, Home | Figur bewegen/zurücksetzen | geliefert | nur bei Fokus auf der Figur |
| T04 | Enter (Umschalt+Enter) | senden (Zeilenumbruch) | geliefert | Web-Formular, Word |
| T05 | Alt+Shift+K | Browser-Seitenleiste öffnen | geliefert | Chrome-Vorschlag; Belegung verwaltet Chrome, nicht Klarwerk |
| — | Control-Option-K | Begleitfigur zum Zeiger holen (systemweit) | **Kandidat C01** | nicht im Hauptstand; siehe Entscheidungsvorlage |

Ein frei belegbares Klara-Kürzel gibt es heute in keinem Host. Die Anzeige von Kürzeln hat genau
eine Quelle (`apps/web/src/lib/tastenkuerzel.ts`, Apple „⌘“, sonst „Strg“/„Ctrl“).

## 5. Hostkontexte, Zuständigkeiten, Grenzen

| ID | Host | Stand | Zuständig für | Technische Grenze für Kürzel/Einstellungen |
| --- | --- | --- | --- | --- |
| H01 | Web-App (SPA, `KlaraEbene` in `AppShell.tsx`) | geliefert | alle Einstellungen E01–E10, O01–O02; A01–A07 | Tastenereignisse nur, solange Tab und Fenster aktiv sind; Browser behält reservierte Kürzel (⌘W, ⌘T, ⌘Q …) |
| H02 | Chrome-Erweiterung „Klara im Browser“ 0.4.2 | geliefert | A08, T05; Sprache in `chrome.storage.local` | Kürzel nur über `commands` im Manifest, Nutzerbelegung nur in `chrome://extensions/shortcuts`; die Web-App kann sie nicht setzen |
| H03 | Word-Add-in „Klara“ | geliefert | A09 | Manifest ohne Kürzel; Add-in speichert bewusst nichts dauerhaft |
| H04 | „KLARWERK App.app“ | geliefert | Start des lokalen Servers, öffnet den Browser | Bash-Skript ohne eigenes Fenster und ohne Ereignisschleife — **kein Ort für ein systemweites Kürzel** |
| C01 | „Klara Begleiter“ (Swift/AppKit) | Kandidat | schwebende Figur über allen Apps, Menüleiste | einziger nativer Host mit globaler Registrierung; Hostabnahme offen |

## 6. Laufende Kandidaten mit Überschneidung (Stand 12.10.2026, Zweige im Repository)

| ID | Zweig · Commit | Überschneidung mit AA-02 bis AA-04 |
| --- | --- | --- |
| C01 | `codex/auftrag-08abbc8ce7113845b115` · `5b836e73b` | eigenes globales Kürzel Control-Option-K; ändert `KlaraVorschau.tsx` (+1440 Zeilen) und `AppShell.tsx` |
| C02 | `codex/auftrag-f592e61e001e4eccfde7` · `7713702f5` | ändert `assistenz-profil.ts` und `assistenz-profil-routes.ts` — dieselbe Ablage, die AA-03 erweitern soll |
| C03 | `codex/auftrag-97d57ecfa8c8bd7d3426` · `0dac2221a` | neue Zeile „Besprechungsassistenz“ in `/profil` — gehört in die Gruppierung von AA-02, sobald geliefert |
| C04 | `codex/auftrag-71c74841eea80f27c7b3` · `fb5766f0a` | ändert `KlaraVorschau.tsx` (Erinnerungen) |
| C05 | `codex/auftrag-a9f1916ab14978df76b8` · `bf41ae240` | ändert `KlaraVorschau.tsx` (Übernahme) |

Diese Kandidaten werden hier nur gelesen, nicht verändert. Nur beauftragt, ohne Code: AA-02 (B02),
AA-03 (B03), AA-04 (B04), AA-05 (B05). Offene Kalender-/Einführungsaufträge wurden hier nicht
inhaltlich abgeglichen; sie bleiben ihre eigenen Originale und werden von AA-02 bis AA-04 nicht
übernommen.

## 7. Grenzen dieser Erhebung

- Quelleninspektion im Arbeitsbaum und Lesen der Kandidatenzweige; kein Bedienlauf, kein Hostlauf,
  keine Screenreader-Prüfung.
- Das ältere Office-Bündel `services/app/addin-static` stammt aus einem eigenen Repository
  (`klarwerk-office-addin`); dessen Quellen liegen nicht hier und wurden nicht gelesen.
- Ob weitere laufende Aufträge außerhalb der Repository-Zweige Klara-Einstellungen planen, ist aus
  dem Repository nicht feststellbar.
