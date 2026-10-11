# Aktive Begleitung im freigegebenen Arbeitskontext (BPA-05)

Auftrag: `produkt:20261011:assistenz-aktive-beobachtung`, Revision 1. Kriterien K1–K10 entsprechen
BPA-05-AC01 bis AC10.

## Was gebaut ist

Die Begleitung ist Teil der vorhandenen Assistenz. Es gibt keine zweite Assistenz, keinen eigenen
Speicher, keinen eigenen Dienst und keine neue Schnittstelle zum Server.

| Datei | Aufgabe |
|---|---|
| `apps/web/src/components/klara-begleitung/kern.ts` | Freigabe, Pause/Stopp/Fortsetzen, Filter, Hinweisdosierung, Wiederanlauf, Auskunft. Reine Logik ohne Netz, Speicher oder Geräte. |
| `apps/web/src/components/klara-begleitung/adapter.ts` | Vorgangsadapter: liest nur Felder eines ausdrücklich eingerichteten Vorgangs. Dazu kommen die Ereignisnamen für Browser- und Nativadapter. |
| `apps/web/src/components/klara-begleitung/KlaraBegleitung.tsx` | Kompakte Statusleiste in der Hülle (`shell/AppShell.tsx`). Sie steht neben der Figur und nicht in deren Gespräch. |
| `apps/web/src/texte/begleitung.ts` | Texte auf DE, EN und NL. |

## Einen Vorgang einrichten

Ein Vorgang ist nur dann begleitbar, wenn seine Fläche sich selbst kennzeichnet:

```html
<form data-klara-begleitbereich="pruefformular-42" data-klara-begleitbereich-name="Prüfformular">
  <input name="leistung" data-klara-einheit="W,kW">     <!-- erwartet eine Einheit -->
  <input name="kundennummer" data-klara-ausgeschlossen> <!-- wird nie gelesen -->
</form>
```

Nie gelesen werden außerdem: Passwortfelder, versteckte Felder und alles außerhalb der Fläche.

## Ablauf für Nutzer

1. Auf einer Seite mit eingerichtetem Vorgang erscheint das Angebot. Ein Satz genügt, zum Beispiel
   „Produktrecherche, 45 Minuten“. Ohne Dauer gelten 30 Minuten, höchstens 8 Stunden.
2. Die Leiste zeigt „Begleiten · Bereich · bis HH:MM“, den Zweck und „Mikrofon aus · Video aus ·
   keine Aufzeichnung“.
3. **Alt+Umschalt+P** pausiert und setzt fort, **Alt+Umschalt+S** stoppt. Beides geht auch über die
   Knöpfe der Leiste, ohne dass das Gespräch offen ist.
4. Ein Hinweis nennt das Feld, den Wert und den nächsten Schritt. Die Assistenz trägt nichts ein.
   Ein verworfener Hinweis kommt für dieselbe Lage nicht wieder.

## Regeln für Pause und Ende

| Ereignis | Wirkung | Fortsetzen |
|---|---|---|
| Pause durch Nutzer | Kontext wird verworfen | jederzeit bis zum Endpunkt |
| Sperrbildschirm | Pause | nur durch den Nutzer |
| Kontowechsel | Pause; anderes Konto sieht nichts | nur mit demselben Konto |
| Rechteentzug | Pause | erst bei positiver Rechteprüfung |
| Neuladen | Pause; Endpunkt bleibt gleich | durch den Nutzer, frischer Kontext |
| Endpunkt erreicht | Ende | nicht möglich; neu starten |
| Stopp | Ende; Kontext verworfen | nicht möglich; neu starten |

## Was gespeichert wird

- Im Sitzungsspeicher des Tabs liegt nur die Freigabe (Zweck, Bereich, Endpunkt, Konto). Sie wird
  bei Stopp oder Ablauf gelöscht.
- Gelesene Feldwerte liegen nur im Arbeitsspeicher. Es gibt immer nur einen Stand. Pause und Stopp
  verwerfen ihn.
- Eine Notiz entsteht nur über „Als Notiz übernehmen“. Notizen liegen je Konto getrennt im
  Sitzungsspeicher, bleiben nach dem Stopp erhalten und lassen sich einzeln löschen.
- Es gibt keinen Verlauf, keine Aufnahme und keine Auswertung über Personen. Die Leiste zeigt das
  unter „Was ist gespeichert?“.

## Abgrenzung zum Quellenänderungsdienst

Dateiänderungen über längere Zeit erkennt weiter der vorhandene, getrennte Dienst: der
Confluence-Abgleich und die Änderungsprüfung der Arbeitsanleitungen. Die Begleitung ruft ihn nicht
und ersetzt ihn nicht. Grenze: Eine zeitgesteuerte Dauerüberwachung ist dort nicht eingerichtet
(`ueberwachung: "nicht_eingerichtet"`). Geprüft wird beim Abgleich oder beim Öffnen.

## Schnittstelle für Host-Adapter (BPA-01 Browser, BPA-04 Nativ)

- `window` → `klarwerk:begleitung-kontext`, `detail: KontextEreignis`
  (`quelle: { art, kennung, privat? }`, `konto`, `felder`)
- `window` → `klarwerk:begleitung-system`,
  `detail: { ereignis: "sperrbildschirm" | "kontowechsel" | "rechteentzug" }`

## Offen

- **Reale Hostprobe:** Chrome-Adapter (BPA-01) und Nativadapter (BPA-04) liefern diese Ereignisse
  noch nicht. Ein echtes Inkognitofenster, ein echter Sperrbildschirm und ein echter Fensterwechsel
  des Betriebssystems sind deshalb nicht am Host nachgewiesen. In den Tests werden sie als genau
  diese Ereignisse gestellt.
- **K10:** Der Vergleich ist eine geskriptete Agentenprobe mit offen benannten Annahmen. Er ist
  keine Menschenstudie. Güteschwellen legt O07 fest.
- Installation, Veröffentlichung und Gesamtabnahme sind von dieser Lieferung getrennt.
