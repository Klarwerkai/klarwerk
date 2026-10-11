# Branchen-PoC: drei Arbeitswege der fiktiven Musterorganisation

Auftrag `produkt:20261010:branchen-poc-arbeitswege`. Kurze Durchführungshilfe für eine
reproduzierbare Abnahme auf dem **vorhandenen** Produkt. Neu sind nur Ausgangsdaten, diese Hilfe und
ein automatisierter Durchlauf. Die fachlichen Funktionen gehören ihren eigenen Aufträgen (siehe
„Zuordnung“) und werden hier nicht als neu geliefert ausgegeben.

> **Fiktion.** „Musterwerk Nordtal GmbH (fiktiv)“ ist frei erfunden. Alle Einträge, Personen und
> Anlagen sind Testdaten; es werden keine echten Kunden-, Personal- oder vertraulichen
> Organisationsdaten übernommen.

## Einstieg und Voraussetzungen

| Punkt | Stand |
| --- | --- |
| Einstieg (PoC-URL) | Die angemeldete Produktinstanz der ausgelieferten Revision, Startseite `/start`. Die konkrete Adresse und Revision nennt der Lieferbeleg; diese Datei nennt sie bewusst nicht im Voraus. |
| Zugang | Vorhandenes, angemeldetes Konto mit Verwaltungsrecht (`users.manage`). Es wird **keine** öffentliche Demo und kein Gastzugang freigeschaltet. |
| Ladeweg | `/admin` → Daten → „Demodaten laden“ (`POST /api/admin/demo-seed`). Der Weg existiert nur mit gesetztem Betriebsschalter `KLARWERK_DEMO_SEED`; ohne ihn gibt es keinen PoC-Bestand. |
| Sprache | Die Demodaten entstehen in der UI-Sprache der ladenden Person (DE/EN/NL). Diese Hilfe zitiert die deutschen Texte. |
| Zugangsdaten | Die Antwort des Ladens enthält **einmalig** die Kennwörter der neu angelegten Demokonten. Sie stehen nirgends sonst. |

## Ausgangsbestand

Alle Einträge entstehen über die echten Dienste mit demselben Herkunftsmerker wie der übrige
Demo-Bestand (`demoSeed`, Schlagwort `pilot-demo`) und zusätzlich `poc-musterwerk`, Kategorie
„Musterwerk Nordtal (fiktiv)“. Texte: `services/app/src/demo-content.ts` (`poc`), Anlage:
`services/app/src/seed-demo.ts` (`buildPocArbeitswege`).

| Geschichte | Ausgangsdaten | Zustand nach dem Laden |
| --- | --- | --- |
| 1 · Quellenantwort | „Kühlschmierstoff der Fräse M12 alle sechs Wochen erneuern“ mit Quelle „Betriebsanweisung Fräse M12, Abschnitt 3 (fiktiv)“ (Bezeichnung + wörtlicher Auszug, **keine** Adresse) | validiert (2 Bewertungen) |
| 2 · Lückenabschluss | vorhandene Demo-Lücke „Warum schwankt der Dosierwert an Linie L4 nach jedem Schichtwechsel?“, gestellt von der ladenden Person | offen, ohne Zuständigkeit, Priorität hoch |
| 3 · Quellenänderung | an Anlage `AF-2`: „Füllventile … auf Tropfdichtheit prüfen“ und „Etikettierer bei neuem Flaschenformat justieren“, je mit Quelle „Betriebsanleitung Abfüllanlage AF-2, Fassung 1 (fiktiv)“; an Anlage `KOMP-K1`: „Druckluftkompressor K1: Kondensat täglich ablassen“ | alle drei validiert, **keine** offene Folgeprüfung |

Die Wortwahl der PoC-Texte teilt kein Suchwort mit der Lückenfrage (je Sprache geprüft). Sonst
entstünde keine Lücke, oder die Wiederholungsfrage würde von der Suche statt vom Abschluss beantwortet.

## Rollen

| Rolle in der Geschichte | Konto | Produktrolle |
| --- | --- | --- |
| Verwaltung: stellt beim Laden die Lückenfrage, Übernahme des Änderungsvorschlags, Fachprüfung | ladende Person | admin |
| Fragende Fachkraft (Geschichte 2) | ein Experte-Konto, z. B. „Frida Fertigung“ (von der Verwaltung regulär angelegt) | experte |
| Fragende (Geschichte 1), Fachprüfung, meldet die Änderung (Geschichte 3) | Carla Controller `carla@demo.klarwerk` | controller |
| Fachzuständigkeit (Geschichte 2), Anpassung als Vorschlag (Geschichte 3) | Erik Experte `erik@demo.klarwerk` | experte |
| Folgeprüfung im Reiter „Erneut“ (Geschichte 3) | ein zweites Controllerkonto, z. B. „Theo Teamleitung“ (von der Verwaltung regulär angelegt) | controller |

