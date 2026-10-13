# Aufnahme 20260922 · Verwaistes Wissen: Geltungsfrage, heutiger Stand, nötige Entscheidung

Auftrag `aufnahme:20260922:gesamt-verwaistes-wissen`, Revision 1 („Wissen ohne aktiven Urheber und
jüngere Bewährung kuratierbar auflisten“). Basis `81f9152d` (**1.0.0-beta.1.952**), erhoben am
13.10.2026.

- Der Abgleich ist **Quelleninspektion** am Arbeitsbaum der Basis. In diesem Arbeitsgang lief kein
  Test.
- Der Auftrag ändert keinen Produktcode. Warum, steht unter „Was davon eindeutig bestellt ist“.
- Der Lieferbeleg mit Fassung (K4) entsteht erst mit der Veröffentlichung dieses Dokuments und steht
  hier deshalb noch nicht.

## Die Anliegen

| Anliegen | Wortlaut (Quelle) | Letzte Einordnung | Heute geliefert? |
|---|---|---|---|
| **R-0258** (Alias F-0258, Funktionslandkarte **A5**, MARKTBLICK-IDEE 10) „Automatisches Archiv für ungenutztes, ungeprüftes Wissen“ | „Wissensobjekte, die nie geprüft wurden und lange niemand genutzt hat, landen in einer Warteschlange: archivieren oder prüfen. Damit verstopft alter Ballast weder Suche noch Antworten.“ (`FUNKTIONSREGISTER.json:5979`, 29.08.2026) | **VERWORFEN** (Funktionslandkarte v3, Plan-Spalte „gestrichen“, Streichliste v3 nennt A5). Grund: „Der Marktbeleg trägt nicht: die Marktrecherche konnte die Guru-Kadenzen und Schwellen nicht belegen. In v3 gestrichen, um Bauzeit auf den IT-Leiter-Test zu bündeln.“ `pedi_override`: keiner. `entscheidungen`: keine. | **Nein.** Weder Warteschlange noch Archivzustand noch Nutzungsmaß (siehe „Heutiger Stand“). |
| **R-1638** (Alias ROADMAP:4.4) „Verwaiste Wissensobjekte“-Liste | „Wissensobjekte, deren Originalautor das Unternehmen verlassen hat und die seit 18+ Monaten nicht mehr bewährt wurden, landen auf einer eigenen Liste — als kuratierbarer Bestand. Verhindert die schleichende Verschmutzung der Wissensbasis.“ (`KLARWERK-Funktions-Roadmap.md:118`, undatiert) | **angedacht.** Empfehlungen vom 05.09.2026: Steuerung ES-050 „später“ (nach der Vorführung 07.09.), Codex EC-20260905-R-1638 „später“, „Priorisierung, keine Funktionsabnahme“. Hinweis im Register: „Keine neue Bauentscheidung“. `entscheidungen`: keine. | **Teilweise, auf anderem Weg.** Beide Achsen gibt es einzeln, ihre Schnittmenge als eigene Liste nicht (siehe unten). |

Die Aufnahme vom 22.09.2026 hat beide Punkte **aufgenommen** („Warteschlange und Kuratierung sind
aufgenommen“). Eine Aufnahme ist laut Nichtzielen keine Bau- oder Aktivierungsentscheidung.

## Heutiger Stand (Quelleninspektion, Basis 1.0.0-beta.1.952)

### Achse 1 · „Originalautor hat das Unternehmen verlassen“ — geliefert als Autorenübergabe

Geliefert hat das der gesonderte Auftrag `aufnahme:20260922:gesamt-aufgabenansicht:autorenuebergabe`
(Dokument `docs/aufnahme/20260922-gesamt-aufgabenansicht-autorenuebergabe.md`). Grundlage sind
Peters Entscheidungen 23 und 24 vom 11.10.2026 und Entscheidung 1 vom 12.10.2026.

- **Regel** `apps/web/src/lib/autorenuebergabe.ts` (`anstehendeUebergaben`): Jedes Wissensobjekt,
  dessen Autor
  - kein Konto mehr hat (`konto-geloescht`) oder
  - den Status „Ausgeschieden“ trägt (`ausgeschieden`, gesetzt über
    `POST /api/users/:id/ausscheiden`, `AuthService.ausscheiden`),

  erscheint als wartende Aufgabe. Dazu kommt der ausdrückliche Antrag (`angefordert`).
- **Liste** `GET /api/me/author-transfers` und `/summary`
  (`services/app/src/routes/aufgaben-zaehler-routes.ts`), nur für `users.manage`. Auf der Fläche
  „Offene Aufgaben“ (`pages/MyTasks.tsx`) ist das die Art „Autorenübergabe“ mit Filter
  `?art=authorTransfer`, Priorität „Heute“ bzw. „Kritisch“ und Absprung zum Objekt.
