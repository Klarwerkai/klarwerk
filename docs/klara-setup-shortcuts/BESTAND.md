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

### 2.3 Word-Add-in (eigene Einstellungsfläche im Aufgabenbereich)

Das Word-Add-in hat eine eigene Einstellungsfläche (`#kw-einstellungen` in
`apps/web/public/word-addin/taskpane.html`) mit Sprache, zwei Schaltern, der Sitzungszustimmung,
der nur lesbaren Gruppe „Vom Admin eingestellt“ (Werte aus O01 über `/api/klara/ai-status`) und
dem Konto (Abmelden).

| ID | Einstellung | Stand | Ort heute | Speicher | Geltung | Recht |
| --- | --- | --- | --- | --- | --- | --- |
| W01 | Sprache des Aufgabenbereichs (de/en/nl) | geliefert | Word › Klara › Einstellungen | nur Arbeitsspeicher des Panels, Start „de“ | Panelinstanz | keine Serverprüfung |
| W02 | Text in Word mitlesen | geliefert | wie W01, Schalter (Vorgabe an) | nur Arbeitsspeicher des Panels | Panelinstanz | keine Serverprüfung |
| W03 | Absatzblick (Bestandsblick beim Absatzwechsel) | geliefert | wie W01, Schalter (Vorgabe aus) | nur Arbeitsspeicher des Panels | Panelinstanz | keine Serverprüfung |
| W04 | Zustimmung zur externen KI dieser Sitzung; Ablehnung je Dokument | geliefert | wie W01, nur sichtbar, wenn der Server sie verlangt oder sie erteilt ist | Zustimmung am Server (`klara_session_consents`, `POST/DELETE /api/klara/sessions/:sessionId/consent`); das „Nein“ je Dokument nur im Arbeitsspeicher | Sitzung bzw. Dokument im Panel | `ko.read`; Bedarf und Wirkung entscheidet der Server |
| W05 | Dokumentkennung `klarwerkDokumentId` | geliefert | keine Bedienfläche | **dauerhaft in den Einstellungen des Word-Dokuments** (`Office.context.document.settings` + `saveAsync`), reist mit der Datei | Dokument | vom Server beim Senden vergeben, nicht vom Anwender einstellbar |

Abgrenzung: W05 ist **keine** Nutzereinstellung und **keine** Anmeldung, sondern die dauerhafte
Zuordnung eines Dokuments zu seiner Klarwerk-Akte. Die Anmeldung hält das Panel getrennt davon
nur im Arbeitsspeicher (`officeSchluessel`, kein `localStorage`, kein Cookie). W01–W03 und das
„Nein“ aus W04 sind flüchtiger Panelzustand und beginnen bei jedem Öffnen neu.

### 2.4 Rollen- und Berechtigungsregeln (zu übernehmen, nicht zu erweitern)

- Persönliche Assistenz-Einstellungen (E01–E07): jede angemeldete Rolle (`requireUser`); das Konto
  kommt **ausschließlich** aus der Sitzung; nennt eine Anfrage eine fremde Kontokennung, antwortet
  der Server 403 und ändert nichts (`nenntFremdesKonto` in `assistenz-profil-routes.ts`).
  Ins Prüfprotokoll gehen nur Ereignisse, nie Name oder Hinweisschlüssel.
- Klara-Gespräch und Office-Sitzungen: `ko.read` — das hat jede Rolle (`viewer: ["ko.read"]`).
  Eine eigene `klara.*`-Berechtigung gibt es nicht und ist nicht vorgesehen.
- Organisationsweite Werte (O01, O02): `users.manage`, also nur `admin`.
- Browser-Erweiterung und Word-Add-in: eigene Anmeldung am Server; dort gelten dieselben Rechte.
  Die Word-Schalter W01–W03 sind ohne Serverrecht; die Zustimmung W04 läuft über `ko.read` und
  die serverseitige Sitzungsbindung.

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
| H03 | Word-Add-in „Klara“ | geliefert | A09; Einstellungen W01–W05 im eigenen Aufgabenbereich | Manifest ohne Kürzel; Einstellungen nur im Word-Panel erreichbar (eigener Rahmen, eigene Anmeldung); dauerhaft ist nur W05 im Dokument und W04 am Server |
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
| C06 | `codex/auftrag-037bbf78aabef05890d7` · `0b88f41b2` | Kalender (`produkt:20261010:klara-eigener-kalender`): neue persönliche Einstellung „Sichtwahl“ (`PUT /api/me/kalender/einstellungen`, eigene Tabelle `kalender_einstellungen`), Seite `/kalender` über das Konto-Menü, Block „Mein Kalender“ in `taskpane.html` |

Diese Kandidaten werden hier nur gelesen, nicht verändert. Nur beauftragt, ohne Code: AA-02 (B02),
AA-03 (B03), AA-04 (B04), AA-05 (B05).

