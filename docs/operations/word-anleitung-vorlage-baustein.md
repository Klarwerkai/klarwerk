# Anleitung in Word · Vorlage, Baustein, Vollständigkeit

Vorgang `aufnahme:20260922:gesamt-dokumenterzeugung`, Ergänzung Pedi 28.09.2026 (Nutzerliste
Auftrag 6): „Eine vollständige Anleitung in der vertrauten Word-Oberfläche erstellen und vorhandenes
Wissen wiederverwenden.“ Umfang zunächst: eine Anleitungsvorlage und ein wiederverwendbarer
Inhaltsbaustein in **einem** Word-Host; der Rückweg nach Klarwerk ist der bestehende aus
`aufnahme:20260922:word-echter-arbeitsweg` (Auftrag 4) und bleibt unverändert.

## Word-Host

Derselbe Host, den Entscheidung `entscheidung:756b7d22` (Pedi 29.09.2026) für den Rückweg aus
Auftrag 4 festgelegt hat — hier übernommen, nicht neu bestimmt:

- **Word Web unter Chrome**,
- Dokument aus SharePoint/OneDrive des Testmandanten **`klarwerktest4711`**,
- Rückgabe mit einem Klarwerk-Konto der Rolle **`admin`** (Direktfreigabe).

Word für Mac, Word für Windows und andere Office-Anwendungen sind **nicht** Teil dieses Umfangs.

## Was das Panel tut (Block KW-ANLEITUNG, `apps/web/public/word-addin/anleitung.js`)

Der Block steht in Klara unter „Fragen“ in der Ruhe, direkt unter „Begriffe prüfen“, sobald jemand
angemeldet ist und ein Word-Dokument offen ist.

| Knopf | Wirkung | Schreibt ins Dokument? | Server |
|---|---|---|---|
| **Anleitungsvorlage einfügen** | setzt hinter den Absatz am Cursor die Überschriften *Zweck*, *Voraussetzungen*, *Arbeitsschritte*, *Warnhinweise* (Formatvorlage „Überschrift 2“) mit je einem Hinweis in eckigen Klammern: `[Pflichtangabe: …]` bzw. `[Optional: …]` | ja, nur hinter den Cursor | nein |
| **Vollständigkeit prüfen** | meldet je Abschnitt: ausgefüllt, Angabe fehlt (mit Handlungsempfehlung und „Zum Abschnitt“) oder Abschnitt fehlt; darunter getrennt „Formal vollständig: ja/nein“ und „Fachlich geprüft oder freigegeben: nicht festgestellt“ | nein | nein |
| **Baustein einfügen** | fügt ein gewähltes geprüftes Wissensobjekt hinter den Cursor ein: Aussage, „Gilt, wenn: …“, nummerierte Maßnahmen und eine Herkunftszeile `Baustein aus Klarwerk: „Titel“ · Fassung n · Prüfstand validiert · Vertrauenswert t · Kennung id · Geltung: … · Verantwortung: … · Fassung vom … · Letzte Prüfung: … · Offene Unsicherheiten: …` | ja, nur hinter den Cursor | `GET /api/output/sources`, `POST /api/output/generate`, `GET /api/kos/:id` — alle mit `ko.read` |
| **Dokument erzeugen und einfügen** | Dokumentart (Arbeits-/Verfahrensanweisung, Checkliste, Störungsleitfaden, Schulungsunterlage, FAQ, Zusammenfassung für die Führung), Zielrolle und mehrere geprüfte Quellen („Quellen wählen“) → die Output Factory erzeugt das Dokument; sein vollständiges Ergebnis (Titel als Überschrift 1, Adressat, Prüfhinweis, Rumpf, „Herkunft & Nachweis“ je Quelle) kommt als Word-Absätze hinter den Cursor | ja, nur hinter den Cursor | `GET /api/output/sources`, `POST /api/output/generate` — `ko.read` |

