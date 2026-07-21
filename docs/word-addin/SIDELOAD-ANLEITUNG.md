# Klara in Word — Sideload-Anleitung (Mac)

> WP-KLARA-1: erster Schritt. Klara kann in Word deine TEXTAUSWAHL als KLARWERK-Entwurf anlegen —
> ehrlich, ohne KI-Versprechen, nichts wird automatisch veröffentlicht. Das Taskpane lädt von der
> echten HTTPS-Domain (https://app.klarwerk.ai/word-addin/taskpane.html) — lokale Dev-Zertifikate
> (~/.office-addin-dev-certs) werden NICHT gebraucht.
>
> WP-KLARA-1c: Anleitung nach Pedis ERFOLGREICHEM Sideload (Word Mac 16.111) nachgezogen — der
> funktionierende Weg ist der wef-Ordner + Cache leeren + Word-Neustart, danach erscheint Klara im
> **HOME-Tab** unter **Add-ins** (NICHT unter Einfügen → Meine Add-Ins; dort tauchen Sideloads oft
> nicht auf). Das Manifest ist bewusst OHNE Kommentar-Header vor `<OfficeApp>` — ein solcher Header
> war vermutlich Mitursache, dass das Add-in zunächst nicht erschien.

## Voraussetzungen

1. Word für Mac (Microsoft 365).
2. Einmal im normalen Browser bei https://app.klarwerk.ai anmelden (prüft, dass dein Konto läuft).
3. Die Manifest-Datei aus diesem Ordner: `klara-manifest.xml` (unverändert kopieren).

## Weg A — wef-Ordner (funktioniert, empfohlen)

1. Finder → **Gehe zu** → **Gehe zum Ordner …** und diesen Pfad einfügen:
   `~/Library/Containers/com.microsoft.Word/Data/Documents/wef`
   (fehlt der Ordner `wef`, einfach anlegen).
2. `klara-manifest.xml` in diesen Ordner kopieren.
3. Office-Webcache leeren: in
   `~/Library/Containers/com.microsoft.Word/Data/Library/Caches`
   den Ordner `com.microsoft.Office365ServiceV2` löschen (bzw. den Caches-Inhalt leeren).
4. Word KOMPLETT beenden (Cmd+Q) und neu starten.
5. Im Menüband auf dem **HOME-Tab** (Start) den Knopf **Add-ins** öffnen → **Klara** auswählen —
   das Seitenfenster öffnet sich.

## Weg B — Fallback: Add-in direkt in Word hochladen

Nur falls Weg A auf deinem Stand nicht angeboten wird (der Einfügen-Dialog zeigt Sideloads nicht
in jeder Word-Mac-Version zuverlässig an — bei Pedi erschien Klara dort NICHT):

1. Word öffnen, ein beliebiges Dokument (auch leer).
2. Menüband **Einfügen** → **Add-Ins** (bzw. „Add-Ins abrufen").
3. Im Dialog oben auf **Mein Add-In hochladen** (bzw. „Upload My Add-in") klicken.
4. `klara-manifest.xml` auswählen → **Hochladen**.
5. Erscheint Klara danach nicht: zurück zu Weg A (wef-Ordner + Cache + Neustart, Home-Tab → Add-ins).

## Erster Test (2 Minuten)

1. Klara öffnen — oben steht der ehrliche Anmelde-Status.
2. Nicht angemeldet? **Bei KLARWERK anmelden** klicken. Die Anmeldung öffnet sich in einem EIGENEN
   Fenster; das Klara-Panel bleibt stehen, zeigt „Warte auf die Anmeldung …" und erkennt die
   Anmeldung automatisch (WP-KLARA-1c — nichts schließen, nichts neu öffnen).
3. Im Dokument einen Absatz markieren → **Auswahl als Entwurf senden**.
4. Ergebnis: „Entwurf angelegt: …" + Link **In KLARWERK öffnen** — der Entwurf liegt unter
   Erfassen → Entwürfe fortsetzen. Er ist ein ENTWURF: prüfen und bewusst einreichen wie gewohnt.

## Troubleshooting

- **Klara erscheint nicht im Home-Tab → Add-ins:** Manifest wirklich UNVERÄNDERT in den wef-Ordner
  kopiert? Cache geleert? Word komplett beendet (Cmd+Q, nicht nur Fenster zu) und neu gestartet?
- **Add-in lädt nicht / weiße Fläche:** Word beenden, Office-Webcache erneut leeren (s. Weg A,
  Schritt 3), Word neu starten.
- **„Nicht angemeldet" obwohl im Browser eingeloggt:** Das Taskpane ist ein EIGENER Webview mit
  eigenen Cookies — die Anmeldung einmal über den Knopf im Add-in machen; das Panel wartet und
  erkennt sie automatisch. Bricht das Warten nach 5 Minuten ab, einfach erneut klicken.
- **Senden schlägt fehl (offline/Fehlermeldung):** Klara täuscht nie Erfolg vor — Meldung lesen;
  meist fehlt Netz oder die Anmeldung ist abgelaufen (erneut anmelden, nochmal senden).
- **Hinweis Domain:** `app.klarwerk.ai` leitet serverseitig auf `klarwerk.ai` um — das ist normal
  und im Manifest berücksichtigt (beide Domains freigegeben).
- **Add-in wieder entfernen:** Weg A: Datei aus dem wef-Ordner löschen, Word neu starten.
  Weg B: Einfügen → Add-Ins → bei Klara „…" → Entfernen.