### 6.1 Abgleich weiterer laufender und gelieferter Aufträge

Gelesen wurden am 12.10.2026 die Commit-Historie aller Zweige, der Hauptstand der Basis und bei
Kandidaten die Dateiliste ihres Unterschieds zur Basis sowie ihre mitgelieferte Betriebsdoku.

| Auftrag (Titel laut Lieferung) | Stand | Belegt durch | Ergebnis für AA-02 bis AA-04 |
| --- | --- | --- | --- |
| Eigenen persönlichen Kalender ohne externen Dienst nutzbar machen | Kandidat C06, Stand „Nacharbeit 2“ | Zweig oben; `docs/operations/klara/eigener-kalender.md` auf dem Zweig | **Überschneidung**: Die Sichtwahl ist eine kontobezogene Einstellung mit eigener Ablage, und der Word-Block ändert `taskpane.html` neben W01–W04. Sie bleibt Eigentum ihres Auftrags; der Bereich „Klara“ darf nach deren Lieferung höchstens auf `/kalender` verweisen, übernimmt aber weder Speicher noch Bedienung. |
| Rollengerechte Befehlspalette und globale Schnellsuche anbieten | geliefert (1.0.0-beta.1.713, `2b1131adc`) | im Hauptstand | **Überschneidung T01**: ⌘K/Strg+K gehört der Palette; AA-04 behandelt das als Konfliktgrenze und verändert die Palette nicht ohne Zustimmung. |
| Navigation, Logo und aktiven Bereich konsistent bedienen; Navigation und wirksame Rolle verständlich anzeigen; Verwaltung mit Aufgabenübersicht und verständlicher Navigation | geliefert (bis 1.0.0-beta.1.807, `8e3b1366d`) | im Hauptstand | Bestand des Zahnradmenüs und der Profilzeilen (H01); AA-02 fügt sich in diese Zeilen ein und legt keinen neuen Menüpunkt an. |
| Dialoggrenzen, Tastaturfokus und Vorleseansagen einheitlich führen; Kontrast, Tastatur, Fokus und tatsächliche Vorleseausgabe nachweisen | geliefert (bis 1.0.0-beta.1.862, `d0b026c4f`) | im Hauptstand | Modalgrenze und Fokusführung sind Bestand; AA-04 setzt auf `useModalBoundary` auf und darf deren Prüfungen nicht abschwächen. |
| Einführungsauftrag mit Klara-Bezug | nicht gefunden | keine Lieferung und kein Zweig mit passendem Titel seit 15.09.2026; die Suche in den Originalaufträgen (6.2) findet unter „einführ“ nur den Chat-Auftrag | Kein Einführungs-/Onboarding-Auftrag mit Klara-Einstellungen belegt. |

### 6.2 Vertragsabgleich mit den Originalaufträgen (Revision, Status, Kriterien)

**Quelle.** Die Originaldateien `AUFTRAG-B1.json` der Nachbaraufträge liegen außerhalb des für diese
Bearbeitung lesbaren Bereichs. Gelesen wurde deshalb die unveränderte Ausgabe, mit der Ben sie am
12.10.2026 vollständig gelesen hat (Felder `id`, `title`, `revision`, `status`, `criteria`,
`delivery`): `HISTORIE/nacharbeit-2/BEN/STREAM.jsonl`, Befehl `item_5` im eigenen Auftragsordner.
Alle sieben dort gelesenen Aufträge haben `status: "offen"` und `delivery: null`, sind also zentral
nicht abgeschlossen.

