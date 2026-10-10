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

## Grenzen

- Die bisherigen Zustandsanimationen (Anfrage läuft, Antwort bereit) gelten für alle Motive; eigene
  emotionale Animationsdateien je Motiv sind nicht Teil dieser Lieferung.
- Der klassische Hilfeknopf (ohne eingeschaltete bewegliche Assistenz) zeigt den persönlichen Namen,
  sobald einer gespeichert ist; ohne Namen behält er seine bisherigen, eingefrorenen Grundtexte.

## Prüfungen

- `tests/assistenz-profil/profil-am-server.test.ts` — Server über HTTP (Einrichtung, Prüfung, zwei
  Konten, zweite Sitzung, Fremdkonto, Konflikt, Gespräche unverändert, Prüfprotokoll).
- `tests/assistenz-profil/profil-pg.integration.test.ts` — PostgreSQL (Neustart, zwei Konten, Konflikt).
- `tests/assistenz-profil/katalog.test.ts`, `bildpaket.test.ts` — Motive, Original, Texte.
- `tests/assistenz-profil/assistenz-mounted.test.tsx` — echte Hülle und Profilseite gegen den Server.
- `tests-smoke/assistenz-name-avatar-browser.spec.ts` — Bedienbeleg in Chromium (Desktop,
  390 × 844, Tastatur, Speicherfehler, zwei Konten, zweites Gerät, Fremdkonto).
