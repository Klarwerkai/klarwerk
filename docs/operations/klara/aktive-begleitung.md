# Aktive Begleitung im freigegebenen Arbeitskontext (BPA-05)

Auftrag: `produkt:20261011:assistenz-aktive-beobachtung`, Revision 1. Kriterien K1–K10 entsprechen
BPA-05-AC01 bis AC10.

## Was gebaut ist

Die Begleitung ist Teil der vorhandenen Assistenz. Es gibt keine zweite Assistenz, keinen eigenen
Speicher, keinen eigenen Dienst und keine neue Schnittstelle zum Server.

| Datei | Aufgabe |
|---|---|
| `apps/web/src/components/klara-begleitung/kern.ts` | Freigabe, Rechteregel (`darf`, `darfLesen`), Pause/Stopp/Fortsetzen, Filter, Hinweisdosierung, Wiederanlauf, Auskunft. Reine Logik ohne Netz, Speicher oder Geräte. |
| `apps/web/src/components/klara-begleitung/adapter.ts` | Vorgangsadapter: liest nur Felder eines ausdrücklich eingerichteten Vorgangs. Dazu kommen die Ereignisnamen für Browser- und Nativadapter. |
| `apps/web/src/components/klara-begleitung/hostzustand.ts` | Hostzustand im Browser: Sperrbildschirm über die Idle Detection API (nach Erlaubnis beim Start). |
| `apps/web/src/components/klara-begleitung/KlaraBegleitung.tsx` | Kompakte Statusleiste in der Hülle (`shell/AppShell.tsx`). Sie steht neben der Figur und nicht in deren Gespräch. |
| `apps/web/src/pages/BegleitungPruefformular.tsx` | Der freigegebene, synthetische Testvorgang unter `/begleitung/pruefformular`. Einstieg: Link „Prüfformular öffnen“ auf `/klara-vorschau`. |
| `apps/web/src/texte/begleitung.ts` | Texte auf DE, EN und NL. |

## Einen Vorgang einrichten

Ein Vorgang ist nur dann begleitbar, wenn seine Fläche sich selbst kennzeichnet:

```html
<form data-klara-begleitbereich="pruefformular-42" data-klara-begleitbereich-name="Prüfformular"
      data-klara-begleitbereich-rollen="experte,controller">
  <input name="leistung" data-klara-einheit="W,kW">     <!-- erwartet eine Einheit -->
  <input name="kundennummer" data-klara-ausgeschlossen> <!-- wird nie gelesen -->
</form>
```

Nie gelesen werden außerdem: Passwortfelder, versteckte Felder und alles außerhalb der Fläche.

Die Rollenliste legt fest, wer den Vorgang begleiten lassen darf. Fehlt sie, genügt eine bestätigte
Anmeldung. Das Prüfformular lässt `experte` und `controller` zu. Verwaltung allein (`admin`) gibt
keine fachliche Freigabe (G04). Ob Administratoren den Testvorgang ebenfalls begleiten lassen
dürfen sollen, ist eine Produktentscheidung, die hier nicht getroffen wird.

## Ablauf für Nutzer

1. Auf einer Seite mit eingerichtetem Vorgang, den die eigene Rolle begleiten lassen darf, erscheint
   das Angebot. Ein Satz genügt, zum Beispiel „Produktrecherche, 45 Minuten“. Ohne Dauer gelten
   30 Minuten, höchstens 8 Stunden.
2. Die Leiste zeigt „Begleiten · Bereich · bis HH:MM“, den Zweck und „Mikrofon aus · Video aus ·
   keine Aufzeichnung“. Sie sagt außerdem, ob ein Sperrbildschirm erkannt wird oder nur das
   verborgene Fenster.
3. **Alt+Umschalt+P** pausiert und setzt fort, **Alt+Umschalt+S** stoppt. Beides geht auch über die
   Knöpfe der Leiste, ohne dass das Gespräch offen ist.
4. Ein Hinweis nennt das Feld, den Wert und den nächsten Schritt. Die Assistenz trägt nichts ein.
   Ein verworfener Hinweis kommt für dieselbe Lage nicht wieder.

## Regeln für Pause und Ende

Vor jedem Lesen, auch vor dem Taktlesen im Hintergrund, wird geprüft: aktiv, nicht abgelaufen,
dasselbe Konto, aktuelle Berechtigung, Fenster sichtbar. Fällt eine Bedingung weg, wird pausiert,
ohne das Formular anzufassen.

