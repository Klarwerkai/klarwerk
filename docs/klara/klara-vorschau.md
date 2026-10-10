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

## Echter Betrieb (Klara 01, `produkt:20261008:klara-basis`)

Klara beginnt im **echten Betrieb** („Echt · Frageweg von Klarwerk“ im Gespräch). **„Demo“** schaltet
sichtbar auf die vorgefertigte Vorschau unten um; an der Figur steht dann „Demo“.

| Handlung | Was geschieht |
| --- | --- |
| Einwilligen | „Einverstanden“ im Gespräch. Gespeichert am Server, je Gespräch, widerrufbar. Ohne Einwilligung geht keine Frage los (Client und Server prüfen das). |
| Fragen | Getippte Frage → derselbe Frageweg wie die Seite „Fragen“ (`POST /api/ask`, mit den vorigen Fragen als Faden). KI-Abschaltung, Leserechte, Grund- und Vertraulichkeitsfreigabe wirken dort unverändert. Markierter Seitentext geht nicht mit. |
| Kennzeichnung | „KI-Antwort“ nur, wenn der Frageweg `demo: false` meldet; sonst „Ohne KI · wörtlich aus geprüftem Wissen“. Klaras eingebaute Hilfe heisst „Klarwerk-Hilfe · ohne KI“. |
| Laden und Stoppen | „Anfrage läuft seit … s“ mit **„Anfrage stoppen“**; danach steht „Anfrage gestoppt“ im Gespräch. |
| Fehler | KI abgeschaltet (Satz des Servers), Anmeldung abgelaufen, fehlende Berechtigung, Server nicht erreichbar — jeweils als „Fehler“ mit dem tatsächlichen Grund. |
| Speichern | Jede Nachricht wird am Server unter der eigenen Person abgelegt. Gelingt das nicht, steht „Nicht gespeichert – fehlt nach dem Neuladen“ daneben, mit „Erneut speichern“. |
| Fortsetzen | Nach Neuladen, neuer Anmeldung und auf jeder Seite liest Klara das zuletzt geführte eigene Gespräch: Verlauf, „Begonnen auf …“ (ursprünglicher Objektbezug mit Rückweg) und „Zuletzt begonnen“ (letzter Schritt mit Stand, ggf. „unterbrochen“ und „Erneut fragen“). |
| Verwalten | „Neues Gespräch“, „Gespräch löschen“ (mit Bestätigung). |
| Bedienhilfe | „So arbeitest du mit Klara“ im Gespräch. |

Server: `services/app/src/klara-gespraech.ts` (Dienst, Ablage, `KLARA_GESPRAECH_SCHEMA`) und
`services/app/src/routes/klara-gespraech-routes.ts` (`/api/me/klara/...`, nur das eigene Konto,
fremd und unbekannt 404, Prüfprotokoll nur mit Ereignissen). Eine abgelegte Antwort aus dem Frageweg
braucht eine Antwortkennung, die serverseitig der eigenen Person gehört.
Browser: `apps/web/src/components/klara-vorschau/echt.ts`, `KlaraEchtGespraech.tsx`,
`apps/web/src/api/klaraGespraech.ts`, Texte `apps/web/src/texte/klaragespraech.ts` (DE/EN/NL).

Grenzen des echten Betriebs: Die Antwort kommt nicht gestreamt, sondern nachvollziehbar geladen.
Der Server prüft, dass eine abgelegte Antwort aus einem eigenen Lauf des Fragewegs stammt, nicht
ihren Wortlaut — die Person kann nur ihr eigenes Gespräch beschreiben. Gespräche haben keine
automatische Löschfrist; gelöscht wird bewusst. Erklären, Zusammenfassen, Umformulieren und Notiz an
einem markierten Ausschnitt bleiben Demo.

## Was man in der Demo ausprobieren kann

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

## Ehrliche Grenzen der Demo

- **Alle Antworten der Demo sind vorgefertigt** und als „Demo-Antwort · vorgefertigt“ gekennzeichnet. Es
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
  und WebKit (Desktop und schmal mit reduzierter Bewegung), im Demo-Betrieb
- `tests/klara-basis/` — echter Betrieb: Ablage am Server (`gespraech-am-server.test.ts`,
  PostgreSQL in `gespraech-pg.integration.test.ts`) und die echte Klara gegen den echten Server mit
  kontrolliertem Modelladapter (`klara-echt-am-server.test.tsx`)
- `tests-smoke/klara-basis-browser.spec.ts` — echter Betrieb im Browser: Frage, Kennzeichnung,
  Seitenwechsel, Neuladen, neue Anmeldung, fremde Person, schmal mit Tastatur, Vollbild, Stopp,
  gescheiterte Speicherung, abgelaufene Anmeldung
