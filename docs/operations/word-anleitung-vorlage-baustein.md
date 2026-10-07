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
| **Baustein einfügen** | fügt ein gewähltes geprüftes Wissensobjekt hinter den Cursor ein: Aussage, „Gilt, wenn: …“, nummerierte Maßnahmen und eine Herkunftszeile `Baustein aus Klarwerk: „Titel“ · Fassung n · Prüfstand validiert · Vertrauenswert t · Kennung id` (bei niedrigem Vertrauenswert mit Zusatz) | ja, nur hinter den Cursor | `GET /api/output/sources`, `POST /api/output/generate`, `GET /api/kos/:id` — alle mit `ko.read` |

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
- Nicht in diesem Umfang: Erzeugen ganzer Dokumente (Arbeitsanweisung, Checkliste, Schulung, FAQ,
  Störungsleitfaden, Management-Summary) aus mehreren Quellen in Word, Textsorten mit eigener Form
  (Betriebsmitteilung), Gesprächsfaden und Modell, Foliensätze, vollständige Pflichtangaben je
  Dokument (Gültigkeitsbereich, verantwortliche Rolle, Datum der letzten Prüfung). Die
  Gesamtanweisung der Web-Oberfläche (`apps/web/src/components/gesamtanweisung/`) ist ein eigener
  Bestand und wird hier nicht ausgeweitet.
