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
| Verwaltung, Fragende (Geschichte 2) | ladende Person | admin |
| Fragende (Geschichte 1), Fachprüfung, meldet die Änderung (Geschichte 3) | Carla Controller `carla@demo.klarwerk` | controller |
| Fachzuständigkeit (Geschichte 2), Folgeprüfung (Geschichte 3) | Erik Experte `erik@demo.klarwerk` | experte |

## Ablauf je Geschichte

Für jede Geschichte sind Ergebnis, zulässige Rollen, Startdaten und Abschluss **vor** der Abnahme
festgelegt.

### Geschichte 1 · Typische Frage mit Quellenantwort

- **Start:** Bestand wie oben. **Rolle:** Carla (jede Rolle mit Leserecht ist zulässig).
- **Schritte:** `/fragen` → „Wie oft muss der Kühlschmierstoff an der Fräse M12 erneuert werden?“ →
  Quelle in der Antwort öffnen (führt nach `/wissen/<id>?stelle=…&fassung=…`).
- **Ergebnis:** Antwort aus dem validierten Eintrag; Fundstelle mit Fassung; Prüfstand „belegt“,
  tragende Quelle validiert; die Quelle zeigt Bezeichnung und Auszug.
- **Gegenprobe:** Die Lückenfrage aus Geschichte 2 bekommt **keine** Quelle und keine erfundene
  Referenz, sondern führt zur Wissenslücke.
- **Abschluss:** Quelle geöffnet, Fassung und Prüfstand abgelesen.

### Geschichte 2 · Fehlendes Wissen bis zur Rückmeldung

- **Start:** offene Demo-Lücke. **Rollen:** Fragende = ladende Person; Fachzuständigkeit = Erik;
  Fachprüfung = Carla und die ladende Person (zwei Bewertungen).
- **Schritte:**
  1. Fragende: Lücke öffnen (`/luecke/<id>`, auch über die Glocke) → an „Erik Experte“ übergeben.
  2. Erik: Rückfrage „Tritt die Abweichung bei allen Rezepturen auf oder nur bei einer?“.
  3. Fragende: Glocke → Rückfrage → Antwort „Bei allen Rezepturen, jeweils in der ersten halben Stunde.“
  4. Erik: Eintrag erfassen „Mengenregler des Mischers M4 bei der Übergabe neu nullen“ (Aussage aus
     `poc.lueckenAntwort`) und in der Lücke als Antwortentwurf verknüpfen. „Abschließen“ bleibt gesperrt.
  5. Carla und die Fragende bewerten den Eintrag in `/validierung` positiv.
  6. Erik: „Abschließen“ → „Fachlich gelöst“.
- **Ergebnis:** genau eine Erfolgsmeldung an die Fragende mit dem nutzbaren Eintrag; dieselbe Frage
  erneut zeigt den abgeschlossenen Stand statt einer neuen Lücke.
- **Abschluss:** Wiederholungsfrage gestellt und Ergebnis geöffnet.

### Geschichte 3 · Geänderte Quelle mit gezielter Folgeprüfung

- **Start:** drei validierte Einträge, keine offene Folgeprüfung. **Rollen:** Meldung = Carla
  (braucht `ko.validate`); Folgeprüfung = Erik (zuständig, braucht `ko.create`); Übernahme des
  Änderungsvorschlags = ladende Person (braucht `users.manage`).
- **Schritte:**
  1. Carla: `/lebenszyklus` → „Anlage geändert …“: Anlage `AF-2`, Änderung „Betriebsanleitung AF-2,
     Fassung 2“.
  2. Liste „Erneut“: genau die zwei Einträge an `AF-2`, je mit Anlage, Änderungsbeleg, Fassung und
     zuständiger Person. Der Kompressor-Eintrag und die Antwortquelle aus Geschichte 1 fehlen.
  3. Erik: Füllventile → „Noch gültig“ (bestätigt genau den gesehenen Stand und legt eine neue
     Fassung an; keine fachliche Freigabe des Inhalts).
  4. Erik: Etikettierer auf Fassung 2 anpassen (Aussage aus `poc.koAnlageBNeu`). Der Eintrag ist
     freigegeben und Erik hat kein Freigaberecht: das Produkt nimmt die Änderung nur als
     **Änderungsvorschlag** an. Die ladende Person (Verwaltung) übernimmt den Vorschlag; den eigenen
     Vorschlag gibt niemand selbst frei.
  5. Erik: „Noch gültig“ für die **neue** Fassung. Eine Bestätigung der alten Fassung wird abgewiesen.
  6. Carla und die ladende Person prüfen die dabei entstandene Fassung erneut.
- **Ergebnis:** beide Folgefälle geschlossen; der unbeteiligte Eintrag war nie betroffen.
- **Abschluss:** Liste „Erneut“ ohne `AF-2`-Einträge; Etikettierer wieder validiert.

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
Qualitäts- oder Renditeaussage gemacht.

| Geschichte | Rolle | Art (Agentenprobe / Simulation / echte Nutzung) | Produktrevision | Start–Ende (Dauer) | Hilfe nötig (wo, welche) | Fehler (Schritt, Meldung) | offene Punkte |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Fragende | | | | | | |
| 2 | Fragende | | | | | | |
| 2 | Fachzuständigkeit | | | | | | |
| 2 | Fachprüfung | | | | | | |
| 3 | Meldung | | | | | | |
| 3 | Folgeprüfung | | | | | | |

## KI-Betriebsart und Integrationen

- Die Antwort entsteht im **eingestellten** Betrieb der Instanz (Verwaltung → KI): Modellweg oder
  deterministischer Weg ohne Modell. Der automatisierte Durchlauf unten läuft **ohne Modell**
  (deterministisch). Für den PoC wird kein Anbieter- oder Kontowechsel vorgenommen.
- Genutzte Integrationen im PoC: **keine**. Office-Datenimport, Office-Bearbeitung, Confluence und
  externe Suche sind nicht Teil der Geschichten und werden im PoC nicht als funktionsfähig gezeigt.

## Wiederholung und Schutz echter Daten

- „Demodaten laden“ ohne „force“ legt nichts doppelt an. „force“ entfernt nur den Demo-Bestand
  (Merker `demoSeed`, Demo-Konten) und lädt ihn neu: der PoC steht danach wieder im Ausgangszustand,
  die Demo-Lücke ist wieder offen.
- Echte, selbst erfasste Einträge und Lücken bleiben unberührt. Auch der in Geschichte 2 von Erik
  erfasste Antworteintrag ist ein gewöhnlicher Eintrag und bleibt bestehen. Wer ihn nach der Abnahme
  nicht behalten will, löscht ihn regulär.
- Die Demo-Konten werden bei „force“ neu angelegt (neue Einmalkennwörter); ihre Assistenzprofile
  entfallen mit ihnen.

## Nachweisstand

| Nachweis | Art | Stand |
| --- | --- | --- |
| `tests/branchen-poc/arbeitswege-am-draht.test.ts` | Agentenprobe über die echten Routen (In-Memory, ohne Modell) | Geschichten 1–3 mit getrennten Rollen, Gegenfälle, Wiederholung, Wortwahl je Sprache |
| Bedienung im Browser | — | **offen** (der Smoke-Torlauf setzt `KLARWERK_DEMO_SEED` nicht) |
| Echte Nutzung durch Menschen, Messprotokoll | — | **offen** |
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