**Herkunftsangaben je Quelle (R-0337/R-1739).** Die Output Factory (`toProvenance`,
`services/output/src/render.ts`) übernimmt aus dem Wissensobjekt: Titel, Kennung, Status, Trust,
Fassung, Autor, Gültigkeitsbereich (`geltung`), Verantwortung (`ownership.owner`, kein Rückfall auf
den Autor), Validierer (`ownership.validators`) und das Datum der aktuellen Fassung (`history`).
Ein Datum der letzten fachlichen Prüfung führt das Wissensobjekt nicht (die Entscheidung liegt nur
im Audit); es steht deshalb als „nicht festgehalten“ da. Jede fehlende Angabe und niedriger Trust
stehen zusätzlich unter „Offene Unsicherheiten“. Dieselben Angaben trägt die Herkunftszeile eines
Bausteins und der Herkunftsblock eines erzeugten Dokuments; beide reisen als Text über den Rückweg.

Pflicht sind *Zweck*, *Voraussetzungen* und *Arbeitsschritte*; *Warnhinweise* sind optional. Ein
Abschnitt gilt als ausgefüllt, sobald unter seiner Überschrift ein Absatz steht, der nicht nur der
Hinweis in eckigen Klammern ist; er endet an der nächsten Überschrift.

Die Bausteinliste kommt aus der Output Factory (nur validiert, nichts Vertrauliches). Vor dem
Einfügen fragt das Panel die Output Factory erneut; sie weist ein inzwischen ungeprüftes oder
vertrauliches Objekt serverseitig ab. Weicht die Fassung des Inhalts von der Fassung der Herkunft ab,
wird nichts eingefügt.

## Rückweg

Die fertige Anleitung markieren und unter „Erfassen“ wie in `docs/operations/word-host-gesamtweg.md`
Abschnitt 1 an das Wissensobjekt zurückgeben. Überschriften gehen über die Formatvorlage als `<h1>`/
`<h2>` mit, Herkunftszeilen als Text. Fachlich geprüft und freigegeben ist die Anleitung erst danach,
durch Klarwerk — nicht durch die Vollständigkeitsprüfung.

## Realabnahme im Host (Mensch, nicht automatisiert)

Startbedingung wie in `docs/operations/word-host-gesamtweg.md` (ausgelieferte Fassung, `/health`
mit Liefercommit, Mandant aktiv). Dann in Word Web unter Chrome, Dokument des Testmandanten:

1. Klara öffnen, anmelden. Cursor unter einen Dokumenttitel setzen, **Anleitungsvorlage einfügen**.
   Bildschirmfoto: vier Überschriften im Navigationsbereich von Word als Überschriften erkennbar.
2. **Vollständigkeit prüfen** — erwartet „Formal vollständig: nein – 3 von 3 Pflichtangaben fehlen.“
   und je Abschnitt eine Zeile. „Zum Abschnitt“ bei *Voraussetzungen* klicken: Word markiert den
   Hinweis unter *Voraussetzungen*. Bildschirmfoto.
3. Zweck, Voraussetzungen und einen Schritt eintragen. Cursor in *Arbeitsschritte*, einen Baustein
   wählen, **Baustein einfügen**. Bildschirmfoto der Herkunftszeile; Titel und Fassung mit
   `GET /api/kos/<id>` vergleichen.
4. **Vollständigkeit prüfen** — erwartet „Formal vollständig: ja …“ **und** darunter „Fachlich
   geprüft oder freigegeben: nicht festgestellt …“. Bildschirmfoto.
5. Ganze Anleitung markieren, unter „Erfassen“ als `admin` an das Ziel zurückgeben (Abschnitt 1 von
   `word-host-gesamtweg.md`). Danach `GET /api/kos/<id>`: `bodyHtml` enthält die vier Abschnitte als
   Überschriften und die Herkunftszeile im Wortlaut.

Kein Beleg darf Passwörter, Cookies, Token, Sitzungskennungen oder Freigabelinks mit Schlüssel
enthalten; Bildbelege wie in `docs/operations/word-web-hostabnahme/README.md` schwärzen.

## Grenzen

- Automatisch belegt ist das Verhalten gegen eine Word-Attrappe
  (`tests/anleitung-word/anleitung-word.test.tsx`), nicht im echten Word. Ob Word Web einen neuen
  Absatz hinter einer Überschrift mit deren Vorlage anlegt, ist nicht gemessen; das Panel setzt die
  Vorlage deshalb ausdrücklich (`styleBuiltIn`, WordApi 1.3). Meldet ein Host WordApi 1.3 nicht,
  setzt es keine Vorlage.
