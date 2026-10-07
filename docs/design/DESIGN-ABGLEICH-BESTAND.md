# Design-Abgleich · Bestand je Kriterium (Auftrag `aufnahme:20260922:gesamt-design-abgleich`)

Stand: Produktfassung `1.0.0-beta.1.733` (Kandidat `d6d96b73`) plus Nacharbeit 3 dieses Auftrags.
Diese Seite ordnet jedes Kriterium K1–K34 dem **heutigen** Stand zu: Ergebnis, Beleg (Datei bzw.
Prüfstand), tatsächlicher Rest und – wo vorhanden – gesonderter Auftrag. Historische Aussagen der
Quelle („erledigt 05.09.", „ROT 13.08.") sind als Herkunft benannt, nicht als heutiger Beweis.
Abschnitt „Restvertrag" am Ende ist die abarbeitbare Liste der übrigen Bedienmängel (R-1046).

Legende: **erfüllt** = im Produkt vorhanden und durch einen benannten Prüfstand belegt ·
**abgelöst** = das alte Ziel ist durch ein jüngeres, freigegebenes Ziel ersetzt, das Nachfolgeziel
ist belegt · **offen** = Rest, mit Ort · **extern** = braucht Pedi/Design-Rolle/Quelle außerhalb
des Produktbaums · **Widerspruch** = Quellen widersprechen sich, Entscheidung nicht hier.

## Freigegebene Vorlagen, gegen die heute gemessen wird

