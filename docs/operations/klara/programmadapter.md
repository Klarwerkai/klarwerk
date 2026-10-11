# Klara in anderen Programmen — gemeinsame Adapter (BPA-04)

> Auftrag `produkt:20261011:assistenz-programmadapter` (BPA-Gesamtpaket r2). Kern:
> `services/app/src/programmadapter.ts`, Serverwege `services/app/src/routes/programmadapter-routes.ts`,
> Word-Seitenfenster `apps/web/public/word-addin/taskpane.js` (Zielprüfung vor dem Einfügen),
> Mac-Begleiter `apps/desktop/klara-begleiter`, Anzeige `apps/web/src/components/assistenz/ProgrammeUebersicht.tsx`
> (Einstellungen → Persönliche Einstellungen → Meine Assistenz). Prüfstände:
> `tests/programmadapter/programmadapter.test.ts`, `tests/programmadapter/hostwege.test.ts`,
> `tests/programmadapter/word-einfuegen-zielpruefung.test.tsx`.

## 1 · Was Klara in welchem Programm kann (Stand dieses Kandidaten)

Die Tabelle ist die menschenlesbare Fassung von `PROGRAMM_REGISTER`. Dieselbe Übersicht zeigt
„Meine Assistenz → In anderen Programmen“. **Real belegt ist derzeit nichts**: `HOSTBELEGE` ist leer,
weil kein realer Lauf mit diesem Kandidaten festgehalten ist. Programme, die hier nicht stehen,
werden nicht unterstützt. Es gibt kein Versprechen für „alle Programme“.

| Programm | Fassung | Weg | Lesen | Auswahl | Schreiben | Ergebnisprüfung | Rücknahme |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Word für Mac | macOS 13 (Ventura) oder neuer (Bauziel; real geprüfte Fassung offen); Word für Mac 16.111 (nur Sideload belegt, 24.07.2026); WordApi 1.1 | Office-Add-in (Office.js); Bedienungshilfe nur zum Lesen der Markierung über den Begleiter | gebaut, ohne Hostbeleg | gebaut, ohne Hostbeleg | gebaut, ohne Hostbeleg — nur auf Klick, nach Zielprüfung | gebaut, ohne Hostbeleg | nicht geliefert (nur Word selbst: Widerrufen) |
| Word im Browser | WordApi 1.1 | Office-Add-in (Office.js) | gebaut, ohne Hostbeleg | gebaut, ohne Hostbeleg | gebaut, ohne Hostbeleg | gebaut, ohne Hostbeleg | nicht geliefert |
| Finder (gewählte Datei) | macOS 13 (Ventura) oder neuer (Bauziel; real geprüfte Fassung offen) | Mac-Begleiter → vorhandene Objektablage | gebaut, ohne Hostbeleg | gebaut, ohne Hostbeleg | ausgeschlossen | gebaut, ohne Hostbeleg | ausgeschlossen |
| Excel | — | — | nicht geliefert | nicht geliefert | nicht geliefert | nicht geliefert | nicht geliefert |
| Outlook | — | — | nicht geliefert | nicht geliefert | nicht geliefert | nicht geliefert | nicht geliefert |
| PowerPoint | — | — | nicht geliefert | nicht geliefert | nicht geliefert | nicht geliefert | nicht geliefert |

„Real belegt“ setzt die Übersicht nur aus einem vollständigen Hostbeleg für **genau dieses**
Programm: Programm, Host- und OS-Fassung, Kandidat, Zeitpunkt und Protokoll. Ein Word-Beleg hebt weder
Word im Browser noch Excel, Outlook oder PowerPoint, und ein Beleg hebt nie einen nicht gebauten
Weg. Excel, Outlook und PowerPoint lassen sich am Server gar nicht verbinden (400).

## 2 · Gemeinsame Dienste — keine zweite Anmeldung oder Ablage je Programm

| Teil | Woher |
| --- | --- |
| Anmeldung | Bestehende KLARWERK-Sitzung. Das Word-Add-in nutzt seine vorhandene Anmeldung; der Mac-Begleiter löst einen Übergabecode derselben Sitzung ein (`/api/auth/office-handover`). |
| Name und Avatar | Eigenes Assistenzprofil (`/api/me/assistenz`) |
| Quellenprüfung | Bestehender Frage-/Belegweg mit Fundstellen und Rechteprüfung |
| Dateiablage | Vorhandene Objektablage (`ObjectStore`, wie `POST /api/objects`, Recht `ko.create`) |
| Persönlicher Speicher | Gedächtnis und Klara-Gespräche (`/api/me/klara/…`) |
| Aktionen | Bestehender Klara-Sitzungs- und Ausführungsweg (`/api/klara/sessions/…`) |

## 3 · Die Regeln — und wo sie im echten Weg greifen