Die Seite `/lebenszyklus` mit dem Reiter „Erneut“ steht erst ab der Rolle Controller zur Verfügung;
Erik (Experte) bestätigt dort deshalb nichts. Die Folgeprüfung übernimmt eine zweite Controllerrolle,
damit die anschließende Fachprüfung bei zwei **anderen** Personen bleibt.

## Ablauf je Geschichte

Für jede Geschichte sind Ergebnis, zulässige Rollen, Startdaten und Abschluss **vor** der Abnahme
festgelegt.

### Geschichte 1 · Typische Frage mit Quellenantwort

- **Start:** Bestand wie oben. **Rolle:** Carla (jede Rolle mit Leserecht ist zulässig).
- **Schritte:** `/fragen` oder die persönliche Assistenz → „Wie oft muss der Kühlschmierstoff an der
  Fräse M12 erneuert werden?“ → Quelle in der Antwort öffnen (führt nach `/wissen/<id>?…fassung=…`) →
  auf der Quelle die Assistenz öffnen (Seitenkontext: Seite, Eintrag, Fassung, Prüfstatus) → einen
  Satz markieren → „… fragen“ (Markierung mit Herkunft und Fassung). Ohne aktives Modell ist das
  Absenden auf `/fragen` gesperrt; die Assistenz fragt über denselben Frageweg „Ohne KI“.
- **Ergebnis:** Antwort aus dem validierten Eintrag; Quelle mit Fassung und Prüfstatus „geprüft“;
  Prüfstand „belegt“; beim Demo-Ladeweg zeigt die Quelle zusätzlich Bezeichnung und Auszug.
- **Gegenprobe:** Die Lückenfrage aus Geschichte 2 bekommt **keine** Quelle und keine erfundene
  Referenz, sondern führt zur Wissenslücke.
- **Abschluss:** Quelle geöffnet, Fassung und Prüfstand abgelesen.

### Geschichte 2 · Fehlendes Wissen bis zur Rückmeldung

- **Start:** offene Demo-Lücke. **Rollen:** Fragende = Fachkraft (Experte); Fachzuständigkeit = Erik;
  Fachprüfung = Carla und die ladende Person (zwei Bewertungen). Verwaltung und Controller tragen
  das Zuordnungsrecht (`ko.assign`) und sind am Vorgang „verwaltend“: ihr nächster Schritt heißt
  „Eine Fachzuständigkeit zuordnen“, die Übergabe-Auswahl auf der Vorgangsseite erscheint nur für
  rein Fragende. Deshalb fragt in der Oberfläche eine Fachkraft.
- **Schritte:**
  1. Fragende: dieselbe Frage in der Assistenz stellen (dieselbe offene Lücke) → Lücke öffnen
     (`/luecke/<id>`) → an „Erik Experte“ übergeben.
  2. Erik: Rückfrage „Schwankt der Dosierwert an Linie L4 bei allen Rezepturen oder nur bei einer?“.
  3. Fragende: Glocke → Rückfrage → Antwort „Bei allen Rezepturen, jeweils in der ersten halben
     Stunde nach dem Schichtwechsel.“
  4. Erik: über „Erfassen“ (`/capture/frontdoor`) den Eintrag einreichen „Linie L4: Dosierwaage bei jedem Schichtwechsel neu tarieren“ (Aussage aus
     `poc.lueckenAntwort`: die nicht neu tarierte Dosierwaage derselben Linie ist die Ursache) und in
     der Lücke als Antwortentwurf verknüpfen. „Abschließen“ bleibt gesperrt.
  5. Die vorgeschriebene Zahl Prüfender (Standard 3: Carla, Verwaltung, zweite Controllerrolle)
     gibt den Eintrag in `/validierung` mit „Freigeben“ frei.
  6. Erik: „Abschließen“ → „Fachlich gelöst“.
- **Ergebnis:** genau eine Erfolgsmeldung an die Fragende mit dem nutzbaren Eintrag; dieselbe Frage
  erneut zeigt den abgeschlossenen Stand statt einer neuen Lücke — als direkte Antwort mit genau
  diesem Eintrag als Quelle (er passt sachlich) oder über den Verweis auf die gelöste Lücke.
- **Abschluss:** Wiederholungsfrage gestellt und Ergebnis geöffnet.

### Geschichte 3 · Geänderte Quelle mit gezielter Folgeprüfung

- **Start:** drei validierte Einträge, keine offene Folgeprüfung. **Rollen:** Meldung = Carla
  (braucht `ko.validate`); Folgeprüfung = zweite Controllerrolle (Reiter „Erneut“, braucht
  `ko.create`); Anpassung = Erik (zuständig, ohne Freigaberecht); Übernahme des Änderungsvorschlags =
  ladende Person (braucht `users.manage`); Fachprüfung = Carla und die ladende Person.
