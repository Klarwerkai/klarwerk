# Word-Vergleich im Aufgabenfenster (JOB 3281) — Entwurfskopf

Dieser Text stand bis zur Aufnahme 20260922 (gesamt-bestandsblick, Nacharbeit nach Pedi-Entscheidung 4080cacc, Option A) wörtlich als Kopfkommentar des Blocks `KW-WORDVERGLEICH` im Inline-Skript von `apps/web/public/word-addin/taskpane.html`. Er ist hierher umgezogen, damit das Inline-Skript unter der unveränderten Schranke von `tests/klara-zerlegung/schnittflaechen.test.ts` B3 (12500 Zeilen) bleibt. Am Code hat sich dabei nichts geändert; die Aussagen gelten für den Block unverändert.

## JOB 3281 · WORD-VERGLEICH — DAS GANZE DOKUMENT, ABSATZ FUER ABSATZ, MIT FARBE UND BELEG

```text
PEDIS FALL (Auftrag §1): er oeffnet das Vergleichsdokument in Word und klickt „Dokument
pruefen". Klara geht Absatz fuer Absatz durch, faerbt IM DOKUMENT und listet im Panel je
Absatz die Quellen. Sie entscheidet nichts: „aehnlich" und „Widerspruch" sind Hinweise mit
Beleg, die der Mensch im Dokument sieht.

DIE VIER AUSSAGEN UND WORAN SIE HAENGEN — jede an ihrer eigenen Voraussetzung (§7 des
Zustandsmodells), keine an einer Punktzahl:

  gruen  „woertlich belegt"   Ein Quellenfund mit `coverage: "full"` UND
         (BrightGreen)        `gedeckteZeichen === passageZeichen` UND — das ist der Kern —
                              die MITGELIEFERTE Fundstelle traegt den normalisierten Absatz
                              woertlich (`wvWoertlich`). Ein hoher Trigramm-/Dublettenwert
                              fuehrt hier NIE hin: `confidence` wird in diesem Block nirgends
                              gelesen. Codex' Nachfuehrung 08.09., Punkt 1, als Code.
  gelb   „aehnlich"           Es gibt Dublettentreffer oder Quellenfunde, aber keinen
         (Yellow)             woertlichen Beleg. Die schwaechere Aussage steht da, nicht die
                              starke — auch bei `relation: "identisch"` mit 0,98.
  tuerkis „kein Fund"         NUR nach einem VOLLSTAENDIGEN Lauf: der Absatz ging ungekuerzt
         (Turquoise)          hinaus, der Bestand wurde wirklich durchsucht
                              (`quellenfund.gelaufen === true`), der Deckel hat nichts
                              abgeschnitten (`sourceHitsTruncated !== true`) — und es kam
                              nichts zurueck. Fehlt eine dieser Voraussetzungen, gibt es
                              KEINE Farbe und einen Grund. Kein pauschales Blau.
                              DER SATZ SAGT „im durchsuchten Bestand", nicht „nirgends": die
                              Kandidatenwahl der Route ist gedeckelt und behauptet keine
                              Vollstaendigkeit (check-text-routes.ts, `includeUnvalidated`).
  rot    „Widerspruch"        Die Antwort traegt einen Konflikttreffer mit einem BENANNTEN
         (Red)                Konflikttyp (`KA7_KONFLIKT_TYPEN`; Doppelungstypen zaehlen als
                              Aehnlichkeit, nicht als Widerspruch). Der belegte Satz aus der
                              Quelle (`stellen.quelle`) steht daneben.

OHNE FARBE ist eine eigene, ehrliche Lage und kein Rest: zu kurz, gekuerzt, nicht durchsucht,
Deckel, Fehler — jede mit ihrem Grund in der Liste.

DER WIDERSPRUCHSZWEIG KOSTET EINEN TEXTABFLUSS, UND DEN ENTSCHEIDET NICHT DIESER BLOCK.
`conflicts` entsteht serverseitig nur im tiefen, nicht vertraulichen Zweig
(`want: "deep"`, check-text-routes.ts `deepAllowed`). Das ist der Gang an die externe KI und
braucht Pedis Weiche je Dokument (Werkstattbeschluss 18.08., KA4). Dieser Block liest sie
ueber `ka7ExterneKi()` — dieselbe eine Stelle, die KA7 dafuer gebaut hat, kein zweiter
Riegel. Ohne Einwilligung geht `want` NICHT hinaus, Rot kann konstruktiv nicht entstehen,
und das Fenster sagt genau das (`wvKiFehlt`) — statt „kein Widerspruch" zu behaupten.

EIN WEG ZUR ROUTE, KEIN ZWEITER. Der Abruf laeuft durch `w6DublettenAusCheckText` (Block
KW-KLARA-W6-CHECKTEXT), denselben Uebersetzer, den die Erfassen- und die Bestandsflaeche
benutzen: dieselbe Sitzung, derselbe Rumpf (`source: "transient-document"`,
`nichtEingestuft: true`), dieselben Grenzen (40 / 8.000 Zeichen), dieselbe Kuerzungsauskunft.
Es kommt KEINE neue `fetch(`-Stelle und KEIN neues Abrufziel dazu (mega69-klara-merkmale
M6/M7 bleiben unberuehrt). Was `wvUmschlag` am hereingereichten `fetchFn` tut, ist zweierlei
und gehoert genau hierher, nicht in den W6-Vertrag:
  · es setzt `want: "deep"` in den Rumpf, WENN die Weiche oben es erlaubt;
  · es hoert die Antwort EINMAL mit, weil `conflicts`/`konfliktpruefung` im selben Rumpf
    stehen und W6 nur `duplicates`/`sourceHits` uebersetzt. `json()` wird dabei genau einmal
    gelesen und das Ergebnis beiden Lesern gegeben (ein zweites `res.json()` wuerde an einer
    echten Antwort werfen).

GESCHRIEBEN WIRD NICHTS. Kein `insertText`, kein `insertHtml`, kein
`setSelectedDataAsync` — der Block setzt ausschliesslich `font.highlightColor` und ruft
`range.select()`. `tests/app/word-addin-wortvergleich.test.ts` V2 haelt das an den
ausgelieferten Bytes fest, nicht nur an einem Ablauf.

DIE MERKLISTE HAENGT AM VORKOMMEN, NICHT AN DER ABSATZNUMMER (Codex 08.09., Punkt 3+4):
  · Ein Posten ist (TEXT-HASH + VORKOMMEN `vk`), nicht der Hash allein. Zwei woertlich
    gleiche Absaetze sind ZWEI Posten und zwei Stellen im Dokument. Der Hash allein war der
    Fehler der Runde 1 (Ben 08.09.): er fasste beide zu einem Posten zusammen, liess nach der
    Ruecknahme den zweiten gefaerbt stehen, sprang immer zum ersten — und ueberschrieb beim
    Faerben die fremde Hervorhebung des ersten Vorkommens, obwohl der Auftrag dem zweiten galt.
    Die Absatznummer taugt als Identitaet nicht: sie verschiebt sich beim Bearbeiten. `vk`
    zaehlt je Wortlaut und verschiebt sich nur, wenn ein GLEICHER Absatz davor wegfaellt —
    dann greift der zweite Durchgang von `wvZuordnen`.
  · Vor dem Faerben wird die URSPRUNGSFARBE jedes Absatzes festgehalten. Traegt ein Absatz
    schon eine FREMDE Hervorhebung, wird er NICHT ueberfaerbt — er wird nur eingestuft, mit
    Hinweis. Fremde Arbeit geht nicht verloren. Geprueft wird das ZWEIMAL: beim Lesen und
    noch einmal unmittelbar vor dem Schreiben, denn zwischen beidem kann ein Mensch faerben.
  · „Markierungen entfernen" stellt die Ursprungsfarbe wieder her, nicht „keine Farbe" — und
    nur dort, wo JETZT noch genau die Farbe steht, die Klara gesetzt hat. Hat ein Mensch
    seither umgefaerbt, bleibt seine Farbe stehen und die Zahl sagt es.
  · Ein zweiter Lauf uebernimmt die Ursprungsfarbe aus der Merkliste und nicht das, was er
    im Dokument vorfindet — sonst merkte sich Klara ihre eigene Farbe als Ursprung.
  · Verschiebt sich ein Absatz, findet der Hash ihn wieder. Aendert sich sein Text, wird
    NICHTS blind entfaerbt: der Posten bleibt stehen und wird als „veraendert" gemeldet.
  · Gemerkt wird ERST NACH dem erfolgreichen Schreiblauf. Scheitert er, steht keine Farbe im
    Dokument — dann darf das Panel auch keine Ruecknahme dafuer anbieten.

WIEDEROEFFNEN: die Farben gehoeren ab dem Speichern Word, nicht Klara — sie bleiben von
selbst. Das Panel haelt NICHTS ueber ein Fenster hinaus (kein localStorage, kein Cookie);
in der Ruhe steht deshalb `wvRuhe` — der Satz, der genau das sagt, statt eine Liste
vorzutaeuschen, die niemand mehr belegen kann.
```