- **Kuratieren:** Erledigt wird die Aufgabe durch die vorhandene Übergabe `transfer-author`
  (`setAuthor`, Audit `ko.author-transferred`). `originalAuthor` bleibt erhalten.
- **Ausdrücklich ausgeschlossen** (Entscheidung 1): Inaktivität, eine bloße Sperre und ein
  abgelaufener Zugang gelten **nicht** als ausgeschieden.
- **Prüfstand:** `tests/aufgaben-ansicht/autorenuebergabe-aufgabe.test.ts`, A1 (gelöscht), A2
  (Gegenfall Befristung), A9 (Ausgeschieden), A10/A11 (Gegenfälle), A7 (Abschluss durch Übergabe).

Diese Liste ist **weiter** als R-1638: Sie führt **jedes** Objekt eines ausgeschiedenen oder
gelöschten Autors, unabhängig davon, wie lange es sich nicht bewährt hat.

### Achse 2 · „seit langem nicht mehr bewährt“ — geliefert als Frische

Geliefert hat das der gesonderte Auftrag `aufnahme:20260922:gesamt-wissen-frische` (R-0206, R-0266,
R-1636).

- **Ableitung** `services/knowledge-object/src/frische.ts`: Stufen `frisch`, `altert`, `faellig`
  und `veraltet`, gemessen an der Halbwertszeit.
  - Die Halbwertszeit ist je Kategorie aus der Bewährungs-Historie gelernt (Fassungsabstände,
    R-1636 = Roadmap 4.2).
  - Bis genug Beobachtungen vorliegen, gilt die Vorgabe je Wissensart (`HALBWERTSZEIT_TAGE`):
    Technik 180, Best Practice 365, Lernkurve 365, Negativwissen 730, Bauchgefühl 1095 Tage.
  - Bewährung im Sinn der Ableitung ist eine neue Fassung, „Noch gültig“, das Frische-Signal oder
    die Fristbestätigung des Verantwortlichen.
- **Liste** Reiter „Erneut“ (`apps/web/src/pages/Lifecycle.tsx`, `faelligeKennungen` in
  `apps/web/src/lib/frische.ts`): Geprüftes Wissen mit Stufe `faellig` oder `veraltet` steht neben
  den Merkern zum Abarbeiten. Dazu kommt die persönliche Vorlage der ältesten eigenen Beiträge
  (`aeltesteVorlage`, wöchentlich auch in der Glocke).
- **Prüfstand:** `tests/wissen-frische/oberflaeche-auswahl.test.ts` (R-0206 fällige Kennungen,
  R-0266 Vorlage) und `services/knowledge-object/src/frische.test.ts` (Stufenfolge an der
  Halbwertszeit).
- **Grenze:** Die Frische gilt nur für **geprüftes** Wissen (`status === "validiert"`). Nie geprüftes
  Wissen (Status `offen`) steht in keiner Alters- oder Fälligkeitsliste.

### Was es nicht gibt

- **Die Schnittmenge aus R-1638** („ausgeschieden **und** nicht bewährt“) als eigene Liste oder als
  Filter: Die Übergabeliste zeigt keine Frischestufe. Der Reiter „Erneut“ fragt nicht nach dem Autor.
- **Ein Nutzungsmaß je Wissensobjekt** („lange niemand genutzt“, R-0258):
  - `services/app/src/livewall.ts` zählt keine Nutzung. Er zeigt neue und validierte Objekte und
    die Ereignisse „hat geholfen“ (`answer.helpful`) samt Tageszahl.
  - Das Frische-Signal (R-0206) ist eine Bestätigung an geprüftem Wissen, keine Nutzung.
  - Aufrufe, Treffer in Suche oder Antwort werden je Objekt nicht als „zuletzt genutzt“ geführt.
- **Ein Archivzustand:** `KoStatus` ist `"offen" | "validiert"`
  (`services/knowledge-object/src/types.ts:28`). Ein Zustand „archiviert“, der ein Objekt aus Suche
  und Antworten nimmt, ohne es zu löschen, existiert nicht.
- **Der Papierkorb** ist kein Archiv. Er löscht nach `TRASH_RETENTION_DAYS = 30` Tagen endgültig
  (`services/knowledge-object/src/service.ts:350`, `runTrashSweep`; Auftrag gesamt-papierkorb).

## Die offene Geltungs- und Umfangsfrage (K1)

**Frage:** Was von R-1638 und R-0258 soll heute noch gelten, und mit welchem Maß?

Jüngste Belege:

- Streichung A5 / R-0258 am 29.08.2026: eine Priorisierungs- und Marktbelegentscheidung, keine
  Ablehnung durch den Nutzer.
- Empfehlung „später“ zu R-1638 am 05.09.2026.
- Aufnahme beider Punkte am 22.09.2026.
- Peters Entscheidungen 23 und 24 (11.10.2026) und 1 (12.10.2026) zum Wissen ausgeschiedener
  Autoren: „das wissen gehoert der firma, nicht der person“. Jedes Objekt eines gelöschten oder
  ausgeschiedenen Autors wird eine wartende Übergabe; Inaktivität zählt nicht.

Alternativen:

| | Alternative | Was gebaut würde | Was dafür entschieden sein muss |
|---|---|---|---|
| **A** | **R-1638 gilt durch die Autorenübergabe als abgedeckt; R-0258 bleibt gestrichen.** | Nichts. | Dass die weitere Übergabeliste (alle Objekte ausgeschiedener Autoren) die „kuratierbare Liste“ ersetzt und die 18-Monats-Bedingung entfällt. |
| **B** | **Schnittmenge auf vorhandenen Maßen.** Die Übergabeliste zeigt und filtert die vorhandene Frischestufe (`faellig`/`veraltet`), oder der Reiter „Erneut“ filtert nach ausgeschiedenen Autoren. | Kleine Erweiterung einer vorhandenen Liste, ohne neue Schwelle. | Dass die Frische (gelernte Halbwertszeit) das Maß „nicht mehr bewährt“ ist und nicht die 18 Monate der Roadmap. |
| **C** | **Eigene Liste nach Roadmap 4.4.** Ausgeschieden **und** seit mindestens 18 Monaten ohne Bewährung. | Neue Liste mit fester 18-Monats-Schwelle neben Übergabe und Frische. | Dass die 18 Monate gelten. Belegt sind sie nur durch die undatierte Roadmap; A5 wurde gerade wegen nicht belegter Schwellen gestrichen. Zu klären ist auch, wie sich die Liste zur Übergabeaufgabe verhält (doppelte Arbeitsliste). |
| **D** | **R-0258 reaktivieren:** Warteschlange „archivieren oder prüfen“ für nie geprüftes, lange ungenutztes Wissen. | Neues Nutzungsmaß je Objekt, ein Zustand „archiviert“ (aus Suche und Antworten heraus, wiederherstellbar) und eine Warteschlange; wahlweise mit automatischer Archivierung. | Aufhebung der Streichung A5. Außerdem: was „genutzt“ heißt (Aufruf, Treffer in Suche oder Antwort, „hat geholfen“) samt Datenschutzbewertung eines neuen Nutzungsprotokolls; die Schwelle für „lange“ (keine Quelle nennt eine); die Bedeutung von „archivieren“ (eigener Zustand oder Papierkorb, der nach 30 Tagen endgültig löscht); für eine automatische Archivierung zusätzlich ihr konkreter Geltungsumfang. |

**Noch erforderliche Entscheidung (Pedi/Peter):**

1. Zu R-1638: A, B oder C.
2. Zu R-0258: Bleibt die Streichung A5 bestehen? Wenn nicht (D), braucht es die vier Festlegungen
   aus der Tabelle. Eine **automatische** Archivierung braucht vorher einen ausdrücklich benannten
   Umfang (welche Objekte, welche Schwelle, umkehrbar oder nicht).

**Empfehlung (keine Entscheidung):**

- R-1638 nach **A** schließen, wahlweise mit **B** als kleiner Ergänzung. Peters Entscheidung 24
  geht weiter als die Roadmap: Jedes Wissen eines Ausgeschiedenen bekommt einen erreichbaren
  Verantwortlichen, nicht erst nach 18 Monaten. Eine zweite Liste mit eigener Schwelle (C) würde
  dieselben Objekte doppelt führen.
- R-0258 gestrichen lassen, bis ein Nutzungsmaß und eine Schwelle belegt sind. Ungeprüftes Wissen
  darf heute schon nicht in erzeugte Dokumente (`frische-wege.test.ts`, „GEGENPROBE: ungeprüftes
  Wissen darf nicht in Dokumente“). Ob es Suche und Antworten belastet, wie R-0258 annimmt, ist
  hier nicht gemessen.

## Was davon eindeutig bestellt ist

**Nur diese Klärung.** Für keinen Bauanteil liegt eine Entscheidung vor:

- R-0258 ist gestrichen, eine Gegenentscheidung gibt es nicht.
- Für R-1638 gibt es nur die Empfehlung „später“, und das Register sagt „Keine neue
  Bauentscheidung“.
- Die einzige konkrete Schwelle (18 Monate) ist nicht belegt. Der Auftragsumfang untersagt,
  unbelegte Schwellen zu übernehmen und ohne benannten Umfang automatisch zu archivieren.