Die Prüfung stellt die Vorlagen als Prüfmittel bereit (`PRUEFUNG/DESIGN-PRUEFMITTEL.json`):
`design/klarwerk/{Admin,Bibliothek,Duplikate,Erfassen,Fragen,Konflikte,Main,Menues,Pruefen}.dc.html`,
`design/klara/{Einstellungen,Erfassen,Main,Ruhe}.dc.html`,
`DESIGN_ZIELBILD_20260827/{Wissensnetz,KeinWissen,Main}.dc.html`. Gemessen wird an der **gebauten**
Anwendung (`apps/web/dist` bzw. das ausgelieferte `word-addin/taskpane.html`) in Chromium, Wert für
Wert (`tools/design-vergleich/werte.ts` + `tests/design/zielbild-*.test.ts`). Fehlt eine Vorlage,
überspringen die Tests den Abgleich ausdrücklich („Mockup-Abgleich übersprungen").

## K1–K34

| K | Quelle | Ergebnis | Beleg (Datei / Prüfstand) | Rest / gesonderter Auftrag |
|---|---|---|---|---|
| K1 | R-0882 Wortmarke | **Widerspruch** | Produkt führt „Reasoning System" (`auth/BrandPanel.tsx`, `auth/SsoCallback.tsx`, `index.html`, `app.subtitle`); Brand Book (`docs/ci/CI_KURZREFERENZ.md`) schreibt genau diesen Untertitel vor; „Knowledge OS" nur in Doku. | Pedi-Entscheidung offen (`docs/qm/PEDI_ENTSCHEIDUNGEN_2026-07-03_UMSETZUNG.md` Punkt 5: „Pedi bestätigt/verwirft"). Nicht hier entschieden. |
| K2 | R-0896 Rückfragen | **erfüllt** | Werksreset Stufe 2 neutral, Rot nur am Knopf (`pages/AdminDatenDetails.tsx`); `tests/bestaetigung-neutrale-flaeche/werksreset-rueckfrage.test.ts`, `tests/app/destructive-button-colour.test.ts`; Bild + gemessene Farben `tests/design-bildnachweis/bildnachweis-chromium.test.ts` B3. | – |
| K3 | R-0906 acht Vorlagen | **abgelöst / erfüllt** | Zuordnung s. Tabelle „Acht Vorlagen" unten. | Wissen-Erfassen-Messung (K2-Mockup) ruht wegen K21-Widerspruch. |
| K4 | R-0918 Schriftskala | **erfüllt (durchgängige Skala)** | Vollständige Skala der freigegebenen Vorlagen: 10 (nur Quellenmarke) · 10,5 (nur Kopfband-Zähler) · 11 · 11,5 · 12 · 12,5 · 13 · 13,5 · 14 · 15 · 15,5 · 16 · 17 · 20 · 24 · 26 · 28 · 30 px (`apps/web/src/lib/schriftskala.ts`, je Wert eine Fundstelle des wörtlichen Vorlagen-Ankers in `ZIELBILD_HERKUNFT`); Stufen `klein`/`zaehler`/`fussnote`/`micro` in `apps/web/tailwind.config.ts`. 326 der 329 Größen < 11 px umgestellt (3 SVG-Beschriftungen in viewBox-Einheiten bewusst ausgenommen); die 10 Stellen neben der Skala migriert (14,5 → 15 px Fließtext in `KoRead`, `KnowledgeInputStudio`, `RichTextEditor`; 18/19/22 → 20 px in `DuplicateCompare`, `ImportExplore`, `Capture`, `FunkeCards`). Wächter `tests/design-schriftskala/schriftskala.test.ts`: S1 Untergrenze, S5 Herkunft je Wert, S6 Vollständigkeit gegen alle Vorlagen-Anker der Zielbild-Messungen, S7 keine Größe neben der Skala, S8 jede Stufe in Gebrauch. | **Widerspruch, zugeordnet:** Auftragsbestand führte die Skala „verworfen", Designer-Übergabe als offene Scheibe (QUELLEN R-0918 `notiz`). Der jüngere Auftrag (22.09.) gilt. JOB 692/693 liegen nicht im Repo; die Skala ist aus den Vorlagen-Ankern abgeleitet. Die frühere Angabe hier („15,5/17/24/28/30 px außerhalb der Zielbildstufen") war falsch — diese Werte stehen in Bibliothek, Fragen, Erfassen und Start und gehören zur Skala. |
| K5 | R-0919 Baukasten + Katalog | **erfüllt** | Tokens: `apps/web/tailwind.config.ts` + `src/styles/themes.css` (brand = Marke/Auswahl, trust = nur Status, ai = nur KI); Bausteine `components/trust/*` (Status, Vertrauen, Herkunft, KI-Entwurf), `components/ui.tsx`; Katalog `/ui-kit` (`pages/UiKit.tsx`, FE-FND-07) jetzt mit Farbbedeutung, Schriftskala, Radien, Rückfrage; `tests/bausteinkatalog/ui-kit-grundwerte.test.tsx`, `tests/ko/mega35-prozentlabel-ui-kit.test.tsx`. | Feinabgleich Symbol-Strichstärken (Brand Book „~1,8") nicht gemessen → Restvertrag. |
| K6 | R-0967 Wertvergleich | **erfüllt** | Werkzeug `tools/design-vergleich/werte.ts`; Messung an der echten gebauten Datei: `zielbild-h2-pruefen` (Validierung/Prüfen), `zielbild-h5-fragen` (Frageweg), `zielbild-h3-erfassen` + `zielbild-k1-*` (Erfassen/Panel). | – |
| K7 | R-0996 Vorführfläche | **erfüllt** | `/ui-kit` ohne Navigationseintrag, ohne Datenabruf (G5 in `ui-kit-grundwerte.test.tsx`). JOB 691 (Quelle: „gebaut, kein Commit") ist nicht im Repo; die vorhandene Lieferung FE-FND-07 wurde wiederverwendet. | – |
| K8 | R-1025 Ordnungsregel | **erfüllt** | Startseite: Frage + drei Karten (`zielbild-h5-start`, `zielbild-h5-kein-erklaertext`); Erklärungen hinter Klick u. a. Kenntnisnahme-Aufklapper (`components/kenntnisnahme/KenntnisnahmeBereich.tsx`, `zielbild-h4-kein-erklaertext`). | – |
| K9 | R-1033 weitere Vorlagen | **erstellt, Freigabe offen** | Bibliothek, Konflikte, Duplikate liegen als freigegebene Vorlagen vor (Prüfmittel-Inventar) und sind gebaut (H2, H4). Die zwei fehlenden Flächen liegen jetzt als technische Entwürfe im selben Stil vor, je Fläche eine Datei: `docs/design/entwuerfe/klarwerk/Lebenszyklus.dc.html` (Web-App `/lebenszyklus`) und `docs/design/entwuerfe/klara/MobilPanel.dc.html` (Klara-Panel auf 320 px); Gegenprobe `tests/design-entwuerfe/entwuerfe-r1033.test.ts`. | Nur noch: Pedis Freigabe und Übernahme in den Freigabe-Canvas bzw. das Prüfmittel-Inventar (`klarwerk_steuerung/design`) — eine menschliche Freigabe, keine fehlende Erstellung. Bis dahin wird nicht gegen die Entwürfe gemessen. |
| K10 | R-1036 Werkbank + Klara-Prototyp | **zugeordnet** | Werkbank-Richtung = die in R-1036 genannte „zweite Gestaltungslinie als Palette im Produkt": das Thema „modern" aus mega40 („umschaltbares Zweitdesign Werkbank", `src/styles/themes.css`, `tests/app/mega40-theme-invarianz.test.ts`, `mega40-kontrast-modern.test.ts`), für Klara mega43 (`tests/app/mega43-klara-werkbank-palette.test.ts`); seit H1 Standard für alle (`lib/designTheme.ts`). Das Gestaltungsbild dieser Richtung sind die freigegebenen Vorlagen vom 04.09. (`design/klarwerk/*`, `design/klara/*`, gemessen „Theme modern"); Klara-Prototyp = K1/K2. | Ein darüber hinausgehendes „Design v2"-Bild ist nicht freigegeben (`theme-deckungsregister` R5: keine v2-Quelle) — keine Lieferung zuzuordnen, keine Entscheidung hier. |
| K11 | R-1044 Bedienbefunde | **teils** | Kopfzeilen-Kennzeichen entfernt (H1, `zielbild-h1-kein-erklaertext`); eine betonte Handlung (KeinWissen: genau ein `primary`, `zielbild-keinwissen`); Zahlen mit Bezug („k von n", `pages/Validation.bewertungsumfang.test.tsx`; Duplikat-Metrik benannt); Re-Import hinter Menü „…", nur Admin+Stufe 2 (`BibliothekFlaeche.tsx`, `RoleLink`). | **Widerspruch** „gesichert" (= validiert, z. B. `ask.status.verified`) gegen H3-Vorgabe „Entwurf sichern" — Begriffsentscheidung offen (Firmenwörterbuch/Pedi). |
| K12 | R-1046 Bedienschulden-Vertrag | **erfüllt (diese Seite)** | Altbestand „VERWORFEN" (JOB 590 ROT) ist durch die Aufnahme 22.09. überholt; Sammlung, Bewertung und Vertrag: Abschnitt „Restvertrag". | – |
| K13 | R-1049 Design-Paket Erfassung | **abgelöst** | Altbestand „VERWORFEN" (JOB 699); die Erfassungsstrecke ist über H3 (Web-Erfassen, `zielbild-h3-erfassen`) und K2 (Klara-Erfassen) gebaut. | K2b ist gesonderter Auftrag (Commit `6ae13f89`); K21-Widerspruch s. dort. |
| K14 | R-1399 Sichtnachweis | **erfüllt (diese Nacharbeit)** | `tests/design-bildnachweis/bildnachweis-chromium.test.ts`: Startbefehl im Kopf, Bilder unter `test-results/bildnachweis/`, je Bild die gemessenen Zahlen. | Ob die Bilder aus `test-results/` eingesammelt werden, entscheidet der Prüfadapter. |
| K15 | R-1673 UI-Bausteine | **erfüllt** | `components/ui.tsx` (Button, Card, Field, TextInput, PageHeader, SectionLabel, QueryState, Avatar) + `components/trust/*`; Katalog `/ui-kit`. | – |
| K16 | R-1913 Klara-Refresh vor Freitag | **erfüllt (historisch) / abgelöst** | Klara K1/K2 Pages-Maßstab (Quelle: LIVE 1.0.0-beta.1.86/98); heute gemessen `zielbild-k1-ruhe`, `-antwort`, `-einstellungen`. | Termin „Freitag" ist verstrichen. |
| K17 | R-1955 D3a | **wie K10** | E1 Werkbank-Richtung = Thema „modern" (K10); E2 Klara-Prototyp = K1/K2; E3 Reihenfolge D1→D4 abgearbeitet (D-Zeilen der Quelle). | Design-v2-Bild nicht freigegeben (K10). |
| K18 | R-2209 Fertigstände | **beschrieben** | H1–H6, K1, K2 gebaut und je mit Wertvergleich; einzige bekannte Ungleichzeitigkeit: K21. | – |
| K19 | REVIEW26-DESIGN | **teils** | Exportumfang (`texte/exportumfang.ts`, `review26-exportumfang`, Bild B1), Freigeben-Umfang, Leerzustand, Duplikatprozente, Hilfe „import", Originaldatei im Kopf, Aufgabenliste schmal, Prüfen-Detail schmal (je eigener Prüfstand). | „Lückenbezug": Befundtext liegt der Quelle nicht bei (fehlender Beleg). „Aktionsmenü 390 px": `max-w-[calc(100vw-2rem)]` im Quelltext, kein eigener Messtest. |
| K20 | K1 Klara neu | **erfüllt** | `zielbild-k1-ruhe`, `-antwort`, `-einstellungen`, `-kein-erklaertext`. | – |
| K21 | K2 Klara Erfassen | **Widerspruch** | Mockup `design/klara/Erfassen.dc.html`: Markierungskarte, Titel, Bereich, ein Knopf. | Pflicht-Stufenwahl aus R-0632 (`tests/vertraulichkeit-pflicht/word-panel-stufenwahl.test.tsx`) setzt drei weitere Knöpfe; `zielbild-k2-kein-erklaertext` daher rot (Bericht HISTORIE/nacharbeit-1). Entscheidung Pedi. |
| K22 | H1 Hülle | **erfüllt** | `zielbild-h1-huelle`, `-kein-erklaertext`, `h1-funktionsinventar`. | – |
| K23 | H2 Prüfen | **erfüllt** | `zielbild-h2-pruefen`, `h2-funktionsinventar`. | – |
| K24 | H3 Erfassen | **erfüllt** | `zielbild-h3-erfassen`, `-kein-erklaertext`. | – |
| K25 | H4 Bibliothek | **erfüllt** | `zielbild-h4-bibliothek`, `-kein-erklaertext` (nach Kenntnisnahme-Aufklapper grün, HISTORIE/nacharbeit-2), `h4-funktionsinventar`. | – |
| K26 | H5 Fragen + Start | **erfüllt** | `zielbild-h5-start`, `-fragen`, `-kein-erklaertext`. | – |
| K27 | D1 Main | **abgelöst + Widerspruch** | Zielbild `DESIGN_ZIELBILD/Main.dc.html` (27.08.) am 04.09. durch `design/klara/Main.dc.html` ersetzt (`zielbild-klara-main` pinnt die Ablösung); Messung `zielbild-k1-antwort`. | Erledigungstext der D1-Zeile beschreibt JOB 3266 („Meine Entwürfe"), eine andere Lieferung. |
| K28 | D2 KeinWissen | **erfüllt** | `zielbild-keinwissen` (Chromium, Wert für Wert gegen `KeinWissen.dc.html`), `zielbild-keinwissen-messung`. | – |
| K29 | D3 PruefungLaeuft | **abgelöst** | Ladekarte durch Kreisel im Sendeknopf ersetzt (JOB 3056 §9); Messung `zielbild-k1-ruhe` F4/F5, Ablösung gepinnt in `zielbild-pruefunglaeuft`. | Vorlage `PruefungLaeuft.dc.html` ist nicht mehr im Prüfmittel-Inventar. |
| K30 | D4 SchlankesPanel | **abgelöst** | Grundpanel jetzt nach `design/klara/Ruhe.dc.html`; `zielbild-k1-ruhe`. | – |
| K31 | D5 KonsoleStart | **abgelöst** | Startseite nach `design/klarwerk/Main.dc.html` (H5); `zielbild-h5-start`. | – |
| K32 | Q4 Konto-Kreis | **erfüllt** | `tests/kontokreis-funke/konto-kreis-traegt-den-funke.test.ts`, `zielbild-h1-huelle`. | – |
| K33 | Konsistenz | **erfüllt bis auf „sichern/speichern"** | **Gleiche Aktion, gleiches Symbol, gleiche Rückmeldung** — Abgleich: Löschen mit Symbol = Papierkorb `Trash2` (Entwurfsliste, Mobil, Verwaltung/Papierkorb, Risiko, Import-Bereinigung, Demodaten, KI-Zugänge); in der Bibliothek steht Löschen als Textknopf ohne Symbol (H4: Menüs und Fußband ohne Symbole) — kein abweichendes Symbol; Speichern = `Save` (Erfassen-Arbeitsraum); Öffnen/Fortsetzen = `FolderOpen`; Zurücksetzen = `RotateCcw` (Werks-/Demodaten, Tutorial). Behobene Abweichungen: Mobil nannte das Löschen eines Entwurfs (`DELETE`) „Verwerfen", fragte „Verwerfen?", bestätigte mit Haken und quittierte „Entwurf verworfen." — jetzt wie die Entwurfsliste „Löschen", dieselbe Rückfrage, Papierkorb, „Behalten", „Entwurf gelöscht." (`pages/Mobile.tsx`; Begriffsregel JOB 3426 §4b.4); „Fortsetzen" trug in Entwurfsliste und Mobil den Zurücksetzen-Pfeil — jetzt `FolderOpen`. Gegenprobe `tests/konsistenz-aktionen/aktionen-symbol-begriff.test.ts`. **Bestätigungen an erreichbarer Stelle**: `destructive-button-colour`, K2. **Klara zeigt nur Eingaben der gewählten Quelle** (Word-Panel: Markierung oder ganzes Dokument): vorhandene Belege `tests/word-rueckweg/panel-rueckweg-mounted.test.ts` R8 (andere Markierung geht nicht an das alte Ziel), `tests/app/ka3-bestandsblick-aktueller-stand.test.tsx` A2 (Markierung gewechselt → neu gelesen), `tests/vertraulichkeit-pflicht/word-panel-stufenwahl.test.tsx` (Markierungsweg und Dokumentweg senden je ihre Quelle). **Erklärtextflut**: alle `*-kein-erklaertext`. | Rest: „Entwurf sichern" (Blatt, H3-Vorgabe) gegen „Als Entwurf speichern" (Arbeitsraum) — derselbe Begriffswiderspruch wie K11 „gesichert", Entscheidung Pedi. „Gewählte Quelle" ist im Planungspaket nicht näher bestimmt (Paket: „direkte Nutzerquelle noch zuzuordnen"); zugeordnet ist die Lesart Markierung/Dokument im Word-Panel. |
| K34 | Lieferbeleg | **nach Veröffentlichung** | – | Fassung + Livebeleg entstehen erst bei Auslieferung. |

## Acht Vorlagen (R-0906) → heutiger Messort

| Vorlage 27.08. | Heute gültiges Ziel | Wertvergleich an der gebauten Fläche |
|---|---|---|
| Word-Panel in Ruhe (SchlankesPanel) | `design/klara/Ruhe.dc.html` | `tests/design/zielbild-k1-ruhe.test.ts` |
| Prüfung läuft (PruefungLaeuft) | Kreisel im Sendeknopf (Ruhe-Mockup) | `zielbild-k1-ruhe.test.ts` F4/F5 |
| Antwortkarte (Main) | `design/klara/Main.dc.html` | `zielbild-k1-antwort.test.ts` |
| Ehrliche Wissenslücke (KeinWissen) | unverändert `KeinWissen.dc.html` | `zielbild-keinwissen.test.ts` |
| Wissen erfassen (WissenErfassen) | `design/klara/Erfassen.dc.html` | `zielbild-k2-erfassen.test.ts` (ruht: K21) |
| Konsolenstart (KonsoleStart) | `design/klarwerk/Main.dc.html` | `zielbild-h5-start.test.ts` |
| Wissensnetz | unverändert `Wissensnetz.dc.html` | `zielbild-wissensnetz.test.ts` |
| Validierung | `design/klarwerk/Pruefen.dc.html` | `zielbild-h2-pruefen.test.ts` |

## Restvertrag (R-1046) — abarbeitbar, je Posten Ort und Gegenprobe

| Nr. | Posten | Bewertung | Ort | Gegenprobe |
|---|---|---|---|---|
| R1 | ~~Schriftgrößen neben der Skala~~ — **erledigt** (Nacharbeit 7): Skala vervollständigt, 10 Abweichler migriert, Wächter S5–S8 | – | – | `schriftskala.test.ts` |
| R2 | Symbol-Strichstärke ~1,8 (Brand Book) | gering | `lucide`-Aufrufe ohne `strokeWidth` | Quelltextwächter auf `strokeWidth` |
| R3 | ~~gleiche Aktion = gleiches Symbol~~ — **erledigt** (Nacharbeit 7), s. K33 | – | – | `aktionen-symbol-begriff.test.ts` |
| R4 | ~~Klara zeigt nur Eingaben der gewählten Quelle~~ — **zugeordnet** (vorhandene Belege, s. K33) | – | – | R8 / A2 / Stufenwahl-Tests |
| R5 | Begriff „gesichert"/„sichern" doppelt belegt (auch „Entwurf sichern" gegen „Als Entwurf speichern") | Entscheidung nötig | Wörterbuch (`woerterbuch/*`, `texte/*`) | nach Entscheidung: Wörterbuchwächter |
| R6 | Lückenbezug (REVIEW26) | Beleg fehlt | `pages/MyTasks.tsx` | erst Befundtext beschaffen |
| R7 | ~~Vorlagen Lebenszyklus, Mobilansicht Panel~~ — **erstellt** als Entwürfe (K9); offen nur Pedis Freigabe | menschliche Freigabe | Freigabe-Canvas | `entwuerfe-r1033.test.ts` |
