# Klara im Browser · Berechtigte Funktionen ausführen (BPA-03)

Auftrag `produkt:20261011:assistenz-browser-aktionen`, Revision 1 (BPA-Gesamtpaket r2). Stand:
17.10.2026 (Produktanschluss, Chat 62). Basis: Hauptstand `dcd5a0413` (`1.0.0-beta.1.990`) mit der
**noch nicht gelieferten** Elternvorleistung BPA-01 (`aufnahme:20260922:gesamt-browser-kontextkarten`,
Kandidat `207bc6488`, integriert für diesen Stand). Dieses Dokument beschreibt Code und Prüfungen,
keine Host- oder Lieferabnahme.

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
Schritt. Wählt eine Seite ihren Datensatz über die Adresse (`?id=…`, Ankerroute), nennt das Profil
diese Teile in `adressbindung`; nur sie binden das Ziel zusätzlich zu Herkunft und Pfad. Fehlt die
Angabe, binden nur Herkunft und Pfad (wie im Kern) — wer ein Profil für eine solche Seite schreibt,
muss sie setzen.

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

## Der Produktweg

```
Leiste (panel.html/panel.js, Abschnitt „Auf dieser Seite ausführen")
  │  Auftrag getippt oder gesprochen (Spracherkennung des Browsers), Vorgangsschlüssel je Klick
  ▼
Worker (worker.js, KW-AKTION)  ── prüft vor JEDEM Befehl die Seitenfreigabe aus BPA-01
  │  POST /api/me/klara/browser-auftraege            (kontext.js `zugang`, Widerrufsepoche,
  │  POST …/:id/takt  (Antwort melden, nächsten Befehl holen)   Anmeldung, Tab noch da)
  │  POST …/:id/steuerung (Pause, Fortsetzen, Abbruch, Bestätigen, Rücknahme, Widerruf)
  ▼
Aktionskern am Server (klara-browser-aktion-dienst.ts)
  │  Erkennung gegen das Seitenprofil (klara-browser-auftrag-erkennung.ts, feste Satzformen, ohne KI)
  │  BrowserAusfuehrung (Vertrag, unverändert in seinen Regeln) mit
  │    · Rechten je Schritt: AuthService.authenticate(Sitzung) + Rolle (ko.read lesen, ko.create wirken)
  │    · Seitenadapter = BrowserBefehlsrelais (klara-browser-relais.ts)
  │    · Außenaktionsbestätigung: Nutzer aus der Anmeldung, an Auftrag/Knopf/Aufbau/Werte gebunden
  │  Verlauf: KlaraGespraech.browserAuftraege im eigenen Klara-Gespräch (Standvergleich, JSONB)
  ▼
aktion.js in Chromes isolierter Welt der freigegebenen Seite (chrome.scripting, activeTab)
```

- **Kein zweiter Kanal.** Die Erweiterung erreicht den Server über denselben HTTPS-Weg mit derselben
  Anmeldung wie Entwürfe, technische Daten (BPA-02) und die Klara-Sitzung der Kontextkarte (BPA-01).
  Der Server stellt keine Befehle zu; die Erweiterung holt sie ab (`takt`, streng steigende Folge).
- **Zwei Fristen** tragen den Vertrag: nicht abgeholt = belastbar nicht ausgeführt
  (`nicht_ausgefuehrt`); abgeholt ohne Antwort = Ausgang offen (`zeitueberschreitung`, Abgleich vor
  jeder Wiederholung, Auslösen nie wiederholt). Jede Befehlsnummer führt der Worker höchstens
  einmal aus; kommt dieselbe Nummer erneut, geht die gemerkte Antwort hinaus.
- **Lesefehler vor einem Schritt** heisst „nichts ausgeführt": der Schritt bleibt offen (keine
  dauerhafte Sperre eines Speicherns, das nie geklickt wurde). Ist dabei das Recht weg, endet der
  Lauf als „Recht entzogen".
