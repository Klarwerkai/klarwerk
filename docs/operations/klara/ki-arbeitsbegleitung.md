# Klara · Arbeit mit ausgewählter öffentlicher KI (BPA-13)

Auftrag `produkt:20261011:assistenz-ki-arbeitsbegleitung` (BPA-Gesamtpaket r2, BPA-13).
Kern: `services/app/src/ki-arbeitsbegleitung.ts` · Prüfung: `tests/ki-arbeitsbegleitung/bpa13-ki-arbeitsweg.test.ts`.

## Was der Kern tut

Freigegebener Arbeitsbereich → minimiertes, versioniertes Kontextpaket → gewählter, registrierter
Weg → gebundener Job → Antwort am Ursprung → Vergleich/Ablage im vorhandenen Verlauf.

Es gibt keine zweite Policy. Der Kern liest als Ergebnis:

- die zentrale Adminfreigabe für öffentliche KI (`kiFreigabe.oeffentlicheKi`, P04) und für
  vertrauliche Inhalte (`kiFreigabe.vertraulicheInhalte`),
- die aktuelle Klara-Auflösung (`resolveKlaraPolicy` → `KlaraResolution`) für den API-Weg,
- die dokumentbezogene externe Freigabe je Quelle (`erteilt` / `fehlt` / `geschlossen`),
- „Keine KI“ für Mandant, Arbeitsbereich oder Dokument.

## Fähigkeitsvertrag (vier getrennte Fähigkeiten)

| Fähigkeit | Bedeutung | gilt als verbunden, wenn |
|---|---|---|
| `prompt_manuell` | Nutzer kopiert Prompt und gibt Ergebnis zurück | immer verfügbar (außer „Keine KI“, fehlende P04-Freigabe, Anbieter nicht erlaubt) |
| `api` | direkte Ausführung über Anbieter-Schnittstelle | geprüfter, nicht simulierter Adapter **und** `KlaraResolution.executionAllowed` mit identischem Anbieter |
| `browser_begleitung` | Begleitung im Browser | geprüfter, nicht simulierter Adapter |
| `codex_auftrag` | Programmierauftrag | geprüfter, nicht simulierter Adapter; Ergebnis nur Dateien unter erlaubten Pfaden |

Der MCP-Status bedeutet nur „Klara-Wissen ist in fremden KI-Programmen als Werkzeug verfügbar“.
Daraus wird keine Steuerung fremder Chats abgeleitet (`fremdeChatsteuerung: "nicht_vorhanden"`).

Ein Codex-Auftrag erhält nie Deployment, Shell, Installation, Push, Veröffentlichung oder
Löschen. Angeforderte Aktionen werden abgelehnt und nicht ausgeführt.

## Belegklassen

`promptentwurf`, `manuelle_uebergabe`, `simulation` und `realer_adapterlauf` werden getrennt
geführt. Als `realer_adapterlauf` zählt nur ein Lauf über einen geprüften, nicht simulierten
Adapter mit Anfragekennung des Anbieters und gemessenem Verbrauch.

## Offene Grenzen (nicht durch diese Lieferung belegt)

- Kein realer Anbieterlauf und kein Verbrauch belegt. Dazu braucht es einen ausdrücklich
  beauftragten Lauf über den vorhandenen genehmigten Anbieterweg (O09). Es werden keine
  zusätzlichen Kosten freigegeben.
- Keine Oberfläche (Word-Add-in, Browser, Begleiter) ist in dieser Lieferung an den Kern
  angeschlossen. Kein Browser-/Codex-Adapter ist registriert. Ohne Adapter zeigt der Kern ehrlich
  „nicht eingerichtet“ an.
- Die Persistenz von Jobs bleibt beim vorhandenen Verlauf. Der Kern arbeitet auf übergebenen
  Ständen und legt keine eigene Auftragsdatenbank an.
- Unabhängige Ben-Prüfung, Installation, Veröffentlichung und Gesamtabnahme sind getrennte
  Schritte.