| Regel (Kern) | Angebunden an | Wirkung |
| --- | --- | --- |
| `pruefeZielVorWirkung` | Word-Seitenfenster: vor jedem Einfügen (Antwort, KA6-Vorschlag, Memo) über `POST /api/klara/programme/wirkung`. Begleiter: bei Finder-Aufnahme und Lesen über die gesiegelte Bindung. | Wechsel von Sitzung oder Konto, ein anderes Dokument oder Fenster, eine andere Markierung oder Fassung: keine Wirkung, verständlicher Satz. Scheitert die Prüfung selbst, wird ebenfalls nicht eingefügt. |
| `BindungsSiegel` | `POST /api/klara/programme/verbinden` | Mandant und Nutzer setzt der Server aus der Sitzung. Eine Bindung eines anderen Kontos oder eine Fälschung trägt nichts. Nach einem Serverneustart: neu verbinden. |
| `uebermittelbarerKontext` | `POST /api/klara/programme/bedienungshilfe` | Mitgeschickter Kontext kommt nur mit gültigem Siegel **und** passender aktueller Bindung zurück. Nach einem Konto-, Mac-Konto-, Programm- oder Dokumentwechsel geht nichts davon erneut hinaus. |
| `nimmGewaehlteDateiAuf` + `adapterZustand` | `POST /api/klara/programme/finder` | Genau eine Datei; ohne Dateizugriff Stopp vor jedem Lesen. Die Prüfsumme rechnet der Server nach; eine andere Datei-Kennung oder Fassung wird nicht abgelegt. |
| `bewerteBedienungshilfeLesen` | `POST /api/klara/programme/bedienungshilfe` | Ohne Bedienungshilfe-Freigabe: Stopp, `ersatzweg: null`. Ohne eingetragenen Lesezweck: Stopp. Bei mehreren oder keinen Fenstern bzw. Elementen oder leerer Markierung: Klärung. |
| `bewerteZiel` | (Aktionen über die Bedienungshilfe) | Eine Koordinate ist nie ein Ziel. Eine Aktion braucht einen **real getesteten** `bedienungshilfeRueckfall`; es ist keiner eingetragen, also gibt es keine Bedienung über die Bedienungshilfe. OCR führt immer zur Klärung. |

Der Word-Weg bindet jedes Ergebnis beim Fragen an fünf Merkmale:

- die Klara-Sitzung, damit auch an das KLARWERK-Konto,
- die serverseitige `documentContextId`,
- die **Stelle**: die Absatzfolge der Auswahl im Dokument, die genau einmal vorkommen muss, dazu
  der Zeichenversatz des Auswahlanfangs im ersten Absatz (WordApi 1.3). Damit unterscheiden sich
  auch gleicher Text und leere Cursorpositionen innerhalb desselben Absatzes. Ohne WordApi 1.3 ist
  die Stelle nicht bestimmbar; dann wird verständlich gestoppt,
- eine Prüfsumme der Markierung,
- die **Dokumentfassung** als Prüfsumme des ganzen Texts.

Frageinhalt (Markierung), Stelle und Fassung stammen aus **einem** `Word.run`-Lauf; das gilt für
die Frage und für den KA6-Zuruf. Einen zweiten, späteren Abruf, der eine andere Stelle mit gleichem
Text erfassen könnte, gibt es nicht. Ohne diesen Lauf (Rückfall auf `getSelectedDataAsync`, Host
ohne die nötigen Objekte) ist das Ziel nicht bestimmbar, und Einfügen wird verständlich gesperrt.
Vor dem Einfügen entscheidet der Server.

Mit „Text in Word mitlesen“ aus liest das Fenster keinen Dokumentinhalt, auch nicht für die
Zielbindung (G09). Ohne Inhaltszugriff ist keine sichere Bindung möglich. Gebundenes Einfügen wird
deshalb vor jedem Lesezugriff mit einem eigenen Satz gesperrt; Kopieren bleibt möglich. Das gilt
auch, wenn Mitlesen erst nach der Frage ausgeschaltet wird. Geschrieben wird danach in **einem** `Word.run`: Die Lage
wird erneut gelesen und mit der geprüften verglichen, erst dann geht der Text in genau diesen
Bereich. Nicht eingefügt wird in diesen Fällen:

- gleicher Text an anderer Stelle,
- ein inzwischen geänderter Dokumenttext,
- eine Auswahl, die nach der Prüfung woandershin springt,
- eine Stelle, die nicht eindeutig feststellbar ist (gleicher Absatz mehrfach, kein `Word.run`).

Jeder dieser Fälle bekommt einen verständlichen Satz.

Grenzen:

- Office.js nennt kein angemeldetes Microsoft-Konto.
- Die Fassung ist eine Prüfsumme des Texts, keine Versionsnummer. Änderungen nur an der
  Formatierung erkennt sie nicht.
- Ohne Klara-Sitzung beim Fragen (Rückfall auf den allgemeinen Frageweg) gibt es keine
  Dokumentbindung; dort bleibt der bisherige Einfügeweg.

