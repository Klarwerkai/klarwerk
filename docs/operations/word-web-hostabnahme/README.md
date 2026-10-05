# Host-Abnahme: Klara in Word für das Web (Chrome)

> Aufnahme `m365-anmeldung`, Lauf 1 Runde 2 (25.09.2026), übernommen in Lauf 2 (26.09.2026, Basis
> `c38f2d71`, 1.0.0-beta.1.608) — noch immer ohne Lauf. Gemeinsamer Teil (Stammdaten, Zustimmung,
> Zustände, Zuordnung der Anliegen): `docs/word-addin/ABNAHME-M365.md`. Installationsweg:
> `docs/word-addin/SIDELOAD-CHROME.md`. Der Mac-Weg ist getrennt:
> `docs/operations/word-mac-hostabnahme/README.md`. Rückgabe einer Anleitung als neue Fassung
> desselben Objekts mit Rolle admin (Ergänzung 4, belegpflichtig zu W13):
> `docs/operations/word-host-gesamtweg.md`.

## Stand dieses Belegs

| Frage | Antwort |
| --- | --- |
| Realer Lauf in Word für das Web durchgeführt? | **Nein. Kein Lauf ist belegt.** |
| Warum nicht? | Die Stammdaten des Testkontos sind zentral hinterlegt (`ABNAHME-M365.md`, Abschnitt 1), das Kennwort bewusst nicht — die Baubahn hat keine Sitzung im Testmandanten und kann Word im Browser nicht bedienen; der Testserver fährt nur `tools/check`. |
| Wer kann ihn führen? | Eine Person mit dem Kennwort des Testbenutzers (Pedi oder eine von Pedi beauftragte Person) und einem KLARWERK-Konto. |
| Bis wann? | Vor Ablauf der Testversion am **20.10.2026**. |
| Produktfassung für den Lauf | Die ausgelieferte Fassung, in der diese Runde enthalten ist — im Seitenfenster unter Einstellungen ablesen und unten eintragen. Manifest `klara-manifest.xml`, `<Version>1.0.0.1</Version>`. |

## Voraussetzungen (vor dem Lauf eintragen, ohne Geheimnisse)

| Feld | Eintrag |
| --- | --- |
| Datum / Uhrzeit (UTC) | |
| Produktfassung (Einstellungen im Seitenfenster) | |
| Kontotyp Microsoft 365 (Quelle: Business Basic, Testversion, eigener Testmandant — beim Lauf bestätigen) | |
| Mandant erlaubt Hochladen eigener Add-ins? (ja/nein, woran gesehen) | |
| Chrome-Version (`chrome://version`, nur die Nummer) | |
| Neues, leeres Chrome-Profil benutzt? | |
| Bearbeitungsrecht am Testdokument (bearbeiten / nur lesen) | |
| KLARWERK-Konto: Rolle, freigegeben? (keine Adresse) | |
| Zweites KLARWERK-Konto für den Kontowechsel vorhanden? | |
| Anmeldeweg (Kennwort / SSO) | |

## Ablauf und Ergebnis

Jede Zeile: Ergebnis **ja/nein**, bei „nein" der wörtliche Satz auf dem Bildschirm. Bildbelege
unter `docs/operations/word-web-hostabnahme/belege/` ablegen (vorher Adressleiste, Konto- und
Mandantennamen schwärzen).

