# Host-Abnahme: Klara in Word für Mac

> Aufnahme `m365-anmeldung`, Lauf 1 Runde 2 (25.09.2026), übernommen in Lauf 2 (26.09.2026, Basis
> `c38f2d71`, 1.0.0-beta.1.608) — noch immer ohne Lauf. Gemeinsamer Teil (Stammdaten, Zustimmung,
> Zustände, Zuordnung der Anliegen): `docs/word-addin/ABNAHME-M365.md`. Installationsweg:
> `docs/word-addin/SIDELOAD-ANLEITUNG.md`. Der Browser-Weg ist getrennt:
> `docs/operations/word-web-hostabnahme/README.md`.

## Stand dieses Belegs

| Frage | Antwort |
| --- | --- |
| Realer Lauf in Word für Mac mit dem heutigen Anmeldeweg durchgeführt? | **Nein. Kein Lauf ist belegt.** |
| Was früher belegt ist | Pedis Sideload in Word für Mac 16.111 am 24.07.2026 (WP-KLARA-1c, Manifestkommentar und `SIDELOAD-ANLEITUNG.md`) — **vor** der Dialogseite (JOB 4076) und vor dieser Runde. Ein Anmeldelauf ist dort nicht festgehalten. |
| Warum kein neuer Lauf? | Die Stammdaten des Testkontos sind zentral hinterlegt (`ABNAHME-M365.md`, Abschnitt 1), das Kennwort bewusst nicht; die Baubahn kann Word für Mac nicht bedienen. |
| Bis wann? | Vor Ablauf der Testversion am **20.10.2026** (gilt, wenn Word für Mac mit dem Testkonto angemeldet wird). |
| Produktfassung für den Lauf | Die ausgelieferte Fassung, in der diese Runde enthalten ist — im Seitenfenster unter Einstellungen ablesen und unten eintragen. Manifest `klara-manifest.xml`, `<Version>1.0.0.1</Version>`. |

## Voraussetzungen (vor dem Lauf eintragen, ohne Geheimnisse)

| Feld | Eintrag |
| --- | --- |
| Datum / Uhrzeit (UTC) | |
| Produktfassung (Einstellungen im Seitenfenster) | |
| Word-Version (Word → Über Word, nur Nummer) | |
| macOS-Version | |
| Kontotyp Microsoft 365 (Quelle: Business Basic, Testversion, eigener Testmandant — beim Lauf bestätigen) | |
| Bereitstellung (Weg A wef-Ordner / Weg B Hochladen) | |
| Bearbeitungsrecht am Testdokument | |
| KLARWERK-Konto: Rolle, freigegeben? (keine Adresse) | |
| Zweites KLARWERK-Konto für den Kontowechsel vorhanden? | |

## Ablauf und Ergebnis

Bildbelege unter `docs/operations/word-mac-hostabnahme/belege/` (vorher Konto- und Mandantennamen
schwärzen).

| # | Schritt | Soll | Ergebnis |
| --- | --- | --- | --- |
| M1 | Add-in bereitstellen (Weg A), Word neu starten | Klara unter Start → Add-ins | |
| M2 | Echtes Dokument öffnen, Klara öffnen | „nicht angemeldet", Knopf im Seitenfenster | |
| M3 | **Bei KLARWERK anmelden** | eigenes Anmelde-Fenster; Seitenfenster wartet | |
| M4 | Anmelden | Seitenfenster erkennt die Anmeldung von selbst, zeigt den Namen | |
| M5 | Auswahl als Entwurf senden | „Entwurf angelegt" | |
| M6 | Fragen, Quelle öffnen, Antwort einfügen | wie Web W8–W10 | |
| M7 | Abmelden, mit zweitem Konto anmelden | neuer Name; Entwurf aus M5 nicht sichtbar | |
| M8 | Zurück zum ersten Konto | Entwurf aus M5 unverändert | |
| M9 | Anmelde-Fenster offen lassen, 5 Minuten nichts tun | „Keine Anmeldung erkannt. Bitte erneut versuchen.", Knopf frei | |
| M10 | Word beenden und neu starten, Klara öffnen | Anmeldung verständlich (angemeldet oder Knopf) | |

## Ergebnis dieses Belegs

**Offen.** Bis M1–M10 ausgefüllt sind, ist Word für Mac nicht getrennt nachgewiesen.
