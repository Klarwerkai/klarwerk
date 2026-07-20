# Klara in Word — Sideload-Anleitung (Mac)

> WP-KLARA-1: erster Schritt. Klara kann in Word deine TEXTAUSWAHL als KLARWERK-Entwurf anlegen —
> ehrlich, ohne KI-Versprechen, nichts wird automatisch veröffentlicht. Das Taskpane lädt von der
> echten HTTPS-Domain (https://app.klarwerk.ai/word-addin/taskpane.html) — lokale Dev-Zertifikate
> (~/.office-addin-dev-certs) werden NICHT gebraucht.

## Voraussetzungen

1. Word für Mac (Microsoft 365).
2. Einmal im normalen Browser bei https://app.klarwerk.ai anmelden (prüft, dass dein Konto läuft).
3. Die Manifest-Datei aus diesem Ordner: `klara-manifest.xml`.

## Weg A — Add-in direkt in Word hochladen (empfohlen)

1. Word öffnen, ein beliebiges Dokument (auch leer).
2. Menüband **Einfügen** → **Add-Ins** (bzw. „Add-Ins abrufen").
3. Im Dialog oben auf **Mein Add-In hochladen** (bzw. „Upload My Add-in") klicken.
4. `klara-manifest.xml` auswählen → **Hochladen**.
5. Im Menüband erscheint **Klara** — anklicken, das Seitenfenster öffnet sich.

## Weg B — Fallback über den wef-Ordner

Wenn Word den Hochladen-Knopf nicht zeigt (ältere Word-Version):

1. Finder → **Gehe zu** → **Gehe zum Ordner …** und diesen Pfad einfügen:
   `~/Library/Containers/com.microsoft.Word/Data/Documents/wef`
   (fehlt der Ordner `wef`, einfach anlegen).
2. `klara-manifest.xml` in diesen Ordner kopieren.
3. Word KOMPLETT beenden und neu starten.
4. **Einfügen** → **Add-Ins** → Reiter „Meine Add-Ins" → **Klara** auswählen.

## Erster Test (2 Minuten)

1. Klara öffnen — oben steht der ehrliche Anmelde-Status.
2. Nicht angemeldet? **Bei KLARWERK anmelden** klicken, im Seitenfenster einloggen,
   dann das Seitenfenster schließen und Klara über das Menüband neu öffnen.
3. Im Dokument einen Absatz markieren → **Auswahl als Entwurf senden**.
4. Ergebnis: „Entwurf angelegt: …" + Link **In KLARWERK öffnen** — der Entwurf liegt unter
   Erfassen → Entwürfe fortsetzen. Er ist ein ENTWURF: prüfen und bewusst einreichen wie gewohnt.

## Troubleshooting

- **Add-in lädt nicht / weiße Fläche:** Word beenden, Office-Webcache leeren
  (`~/Library/Containers/com.microsoft.Word/Data/Library/Caches` leeren bzw. den Ordner
  `com.microsoft.Office365ServiceV2` darin), Word neu starten.
- **„Nicht angemeldet" obwohl im Browser eingeloggt:** Das Taskpane ist ein EIGENER Webview mit
  eigenen Cookies — die Anmeldung muss einmal IM Taskpane erfolgen (Knopf im Add-in).
- **Senden schlägt fehl (offline/Fehlermeldung):** Klara täuscht nie Erfolg vor — Meldung lesen;
  meist fehlt Netz oder die Anmeldung ist abgelaufen (erneut anmelden, nochmal senden).
- **Hinweis Domain:** `app.klarwerk.ai` leitet serverseitig auf `klarwerk.ai` um — das ist normal
  und im Manifest berücksichtigt (beide Domains freigegeben).
- **Add-in wieder entfernen:** Weg A: Einfügen → Add-Ins → bei Klara „…" → Entfernen.
  Weg B: Datei aus dem wef-Ordner löschen, Word neu starten.