| # | Schritt | Soll | Ergebnis |
| --- | --- | --- | --- |
| W1 | Word im Browser, echtes Dokument öffnen | Dokument bearbeitbar | |
| W2 | Add-in hochladen (`SIDELOAD-CHROME.md`) | Klara im Menüband | |
| W3 | Klara öffnen | „nicht angemeldet", Knopf **Anmelden** im Seitenfenster | |
| W4 | **Anmelden** | eigenes Anmelde-Fenster; Seitenfenster: „Warte auf die Anmeldung im Anmelde-Fenster ..." | |
| W5 | Mit Kennwort anmelden | Anmelde-Fenster schließt sich, Seitenfenster zeigt den eigenen Namen — ohne weiteren Klick | |
| W6 | (falls SSO eingerichtet) Abmelden, dann **Anmelden** → **Mit SSO anmelden** | nach dem Anbieter zurück im Anmelde-Fenster, Übergabe von selbst, kein zweiter Druck | |
| W7 | Dokument lesen: Absatz markieren, Markierung erscheint in Klara | Markierung sichtbar | |
| W8 | Fragen: eine Frage stellen | Antwort oder ehrlicher Wissenslücken-Satz | |
| W9 | Quelle öffnen aus der Antwort | Quelle öffnet sich | |
| W10 | Antwort in Word einfügen | Text steht im Dokument | |
| W11 | Auswahl als Entwurf senden | „Entwurf angelegt" + Link | |
| W12 | Dokument speichern, schließen, wieder öffnen, Klara öffnen | Seitenfenster „nicht angemeldet" oder angemeldet; nach **Anmelden** ist der Entwurf aus W11 in der Anwendung da; Inhalt, Bilder, Zuordnung und Quelle gegen das Sollpaket: Schritte WS1–WS4 unten | |
| W13 | Rückweg (JOB 3667): geänderten Absatz zurück an dasselbe Wissensobjekt | Vorschlag/Version am selben Objekt | |
| W14 | Rückfrage „neues Fenster anzeigen" einmal ignorieren | sofort „Das Anmelde-Fenster ließ sich nicht öffnen …", Knopf frei | |
| W15 | Seitenfenster neu laden | „nicht angemeldet"; **Anmelden** übergibt ohne Formular | |
| W16 | Einstellungen → Konto → **Abmelden**, **Anmelden** | Anmelde-Fenster zeigt das Formular (alte Anmeldung ist beendet) | |
| W17 | Mit dem zweiten Konto anmelden | neuer Name; Entwurf aus W11 ist im zweiten Konto **nicht** sichtbar | |
| W18 | Zurück zum ersten Konto | Entwurf aus W11 unverändert | |
| W19 | Anmelde-Fenster öffnen und 5 Minuten nichts tun | Abbruch mit verständlichem Satz, Knopf frei | |

## Sollvergleich nach dem Wiederöffnen (Kriterium 3, nur Word für das Web)

Ablauf und Bedeutung: `docs/operations/word-host-gesamtweg.md`, Abschnitt 2. Das Sollpaket steht
vor dem Lauf fest (`node tools/word-host-wiederoeffnen.ts sollpaket web abnahme/`); ein Ergebnis aus
Word für Mac zählt hier nicht. Ergebnis = die Ausgabe des Vergleichs, wörtlich.

| # | Schritt | Soll | Ergebnis |
| --- | --- | --- | --- |
| WS1 | `pruefdokument-web.docx` in OneDrive/SharePoint öffnen, Änderungssatz aus `soll-web.json` als letzten Absatz eintippen, „Ganzes Dokument übernehmen“ | Entwurf angelegt, Kennung notiert | |
| WS2 | Speichern, Browserfenster schließen, Dokument wieder öffnen, Kopie als `wiedergeoeffnet-web.docx` herunterladen | Datei liegt vor | |
| WS3 | `node tools/word-host-wiederoeffnen.ts vergleiche-docx soll-web.json wiedergeoeffnet-web.docx` | „✓ gleich dem Soll“ | |
| WS4 | `GET /api/drafts/<id>` als `entwurf-web.json`, dann `node tools/word-host-wiederoeffnen.ts vergleiche-objekt soll-web.json entwurf-web.json <id>` | „✓ gleich dem Soll“ (bei „offen“: `vergleiche-bild`) | |

## Ergebnis dieses Belegs

**Offen.** Bis Zeilen W1–W19 und WS1–WS4 ausgefüllt sind, ist TEST-A10 und der Realbeleg für
OFFICE-WEB-ANMELDUNG nicht erbracht. Was ohne Microsoft-Konto gemessen ist, steht in
`docs/word-addin/ABNAHME-M365.md`, Abschnitt „Zustände".
