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

## Anmelden (so ist es seit JOB 4076 gebaut)

1. Im Seitenfenster auf **Anmelden** drücken. Es öffnet sich ein eigenes Anmelde-Fenster (der
   Office-Dialog) mit der Seite `word-addin/anmeldung.html`. Dieses Fenster ist ein
   eigenständiges Fenster auf der Adresse des Hauses — dort gilt das Sitzungscookie normal.
2. Kurz steht dort **„Verbindung zu Word wird hergestellt …"**. Das Anmelde-Fenster wartet an
   dieser Stelle auf Word: erst wenn Word seine Dialog-Schnittstelle bereitgestellt hat, prüft es
   die Anmeldung und übergibt sie. Vorher kann es nicht übergeben, und es behauptet es auch nicht.
3. Dann anmelden: E-Mail und Kennwort, oder **Mit SSO anmelden**, wenn der Server SSO meldet. Wer
   in diesem Browser schon angemeldet ist, sieht kein Formular — es geht sofort weiter.
4. Das Anmelde-Fenster gibt die Anmeldung **aktiv an das Seitenfenster weiter**: es holt einen
   einmaligen Übergabecode (120 Sekunden gültig, genau einmal einlösbar) und schickt ihn über die
   Dialog-Schnittstelle von Office an Klara. Klara löst ihn ein und hält den Zugang nur im
   Arbeitsspeicher — nicht im Browserspeicher, nicht in einem Cookie, nicht in der Adresse.
5. Danach steht im Seitenfenster der eigene Name, und Klara ist benutzbar. Das Anmelde-Fenster
   schließt sich von selbst.

**Nach SSO braucht es einen zweiten Druck auf »Anmelden«.** Der Rücksprung des Anmeldedienstes
landet in der Anwendung, nicht auf der Dialogseite; danach gilt das Cookie im Dialog, und der
zweite Druck übergibt ohne Formular. Das ist keine Bequemlichkeit, sondern der ehrliche Stand: ein
Rücksprung direkt auf die Dialogseite wäre eine Änderung an der SSO-Einrichtung des Servers.

**Klappt die Übergabe nicht, steht der Grund da.** Klara schreibt dann, dass die Anmeldung dieses
Fenster nicht erreicht — nicht mehr „Zeit abgelaufen", und ausdrücklich ohne den Rat, irgendwelche
Browsereinstellungen zu ändern (das hat niemand gemessen).

## Was hier NICHT belegt ist

Diese vier Punkte sind offen. Sie stehen hier, damit niemand aus dieser Anleitung mehr liest, als
sie hergibt.

1. **Kein Lauf in einem echten Office-Web-Host ist belegt.** Der Weg oben ist gebaut und gemessen,
   aber ohne Microsoft-Konto: die zwei Routen am echten Server-Draht, die Dialogseite und das
   Seitenfenster im Prüfstand, und — der Kern — ein Aufruf an eine geschützte Route **ohne jedes
   Cookie**, der nur durch die Übergabe durchkommt. Was daran NICHT gemessen ist: ob Word im
   Browser den Dialog wirklich so öffnet, die Nachricht wirklich so durchreicht und der Browser
   sich wirklich so verhält. Der Rahmen einer fremden Herkunft ist der Grund für diesen Weg
   (Tracking-Schutz, Stichwort **ITP**, und Drittanbieter-Cookies); Microsofts Originaldoku dazu:
   <https://learn.microsoft.com/en-us/office/dev/add-ins/develop/itp-and-third-party-cookies> —
   gelesen werden muss sie dort, nacherzählt wird sie hier nicht. Die Abnahme im echten Host steht
   aus und ist Sache von Pedi und dem Prüfer.
2. **Das Sitzungscookie bleibt `SameSite=Lax`.** Es wird NICHT auf `None` gelockert, um eine
   Anmeldung im Rahmen „zu reparieren" — das wäre eine eigene, bewusste Entscheidung über ein
   CSRF-Risiko und gehört Pedi vorgelegt, nicht nebenbei erledigt. Der Vermerk dazu steht im Code:
   `services/app/src/security-headers.ts:22-24`.
3. **Die zwei Arbeiten, auf die dieser Weg gewartet hat, sind LIVE — der Rest der Zeile nicht.**
   **JOB 3667** (Anmeldeablauf und Rückweg im Seitenfenster) und **JOB 4011** (Sitzung am Server)
   sind eingebaut; erst damit war die Anmeldung überhaupt schneidbar. Offen bleibt alles, was
   danach kommt: im Browser ein Dokument lesen, fragen, Quellen öffnen, einfügen, speichern und
   wieder öffnen. Und: die Übergabecodes liegen im Arbeitsspeicher EINER Serverinstanz — hinter
   einem Verteiler mit mehreren Instanzen müsste der Dialog dieselbe Instanz treffen. Das ist eine
   Betriebsentscheidung und hier nicht gebaut.
4. **Wer einbetten darf, steht an genau einer Stelle im Code:**
   `services/app/src/office-host.ts`. Dort stehen die belegten Hosts der Office-Runtime, die
   bewusst nicht freigegebenen Plattformfamilien und die Prüfung dazu. Diese Anleitung wiederholt
   die Liste nicht — eine zweite Fassung wäre die Fassung, die als Erste veraltet.

## Wenn etwas nicht geht

- **Das Hochladen wird abgelehnt:** Manifest wirklich unverändert? Es muss genau
  `klara-manifest.xml` aus diesem Ordner sein; ein von Hand geändertes Manifest (andere Adresse,
  anderer Kommentarkopf) ist die häufigste Ursache.
- **Klara erscheint, das Fenster bleibt leer:** Seite im Seitenfenster neu laden. Bleibt es leer,
  bitte melden, was auf dem Bildschirm steht — nichts, was diese Anleitung aufhebt.
- **„Nicht angemeldet", obwohl im Browser angemeldet:** auf **Anmelden** drücken. Das
  Anmelde-Fenster sieht die bestehende Anmeldung und übergibt sie ohne Formular (Schritt 2 oben).
- **Klara schreibt, die Anmeldung erreiche dieses Fenster nicht:** die Übergabe ist nicht
  angekommen. Anmelde-Fenster noch einmal öffnen; hilft das nicht, das Seitenfenster neu laden.
  Bitte melden, was genau dort stand — das ist der Befund, den der offene Punkt 1 erwartet. Keine
  Umgehung bauen und keine Browsereinstellung ändern.
- **Das Anmelde-Fenster meldet „Übergabe abgelehnt":** der Übergabecode war abgelaufen oder schon
  verbraucht (er lebt 120 Sekunden und gilt genau einmal). Erneut anmelden. Das sagt NICHT, dass
  die Anmeldung selbst fehlgeschlagen ist.
- **Das Anmelde-Fenster sagt, die Übergabe sei in diesem Fenster nicht möglich:** dann hat Word
  dort keine Dialog-Schnittstelle bereitgestellt — die Anmeldung selbst hat geklappt, die Übergabe
  nicht. Fenster schließen; zeigt Klara weiterhin „nicht angemeldet", dort erneut auf **Anmelden**
  drücken. Bleibt es dabei, bitte melden, was genau dort stand. Dieser Satz ersetzt seit JOB 4076
  eine ältere Zusage („Klara erkennt die Anmeldung von selbst"), die im Rahmen fremder Herkunft
  nicht stimmte und die niemand dort gemessen hatte.
- **Klara meldet einen Fehler:** Die Meldung gilt. Klara täuscht keinen Erfolg vor; ein nicht
  angelegter Entwurf wird als nicht angelegt gemeldet.