| ID | Originalauftrag · Ordner | Revision | Vertragskriterien mit Bezug zu AA-02 bis AA-04 | Auswirkung |
| --- | --- | --- | --- | --- |
| C01 | `produkt:20261011:assistenz-minimalistische-oberflaeche` · `auftrag-08abbc8ce7113845b115` | 1 | UI-MIN-08 (Einwilligung/Datenkontrolle, Verlauf, Fähigkeiten, Hilfe über das Menü erreichbar, Widerruf wirksam), UI-MIN-11 (Grundansicht nur Kopf, Kontextzeile, Gespräch, Eingabe), UI-MIN-15 (Name/Avatar, Rechte, KI-Abschaltung, Speicherung bleiben wirksam; Widerruf in höchstens vier Aktionen), UI-MIN-03 (Tastatur, Fokus) | Die Gesprächsfläche wird schlanker; Einstellungen wie E05 und E07 gehören dann eher in den Bereich „Klara“. AA-02 bindet dieselben Komponenten und Ablagen ein, die C01 über sein Menü erreicht — kein zweiter Speicher, kein abweichender Widerrufsweg. **Das globale Kürzel Control-Option-K ist kein Vertragskriterium von C01**, sondern eine Umsetzungseinzelheit seines Kandidaten; die Systemweiten-Entscheidung bleibt deshalb offen und an keinen Vertrag gebunden. |
| C02 | `produkt:20261010:assistenz-avatar-generieren` · `auftrag-f592e61e001e4eccfde7` | 2 | „Eigenen Avatar gestalten“ bei der Avatar-Auswahl „im Setup und in Meine Assistenz“; eigene Avatare stabil und serverseitig je Konto; Modellwahl und Freigabe in der bestehenden Administration; Kontingentgrenzen | Erweitert E02 vertraglich. AA-02 bindet `AssistenzFormular` mit dem gelieferten Generator unverändert ein und baut keine eigene Avatar-Auswahl. AA-03 erweitert dieselbe Ablage `assistenz_profile` erst auf dem Stand, der C02 enthält. |
| C03 | `produkt:20261011:assistenz-meeting-teilnahme` · `auftrag-97d57ecfa8c8bd7d3426` | 1 | BPA-15-AC04 (Status erkennen, Pause/Stopp/Entfernung); kein Kriterium zu einem Einstellungsort | Die Profilzeile „Besprechungsassistenz“ ist Umsetzung, kein Vertrag. Nach Lieferung erreicht der Bereich „Klara“ sie als direkten Eintrag; Steuerung und Status bleiben bei C03. |
| C04 | `produkt:20261007:klara-erinnerungen-kalender` · `auftrag-71c74841eea80f27c7b3` | 5 | Kriterium 1 (eindeutiges Benachrichtigungsziel), Kriterium 3 („über den gewählten vorhandenen Weg“ zugestellt), AW18-K11 (keine zweite Scheduler-Instanz) | Das Zustellziel ist eine Erinnerungs- bzw. Meldeeinstellung, keine allgemeine Klara-Einstellung; AA-02 übernimmt sie nicht. Überschneidung nur im Code (`KlaraVorschau.tsx`). |
| C05 | `produkt:20261008:klara-gemeinsames-wissen` · `auftrag-a9f1916ab14978df76b8` | 3 | AW02-K05 (Text und Diktat nutzen denselben Weg); Kriterien 1–4 (bewusste Übernahme, Rechte) | Kein Einstellungskriterium. Für AA-04: Ein Kürzel darf keine Übernahme auslösen — erfüllt, weil nur A01/A02 belegbar sind. Überschneidung nur im Code. |
| C06 | `produkt:20261010:klara-eigener-kalender` · `auftrag-037bbf78aabef05890d7` | 1 | AW16-K04 (Sichtmodus eigener, vorhandener oder beide Kalender wählbar), AW16-K02 (Tastaturbedienung der Ansichten) | AW16-K04 ist eine vertragliche persönliche Einstellung dieses Auftrags. Der Bereich „Klara“ verweist nach Lieferung auf `/kalender` und übernimmt sie nicht. AA-04 darf die Tastaturbedienung der Kalenderansichten nicht überlagern: Der zentrale Hörer reagiert nur auf die konfigurierte Kombination mit Modifikator. |
| — | `produkt:20261007:interner-chat` · `auftrag-a96cfc21e96bff8310d0` („Direkt-, Gruppen- und Artikelchat einführen“) | 1 | „Klara-Auswahl wird nur durch bewusstes Senden zur Nachricht; Ziel und Inhalt sind vorher sichtbar.“ | Code im Hauptstand (`ca5ccb434`), zentral offen. Betrifft A05 „als Nachricht entwerfen“. AA-04 belegt A05 nicht mit einem Kürzel; der bewusste Sendeweg bleibt unberührt. |

Nicht in dieser Quelle enthalten sind die Originalaufträge der bereits im Hauptstand integrierten
Palette-, Navigations- und Barrierefreiheitsaufträge (6.1). Für sie belegt der Hauptstand den
gelieferten Code; ihre Vertragsrevisionen sind hier nicht abgeglichen.

## 7. Grenzen dieser Erhebung

- Quelleninspektion im Arbeitsbaum und Lesen der Kandidatenzweige; kein Bedienlauf, kein Hostlauf,
  keine Screenreader-Prüfung.
- Das ältere Office-Bündel `services/app/addin-static` stammt aus einem eigenen Repository
  (`klarwerk-office-addin`); dessen Quellen liegen nicht hier und wurden nicht gelesen.
- Die Originalverträge der Kandidaten C01–C06 und des Chat-Auftrags sind in 6.2 nach Revision und
  Kriterien abgeglichen. Grundlage ist Bens unveränderte Leseausgabe vom 12.10.2026 im eigenen
  Auftragsordner, nicht ein eigener Direktzugriff; ändert sich danach eine Revision, ist 6.2 zu
  erneuern. Die Originalverträge der bereits integrierten Palette-, Navigations- und
  Barrierefreiheitsaufträge waren in keiner lesbaren Quelle enthalten.
- Ob weitere laufende Aufträge ohne Repository-Zweig Klara-Einstellungen planen, ist aus dem
  Repository nicht feststellbar.