- Die Hinweise zu fehlenden Angaben stehen im Panel je Abschnitt, mit Sprung an die Stelle in Word;
  im Dokument selbst steht dort der Vorlagenhinweis in eckigen Klammern. Es werden keine
  Word-Kommentare angelegt.
- Was jede ältere Originalanforderung heute erfüllt und was offen bleibt, steht einzeln im
  Bestandsabgleich unten — keine pauschale Ausgrenzung.

## Bestandsabgleich aller Originalkriterien

**Teilumfang dieser Lieferung.** Pedis Ergänzung vom 28.09.2026 begrenzt den Auftrag zunächst auf
Vorlage und Baustein in einem Word-Host (K18–K22). Nacharbeit 4 (Bens Befund) schließt zusätzlich
den Erzeugungsweg der Output Factory nach Word an und ergänzt die Herkunftsangaben. Die Abnahme
dieses Teilumfangs erfüllt die älteren Anforderungen nicht automatisch; ihr Stand steht unten.

**Fassungsbindung.** „Diese Lieferung“ heißt: Kandidatenfolge des Auftrags
`aufnahme:20260922:gesamt-dokumenterzeugung` auf dem Basisstand `main` 1.0.0-beta.1.777
(Kandidat `da58fff6` plus Nacharbeit 4). Eine ausgelieferte Fassung und `/health`-Beleg entstehen
erst mit der Veröffentlichung (K17). „Bestand“ heißt: im Quelltext dieses Basisstands vorhanden,
ohne eigenen Abschlussbeleg in diesem Auftrag — dort ist die Fassung die des Basisstands, ein
früherer Abnahmebeleg wird nur genannt, wo er im Repo steht.

