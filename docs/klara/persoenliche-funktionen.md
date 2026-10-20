# Persönliche Funktionen: Beschaffungsablauf wiederverwenden (BES-07)

Auftrag: `produkt:20261011:peter-p06:beschaffungsroutine`, Revision 1, eine Ergänzung zu P06.
Quelle: `gespraech/auftragsuebernahme-01a11f14/bes-ui-20261011-r1.json`, SHA256 `125b266f…1444`.

## Was gebaut ist

| Teil | Ort |
| --- | --- |
| Funktionsvertrag, Fassungen, Parameter, Lauf, Serienvorschau | `services/app/src/persoenliche-funktionen.ts` |
| Ablage (eine Zeile je Funktion, JSON) | Tabelle `persoenliche_funktionen`, `PERSOENLICHE_FUNKTIONEN_SCHEMA` (additiv) |
| HTTP, nur das eigene Konto | `services/app/src/routes/persoenliche-funktionen-routes.ts` (`/api/me/funktionen…`) |
| Oberfläche | Einstellungen → Persönliche Einstellungen → „Meine Funktionen“ (`/profil?bereich=funktionen`) |

Aus einem getippten oder diktierten Satz („So möchte ich künftig Angebote für eine Verpackung
einholen.“) entsteht ohne Modell ein Entwurf. Ein Satz, der keinen Beschaffungsablauf nennt, wird
abgelehnt. Gespeichert werden Zweck, die Parameter (Produkt, Menge, Termin, Ansprechpartner,
einmalige Ausnahme), Quellen als Kennungen, die Quellenregel, die erlaubten internen Schritte, die
Außenaktionsregel (Versand und Nachfassen nur nach Bestätigung je Lauf, Bestellung und Zahlung nie),
die Empfängerregel, das Ergebnis, die Fehler- und Stopregel, der Eigentümer und die Fassung.
Beispielwerte aus dem Satz werden zurückgemeldet. Gespeichert werden sie nicht; im Ausgangssatz
stehen dafür Platzhalter.

## „So wie eben speichern“ (Nacharbeit 3)

Der vorhandene Vorgang der Assistenz ist das gespeicherte Assistenzgespräch
(`klara-gespraech.ts`). In „Meine Funktionen“ ist das letzte Gespräch vorausgewählt. Dann genügt
„So wie eben speichern.“: Der Ablauf kommt aus der eigenen Frage im Gespräch, die Quellen aus dessen
Objektbezügen und Antwortquellen. Übernommen werden nur Quellen, die das Konto **jetzt** sehen darf;
die übrigen werden nur gezählt. Gespeichert wird die Gesprächskennung als Herkunft, kein Gesprächsinhalt.
Ohne Vorgang wird der Satz mit `kontext_fehlt` abgewiesen.

Nacharbeit 4: Übernommen wird genau **ein Fall** des Gesprächs. Ein Fall beginnt mit einer eigenen
Frage, die einen Beschaffungsablauf nennt, und reicht bis vor die nächste solche Frage. Nur seine
Nachrichten liefern Quellen; der Objektbezug beim Gesprächsbeginn gehört zu keinem Fall. Enthält das
Gespräch mehrere Fälle, antwortet die Vorschau mit `409 vorgang_mehrdeutig` und der Auswahl, und die
Person wählt. Die Vorschau bindet Gesprächskennung, Gesprächsfassung, Fall und die gezeigten Quellen.
Das Speichern verlangt genau diese Bindung (sonst `400 vorschau_fehlt`), liest Rechte und Quellen neu
und weist jede Abweichung mit `409 vorgang_geaendert` ab. Ein Gesprächswechsel nach der Vorschau ändert
deshalb nicht, was gespeichert wird.

Nacharbeit 5: Auch ein Diktat nach der Vorschau verwirft sie, genau wie Tippen. Die Oberfläche speichert
den Eingabestand, aus dem die Vorschau entstand, und schickt deren Name und Ausgangssatz mit. Weicht die
beim Speichern berechnete Definition davon ab, kommt `409 vorgang_geaendert`. Mit Vorgang ist diese
Angabe Pflicht.

Unter „Bearbeiten“ lassen sich Name, Zweck und Quellen ändern. Dort können Quellen entfernt oder aus dem
letzten Gespräch ergänzt werden. Jede inhaltliche Änderung ergibt eine neue Fassung; bisherige Fälle
behalten ihre.

Ein Fall ohne Quelle oder mit einer gelöschten, nicht zugänglichen oder nicht erreichbaren Quelle
endet in `klaerung_noetig` und nennt je Fall, was zu tun ist. „Gelöscht“ erfährt nur, wer das Objekt
sehen durfte (dieselbe Regel wie bei den Fundstellen); ein Lesefehler heißt „nicht erreichbar“.

## Was Speichern nicht tut

Speichern legt keinen Lauf an, keine Wiederholung und kein Außenrecht. Ein Vorschlag (Lernnotiz)
ist erst nach Übernahme aufrufbar. Eine Serie entsteht nur über „Serie einrichten“.

## Lauf und Serie: Stand dieser Fassung

Ein manueller Lauf nimmt die Parameter dieses Aufrufs. Er liest jede Quelle mit der
Sichtbarkeitsentscheidung des Augenblicks (`sichtbarkeitsfilterFuer`) und hält Rolle, Zeitpunkt und
gelesene Quellfassung fest, aber keinen Titel und keinen Inhalt. Er endet im Stand
`wartet_auf_faehigkeit` mit den offenen Fähigkeiten. Nach außen bewirkt er nichts.

Offen, weil in diesem Stand nicht gebaut:

- **BES-02**: Auftragsführung für Beschaffung.
- **BES-06**: Angebotsvergleich.
- **Postfach**: Anfrageversand und Antwortabruf.
- **Zeitauftrag**: Kein vorhandener Dienst löst eine Serie aus; Klarwerk startet dafür keinen eigenen
  Wecker. Die Serie wird mit Zeitzone (Vorgabe `Europe/Berlin`), Nachholregel und Ende gespeichert. Die
  Vorschau berechnet die Termine nach den IANA-Regeln der Laufzeit: In der Sommerzeit-Lücke gilt die
  nächste gültige Uhrzeit, bei der Winterzeit-Doppelung nur das erste Vorkommen, im kürzeren Monat
  der letzte Tag.

Pausieren und Deaktivieren verhindern jeden weiteren Lauf; bisherige Läufe bleiben erhalten und
tragen ihre Vertragsfassung. Die Tabelle liegt im Dump und in der Pflichtliste des Restore-Drills.
`funktionen-restore.integration.test.ts` sichert mit `backup.sh` und stellt mit dem Aufruf des
Restore-Drills wieder her. Danach muss eine pausierte Funktion mit Fassungen, Serie und Lauf
zurückkommen und weiter pausiert sein.

## Prüfungen

`tests/persoenliche-funktionen/` (Dienst, echter Server, PostgreSQL, gemountete Oberfläche). Eine
echte menschliche Bedienung und die fachliche Abnahme sind getrennt nachzuweisen.