- Der Titel des Auftrags fasst die Aufnahme zusammen, er ist keine Bauentscheidung.

Deshalb ist kein Produktcode geändert. Gebaut wird erst nach der Entscheidung oben.

## Abgrenzung zu gesonderten, bestehenden Aufträgen

| Auftrag | Was er geliefert hat | Bezug |
|---|---|---|
| `aufnahme:20260922:gesamt-aufgabenansicht:autorenuebergabe` (R-0961, Teil Autorenübergabe) | Wartende Autorenübergabe, Status „Ausgeschieden“ | Achse 1. Hier nicht verändert. |
| `aufnahme:20260922:gesamt-wissen-frische` (R-0206, R-0248, R-0266, R-1636 u. a.) | Frischestufen, gelernte Halbwertszeit, Reiter „Erneut“, persönliche Vorlage | Achse 2. Hier nicht verändert. |
| `aufnahme:20260922:gesamt-papierkorb` (R-0973 u. a.) | Papierkorb mit 30-Tage-Frist und Fristlauf, auch für Entwürfe | Der in R-0258 genannte „Papierkorb“-Baustein. Hier nicht verändert. |
| `produkt:20261007:ownership-uebergabe` | Kontoendesperre bei offener Verantwortung | Laut Autorenübergabe-Dokument (Nacharbeit 7). Hier nicht verändert. |

Alle vier Stände sind im Arbeitsbaum der Basis `81f9152d` (1.0.0-beta.1.952) enthalten. Die erste
ausgelieferte Fassung je Lieferung ist in diesem Arbeitsgang **nicht** nachgesehen; die genannten
Dokumente führen nur Kandidaten.

## Quellenwidersprüche und fehlende Belege

- **Papierkorbfrist:** R-0258 nennt „einen Papierkorb mit 28 Tagen“. Seit JOB 4327 (Pedi
  17.09.2026) sind es **30 Tage** (`TRASH_RETENTION_DAYS`; festgeschrieben in
  `tests/app/zusagen-zahlenbindung.test.ts`). Die Angabe im Register stammt vom 29.08. und ist
  überholt.
- **„Nutzungszähler (livewall.ts)“:** `livewall.ts` zählt keine Nutzung je Objekt, sondern
  Ereignisse „hat geholfen“ und deren Tageszahl. Als Baustein für „lange niemand genutzt“ trägt
  das nur, wenn „genutzt“ als „hat geholfen“ festgelegt würde. Das hat niemand entschieden.
- **Schwelle:** Die Roadmap nennt 18 Monate für R-1638. Die gelieferte Frische misst nicht in
  festen Monaten, sondern an einer Halbwertszeit je Kategorie (Vorgabe 180 bis 1095 Tage). Für
  „lange niemand genutzt“ (R-0258) nennt keine Quelle eine Zahl. Die Streichbegründung von A5 sagt
  ausdrücklich, dass die Schwellen nicht belegt sind.
- **„Welle 2 mit kleinem Aufwand“** (v1/v2) widerspricht der Streichung in v3. Der jüngere Stand
  (v3, gestrichen) gilt, bis jemand anders entscheidet.
- **R-1638:** `pruefstatus` „geprueft“, aber Zustand „angedacht“ und Belegaussage „heutige
  Erfüllung nicht erneut geprüft“. Die Herkunft (Roadmap Z. 118) ist undatiert. Der Satz im Register
  ist nur „---“; der Inhalt steht allein im Wortlaut der Herkunft.
- **Verwandter Punkt R-1922** (bei R-0258 vermerkt) liegt nicht in den Auftragsquellen. Sein Inhalt
  ist hier nicht abgeglichen.
- **`user_value` in AUFTRAG-B1.json** ist die Streichbegründung von A5, kein Nutzenversprechen.
- **„Altbestand: Einordnung offen“** (R-0258) neben dem Status **VERWORFEN**: Das Register hält
  beides fest. Eine Pedi-Auswahl zu F-0258 liegt nicht vor (`pedi_override: null`).

## Prüfung

- Dieser Arbeitsgang hat keine Tests gestartet.
- Der Prüfplan ordnet die vorhandenen Prüfstände zu, die die Aussagen zum heutigen Stand tragen:
  - Autorenübergabe: `autorenuebergabe-aufgabe.test.ts`;
  - Frische: `oberflaeche-auswahl.test.ts`, `frische.test.ts`, `frische-wege.test.ts`;
  - Papierkorbfrist: `zusagen-zahlenbindung.test.ts`.
- Ein neuer Test entsteht nicht, weil sich am Produkt nichts ändert.
