# Vorlage: Tarif- und Kostenstellenbindung der Referenz-KI-Prüfung (REF-02, K10)

Anlass: Ben nacharbeit-6 und Peters Entscheidung 13 vom 12.10.2026. Für den PoC trägt der Betreiber
die Tarifverantwortung. Für das tatsächlich verwendete Prüfmodell wird die datierte
Anbieterpreisliste ermittelt: Währung, Eingangs-, Ausgangs- und Zusatzkosten. Die Kosten werden
der bestehenden Produktkostenstelle zugeordnet. Verbrauch und Wiederholungen werden mitgerechnet.

## Stand im Produkt (geprüft im Code, nicht erfunden)

- **Preise:** Der Code liefert keine Preise mit. Die einzige Preisquelle ist
  `KLARWERK_KI_PREISLISTE` (`services/model-runs/src/preisliste.ts`). Diese Liste kennt je Modell
  nur Eingabe- und Ausgabepreis je Million Token, dazu eine Währung und einen Preisstand für die
  ganze Liste.
- **Kostenstelle:** Im Produkt gibt es **keine Kostenstelle**. Kein Feld, keine Einstellung und
  kein Laufprotokoll trägt eine. Deshalb steht hier, wie verlangt, eine konkrete Vorlage. Eine
  Kostenstelle wird nicht erfunden.
- **Zusatzkosten:** Die Prüfung sendet weder `cache_control` noch Werkzeuge oder Websuche
  (`services/reasoner/src/model-client.ts`, Prüfauftrag `referenzpruefung-v1`). Bei Anthropic
  fallen deshalb nach dem Code weder Cache- noch Werkzeugzuschläge an. Die Preisliste des Anbieters
  ist trotzdem vollständig zu erfassen. Ob ein Zuschlag anfällt, belegt nur die Anbieterabrechnung.
- **Modell:** Ohne Überschreibung nutzt der Anthropic-Zugang `claude-sonnet-4-6` (Vorgabe in
  `model-client.ts`). Maßgeblich ist der Wert `modellaufrufeNachweis.modelle` im Bericht des Laufs.
- **Verbrauch und Wiederholungen:** Der Bericht (`kostengrundlage`) summiert Eingabe- und
  Ausgabetoken über alle Versuche aller Prüfläufe (`versucheGesamt`). Gesamtkosten nennt er nur,
  wenn jeder Lauf mit Verbrauch einen Preis hat; sonst steht `null` und `modelleOhnePreis`.

## Vom Betreiber zu bestätigen

Das Modell ist durch den Lauf vom 12.10.2026 belegt. Verbrauch, Kostenrechnung, die Behandlung des
abgebrochenen Versuchs stehen in `kostennachweis-beobachtung-20261012.md`. Preise bleiben hier
offen, bis eine datierte Anbieterquelle sie belegt. Danach rechnet
`scripts/referenzki/kosten-auswerten.ts` den vorhandenen Lauf ohne neuen Modellaufruf aus.

```json
{
  "auftrag": "produkt:20261009:referenzki-pruefdienst",
  "tarif": {
    "anbieter": "anthropic",
    "modell": "claude-sonnet-4-6",
    "quelle": "<URL der Anbieter-Preisseite oder Vertragsdokument>",
    "abgerufenAm": "<JJJJ-MM-TT>",
    "gueltigAb": "<JJJJ-MM-TT>",
    "waehrung": "<z. B. USD>",
    "eingabeJeMillionToken": null,
    "ausgabeJeMillionToken": null,
    "zusatzkosten": {
      "cacheSchreibenJeMillionToken": null,
      "cacheLesenJeMillionToken": null,
      "werkzeugOderSucheJeAufruf": null,
      "steuernOderGebuehren": null,
      "sonstige": null
    }
  },
  "kostenstelle": {
    "kennung": "<bestehende Produktkostenstelle>",
    "bezeichnung": "<z. B. KLARWERK PoC · KI-Betrieb>",
    "verantwortlich": "Peter, Betreiberverantwortlicher im PoC (Entscheidung 13)",
    "budgetbezug": "<vorhandene Budgetbindung, falls festgelegt>"
  },
  "abrechnung": {
    "bericht": "<Anhang beobachtung.json des Smoke-Laufs>",
    "verbrauchGesamt": "aus kostengrundlage.verbrauchGesamt",
    "versucheGesamt": "aus kostengrundlage.versucheGesamt",
    "kostenGesamt": "aus kostengrundlage.kostenGesamt (nur mit Preisliste)"
  }
}
```

Für die Kostenrechnung im Produkt wird daraus die Betreiberliste in der vorhandenen Form gesetzt.
Sie gelangt wie der Smoke-Zugang über die bestehende sichere Betreiber-Einspeisung in den
Prüfprozess, nie als Datei im Repository:

```json
{"waehrung":"<waehrung>","preisstand":"<gueltigAb>","modelle":{"<modell>":{"eingabeJeMillion":<zahl>,"ausgabeJeMillion":<zahl>}}}
```

Grenze: Zusatzkosten und Kostenstelle erfasst die Produktpreisliste nicht. Sie gehören in diese
Vorlage und in die Anbieterabrechnung, nicht in eine erfundene Produkterweiterung.
