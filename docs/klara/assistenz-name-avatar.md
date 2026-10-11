# Persönliche Assistenz: eigener Name und eigenes Motiv

Auftrag `produkt:20261010:assistenz-name-avatar` (PoC). Ergänzt die bestehende bewegliche
Assistenz (`docs/klara/klara-vorschau.md`) um einen persönlichen Namen und eines von dreizehn
Motiven je Konto. Keine neue App, keine neue Steuerung.

## Bedienung

| Schritt | Was geschieht |
| --- | --- |
| Erste Anmeldung (auch Bestandskonto ohne Profil) | Unter dem Inhalt erscheint ein schmales Band „Wie soll deine Assistenz heißen?“ mit „Jetzt einrichten“ und „Später“. Es ist kein Dialog und sperrt nichts. Steht der Nutzungshinweis noch offen, kommt das Band erst nach dessen Bestätigung. |
| Jetzt einrichten | Das Band klappt auf: Namensfeld (Fokus), dreizehn Motive in „Ausdrucksstark“ (Original vorn) und „Sachlich“, Vorschau, „Bewegung der Figur reduzieren“. Ohne Name oder Motiv wird nichts gespeichert; der Grund steht am Feld. |
| Speichern | `PUT /api/me/assistenz` mit `einrichtungAbschliessen`. Erst die Antwort des Servers gilt; die offene Assistenz übernimmt Name und Motiv sofort. |
| Später | Blendet das Band für diese Browsersitzung aus. Abgeschlossen ist damit nichts; nach dem Abmelden und erneuter Anmeldung wird es wieder angeboten. |
| Ändern | Einstellungen (Zahnrad) → Persönliche Einstellungen (`/profil`) → „Meine Assistenz“ (direkt: `/profil?bereich=assistenz`). Name und Motiv einzeln oder gemeinsam; „Abbrechen“ stellt den gespeicherten Stand wieder her. |
| Speicherfehler | Die Eingabe bleibt stehen, der gespeicherte Stand bleibt unverändert; „Erneut speichern“ und „Abbrechen“. |

Ohne gespeicherten Namen heißt die Assistenz neutral „Assistenz“ bzw. „Deine Assistenz“. Der Name ist
frei (1–40 Zeichen, eine Zeile, keine Sperrliste), wird überall als Text gesetzt und erreicht keinen
Modellweg; er ändert weder Anmeldung, Rolle, Rechte, Modellanbieter noch Datenfreigaben.

Der Name steht in: Figur (zugängliche Beschriftung und Tooltip „… – Gespräch öffnen oder
schließen“), Ansagen beim Verschieben/Andocken, Gesprächskopf, Begrüßung („… ist bereit“),
Sprecherzeile im Verlauf, Eingabefeld, „… fragen“ an einer Markierung, Einwilligung, Bedienhilfe,
Sprache, Seitenkontext und Vorschauseite. Das Motiv gilt für Figur, kompaktes Gespräch, Seitenansicht
und den Knopf an einer Markierung. Gespeicherte Nachrichten werden nicht umgeschrieben.

## Server

- `services/app/src/assistenz-profil.ts` — Ablage (In-Memory und PostgreSQL, Tabelle
  `assistenz_profile`, eine Zeile je Konto, `ASSISTENZ_PROFIL_SCHEMA` additiv), Prüfung, Dienst.
- `services/app/src/routes/assistenz-profil-routes.ts` — `GET`/`PUT /api/me/assistenz`. Das Konto
  kommt nur aus der Sitzung; eine fremde Kontokennung in Rumpf oder Adresse wird mit 403 abgewiesen.
  Fassungsschutz: eine veraltete Fassung ergibt 409. Prüfprotokoll nur mit Ereignis, nie mit Namen.

## Oberfläche

- `apps/web/src/lib/assistenzProfil.ts` — bestätigter Stand je Konto, `useAssistenzAnzeige`,
  `useAssistenzT` (setzt `{{assistenz}}` und `{{assistenzTitel}}` in die Texte).