- **Schritte:**
  1. Carla: `/lebenszyklus` → „Anlage geändert …“: Anlage `AF-2`, Änderung „Betriebsanleitung AF-2,
     Fassung 2“.
  2. Liste „Erneut“: genau die zwei Einträge an `AF-2`, je mit Anlage, Änderungsbeleg, Fassung und
     zuständiger Person (Erik). Der Kompressor-Eintrag und die Antwortquelle aus Geschichte 1 fehlen.
  3. Folgeprüfung: Füllventile → „Noch gültig“ (bestätigt genau den gesehenen Stand und legt eine
     neue Fassung an; keine fachliche Freigabe des Inhalts).
  4. Erik: Etikettierer öffnen → „Bearbeiten“ (`/wissen/<id>?edit=1`) → Aussage auf Fassung 2
     anpassen (`poc.koAnlageBNeu`) → „Änderung einreichen“. Der Eintrag ist freigegeben und Erik hat
     kein Freigaberecht: die Fläche sagt das und bietet kein direktes Speichern an. Die ladende
     Person (Verwaltung) öffnet denselben Eintrag und wählt am offenen Vorschlag „Übernehmen“; den
     eigenen Vorschlag gibt niemand selbst frei.
  5. Folgeprüfung: Etikettierer → „Noch gültig“ für die **neue** Fassung. Eine Bestätigung der alten
     Fassung wird abgewiesen.
  6. Carla und die ladende Person geben die beiden dabei entstandenen Fassungen in `/validierung`
     erneut frei. Nach „Noch gültig“ verschwindet der Eintrag sofort aus der Liste „Erneut“ (ohne
     Neuladen).
- **Ergebnis:** beide Folgefälle geschlossen; der unbeteiligte Eintrag war nie betroffen.
- **Abschluss:** Liste „Erneut“ ohne `AF-2`-Einträge; beide Einträge wieder validiert, der
  Etikettierer mit dem Text der Fassung 2.

### Persönliche Assistenz

Die Assistenz begleitet alle Seiten mit dem **vorhandenen** Seiten- und Markierungskontext
(`produkt:20261010:assistenz-produkteinstieg`). Name und eines der dreizehn Motive richtet jede
Rolle selbst ein (`/profil?bereich=assistenz`, `produkt:20261010:assistenz-name-avatar`); in der
Lückenansicht steht sie mit diesem Namen. Zustände der Figur sind ein eigener Vertrag
(`produkt:20261010:assistenz-avatarzustaende`). **Nicht Teil dieses PoC und hier nicht neu gebaut:**
KI-Avatar-Generator, Referenzbild, Referenz-KI — sie gelten im PoC als offen bzw. Vorschau ihrer
eigenen Aufträge.

## Messprotokoll (je Rolle und Geschichte getrennt)

Nur tatsächlich Gemessenes eintragen. Ohne belastbaren Vorher-Vergleich wird **keine** Zeitersparnis,
Qualitäts- oder Renditeaussage gemacht. Werte werden nicht nachträglich geschätzt.

**Agentenprobe (automatisch erhoben).** Die Browserprobe
`tests-smoke/branchen-poc-arbeitswege-browser.spec.ts` misst bei jedem Lauf je Geschichte und
ausgeführter Rolle und hängt das Ergebnis als JSON-Anhang „PoC-Messprotokoll“ an den nativen
Playwright-Bericht, auch bei einem Abbruch. Erhoben werden:
- Einstieg sowie Version und Commit des laufenden Servers (aus `/health`), KI-Betriebsart und welcher
  Ausgangsbestandsweg lief;
- je Schritt Beginn, Ende und Dauer;
- genutzte Assistenz-/Hilfeflächen;
- im Browser dieser Rolle beobachtete Fehler (API-Antworten ≥ 400, Seitenfehler);
- offene Punkte (z. B. „über Route statt Fläche“) und das Ergebnis (abgeschlossen/abgebrochen).

Gemessene Schritte: Geschichte 1 Fragende; Geschichte 2 Übergabe, Rückfrage, Antwort, Erfassen und
Verknüpfen, zwei Fachprüfungen, Abschluss, Meldung und Wiederholung; Geschichte 3 Meldung,
Folgeprüfung A, Anpassung als Vorschlag, Übernahme durch die Verwaltung, Folgeprüfung B, zwei
Fachprüfungen. „Hilfe“ heißt bei einer Agentenprobe: genutzte Flächen, kein menschlicher Hilfebedarf.
Die Werte stehen im Bericht des jeweiligen Laufs, nicht in dieser Datei.

**Echte Nutzung (offen).** Für eine Probe mit Menschen dieselben Spalten von Hand:

