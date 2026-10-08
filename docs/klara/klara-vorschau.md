# Klara zuerst ansehen — die bewegliche Klara (Vorschau)

Auftrag `produkt:20261007:klara-vorschau` (Ausbauliste Punkt 1). Erste ansehbare Fassung: Klara als
orangefarbene Figur, frei beweglich über die ganze Klarwerk-Browseroberfläche, mit Kontext der
Seite und der Markierung.

## Einstieg

1. In Klarwerk anmelden.
2. Die Adresse **`/klara-vorschau`** öffnen (z. B. `http://127.0.0.1:3000/klara-vorschau` lokal).
3. Ab jetzt begleitet Klara diese Browser-Sitzung auf jeder Seite. Sie ersetzt dabei den runden
   Hilfeknopf unten rechts. **„Vorschau beenden“** in Klaras Gespräch schaltet sie wieder aus.

Ohne diesen Einstieg bleibt die Oberfläche unverändert (Hilfeknopf `KlaraAssistant`).

## Was man ausprobieren kann

| Handlung | Wie |
| --- | --- |
| Verschieben | Maus oder Finger ziehen; Tastatur: Klara fokussieren, Pfeiltasten (Umschalt = grosse Schritte) |
| Zurücksetzen | Taste Pos1 auf Klara oder „Position zurücksetzen“ im Gespräch |
| Andocken | Nah am linken/rechten Rand loslassen oder „Am Rand andocken“; bleibt bei Fensteränderung am Rand |
| Parken | Klara auf einen Absatz des fiktiven Artikels ziehen — sie wandert beim Scrollen mit |
| Gespräch | Klick (ohne Ziehen) öffnet/schliesst; „Verkleinern“ macht Klara klein, Klick öffnet wieder |
| Ansicht | „Seitlich anzeigen“ (App rückt zur Seite) oder „Kompakt anzeigen“; schmal als Blatt unten |
| Markierung | Text markieren → „Klara fragen“ — oder markierten Text auf Klara ziehen |
| Mit dem Ausschnitt | Erklären, Zusammenfassen, Umformulieren (Vorschlag mit Original, erst „Übernehmen“ ändert), Notizentwurf |
| Tutorial „Fragen“ | Auf `/fragen`: „Erkläre mir das“, „Zeige mir den nächsten Schritt“, „Begleite die Durchführung“ |
| Zwischenfrage | Während der Begleitung eine Frage an Klara senden — das Tutorial hält am selben Schritt |
| Vollbild | „Vollbild“ im Gespräch; Klara bleibt im Bild |

## Ehrliche Grenzen

- **Alle Antworten sind vorgefertigt** und als „Demo-Antwort · vorgefertigt“ gekennzeichnet. Es
  arbeitet keine KI; die Vorschau ist kein Nachweis für echte KI-Antworten.
- **Nichts wird gespeichert.** Notiz, Aufgabe, Erinnerung und Termin sind als Demo gekennzeichnet
  und werden nur in dieser Browser-Sitzung gemerkt (sessionStorage). Kein Kalender, keine
  Serveranfrage.
- Die **fiktiven Artikel** sind Konstanten im Bündel und nur auf Deutsch hinterlegt. Eine
  übernommene Umformulierung ändert nur die Vorschau, kein Wissensobjekt.
- Klara bewegt sich **nur im Browser**, nicht systemweit auf dem Desktop.

## Bauteile

- `apps/web/src/components/klara-vorschau/` — Figur, Gespräch, Kontext, Antworten, Zustand
- `apps/web/src/pages/KlaraVorschau.tsx` — Einstieg und fiktiver Artikel
- `apps/web/src/tutorial/fernsteuerung.ts` — Klara liest und steuert das vorhandene Tutorial
- `apps/web/public/klara/klara-avatar-v1.png` — der freigegebene Avatar (SHA-256
  `c2327f5bf84dc67706d1f4f11dc471671c78f3183f729a0c2b1b52303ab2f87b`)
- Texte: `apps/web/src/texte/klaravorschau.ts` (DE/EN/NL)

## Prüfungen

- `tests/klara-vorschau/` — Zustand, Kontext, Antworten, Avatar-Datei, montierte Hülle mit Tutorial
- `tests-smoke/klara-vorschau-browser.spec.ts` — zusammenhängender Bedienbeleg in Chromium, Firefox
  und WebKit (Desktop und schmal mit reduzierter Bewegung)