Der Sperrbildschirmmelder läuft nur, solange die Begleitung aktiv ist. Beim Start und bei jedem
Fortsetzen, auch nach dem Neuladen, wird er aus der Geste heraus neu eingerichtet. Aktiviert wird
erst, wenn sein tatsächlicher Zustand feststeht (läuft, nur Fenstersignal oder ausgefallen).
Danach werden Ablauf, Stopp, Konto und Rechte ein zweites Mal geprüft. Ein Melder, der inzwischen
überholt ist, wird sofort wieder freigegeben. Meldet der Melder schon während seiner Einrichtung
einen gesperrten Bildschirm, wird der Versuch entwertet: Seine spätere Antwort aktiviert nichts,
beim Fortsetzen wird daraus eine Sperrbildschirmpause, und es braucht einen neuen, bewussten
Start bzw. ein neues Fortsetzen. Die Leiste sagt „Sperrbildschirm wird erkannt“ erst,
wenn der Melder läuft; vorher steht „wird eingerichtet“, während einer Pause „ruht“.

| Ereignis | Wirkung | Fortsetzen |
|---|---|---|
| Pause durch Nutzer | Kontext wird verworfen | jederzeit bis zum Endpunkt |
| Fenster verborgen (anderes Fenster, Tab, Bildschirm aus) | Pause „verborgen“ | nur durch den Nutzer |
| Sperrbildschirm (Idle Detection, Chrome, nach Erlaubnis) | Pause | nur durch den Nutzer; der Melder wird dabei neu eingerichtet |
| Sperrbildschirmmelder startet nicht (Konstruktor oder `start()` scheitert) | Pause „sperrmelder“, Fehler sichtbar, keine Zusage | nur durch den Nutzer; „Fortsetzen“ versucht den Melder erneut |
| Kontowechsel | Pause; anderes Konto sieht nichts | nur mit demselben Konto |
| Rechteentzug (Rolle passt nicht mehr, Konto bleibt angemeldet) | Pause, Zeitpunkt gemerkt | erst mit einer Serverbestätigung (`/auth/me`), die jünger ist als der Entzug; „Fortsetzen“ fordert sie an |
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

Dateiänderungen über längere Zeit erkennen weiter die vorhandenen, getrennten Dienste. Bei
SharePoint und OneDrive erkennt der Dateiquellenadapter einen geänderten Dateistand
(`lastModifiedDateTime`) und reiht ihn als Vorgang ein. Bei Arbeitsanleitungen meldet die
Änderungsprüfung eine neuere Quellfassung. Beides läuft am Server, ohne dass ein Fenster offen ist.
Die Begleitung ruft diese Dienste nicht und ersetzt sie nicht. Grenze: Eine zeitgesteuerte
Dauerüberwachung ist nicht eingerichtet (`ueberwachung: "nicht_eingerichtet"`). Geprüft wird beim
Wiederholimport, beim Abgleich oder beim Öffnen.

Fremder Basisbefund: Am Kandidaten `f2144738` sind in `tests/confluence-quellabgleich/abgleich.test.ts`
die drei R-0162-Fälle zum Löschabgleich rot. Sie betreffen `services/app/src/confluence-import.ts`,
den diese Lieferung nicht ändert. Der Test bleibt unverändert und wird hier nicht als Beleg
herangezogen.

## Schnittstelle für Host-Adapter (BPA-01 Browser, BPA-04 Nativ)

- `window` → `klarwerk:begleitung-kontext`, `detail: KontextEreignis`
  (`quelle: { art, kennung, privat? }`, `konto`, `felder`)
- `window` → `klarwerk:begleitung-system`,
  `detail: { ereignis: "sperrbildschirm" | "verborgen" | "kontowechsel" | "rechteentzug" }`

## Agentenvergleich (K10)

`tests/klara-begleitung/agentenvergleich-ausgefuehrt.test.tsx` führt dieselbe synthetische
Recherche auf dem Prüfformular zweimal aus, ohne und mit Begleitung, und protokolliert jede
Handlung. Ergebnis dieser Recherche: Wegen der Hinweisruhe von 2 Minuten gibt es nur einen Hinweis.
Der zweite Fehler fällt wie bisher erst der Prüfung auf. Die Entlastung ist negativ (−3 Handlungen)
und steht so im Bericht. Der ältere Modellvergleich `agentenvergleich.test.ts` bleibt als
offengelegte Rechnung erhalten.

## Offen

- **Reale Hostprobe:** Ein Lauf auf diesem Mac mit Chrome (Hostversion, Rollen, positive und
  negative Fälle) ist nicht gemacht. Die Tests laufen in jsdom; die Idle Detection API ist dort eine
  Attrappe.
- **Privates Browserfenster:** Eine Webseite erkennt ein Inkognitofenster nicht verlässlich. Der
  Vorgangsadapter liest nur das eigene Dokument; ein Wechsel in ein anderes Fenster verbirgt dieses
  und pausiert. Ein Melder für fremde Inkognitofenster braucht den Browseradapter aus BPA-01 (die
  Erweiterung liest heute keine fremden Seiten mit).
- **K10:** Geskripteter Agent, keine Menschenstudie und keine Zeitmessung. Güteschwellen legt O07
  fest.
- Installation, Veröffentlichung und Gesamtabnahme sind von dieser Lieferung getrennt.