- **Widerruf** der Seitenfreigabe in der Leiste (BPA-01, „Verbindung widerrufen") beendet einen
  laufenden Auftrag sofort beim Kern; ein gerade laufender Schritt meldet noch sein Ergebnis.
- **Seitenprofile** kommen über `buildApp(…, { browserAktion: { seitenprofile } })`. Ohne Angabe
  gibt es keines: jede Seite endet in der Übergabe „nicht unterstützt". Profile für echte Websites
  sind eine eigene Entscheidung (O01).
- **Nach einem Serverneustart** zeigt der Verlauf einen nicht beendeten Lauf als „unterbrochen" —
  nie als Erfolg; was auf der Seite geschah, prüft die Person dort.
- **Erkennung: nicht raten, nichts verschlucken.** Ausserhalb der Werte darf nur Auftragswortschatz
  stehen (Füllen, Speichern, Formular-, Feld- und Knopfnamen). Ein anderes Wort, eine Verneinung
  oder Aufschiebung („nicht", „erst morgen") ergibt eine Klärung; ein nicht freigegebenes Außenwort
  (senden, übermitteln, bestellen …) eine Übergabe des ganzen Auftrags. Eine Beschriftung direkt nach
  einem Artikel/einer Präposition („auf Ihre Nachricht", „an Empfänger") beginnt nur dann ein Feld,
  wenn es eindeutig ist (Doppelpunkt/Anführungszeichen dahinter oder erste Beschriftung nach reinen
  Auftragswörtern); mitten in einem ungeklammerten Wert wird geklärt. „ist"/„lautet" leiten einen
  Wert ein. Ein Klick ohne genannten Knopf („klicke auf den Knopf") und ein offenes „aus"/„ein" am
  Wertende werden geklärt.
- **Speichern** gleicht unmittelbar vorher die Feldwerte ab (Server und `aktion.js`); weicht ein Feld
  ab, wird nicht gespeichert. Der Stand sagt ehrlich „Speichern ausgelöst, noch nicht nachgelesen"
  bzw. „möglicherweise gespeichert", nie „nichts gespeichert" nach einem Klick.
- **Rücknahme** ohne Antwort der Seite ist „unklar" (kein neues Angebot); eine Seite ohne Löschen
  heisst „kein Löschen", nicht Außenwirkung.
- **Worker:** Unmittelbar vor jeder Handlung prüft die Seite selbst (im eingesetzten Aufruf, ohne
  Lücke), ob ihre Adresse noch das freigegebene Ziel ist — Herkunft, Pfad und die Teile aus
  `adressbindung`. Ändert die Seite anderes selbst (`?entwurf=…`, `#gespeichert`), läuft der Auftrag
  weiter. Eine begonnene Befehlsnummer wird nie erneut ausgeführt; einen Befehl, den der Kern als
  schon abgeholt kennzeichnet (`wiederholt`), führt der Worker ohne gemerkte Antwort nie aus — der
  Ausgang ist offen und wird an der Seite abgeglichen. Ein erneuter Klick auf „Ausführen" mit
  demselben Vorgang behält, was der Worker in diesem Lauf schon ausgeführt hat.
- **Derselbe Vorgang** ist derselbe Auftrag nur für dasselbe Ziel (Tab, Herkunft, Pfad). Nach einer
  Übergabe (nichts geschah) und für ein anderes Ziel wird neu geprüft — „beauftrage Klara danach
  erneut" wirkt ohne den Text zu ändern.
- **Verlauf in der Web-App:** `KlaraBrowserAuftraege` zeigt die Browseraufträge des Gesprächs
  lesend im Klara-Verlauf (neben den KI-Aufträgen von BPA-13). Gelöschte Gespräche werden nicht neu
  angelegt; derselbe Vorgangsschlüssel ist auch nach einem Neustart derselbe Auftrag.

## Geprüft (Chat 62, 17.10.2026)

| Prüfung | Datei | Was echt ist |
| --- | --- | --- |
| Produktweg AC01–AC10, 25 Fälle | `tests/klara-browser-aktionen/produktweg-chromium.test.ts` | ausgelieferte Erweiterung (byte-gleich geladen), Klickgeste über Chromes Symbolaktion, Anmeldung in der Leiste, Worker, `chrome.scripting`, `aktion.js` in der isolierten Welt, `buildApp` mit Rechten und Gespräch, synthetische Seite |
| Türen, Rechte, Fremdzugriff, Folge, Bestätigung, Rücknahme, Ausfall | `tests/klara-browser-aktionen/produktweg-routen.test.ts` | `buildApp`, `app.inject`, Seitenmodell nach `aktion.js` |
| Erkennung und Befehlsweg | `tests/klara-browser-aktionen/erkennung-relais.test.ts` | rein |
| Gegenproben der unabhängigen Prüfung (zwei Runden) | `erkennung-befunde.test.ts`, `produktweg-routen.test.ts` (M6–m7, N2, N3), `produktweg-chromium.test.ts` (N2, N3, N4) | rein, `buildApp` bzw. Chromium |
| Einordnung für die Prüftorregister: Datenfluss ohne Wissensobjekt-Inhalt (Q1), frische `ko.create`-Prüfung vor jeder Wirkung (Q2, Q3) | `produktweg-routen.test.ts` | `buildApp`, echter Rollenwechsel über `PUT /api/users/:id` |
| Verlauf in der Web-App | `tests/klara-browser-aktionen/verlauf-im-web.test.tsx` | `buildApp`, Klara-Fläche gemountet, eigener Abrufweg der Web-App |

Gestellt sind ausdrücklich: Chromium 149 headless statt Google Chrome auf dem Mac, die Geste aus dem
DevTools-Protokoll, die Leiste als Tab statt im Seitenfenster und die Spracherkennung selbst
(Chromium hat ohne Google-Dienst keine; ab ihrem Ergebnis läuft der Produktweg).

## Offen (nicht durch diese Lieferung belegt)

- **Elternlieferung BPA-01** ist nicht geliefert (Ben: offen nur für AC10, reale Chrome-/Begleiter-
  Hostprobe). Dieser Stand integriert ihren Kandidaten `207bc6488`; seine Lieferung bleibt eigener Weg.
- Reale Chrome-Hostprobe auf diesem Mac mit genauer Version (O01), echtem Seitenfenster, echter
  Geste und echter Spracherkennung (Mikrofonrecht der Erweiterung im Seitenfenster).
- Echte Website-Profile; reale Außenwirkung.
- Szenario BPA-S06 (Lernen/Routine) gehört zu BPA-06.
- Die Texte des Kerns (Stand, Klärung, Übergabe) sind deutsch; die Leiste übersetzt nur ihre eigenen.