Der Mac-Begleiter prüft zusätzlich **vor jedem Inhaltszugriff**, ob das Programm einen
freigegebenen Lesezweck hat. Gibt es keinen, liest er nichts und sendet nichts. Nur zum Ziel
passender Kontext verlässt den Mac überhaupt; der Server filtert zusätzlich. Kommt ein anderes Programm nach vorn, verwirft der Begleiter Markierung, Antwort und Lesestand
sofort. „Klara dazu fragen“ prüft vor dem Senden, ob das aktuelle Programm das der Bindung ist,
und prüft die Bindung am Server (`/wirkung`). Ein Wechsel während dieser Prüfung verhindert das
Senden. Neu Verbinden oder Trennen verwirft
Markierung, Antwort und Kontext sofort. Ergebnisse, die erst nach einem Wechsel eintreffen,
verwirft er.

Die Herkunft einer Finder-Aufnahme bleibt dauerhaft am Objekt: Sie steht im verketteten
Prüfprotokoll (Ziel `object:<id>`) mit ursprünglicher Datei-Kennung, Quellfassung (SHA-256, Größe,
Änderungszeit), Aufnahmezeit und Aufnahmebindung. Lesen kann sie nur der Eigentümer über
`GET /api/klara/programme/finder/:objektId`. Dateiname, Pfad und Inhalt stehen nie im Protokoll.

## 4 · Der begrenzte Bedienungshilfe-Weg (dokumentierter Rückfall)

| Feld | Wert |
| --- | --- |
| Host | Word für Mac (`com.microsoft.Word`) |
| Zweck | `markierung-lesen`: `AXSelectedText` des fokussierten Elements im vordersten Hauptfenster |
| Nicht erlaubt | Klick, Eingabe, Koordinate, Bildschirmbild, OCR, andere Programme |
| Rechte | Bedienungshilfe-Freigabe des Begleiters **und** KLARWERK-Sitzung |
| Stand | gebaut, **nicht** real getestet. Die real getestete Word-/macOS-Fassung trägt erst ein ausgefülltes Protokoll S8–S10 ein. |

## 5 · Realer Lauf BPA-S04 auf diesem Mac (offen)

Nur synthetische Testobjekte, keine Geheimnisse, keine realen Personendaten. Bildbelege vor der
Ablage schwärzen. Der Lauf ergänzt die bestehende Word-Mac-Hostabnahme
(`docs/operations/word-mac-hostabnahme/README.md`, M1–M10, MS1–MS4) und ersetzt sie nicht.

| Feld | Eintrag |
| --- | --- |
| Datum / Uhrzeit mit Zeitzone | |
| Kandidat (Produktfassung im Seitenfenster) | |
| Word-Version (Word → Über Word) | |
| macOS-Version | |
| KLARWERK-Rolle (keine Adresse) | |
| Testdokumente | `bpa04-dokument-a.docx`, `bpa04-dokument-b.docx` (synthetisch) |
| Finder-Testordner | eine gewählte Datei, zwei Nachbardateien (synthetisch) |

| # | Schritt | Soll | Ergebnis |
| --- | --- | --- | --- |
| S1 | Dokument A öffnen, Absatz markieren, Klara fragen | Antwort; `documentContextId` notiert | |
| S2 | „In Word einfügen“ | Änderung steht in Dokument A an der Markierung | |
| S3 | Nach der Frage eine andere Stelle in A markieren, „In Word einfügen“ | Nichts eingefügt; Satz „Nicht eingefügt: Seit der Frage hat sich das Ziel geändert …“ | |
| S3b | Dokument B mit einem Absatz desselben Wortlauts öffnen, dort markieren, im Klara-Fenster von A „In Word einfügen“; danach in A denselben Text an anderer Stelle markieren und einfügen | Weder B noch die andere Stelle in A geändert | |
| S4 | Dokument A speichern, schließen, öffnen; Dokument B prüfen | Änderung aus S2 vorhanden; B unverändert | |
| S5 | Begleiter: Code aus „Meine Assistenz“ einlösen, genau eine Datei im Finder wählen | Herkunft mit SHA-256; Objekt in der Ablage; Nachbardateien nicht gelesen | |
| S6 | Leserecht der Datei entziehen (Informationen → Freigabe & Zugriffsrechte), S5 wiederholen | Gestoppt mit „… ein Bildschirmbild ersetzt die Datei nicht“; nichts abgelegt | |
| S7 | „Meine Assistenz → In anderen Programmen“ | Excel, Outlook und PowerPoint „Nicht geliefert“; Word und Finder „Gebaut – noch nicht real geprüft“ | |
| S8 | Begleiter: Absatz in Word markieren, „Markierung lesen“ | Markierung angezeigt | |
| S9 | Zwei Word-Fenster mit Markierung bzw. keine Markierung, „Markierung lesen“ | Klärung, keine Übernahme | |
| S10 | Bedienungshilfe für den Begleiter in den Systemeinstellungen entziehen, S8 wiederholen | Gestoppt mit nächstem Schritt; kein Bildschirmbild; Word-Add-in weiter nutzbar | |

Erst mit ausgefülltem Protokoll darf ein Eintrag in `HOSTBELEGE` entstehen, und zwar je Programm
getrennt. Installation, zentrale Veröffentlichung und Gesamtabnahme sind davon getrennte Nachweise.