| Geschichte | Rolle | Art (Agentenprobe / Simulation / echte Nutzung) | Produktrevision | Start–Ende (Dauer) | Hilfe nötig (wo, welche) | Fehler (Schritt, Meldung) | offene Punkte |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Fragende | | | | | | |
| 2 | Fragende | | | | | | |
| 2 | Fachzuständigkeit | | | | | | |
| 2 | Fachprüfung | | | | | | |
| 3 | Meldung | | | | | | |
| 3 | Folgeprüfung | | | | | | |
| 3 | Anpassung / Übernahme | | | | | | |
| 3 | Fachprüfung | | | | | | |

## KI-Betriebsart und Integrationen

- Die Antwort entsteht im **eingestellten** Betrieb der Instanz (Verwaltung → KI): Modellweg oder
  deterministischer Weg ohne Modell. Beide automatisierten Durchläufe unten laufen **ohne Modell**
  (deterministisch); die Browserprobe hält den gemeldeten KI-Status aus `/health` im Protokoll fest. Für den PoC wird kein Anbieter- oder Kontowechsel vorgenommen.
- Genutzte Integrationen im PoC: **keine**. Office-Datenimport, Office-Bearbeitung, Confluence und
  externe Suche sind nicht Teil der Geschichten und werden im PoC nicht als funktionsfähig gezeigt.

## Wiederholung und Schutz echter Daten

- „Demodaten laden“ ohne „force“ legt nichts doppelt an. „force“ entfernt nur den Demo-Bestand
  (Merker `demoSeed`, Demo-Konten) und lädt ihn neu: der PoC steht danach wieder im Ausgangszustand,
  die Demo-Lücke ist wieder offen.
- Echte, selbst erfasste Einträge und Lücken bleiben unberührt. Auch der in Geschichte 2 von Erik
  erfasste Antworteintrag ist ein gewöhnlicher Eintrag und bleibt bestehen. Weil er die Lückenfrage
  sachlich beantwortet, entsteht beim erneuten Laden **keine** neue Demo-Lücke, solange er besteht.
  Soll Geschichte 2 wiederholt werden, löscht die Verwaltung ihn vorher regulär und lädt dann mit
  „force“ — erst danach ist die Demo-Lücke wieder offen.
- Die Demo-Konten werden bei „force“ neu angelegt (neue Einmalkennwörter); ihre Assistenzprofile
  entfallen mit ihnen.

## Nachweisstand

| Nachweis | Art | Stand |
| --- | --- | --- |
| `tests/branchen-poc/arbeitswege-am-draht.test.ts` | Agentenprobe über die echten Routen (In-Memory, ohne Modell), Ausgangsbestand über „Demodaten laden“ | Geschichten 1–3 mit getrennten Rollen, Gegenfälle, Wiederholung, Wortwahl und sachliche Passung je Sprache |
| `tests-smoke/branchen-poc-arbeitswege-browser.spec.ts` | Agentenprobe im echten Browser (`chromium-zustand`, ohne Modell), angemeldeter Einstieg `/start`, Revision aus `/health` | Geschichten 1–3 mit getrennten Konten, alle Arbeitsschritte über die Oberfläche (Assistenz, Erfassen, Lückenvorgang, Prüffläche, Reiter „Erneut“, Leseansicht mit Vorschlag und Übernahme); Assistenz mit persönlichem Namen, Seiten- und Markierungskontext; Messprotokoll und Bildbelege am Bericht. Im Torlauf fehlt der Schalter `KLARWERK_DEMO_SEED`; der Ausgangsbestand wird dann mit denselben Texten über die regulären Routen nachgebildet (ohne Quellenbezeichnung) — welcher Weg lief, steht im Protokoll |
| Echte Nutzung durch Menschen | — | **offen** |
| Veröffentlichte Fassung, Live-Einstieg, Provider-Nachweis | — | **offen**, folgt dem regulären Lieferweg nach Bens Prüfung |

## Zuordnung zu vorhandenen Verträgen

Lückenvorgang, Rückfrage, Meldung: `produkt:20261010:wissenskreislauf-schliessen`. Folgeprüfung:
`produkt:20261010:aenderungsfolgen-sichtbar`. Frageneinstieg: `produkt:20261010:fragen-pruefen-einstieg`.
Assistenz: `produkt:20261010:assistenz-name-avatar`, `produkt:20261010:assistenz-produkteinstieg`,
`produkt:20261010:assistenz-avatarzustaende`; Generator und Referenzbild:
`produkt:20261010:assistenz-avatar-generieren`, `produkt:20261010:assistenz-avatar-referenzbild`.
Demo-Datenwege: `aufnahme:20260922:demo-datenpaket`, `aufnahme:20260922:demo-bereitstellung`.
Die öffentliche Demo-Freischaltung und die menschliche Demo-Gesamtabnahme
(`aufnahme:20260922:demo-gesamtabnahme`) bleiben getrennt offen.