- `apps/web/src/lib/assistenzAvatare.ts` — die dreizehn Kennungen und Dateien.
- `apps/web/src/components/assistenz/` — Band, Formular, Motivauswahl, Bild mit Ersatzgrafik.
- Texte: `apps/web/src/texte/assistenz.ts` (DE/EN/NL).

## Bildpaket

„Original“ ist die vorhandene Datei `apps/web/public/klara/klara-avatar-v1.png` (unveränderte
Prüfsumme, keine Kopie). Die zwölf neuen Basisbilder gehören nach
`apps/web/public/assistenz/erstauswahl-v1/<kennung>.png` mit den Kennungen `lichtwesen`, `roboter`,
`eule`, `fuchs`, `pinguin`, `wolke`, `kompass`, `prisma`, `wissensbuch`, `verbindungsknoten`,
`monolith`, `leuchtkreis`. Fehlt eine Datei, zeigt die Oberfläche eine neutrale Ersatzgrafik, und
`tests/assistenz-profil/bildpaket.test.ts` wird rot. Eine gespeicherte Kennung, die nicht mehr
angeboten wird, zeigt dieselbe Ersatzgrafik mit Hinweis; der Name bleibt.

## Zustände der Figur

Vorgabe: `ANIMATIONSZUSTAENDE.json` des Bildpakets. Die Figur trägt einen von neun Zuständen
(`data-zustand`), abgeleitet allein aus echten Ereignissen (`components/assistenz/ausdruck.ts`):

| Zustand | Auslöser im Produkt | Ende |
| --- | --- | --- |
| bereit | nichts läuft | neue Aktion |
| warten | Anfrage gesendet, Antwort steht aus | Antwort, Fehler, Stopp |
| nachdenken | die am Server abgelegte Frage wird am Frageweg bearbeitet (assistenz-avatarzustaende) | Antwort, Fehler, Stopp |
| zuhören | Browser bestätigt die Tonaufnahme (`audiostart`) — nicht schon beim Start oder während die Mikrofonberechtigung aussteht | `audioend`, Ende, Fehler (auch verweigerte Berechtigung), Stopp, Schließen |
| sprechen | Sprachausgabe hat tatsächlich begonnen (`start`, nach Pause `resume`) — nicht schon bei der Anforderung | `end`, `error`, `pause`, Stopp; späte Ereignisse einer abgelösten Ausgabe zählen nicht |
| ratlos | Entscheidung bzw. Rückfrage der Person nötig | Person entscheidet |
| freude | Antwort mit Grundlage beantwortet und gespeichert, Profil gespeichert | nach 2,4 s von selbst |
| fehler | Anfrage oder Speichern fehlgeschlagen, Antwort ohne geprüfte Quelle, fehlende Angabe | Wiederholen, Abbrechen, neue Aktion |
| pause | Figur verkleinert, Anfrage gestoppt | neue Aktion, Öffnen |

Ergänzt durch `produkt:20261010:assistenz-avatarzustaende` (Fehlerarten, Aktionskennung, Vorschau):
`docs/klara/assistenz-avatarzustaende.md`.

Darstellung (`index.css`) nach `style_variants`: „expressiv“ (Original, Lichtwesen, Roboter, Eule,
Fuchs, Pinguin, Wolke, Kompass) mit kleinen Gesten der Figur — Atmen, Schweben, Neigen, Nicken,
Sprechbewegung, einmaliges Kippen, kurzer Hüpfer, Absinken; „zurückhaltend“ (Prisma, Wissensbuch,
Verbindungsknoten, Monolith, Leuchtkreis) nur mit Lichtpuls, wanderndem Licht, Signalmodulation,
einmaliger Neigung und Aufhellen, Fehler und Pause gedimmt und still. Bei reduzierter Bewegung (System
oder „Bewegung reduzieren“) bleibt ein statischer Ausdruck; jeder Zustand steht zusätzlich als Text
an der Figur bzw. in der vorgelesenen Beschreibung.

