# Klara in Word für das Web (Chrome)

> JOB 4016, Teil 1. Diese Anleitung beschreibt, wie das Add-in **Klara** in **Word für das Web**
> (Word im Browser, z. B. in Chrome) bereitgestellt wird — mit derselben Manifestdatei wie auf dem
> Mac. Sie sagt außerdem, wo sie aufhört: **Kein Lauf in Word für das Web ist belegt.** Niemand hat
> diesen Weg bisher bis zur fertigen Anmeldung durchgespielt; was unten im Abschnitt
> „Was hier NICHT belegt ist" steht, ist offen und wird hier nicht schöngeredet.
>
> Für **Word für Mac** gilt weiterhin die eigene Anleitung: `SIDELOAD-ANLEITUNG.md`.

## Voraussetzungen

1. Ein Microsoft-365-Konto, mit dem sich Word im Browser öffnen lässt.
2. Chrome (oder ein anderer aktueller Browser) und ein Konto bei KLARWERK — einmal im normalen
   Browsertab bei `https://app.klarwerk.ai` anmelden, damit klar ist, dass das Konto läuft.
3. Die Manifestdatei aus diesem Ordner: `klara-manifest.xml` (unverändert verwenden — dieselbe
   Datei wie auf dem Mac, es gibt keine zweite Fassung).
4. **HTTPS ist Pflicht und schon erfüllt:** das Taskpane liegt unter
   `https://app.klarwerk.ai/word-addin/taskpane.html`; genau diese Adresse (samt Cachekennung
   `?v=<Version>`) steht im Manifest unter `SourceLocation`, und beide Domains des Hauses stehen
   dort unter `AppDomains`. Ein Add-in im Browser lädt ausschließlich über HTTPS — eine lokale
   Adresse ohne Zertifikat funktioniert nicht.

## Bereitstellen (Add-in hochladen)

1. Word im Browser öffnen und ein Dokument anlegen oder öffnen (auch ein leeres genügt).
2. Im Menüband **Start** bzw. **Einfügen** den Eintrag **Add-Ins** öffnen.
3. Im Dialog oben **Mein Add-In hochladen** („Upload My Add-in") wählen.
4. `klara-manifest.xml` auswählen und **Hochladen**.
5. Wird das Manifest angenommen, erscheint **Klara** als Schaltfläche im Menüband; ein Klick öffnet
   das Seitenfenster. Das ist der von Microsoft dokumentierte Weg — **kein bei uns gefahrener
   Lauf**. Was Klara danach anzeigt, hängt an der Anmeldung (siehe unten).

Das Hochladen gilt für dieses Konto und diese Dokumentumgebung; eine Verteilung über den
Microsoft-365-Administrator ist ein anderer Weg und hier nicht beschrieben.

## Was hier NICHT belegt ist

Diese vier Punkte sind offen. Sie stehen hier, damit niemand aus dieser Anleitung mehr liest, als
sie hergibt.

1. **Die Anmeldung im eingebetteten Fenster ist ungeprüft.** Word im Browser lädt Klara in einem
   Rahmen einer fremden Herkunft. Browser behandeln Cookies in dieser Lage eingeschränkt
   (Tracking-Schutz, Stichwort **ITP**, und Drittanbieter-Cookies). Microsofts Originaldoku dazu:
   <https://learn.microsoft.com/en-us/office/dev/add-ins/develop/itp-and-third-party-cookies> —
   gelesen werden muss sie dort, nacherzählt wird sie hier nicht. Ob die Sitzungsübergabe aus dem
   Anmeldedialog ins Seitenfenster in dieser Lage trägt, hat niemand gemessen.
2. **Das Sitzungscookie bleibt `SameSite=Lax`.** Es wird NICHT auf `None` gelockert, um eine
   Anmeldung im Rahmen „zu reparieren" — das wäre eine eigene, bewusste Entscheidung über ein
   CSRF-Risiko und gehört Pedi vorgelegt, nicht nebenbei erledigt. Der Vermerk dazu steht im Code:
   `services/app/src/security-headers.ts:22-24`.
3. **Der vollständige Rückweg wartet auf zwei laufende Arbeiten:** **JOB 3667** (Anmeldeablauf im
   Seitenfenster) und **JOB 4011** (Sitzung am Server). Erst danach wird der Weg im Browser
   überhaupt ehrlich abnehmbar sein.
4. **Wer einbetten darf, steht an genau einer Stelle im Code:**
   `services/app/src/office-host.ts`. Dort stehen die belegten Hosts der Office-Runtime, die
   bewusst nicht freigegebenen Plattformfamilien und die Prüfung dazu. Diese Anleitung wiederholt
   die Liste nicht — eine zweite Fassung wäre die Fassung, die als Erste veraltet.

## Wenn etwas nicht geht

- **Das Hochladen wird abgelehnt:** Manifest wirklich unverändert? Es muss genau
  `klara-manifest.xml` aus diesem Ordner sein; ein von Hand geändertes Manifest (andere Adresse,
  anderer Kommentarkopf) ist die häufigste Ursache.
- **Klara erscheint, das Fenster bleibt leer:** Seite im Seitenfenster neu laden. Bleibt es leer,
  ist das ein Befund für JOB 3667 — nichts, was diese Anleitung aufhebt.
- **„Nicht angemeldet", obwohl im Browser angemeldet:** genau der offene Punkt 1. Bitte melden, was
  auf dem Bildschirm steht, statt eine Umgehung zu bauen.
- **Klara meldet einen Fehler:** Die Meldung gilt. Klara täuscht keinen Erfolg vor; ein nicht
  angelegter Entwurf wird als nicht angelegt gemeldet.
