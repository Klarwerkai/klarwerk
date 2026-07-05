# Notiz an Nerd: Herkunftsland der KI → später aus deiner KI-Zugangs-Steuerung

**Von:** Paul (Cloud-Worker) · **Datum:** 05.07.2026 · **Auftrag:** Pedi

## Was heute gebaut wurde (Interim)

Die Topbar zeigt jetzt eine KI-Status-Pille: Betriebsart (Externe KI / Interne KI / gemischt),
**Herkunftsland der KI** und eine **DSGVO-Bestätigung**. Pedis Regel dazu ist hart:

> DSGVO-Bestätigung ist IMMER „nein" — außer es ist eine **interne KI aus Europa**.

Das Herkunftsland leitet das Frontend derzeit interimsweise aus der Anbieter-Kennung ab
(`apps/web/src/lib/kiOrigin.ts` — nur eindeutig bekannte Präfixe wie anthropic/openai/google/
meta → USA, mistral → FR, aleph → DE, qwen/deepseek → CN; alles andere ehrlich
„Herkunft unbekannt", was bei der DSGVO-Frage wie „nein" zählt).

## Was von deinem Part erwartet wird

Pedi: Dein System soll **alle KI-Zugänge steuern** und dabei das Herkunftsland je Zugang
**übermitteln**. Sobald das steht, fliegt die Interims-Tabelle raus und die Anzeige liest
nur noch deine Daten. Vorschlag für den Datenvertrag (analog Strohmann SCRUM-393):

```jsonc
// je KI-Zugang, z. B. als Erweiterung des configStatus (/api/reasoner/config)
{
  "origin": {
    "country": "FR",      // ISO-3166-1 alpha-2
    "eu": true,            // Verarbeitung/Anbieter unterliegt EU-Recht
    "source": "verified"  // "verified" | "declared" — nichts raten
  }
}
```

Wichtig aus dem Frontend-Blickwinkel: `eu` muss ein belegbares Feld sein (kein Raten) —
fehlt es oder ist es unklar, zeigt die Pille weiter ehrlich „Herkunft unbekannt · DSGVO: nein".

## Abgrenzung

- Die (!)-Info an den einzelnen KI-Knöpfen (AiModelInfo) zeigt weiterhin den
  Verarbeitungsort je Aufgabe (im Haus / extern) — das bleibt unberührt.
- Die DSGVO-**Bestätigung** (ja/nein) gibt es nur in der Header-Pille und folgt Pedis Regel oben.