### Mimik der Motive mit Gesicht

Die acht ausdrucksstarken Motive haben ein Gesicht; ihre Mimik liegt als Ebene deckungsgleich über
dem unveränderten Bild (`components/assistenz/AvatarMimik.tsx`, Lage von Augen und Mund bzw.
Schnabel je Motiv in `lib/assistenzMimik.ts`, in Pixeln des 1254 × 1254 großen PNGs):

| Zustand | Mimik |
| --- | --- |
| bereit | gelegentliches Blinzeln |
| warten | ruhiges, etwas häufigeres Blinzeln |
| nachdenken | leicht gesenkte Lider, langsamer Wechsel |
| zuhören | offene Augen, kein Lidschlag |
| sprechen | Mund bzw. Schnabelspalt öffnet und schließt sich, solange die Ausgabe spielt |
| ratlos | ungleich gesenkte Lider (fragender Blick) |
| freude | das untere Lid hebt sich (freundlich zusammengezogene Augen) |
| fehler | ruhig gesenkter, bedauernder Blick |
| pause | halb geschlossene Ruhelider |

Die Ebene bewegt sich mit den Gesten der Figur. Bei reduzierter Bewegung bleibt nur die statische
Lidstellung (und beim Sprechen ein ruhig halb geöffneter Mund). Sachliche Objekte und die neutrale
Ersatzgrafik bekommen keine Mimik-Ebene — keine nachträglich erfundenen Gesichter.

## Grenzen

- Die Mimik wird über die gelieferten Standbilder gelegt (Lider in der Farbe rund um das Auge, Mund-
  bzw. Schnabelspalt); eigene Bildfolgen je Motiv hat das Bildpaket nicht. Brauen und Blickrichtung
  der Bilder bleiben unverändert. Die Lage der Gesichtsteile ist aus den gelieferten Dateien
  vermessen; Bildwirkung und Passgenauigkeit beurteilt ein Mensch an den Bildschirmbelegen.
- „Nachdenken“ ist angelegt, aber ohne Auslöser: der Frageweg meldet keine eigene
  Verarbeitungsphase. Zuhören und Sprechen hängen an den vorhandenen Browserfunktionen
  (Spracherkennung, Sprachausgabe); ohne sie treten diese Zustände nicht auf.
- Der klassische Hilfeknopf heißt ohne gespeicherten Namen neutral „Assistenz öffnen — Hilfe zu
  dieser Seite“ bzw. „Deine Assistenz“, mit Profil trägt er den persönlichen Namen.

## Prüfungen

- `tests/assistenz-profil/profil-am-server.test.ts` — Server über HTTP (Einrichtung, Prüfung, zwei
  Konten, zweite Sitzung, Fremdkonto, Konflikt, Gespräche unverändert, Prüfprotokoll).
- `tests/assistenz-profil/profil-pg.integration.test.ts` — PostgreSQL (Neustart, zwei Konten, Konflikt).
- `tests/assistenz-profil/katalog.test.ts`, `bildpaket.test.ts` — Motive, Original, Texte.
- `tests/assistenz-profil/ausdruck.test.ts` — die neun Zustände: Auslöser, Vorrang, Ende, Stil.
- `tests/assistenz-profil/mimik.test.tsx` — Mimik nur für Motive mit Gesicht, Regeln je Zustand.
- `tests/assistenz-profil/sprachaktivitaet.test.tsx` — Zuhören/Sprechen erst bei bestätigter
  Aufnahme bzw. Wiedergabe; Berechtigung verweigert, Ende, Pause, Stopp, späte Ereignisse.
- `tests/assistenz-profil/assistenz-mounted.test.tsx` — echte Hülle und Profilseite gegen den Server.
- `tests-smoke/assistenz-name-avatar-browser.spec.ts` — Bedienbeleg in Chromium (Desktop,
  390 × 844, Tastatur, Speicherfehler, zwei Konten, zweites Gerät, Fremdkonto).
