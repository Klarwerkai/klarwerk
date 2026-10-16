# Klara im Browser · Berechtigte Funktionen ausführen (BPA-03)

Auftrag `produkt:20261011:assistenz-browser-aktionen`, Revision 1 (BPA-Gesamtpaket r2). Stand:
16.10.2026, Basis `ef7766dc3` (`1.0.0-beta.1.989`). Frühe Vorbereitung laut
`QUELLEN-FRUEHE-VORBEREITUNG.json`; die Elternlieferung BPA-01
(`aufnahme:20260922:gesamt-browser-kontextkarten`, `extensions/klara-browser/kontext.js`) ist in
diesem Stand **nicht** integriert. Dieses Dokument beschreibt Code und Prüfungen, keine Host- oder
Lieferabnahme.

## Was es gibt

| Teil | Ort | Aufgabe |
| --- | --- | --- |
| Vertrag und Ausführung | `services/app/src/klara-browser-aktion.ts` | Capability-Register, Seitenprofile, Auftrag, Prüfung vor jedem Schritt, Nachlesen, Bestätigung, Rücknahme, Übergabe |
| Seitenausführer | `extensions/klara-browser/aktion.js` | liest Formularaufbau, trägt über Beschriftungen ein, klickt benannte Knöpfe — nur auf Aufruf, ohne Netz und ohne Sitzung |
| Prüfstand | `tests/klara-browser-aktionen/` | synthetische Seite, Vertragstests, Chromium-Lauf |

### Register (AC03)

Fünf getrennte Handlungsarten mit festem Vertrag:

| Art | Folge | Rücknahme | Bestätigung |
| --- | --- | --- | --- |
| `lesen` | keine | – | keine zusätzliche |
| `entwurf_fuellen` | ungespeicherte Eingabe | vorherige Feldwerte | keine zusätzliche |
| `entwurf_speichern` | eigener Entwurf | Entwurf löschen | keine zusätzliche |
| `entwurf_loeschen` | eigener Entwurf (nur Rücknahme) | – | keine zusätzliche |
| `ausloesen` | Außenwirkung | keine | Außenaktionsbestätigung |

Ein Seitenprofil nennt je Website/Pfad/Formular, welche Arten dort tatsächlich unterstützt sind,
mit Knopfnamen. Ein Knopf ist genau eine Handlung. Ohne Profil: „nicht unterstützt" mit manuellem
Schritt.

### Ablauf

1. Auftrag nur aus Eingabe der Person (`getippt`/`gesprochen`), gebunden an Mandant, Nutzer,
   Sitzung, Host, Tab, Herkunft, Pfad, Formular und Werte; danach eingefroren. Entwurfsaufträge
   enthalten kein Auslösen.
2. Vor jedem Schritt: Pause/Abbruch, aktuelle Rechte (fail-closed), Tab/Seite, CAPTCHA/MFA/Anmeldung,
   Formularaufbau. Geänderter Aufbau wird nur neu gebunden, wenn jede beauftragte Beschriftung
   genau einmal vorkommt; sonst Klärung.
3. Speichern gilt erst nach Nachlesen in der Entwurfsliste. Unklarer Ausgang wird vor Wiederholung
   abgeglichen. Ist der Entwurf (noch) nicht sichtbar, bleibt der Schritt unklar — erneut
   gespeichert wird nur, wenn die Übertragung belastbar meldet, dass nichts ausgeführt wurde
   (`nicht_ausgefuehrt`). Unklares Auslösen wird nie wiederholt (Übergabe „prüfen").
4. Auslösen nur mit Bestätigung, die an Auftrag, Nutzer, Knopf, Formularaufbau und Werte gebunden
   ist und genau einmal gilt. Unmittelbar davor werden die tatsächlichen Feldwerte der Seite mit den
   bestätigten Werten verglichen — am Server und noch einmal im Seitenausführer direkt vor dem
   Klick (`werte`). Bei Abweichung: Klärung, kein Klick.
5. Rücknahme löscht genau den nachgelesenen eigenen Entwurf (Kennung) bzw. setzt ungespeicherte
   Felder zurück und liest nach. Vor JEDER Feldrücksetzung: aktuelle Rechte, Tab und
   Seitenadresse, Formularaufbau und der eigene Feldwert (auch im Seitenausführer, `erwartet`). Bei
   Zielwechsel, Rechteentzug oder fremder Änderung hält sie an und nennt, wie viele Felder
   zurückgesetzt sind. Ausgelöstes wird als nicht rücknehmbar benannt.

## Offen (nicht durch diese Lieferung belegt)

- Anbindung im Worker (`chrome.scripting.executeScript` in die isolierte Welt, Host-Rechte je
  freigegebener Seite) und Verbindung mit BPA-01-Kontext — wartet auf die reguläre Integration der
  Elternlieferung.
- Bestätigungs- und Statusoberfläche in der Leiste/im Begleiter; HTTP-Weg in den vorhandenen
  Auftragsverlauf.
- Reale Chrome-Hostprobe mit genauer Version (O01), echte Website-Profile, echte Spracheingabe.
- Szenario BPA-S06 (Lernen/Routine) gehört zu BPA-06.