| K | Original | Stand | Wo / Beleg | Offen |
|---|---|---|---|---|
| K1 | R-0288 Dokument aus geprüften Quellen mit Titel, Zielrolle, Herkunft je Quelle; „keine Tür zu Word“ | **Diese Lieferung:** Word-Panel „Dokument erzeugen und einfügen“ ruft die Output Factory mit gewählten Quellen und Zielrolle und fügt das vollständige Ergebnis ein | `anleitung.js` (`anleitungDokumentErzeugen`); `tests/anleitung-word/anleitung-word.test.tsx` D1–D6 | Realhost-Abnahme in Word Web |
| K2 | R-0294 handlungsnahe Aufbereitung statt Textbausteine | **Teilweise:** Anleitungsvorlage (Zweck, Voraussetzungen, Schritte, Warnhinweise) und erzeugte Arbeitsanweisung/Checkliste mit nummerierten Maßnahmen | `anleitung.js`; Tests V, P, D2 | Ob eine *Antwort* im Fragenweg handlungsnah ist, ist nicht geändert; Altbeleg JOB 634 „BEN ROT“ (Registerherkunft) bleibt historisch; fachliche Bewertung durch Menschen offen |
| K3 | R-0337 Pflichtangaben: Quelle, Vertrauenswert, Prüfstatus, Version, Gültigkeitsbereich, verantwortliche Rolle, Datum der letzten Prüfung, offene Unsicherheiten | **Teilweise, Lücken benannt:** alle Angaben je Quelle im Herkunftsblock und in der Baustein-Herkunftszeile; Fehlendes als „nicht angegeben/benannt/festgehalten“ und als offene Unsicherheit | `services/output/src/render.ts` (`toProvenance`, `renderProvenance`); `services/output/src/service.test.ts`; Tests B2, B3, B3b, D2 | **Datenmodell:** kein Feld „Datum der letzten Prüfung“ (nur Audit-Verweis); Verantwortung ist eine Person (`ownership.owner`), eine *Rolle* nur als Geltungsrolle (`geltung.rolle`). Ob ein Prüfdatum-Feld eingeführt wird, ist eine offene Produktentscheidung |
| K4 | R-0341 beim Verfassen die Quellen des vorgeschlagenen Textes sehen | **Bestand + diese Lieferung:** Baustein und erzeugtes Dokument tragen die Herkunft im eingefügten Text; Bestand: Quellen-Chips im Fragenweg (JOB 3004), Memo-Entwurf mit Herkunftsblock (KW-KA6-MEMO, JOB 3091), Word-Vergleich (KW-WORDVERGLEICH) | `anleitung.js`; `taskpane.js` (Blöcke KW-KA6-MEMO, KW-WORDVERGLEICH) | Herkunft je Passage innerhalb eines erzeugten Dokuments steht im Block je Quelle, nicht an jeder Passage |
| K5 | R-0349 Alltagssprache → Recherche mit Quelle, Stand, Reifegrad, Lücke → Entwurf auf Zuruf, jede Passage mit Herkunft | **Bestand, teilweise:** Recherche über den Fragenweg (`/api/ask`) mit Quellen und Prüfstand; ehrliche Lücke (KW-D2-LUECKE); Entwurf auf Zuruf: KA6 Stufe 1 (`services/output/src/zuruf.ts`, `POST /api/klara/sessions/{id}/zuruf`; OFFEN.md KA6: „Stufe 1 ERLEDIGT am 21.08., JOB 1491 D1, Commit `2eaa857`, BEN GRÜN“) und Memo aus der Quelle (JOB 3091) | `taskpane.js` (KW-KA6-MEMO ab „JOB 3091 · M2“), `services/output/src/zuruf.ts` | Gesprächsfaden fehlt; Zuruf braucht Einwilligung je Dokument und ein konfiguriertes Modell (nicht in diesem Auftrag geändert, hier nicht erneut geprüft) |
| K6 | R-0350 Form passend zur Gattung (Betriebsmitteilung: Anrede, Ton, Aufbau) | **Nicht erfüllt:** die Dokumentarten der Factory haben je eigenen Aufbau, aber keine Textsorte mit Anrede/Ton; „Betriebsmitteilung“ kommt im Bestand nicht vor | Suche in `services`, `apps/web/src`, Word-Panel ohne Treffer | Textsorten mit Anrede/Ton — eigener Ausbau |
| K7 | R-0414 Thema/Quellen wählen → belegtes Textgerüst an der Cursorposition, jede Passage mit Herkunft, als KI-Entwurf gekennzeichnet | **Teilweise:** Quellen wählen → Gerüst der gewählten Art an der Cursorposition mit Herkunftsblock (diese Lieferung) | `anleitung.js`, Test D2 | Wahl nach *Thema* (statt Quellen) fehlt; Herkunft je Quelle, nicht je Passage; das Factory-Ergebnis ist regelbasiert (kein Modell) und trägt deshalb keine KI-Kennzeichnung, sondern den Prüfhinweis — KI-Kennzeichnung gibt es am Zuruf-Weg (`aiGenerated`, KA6) |
| K8 | R-0426 Recherche → E-Mail oder Dokument an der Cursorposition; fehlen: Gesprächsfaden, Textsorte, Modell | **Teilweise:** Recherche (Bestand), Einfügeweg (Bestand) und Dokumenterzeugung nach Word (diese Lieferung) | wie K1, K5 | Gesprächsfaden, Textsorte E-Mail, Modell — Modellfrage ist OFFEN.md S6 „Eine Maschine für ein hausinternes Modell“ (Status ENTSCHEIDUNG); hier nicht entschieden |
| K9 | R-0678 Dienst gebaut, aber von keiner Stelle aufgerufen | **Erfüllt im Bestand und hier erweitert:** Web-Ausgabe (`apps/web/src/pages/Stufe2.tsx`, Seite Output, hinter Stufe 2) und jetzt Word-Panel | `services/app/src/output-routes.test.ts`; Test D2 | **Quellenwiderspruch:** R-0678 nennt „kein Aufrufer“, der Bestand hat einen Web-Aufrufer (`tests/r1864-w9-zuordnung/w9-quelle-und-zuordnung.test.ts` Z3a) |
| K10 | R-0732 sieben Dokumentarten auf Knopfdruck, Herkunft an jedem Ergebnis, kein Ungeprüftes/Vertrauliches | **Diese Lieferung (Word):** alle sieben wählbar; FAQ neu im Dienst; Verfahrensanweisung nutzt den Renderer der Arbeitsanweisung (SOP), keinen eigenen; Ausschluss serverseitig | `services/output/src/types.ts`, `render.ts`; Tests D1, D5, `service.test.ts` (FAQ) | Web-Ausgabe bietet FAQ nicht an (eigene Artenliste in `apps/web/src/lib/outputDoc.ts`, nicht Teil dieses Word-Umfangs) |
| K11 | R-0763 Foliensatz; Code da, Schalter bewusst aus | **Bestand, unverändert gesperrt:** `services/app/src/routes/slides-routes.ts`, `slide-converter.ts`; `KLARWERK_SLIDES_ENABLED` aus | Übergabedokument Abschnitt 8 (Registerherkunft R-0763) | Aktivierung ist eine gesonderte Entscheidung („NO-GO bis Infra-Isolation“); hier nicht geändert |
| K12 | R-1737 Instruction Builder → Arbeitsanweisung (MD-Export) | **Bestand:** Web-Ausgabe mit Markdown-Download (`downloadFilename`, `apps/web/src/lib/outputDoc.ts`); zusätzlich jetzt Arbeitsanweisung als Word-Absätze | `tests/output/output-doc.test.ts`; Test D | — |
| K13 | R-1738 Checkliste/Troubleshooting/Schulung/Management-Summary | **Bestand (Dienst, Web) + diese Lieferung (Word)** | `services/output/src/service.test.ts`; Test D2 | — |
| K14 | R-1739 Herkunft an jedem Output (Quelle/Status/Trust/Version/Gültigkeit/Rolle) | **Wie K3** | wie K3 | wie K3 |
| K15 | R-2109 Output Factory (KANN) | **Bestand** | `services/output` | — |
| K16 | SOLL:FR-EXT-03 Inhalte mit Quelle, Trust, Validierungsstatus, Version, Gültigkeit, Rolle, Unsicherheiten; Vorschau nur aus validiertem Objekt | **Teilweise:** Inhalte und Angaben wie K3/K10; Vorschau im Web (Output-Seite); im Word-Panel wird nach Klick eingefügt, nicht vorab gezeigt | wie K3, K10 | Prüfdatum wie K3 |
| K17 | Ergebnis mit Fassung und Beleg festhalten; Teilumfänge und gesonderte Aufträge abgrenzen | **Dieses Kapitel**; Lieferbeleg erst nach Veröffentlichung | — | Livefassung, `/health`, Realhostbeleg |
| K18–K22 | Pedi 28.09.: Vorlage erklärt Pflicht/optional; Baustein mit Herkunft und Fassung; Hinweise am Abschnitt; formal ≠ fachlich; Rückweg erhält Struktur und Quellenbezug | **Diese Lieferung** | Tests V, B, P, R (21/21 grün zu Kandidat `b4a727cc`, `HISTORIE/nacharbeit-3/PRUEFUNG/anleitung-word.log`; nach Nacharbeit 4 erneut im Prüflauf) | Realhost-Abnahme (Menschenprobe) |

**Gesonderte Aufträge und Bestände, ausdrücklich abgegrenzt.**

- `aufnahme:20260922:word-echter-arbeitsweg` (Auftrag 4): Word-Rückweg (`rueckweg.js`), hier
  unverändert wiederverwendet; seine Abnahme ist `docs/operations/word-host-gesamtweg.md`.
- `gesamt-wissen-editor`: im Umfang zum Abgleich genannt. Sein Auftragsinhalt liegt diesem Auftrag
  nicht vor; abgeglichen ist nur der Repo-Bestand — Web-Editor (`RichTextEditor`,
  `apps/web/src/lib/editorBlockInsert.ts`) und Web-Gesamtanweisung
  (`apps/web/src/components/gesamtanweisung/`, JOB 4154). Beide sind unverändert; der Word-Weg
  dieses Auftrags weitet sie nicht aus. Ob sich Bausteinbegriff und Gesamtanweisung später decken
  sollen, ist offen.
- Folien (R-0763): gesperrt, siehe K11.
- Modell/Gesprächsfaden (R-0349, R-0426): KA6 und OFFEN.md S6, siehe K5/K8.
