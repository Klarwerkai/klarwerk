# Prüfarchiv · ben-Runden sammel26–44 im Repository

Auftrag `aufnahme:20260922:gesamt-pruefarchiv`, Revision 1. Einziger zugeordneter Originalpunkt:
**R-2042** (Alias `OFFEN:I5`, `OFFEN.md:417`).

- **Stand dieses Dokuments:** Nacharbeit 5 vom 13.10.2026 am Kandidaten `1e67914f`, Basis
  `2a96bab2c` (1.0.0-beta.1.973). Die Zeilennummern der Fundstellen gelten für diesen Stand.
- **Die Berichte selbst** liegen unverändert unter `docs/qm/pruefarchiv/berichte/`: 32 Dateien mit
  den Originalnamen.
- **Prüfstand:** `tests/pruefarchiv/sammel26-44-verankert.test.ts`. Er hält Folgendes fest:
  - jede Kopie ist byte-gleich zum Original (SHA-256 aus der Quellenhilfe);
  - je Bericht steht genau eine Tabellenzeile;
  - Gesamtverdikt und Inhalts-SHA der Tabelle sind die, die der Bericht selbst nennt;
  - die Inhalts-SHA rechnet er über den Berichtstext nach;
  - jede Fundstelle im Code nennt ihre Runde.
- **Lieferbeleg:** Die Fassung, mit der dieses Dokument ausgeliefert wird, entsteht erst mit der
  Veröffentlichung und steht hier deshalb noch nicht.

## Was I5 sagt und was davon heute gilt

I5 lautet: „Die Verdikte sammel45–54 und die Ship-Kette dieses Tages sind in SCRUM-469 verankert,
mit Inhalts-SHA je Runde und der Fehlerklasse, die sich durch fünf Runden zieht“. Als Grund nennt I5:
`_relay/` steht in `.gitignore` und reist mit keinem Klon mit. Und: „Die älteren Runden sammel26–44
stehen weiterhin aus.“

**Heute gesichert:** alle 32 Originalberichte zu sammel26–44 im Repository, außerhalb von `_relay/`.
Damit reisen sie mit jedem Klon mit.

Herkunft der Kopien:

- Die Originale liegen in `_relay/ben/outbox/` des Entwicklungsrechners.
- Die Quellenhilfe `QUELLEN-HILFE-09a427-ORIGINALBERICHTE.json` (13.10.2026) hat sie mit Bytes,
  Zeilen und SHA-256 erfasst.
- Die technische Übergabe `QUELLEN-HILFE-62bf2d-UEBERGABE.json` (13.10.2026, Nacharbeit 5) hat sie
  byte-gleich in den Auftragsordner gelegt. Von dort hat diese Bahn sie mit `cp` übernommen.
- Der Prüfstand rechnet jede Kopie gegen die Hashes der Quellenhilfe nach.

**Berichtigte frühere Fassungen:**

- Nacharbeit 0 nannte die Berichte „nicht lesbar“. Nacharbeit 1–4 führten nur Dateinamen und Hashes,
  weil die schreibende Bahn `_relay/` nicht lesen durfte.
- Beides ist mit der Übergabe überholt.
- Verdikte, Basis und Befunde unten stammen jetzt aus den Berichtstexten, nicht mehr nur aus
  Codekommentaren.

**Geheimnisprüfung vor dem Übernehmen:**

- Ich habe nach privaten Schlüsseln, Provider-Tokens, JWT, Bearer-Werten, URL-Zugangsdaten,
  Kennwort- und Schlüsselzuweisungen sowie E-Mail-Adressen gesucht. Es gab keinen Treffer. Vier
  Mustertreffer auf `sk-` waren Testpfade (`tests/ask/ask-…`).
- Enthalten sind lokale Repository-Pfade der Form `/Users/…/dev_Klarwerk`. Sie sind kein Geheimnis,
  stehen auch in den Auftragsquellen und bleiben stehen, weil die Kopie byte-gleich sein muss.
- Eine Musterprüfung garantiert nicht, dass kein Geheimnis in anderer Form enthalten ist.

## Zwei Berichtsreihen mit denselben Nummern

- **Reihe A** sind die Gegenprüfungen der mega-Aufträge, `BERICHT-ben-sammelNN-megaMM.md`,
  sammel26–44. Geprüft wurde der kumulative Arbeitsstand auf `d3fe69d`, später auf `5150cd5` und
  `93c6bd9`.
- **Reihe B** sind die Abnahme- und Recheck-Berichte zu Ship 8, `BERICHT-sammelNN.md`, sammel26–38.
  Geprüft wurden Patchketten (`patches57` ff.) auf der Ship-7-Basis `2727b7e`.
- Die Nummern 26–38 kommen deshalb zweimal vor. Jede Zeile trägt Reihe **und** Runde als Kennung
  (`A-sammel34`, `B-sammel34`). Kein Bericht verdrängt einen anderen.

## Spalten

- **Basis:** HEAD bzw. Baseline, die der Bericht nennt. Bei Reihe A war das Prüfobjekt der
  kumulative Diff darauf, bei Reihe B die Patchkette.
- **Gesamtverdikt:** wörtlich aus dem Bericht (dort `GRUEN` geschrieben, hier GRÜN).
- **Kernbefund:** knapp aus Kurzurteil, Kurzfazit oder den Findings des Berichts. Maßgeblich ist der
  Bericht.
- **Fundstellen:** Stellen im heutigen Code, die die Runde nennen. „keine Fundstelle im Code“ heißt:
  Der Bericht ist nur hier archiviert.
- **Datei-SHA-256:** über die ganze Datei, aus der Quellenhilfe.
- **Inhalts-SHA:** die SHA-256, die ben in der letzten Zeile des Berichts angibt, über den Inhalt
  oberhalb dieser Zeile. Der Prüfstand rechnet sie nach.

## Reihe A · Gegenprüfungen der mega-Aufträge (19 Berichte)

| Kennung | Originaldatei | Gegenstand | Basis | Gesamtverdikt | Kernbefund laut Bericht | Folgearbeit | Fundstellen | Datei-SHA-256 | Inhalts-SHA | Zeilen | Bytes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A-sammel26 | `BERICHT-ben-sammel26-mega26.md` | mega26 | `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e` | GELB | Kein Ship-Blocker. ModelRun-Protokoll unvollständig; ein Jahresring-Lauf über 12.480 KOs braucht vorher ein Mengen-, Kosten- und Betriebs-Gate. | eigener Schnitt (Protokoll, Skalierung) | keine Fundstelle im Code | `9b88c55954342416a2324c01d070baf0622ff3c0c1e0332b830b346742588271` | `4711e4cf08fc2e89e02d169885e785213b22dda096ba419f257dfa6a283e637d` | 208 | 11225 |
| A-sammel27 | `BERICHT-ben-sammel27-mega27.md` | mega27 | `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e` | GELB | Bulk-JSON-Import von 12.480 KOs löst null Modell-, Embedder- und AI-Worker-Aufrufe aus; damit auch null automatische Duplikat- und Konfliktprüfung. Das muss die Jahresring-Entscheidung ausdrücklich tragen. | Jahresring-Entscheidung | keine Fundstelle im Code | `dd0a931ae9f54fffda8f6230f8b76ac7228a7e936ca6a0179eec5ff2bddb0193` | `748f3ea97d3e6ffd502251da5372fef554525b561ed4dfe37b02855444801192` | 297 | 12922 |
| A-sammel28 | `BERICHT-ben-sammel28-mega28.md` | mega28, `patches139` | `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e` | ROT | `examined` zählt vorab ausgewählte statt geprüfte Paare; die Import-Accept-Kante schreibt `done`, obwohl die alte Fassade `null` lieferte; die Abdeckungskennzeichnung fehlt außerhalb des Validation-Badges. | mega29 | keine Fundstelle im Code | `caf3c55ddd5ff19440486f241bf263a918e1c40cdf272d09078d0315b4e823ea` | `374b58a375ca72c0372074e867329a87099d4012e723862f7913e94526923f82` | 368 | 17429 |
| A-sammel29 | `BERICHT-ben-sammel29-mega29.md` | mega29 | `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e` | ROT | Strukturierte Modellfehler zählen in der Coverage als `completed`; die Bestandszusammenfassung wertet den Laufstatus nicht aus. | mega31 | keine Fundstelle im Code | `ec2b8e4fb32430d93740f1fc662533fcff68829f315ec4debdc48b8be4e8cb20` | `6b3b2ffe678a1e8abd186bf06d99e49a85d3b7b8df72a5eedafe73f744069aa1` | 366 | 16014 |
| A-sammel30 | `BERICHT-ben-sammel30-mega31.md` | mega31 | `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e` | GELB | ROT-Ursachen aus sammel28/29 im Kern geschlossen: nur ein nicht-null Urteil zählt als abgeschlossen, `failed` und `pending` zählen als unvollständig. Auflagen bleiben. | mega32 | keine Fundstelle im Code | `d4781b9d5b9437152b2e73128061e5796fecdf8ec71a010a8eb9bfc568cdd612` | `fb29a4beeca85182e15cda41a98d40c8f6cf9e89383262c156c0f6b3dbb365e5` | 279 | 13015 |
| A-sammel31 | `BERICHT-ben-sammel31-mega32.md` | mega32 | `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e` | ROT | Health-Score belohnt unbelegte Erkennung; der Paritätstest ist nicht erschöpfend; die Ask-Seite zeigt unter dem herabgestuften Kasten und im Export weiter „Gesichert“. | mega33 (nach Lesart) | keine Fundstelle im Code | `5e7891be6596ab6ffe120742ea8abafca47eb59e901ebf5e5d0e22ce6ddbc754` | `ce83a7d2befd9c020273a0eec5dd006fb6cb63db984038475dacfaa815867973` | 333 | 14866 |
| A-sammel32 | `BERICHT-ben-sammel32-mega33.md` | mega33 | `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e` | ROT | ROT-1: Ein unbekannter Konfliktstatus wird fail-open zu „konfliktfrei“ (`conflicts.data ?? []`). ROT-2: Word/Klara ist eine Lesefläche ohne Einstufung. ROT-3: „Gesichert“ hat zwei nicht trennbare Bedeutungen. | mega34 Block A | `tests/ask/mega34-konfliktstand-pflichtsignal.test.tsx:3` | `990d8e9f8df1af049ff4bb94f6e0dafe8b2f09d1efc7653743a893ff65bc0f19` | `31d352068ebfc34b912c049777c14815faf0aa1fb5cf0f980fb36f9555695178` | 318 | 13452 |
| A-sammel33 | `BERICHT-ben-sammel33-mega34.md` | mega34 | `d3fe69d` (Kurzform im Bericht) | ROT | Zwei der drei ROT aus sammel32 geschlossen. Offen: Der Word-Kopier-/Einfügeweg kann eine vor Ende der Quellenauflösung bearbeitete Antwort ohne Einstufung und Quelle ausgeben. | mega35 | keine Fundstelle im Code | `081a0f92d84ce4c8a0582acfe2c163fe181a2eb3e4dd5372e589cd936959784f` | `6ef542ff3662eccf3382688f15d2c60223201eedf09c1c2d40ef52290cc65be5` | 539 | 23266 |
| A-sammel34 | `BERICHT-ben-sammel34-mega35.md` | mega35, `patches146` | `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e` | ROT | Nativer Kopierzugriff per Cmd+C und Kontextmenü kopiert nur den Antwortkörper ohne Einstufung und Quellenzeile; ein direkter Bypass der zentralen Zusage. | mega36 Block E (Kontextmenü bleibt Handprüfung) | `tests-smoke/word-taskpane-kopieren.spec.ts:5` | `a4596fed2b64e50addbf9b81936244d8ea6bba34147863de2c06287ff4488156` | `5a9c7cea194a579f3a789a9d546056b6afde296d5eb8d9014cf3fccee30d710e` | 266 | 12490 |
| A-sammel35 | `BERICHT-ben-sammel35-mega36.md` | mega36, `patches147` | `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e` | ROT | ROT-1: Native Ausgänge (Kopieren, Ausschneiden, Ziehen) umgehen das Quellenauflösungs-Gate; vor dem Ende der Auflösung trägt die Ausgabe den generischen Titel `KLARWERK`. | mega37 | keine Fundstelle im Code | `1554f5640553f105e027941b1c5eabe231e64d44e9423fde31eccd429434ee6f` | `0f67319f36de8f41b68ae3f879c0fd38d42da1ada79bbcfc2ed21f71e3213435` | 328 | 14615 |
| A-sammel36 | `BERICHT-ben-sammel36-mega37.md` | mega37 | `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e` | ROT | Der ROT aus sammel35 ist für Copy, Cut und Drag geschlossen; drei Stopper bleiben, darunter: `/fragen` scrollt nicht zum Ergebnis und zeigt dort keinen Ladezustand. | mega38 | keine Fundstelle im Code | `88265d8bb2abe9f135ceb2aa96787648f7e33300620f944f27de2d1db02036c1` | `b76a90c2eb448482da7fc70252e6317d08983e284eca3580e30bc76260c7359c` | 372 | 16173 |
| A-sammel37 | `BERICHT-ben-sammel37-mega38.md` | mega38 | `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e` | ROT | A: Arbeitsliste mit eigener Rollentabelle statt derselben Quelle; C: nach einem Fehler stand die Antwort der alten Frage; D2: zweite Schrittliste ohne Aussage; E1: `apps/web/package-lock.json` fehlte in der dist-Frische; Topbar-Chips aus mega38 Block H als rohe `Link`s ohne `guard()`. | mega39 Blöcke A, C, D2, E1 | `apps/web/src/lib/workCenter.ts:69`, `apps/web/src/pages/Ask.tsx:1013`, `apps/web/src/lib/askSteps.ts:2`, `scripts/dist-frische.ts:94`, `tests/ask/mega39-fehler-ohne-fremde-antwort.test.tsx:6`, `tests/app/mega39-topbar-chips-guarded-mounted.test.tsx:6` | `8b2de56c085a82ed76c9bf7a981aba164016cf3e87712cf233d1cdde0181b79f` | `b520f17c5b630c9ea29ae75974ded5144dc861616bdeebfd9a66dadf5bfb069d` | 458 | 20521 |
| A-sammel38 | `BERICHT-ben-sammel38-mega39.md` | mega39 | `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e` | GRÜN | Alle Blöcke grün: `WORK_ROLES` entfernt, Betriebs-Pills geführt, `onMutate` leert das alte Ergebnis, Schrittregel exakt, Lockfile in `QUELL_PFADE`. | — | keine Fundstelle im Code | `6b575828b6551a2692161cce9655fab8cc5ed7560644ee53434eac36f74c3645` | `e9f5bd3e48c2765d73c35ec86ab09debc860cad8c180d480bc254634d1ca4ba1` | 347 | 16312 |
| A-sammel39 | `BERICHT-ben-sammel39-mega40.md` | mega40 | `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e` | GELB | Weiß auf Funke `#E8630A` (3,38:1) ist fälschlich als rein grafisch behandelt, trägt im Produkt aber kleine Texte. Eine eng begrenzte Auflage vor der Auslieferung. | mega41 Block A | `apps/web/src/styles/modern.css:59`, `tests/app/mega40-kontrast-modern.test.ts:8` | `76b16b95712ae4bc9173bddb1cf9ed39c882ba154e7a13c60291f483f80e4f96` | `37a775c29d7a6e271113d27500ac81dd274aa178ac9eee123d9fbc792d7767b7` | 205 | 11095 |
| A-sammel40 | `BERICHT-ben-sammel40-mega41.md` | mega41, Kontrastfix | `d3fe69d` plus kumulativer Arbeitsstand mega26–mega41 | GELB | `opacity: 1` auf Fläche und `*` ist zu grob, `hover:opacity-95` am Filterknopf bleibt wirkungslos; die Reihenfolge der Badge-Regel hält kein Test fest. | mega42 Blöcke A und B | `apps/web/src/styles/modern.css:92`, `tests/app/mega40-kontrast-modern.test.ts:1009`, `tests/app/mega40-kontrast-modern.test.ts:1075` | `d5e047b95b55f1a6e81553807bfbc1b190a72f036f495be3bdb75abbc3178985` | `08dbbb370d8f02ea360bcdf32fada81029011533c04f27d41e62c704d5e2f447` | 234 | 13660 |
| A-sammel41 | `BERICHT-ben-sammel41-mega42.md` | mega42, zwei Restpunkte | `d3fe69d` plus kumulativer Arbeitsstand mega26–mega42 | GRÜN | Beide GELB-Punkte aus sammel40 geschlossen; die verschachtelte Badge-Probe wird bei vertauschter Reihenfolge rot. Die Grenzen des Bauformwächters sind kein Ship-Blocker. | — | keine Fundstelle im Code | `8f742efc2475ff3a9e3a18b39e78733a26f52ad2a37e11d8970e3f74c3128e49` | `ce3ae5b5c44357498bde8cd28fac4cc1b5af037deca612bb51328438ed9a72bc` | 220 | 11845 |
| A-sammel42 | `BERICHT-ben-sammel42-mega43.md` | mega43, Klara im Werkbank-Design | `5150cd5a0e4a6c6bb5e2fe3fdce8a02329bb7af5` | GELB | Drei als dauerhaft beschriebene Wächter sind enger als ihr Anspruch (G1 Alpha, G2 Paarabdeckung, G3 Violett); Punkt 5: inaktive Knöpfe. Der heutige Stand selbst ist konsistent. | mega44 | `tests/app/mega43-klara-werkbank-palette.test.ts:3`, `tests/app/mega43-klara-werkbank-palette.test.ts:386` | `12826673db3977cd166267222ded2edb38cfa06337236ca6da7f5fa37dcf47fb` | `ff288b2e2ae080991524be8f02a49bfedd64cba75ca44abdc9447e9e1333d193` | 282 | 13866 |
| A-sammel43 | `BERICHT-ben-sammel43-mega44.md` | mega44, drei Wächter-Auflagen | `5150cd5a0e4a6c6bb5e2fe3fdce8a02329bb7af5` | GELB | G2 nicht geschlossen; G1 und die Inlinegrenze nur teilweise. Dazu Überbehauptungen in den Kommentaren des Palettensammlers. | mega45 Block G | `tests/app/mega43-klara-werkbank-palette.test.ts:55` | `f513bae978472476c8d1ea301afb0d0a08ba6de574d894515692429bfbe01d52` | `abb43da55b418a717eb31749de1f0dfdbe9d12a44c0bf369e3d81cae46060056` | 357 | 17039 |
| A-sammel44 | `BERICHT-ben-sammel44-mega45-46.md` | mega45 und mega46 | `93c6bd9a0a31eec0f91792e310cf54d2b15b7fc6` | ROT | Ship-Blocker: Das mobile Filterblatt liegt in dem DOM-Knoten, den `FacetFilter` beim Öffnen auf `inert` setzt; Dialog und Schließen sind im Browser nicht bedienbar. Zweiter Befund, kein Blocker: `mineEmpty` aus der facettierten Endmenge. | mega47 Blöcke B, C1 und D | `tests-smoke/ui-smoke.spec.ts:376`, `tests/app/mega47-modale-flaechen-sammler.test.tsx:6`, `tests/app/mega47-persoenlicher-leerzustand.test.tsx:4` | `4987ef5371b46ff4eb871a3b6c1924d7d71765edb6654e63e1c6607e53e60337` | `adfee50a64aefdbaa3b5a12ff9297bcf6f1b403d7199760e66f76b3b768c9aad` | 294 | 15936 |

## Reihe B · Ship-8-Abnahme und Rechecks (13 Berichte)

| Kennung | Originaldatei | Gegenstand | Basis | Gesamtverdikt | Kernbefund laut Bericht | Folgearbeit | Fundstellen | Datei-SHA-256 | Inhalts-SHA | Zeilen | Bytes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| B-sammel26 | `BERICHT-sammel26.md` | Konsolidierte Ship-8-Abnahme, `patches57`–`71` | `2727b7e84d4a42056f0641174ac693121200ebbb` (Ship 7) | ROT | aiCheck kann reale Providerfehler weiter als `done` abschließen; Cleanup kann einen parallel angenommenen Importkandidaten löschen. | Patch 74 (laut B-sammel29) | keine Fundstelle im Code | `b3ebb279ea332d3c23f2e40e6f883bb8c746ba623bd263fe566fa4628202a6ea` | `0e22a5e64b04b2a07ce951ebb59799a3be8c344a12fab933ebe076531b7810d1` | 197 | 17912 |
| B-sammel27 | `BERICHT-sammel27.md` | Cockpit-Linie, Patch 72 | `2727b7e84d4a42056f0641174ac693121200ebbb` (Ship 7) | ROT | Stepper: Schritt 5 wird auf dem Erfolgsweg nie aktiv; der monotone Context setzt falsche Erledigt-Haken. | Patch 75 | keine Fundstelle im Code | `9f9f6b5e3e58adfb50a5ec6fe9a55a707d8b7d13cd39d72a6cd83dc909af1e67` | `975caae6c769cb67cef18c4d81d49024b3d7afb1a6fe0ca412a040b5edf94030` | 158 | 12981 |
| B-sammel28 | `BERICHT-sammel28.md` | UX-WOW-1, Patch 73 | `2727b7e84d4a42056f0641174ac693121200ebbb` | ROT | Vertrauliche validierte KO-Titel gelangen als Direktfrage in den cloud-fähigen Ask-Pfad; Kante im U8-Guard (`lastEmittedRef`). | Patch 76 | keine Fundstelle im Code | `474b112d7f7b5530277e28a515c8b300ec716f218d1279e669c17bfa4be96bce` | `e43931d406649a537eb186ba656854860fe78e4c190e15a0d1d5c917b6936050` | 152 | 11241 |
| B-sammel29 | `BERICHT-sammel29.md` | Finaler Recheck Ship 8, `patches57`–`76` | `2727b7e84d4a42056f0641174ac693121200ebbb` (Ship 7) | ROT | Cleanup kann einen bereits laufenden Accept verlieren; die Queue-Eviction fällt auf einen ungebundenen Write zurück; Erledigt-Haken nach fehlgeschlagenem Apply. | Patch 77 | keine Fundstelle im Code | `e73d53334265136bbcdd600b23945cfd4370059b2293740e37e30f524934fe70` | `246388f4c33bbd625249de6d7426b68f3b7a99ded56fb5129a95825b8774b041` | 130 | 14594 |
| B-sammel30 | `BERICHT-sammel30.md` | Finaler Recheck 2 Ship 8, `patches57`–`77` | `2727b7e84d4a42056f0641174ac693121200ebbb` | ROT | Der neue Status `in_bearbeitung` kann nach einem Prozessabbruch dauerhaft hängen; während eines Claims kann ein zweiter offener Kandidat derselben Quelle entstehen. | Patch 78 | keine Fundstelle im Code | `6fd88aace14db90e35c734a588b0c326d7e97080e236021c428c6b57d69e1592` | `009329a7ccdb8fe975239ec46d90e358b62efcd6c072897a8dbbc4a7c964bebc` | 86 | 9400 |
| B-sammel31 | `BERICHT-sammel31.md` | Finaler Recheck 3 Ship 8, `patches57`–`78` | `2727b7e84d4a42056f0641174ac693121200ebbb` | ROT | Lease- und opId-Vertrag nicht crash-sicher: drei Interleavings können ein KO vom Kandidaten entkoppeln oder einen Doppel-KO-Retry ermöglichen. | Patch 79 | keine Fundstelle im Code | `85f9266cc3fe09985b5f2b5a41e7521e9feceaf32129ec695c679c675edbdccb` | `aeddee0f62ccf0c5c49c076fe978af247e9dcce31e1f3ec7e334b1ad1b49b9d4` | 108 | 12310 |
| B-sammel32 | `BERICHT-sammel32.md` | Finaler Recheck 4 Ship 8, `patches57`–`79` | `2727b7e84d4a42056f0641174ac693121200ebbb` | ROT | Adoption nach einem create-Fehler lässt den Version-1-Snapshot und den `ko.created`-Auditbeleg fehlen; der Test belegt nur „genau ein KO“. | Patch 80 | keine Fundstelle im Code | `097b2882dc37184bcea3f1b30d8f5e639b8b644c3f9a47edc2dce2c679116dbb` | `6a91cd1f74a005e155b0d0cee3c05df4bf6334e84b336dde49a04091e1d3dfff` | 140 | 12751 |
| B-sammel33 | `BERICHT-sammel33.md` | Finaler Recheck 5 Ship 8, `patches57`–`80` | `2727b7e84d4a42056f0641174ac693121200ebbb` | ROT | `ko.created` ist unter Konkurrenz nicht idempotent; der externalId-Re-Sync kann ein fremdes teilpersistiertes KO ohne Create-Belege übernehmen; der Review-Aktionsbeleg ist verlierbar. | WP-SHIP8-CLOSE-6 (Patch 81) | `tests/app/review-claim-recovery.test.ts:643` | `38eeb4a246339b2fb649d077789b5f9812ef2902779fae5923beed50bf6d60ec` | `021c8eb5c3a0a6f5ec57e6b64d8af60096c6c86a945ca15942d65378536eb9e1` | 155 | 13633 |
| B-sammel34 | `BERICHT-sammel34.md` | Finaler Recheck 6 Ship 8, `patches57`–`81` | `2727b7e84d4a42056f0641174ac693121200ebbb` | ROT | `auditPending` reist nicht im Endstatus-CAS mit, ein Absturz verliert Aktionsaudit und Retry-Marker; die Crash-Recovery schreibt `reviewedBy: "system"` und verliert den menschlichen Reviewer. | WP-SHIP8-CLOSE-7 (Patch 82) | `tests/app/review-claim-recovery.test.ts:849` | `7f5265b18a75613af5c51ecddd0ad22f84d5b2b4e35e96bb61544e45b8a8278c` | `bd58c405bd6eac1974f26414dc3f1ac98655901f76da6a2c556b640dab1fc771` | 159 | 14780 |
| B-sammel35 | `BERICHT-sammel35.md` | Finaler Recheck 7 Ship 8, `patches57`–`82` | `2727b7e84d4a42056f0641174ac693121200ebbb` | ROT | Der bestätigte Admin-Import-Cleanup löscht terminale Kandidaten mit `auditPending`, samt Marker und Rekonstruktionsdaten. | Patch 83 | keine Fundstelle im Code | `952f9d48564ed475d927cdf78a859690e8b660c29171863e895120070d8aefd6` | `f5a2d9c6708d7bb8eb8e2b452d6bef7367f10f0bcf296ed10c958116cd09e22b` | 145 | 14105 |
| B-sammel36 | `BERICHT-sammel36.md` | Finaler Recheck 8 Ship 8, `patches57`–`83` | `2727b7e84d4a42056f0641174ac693121200ebbb` | GELB | Bedingtes GO. `runImportCleanup` ruft den Audit-Retry vor der Digest-Prüfung auf und kann so vor `CLEANUP_DRIFT` schreiben; eng begrenzte Vor-Ship-Korrektur. | Patch 84 | keine Fundstelle im Code | `f66e4d0b14e04b20572b9b3bb48825faa1f0a32a434b95fa15d5ff09719d0c8f` | `b43de8a1cc7f356bb762b2ac8b1b9b5a3a899badb187dda70bf43b9ee7813656` | 150 | 14181 |
| B-sammel37 | `BERICHT-sammel37.md` | Finaler Recheck Ship 8 CLOSE-9, `patches57`–`84` | `2727b7e84d4a42056f0641174ac693121200ebbb` | GRÜN | GO für Ship 8. Patch 84 setzt beide Vor-Ship-Auflagen aus sammel36 eng und korrekt um. | Ship 8 | keine Fundstelle im Code | `346aec4969199e8741693b4b350e5e28170838f75ba0339474243cdad803ee9a` | `486c4001b1be13070316db5b5e6ea40936a5c66f28cf0c3611a614932a3377f9` | 132 | 9886 |
| B-sammel38 | `BERICHT-sammel38.md` | Post-Ship-Kurzcheck, Patch 85 | `bb69aa399f613e82eb6834c9a82df9724d22ac74` | GRÜN | Patch 85 ist rein testseitig (`vitest.integration.config.ts`); die live deployte Kette 57–85 entspricht dem Ship-GO. | — | keine Fundstelle im Code | `991e19e350122078d6bb959f58d00a4c2d0dcb39ebd8021cf77763d66dae8f6a` | `db20ec3cd8d750388e43bafd2cef4b2d0ca3f209182f3c56a3b2542f97327fa5` | 22 | 1646 |

**Zählung:** 32 Berichte, 19 in Reihe A und 13 in Reihe B. Jeder hat einen Datei-SHA-256, eine
Inhalts-SHA aus seiner Markerzeile und ein Gesamtverdikt aus seinem Text. 10
Berichte haben versionierte Fundstellen: 8 in Reihe A (sammel32, 34, 37, 39, 40, 42, 43, 44) und 2
in Reihe B (sammel33, 34). Die übrigen 22 sind nur über ihre Kopie hier verankert. (Die Fassung aus
Nacharbeit 1 nannte hier „11“; das war falsch, BEN Nacharbeit 2.)

**Verdikte:** Reihe A hat 2 GRÜN, 7 GELB und 10 ROT. Reihe B hat 2 GRÜN, 1 GELB und 10 ROT; die
Kette endet mit GO für Ship 8 (B-sammel37) und dem Post-Ship-Check (B-sammel38).

**Inhalts-SHA nachgerechnet (Prüflauf Nacharbeit 6, Kandidat `81a9e91a`):** Bei 31 von 32
Berichten stimmt die SHA-256 der Markerzeile mit den Bytes oberhalb überein.

**Markerzeile nicht reproduzierbar:** B-sammel29.

- Die Kopie ist byte-gleich zum Original: Datei-SHA-256 `e73d5333…` wie in der Quellenhilfe.
- Die Markerzeile hat dasselbe Format wie B-sammel26 bis 28, deren Werte sich nachrechnen lassen.
- Die von ben angegebene Inhalts-SHA `246388f4…b041` passt damit nicht zum archivierten Text.
- Warum, sagt der Bericht nicht, etwa ob nach dem Hashen noch geändert wurde. Es wird hier auch
  nicht vermutet.
- Die Tabelle führt den angegebenen Wert unverändert. Er ist eine Aussage des Berichts, kein
  bestätigter Hash.

Der Prüfstand verlangt, dass diese Liste genau den nicht nachrechenbaren Berichten entspricht.

**Sicherungsstand: 32 von 32 Berichtstexten liegen im Repository.** Diese Zahl ist nicht frei
geschrieben. Der Prüfstand zählt die Dateien in `docs/qm/pruefarchiv/berichte/` und verlangt, dass
diese Zeile genau diese Zahl nennt. Jede dort liegende Datei muss Namen und SHA-256 eines der 32
Berichte tragen. Eine fremde oder veränderte Datei ist rot.

**Wiederkehrende Fehlerklasse (Lesart der Berichte, kein Wortlaut von ben):**

- **Reihe A:** Eine Aussage reicht weiter als ihr Beleg.
  - Coverage und „geprüft“ zählen Läufe ohne inhaltliches Urteil (A-sammel28 bis 31).
  - „Gesichert“ und „konfliktfrei“ stehen ohne gesicherten Stand (A-sammel31, 32).
  - Ausgabewege in Word umgehen die Einstufung (A-sammel32 bis 35).
  - Wächter sind enger als ihr Anspruch (A-sammel42, 43).
- **Reihe B:** Belegvollständigkeit und Exactly-once unter Konkurrenz und Absturz. Von B-sammel29
  bis B-sammel36 rückt dieselbe Garantie, „kein angenommen ohne vollständige Belege“, Runde für
  Runde eine Kante weiter, bis B-sammel37 GO gibt.

## Abgrenzung

- **sammel45–54 und die Ship-Kette:** Diesen Teil hat I5 als erledigt geführt (SCRUM-469). Er ist
  nicht Gegenstand dieses Auftrags und wird nicht neu gebaut. Siehe unten den Widerspruch zu
  sammel45.
- **I20 · Nachtrag nach dem Wiederverbinden** (`OFFEN.md:415`): eigener offener Registerpunkt
  (Ship 9, sammel60, T6, I20, C1).
- **I8 · Scheiben-Zusatz an ben-Auftragsnamen** (`OFFEN.md:402`): eigener offener Punkt zur
  künftigen Benennung. Die doppelten Nummern zeigen, warum er nötig ist.
- **Spätere Runden** (sammel55 ff.) stehen mit Inhalts-SHA bereits in `OFFEN.md` (B-Zeilen in
  `OFFEN.md:130-209`) und in `docs/aufnahme/20260922-gesamt-paket2-scope.md`.
- **Die Befunde selbst:** Dieses Dokument archiviert Prüfberichte. Ob die damaligen Befunde heute
  noch geschlossen sind, prüft es nicht. Historische Verdikte sind keine heutige Produktabnahme.
- **Die Hand-Berichte, Diffs und Patches**, auf die die Berichte verweisen (`_relay/hand/outbox/…`,
  `_relay/patches…`), sind nicht Teil dieser Übergabe und nicht archiviert.

## Quellenwidersprüche

- **sammel45: „je GRÜN“ gegen „ROT“.** `OFFEN.md:215` (B6) führt „ben sammel45–49 je GRÜN“. Dagegen
  steht `tests/app/mega47-modale-flaechen-sammler.test.tsx:15`: „sammel45 (ben, ROT)“. Die Berichte
  ab sammel45 sind nicht Teil der Übergabe; der Widerspruch bleibt offen.
- **A-sammel39: „Blocker“ gegen GELB.** `apps/web/src/styles/modern.css:59` und
  `tests/app/mega40-kontrast-modern.test.ts:8` sprechen von „bens sammel39-Blocker“. Der Bericht
  urteilt GESAMTVERDIKT GELB: „eng begrenzte, vor Auslieferung leicht beheb- und pruefbare Auflage“.
  Die Codekommentare überzeichnen das Verdikt. Sie sind nicht geändert, weil dieser Auftrag fremde
  Kommentare nicht umschreibt.
- **B-sammel29: angegebene Inhalts-SHA gegen Text.** Der Bericht sagt, `246388f4…b041` sei die
  SHA-256 des Inhalts oberhalb seiner letzten Zeile. Nachgerechnet stimmt das nicht. Die übrigen 31
  Berichte bestehen dieselbe Rechnung.
- **Gleiche Nummern, verschiedene Berichte.** sammel26–38 gibt es in beiden Reihen. Die erste
  Fassung dieses Archivs hat beide Gegenstände von sammel34 in eine Zeile gelegt. Das ist
  berichtigt.
- **„Ship 8“ zweimal.** Reihe B prüft die Patchkette 57–85 als „Ship 8“ auf Ship-7-Basis `2727b7e`
  (GO in B-sammel37, Post-Ship-Check auf `bb69aa3` in B-sammel38). In der Ship-Kette von `OFFEN.md`
  ist „Ship 8“ dagegen `bcf1f15` mit mega60 (`OFFEN.md:277`, B15). Es sind zwei verschiedene
  Ship-Zählungen; `OFFEN.md:409` (I24) beschreibt eine fremde, parallele Linie mit eigener
  Ship-Zählung. Welche Zählung für welchen Zeitraum galt, belegen die Berichte nicht.
- **SCRUM-469 als Ablage.** `docs/qm/claude-after-report.md:10983` und `:10997` nennen
  SCRUM-469-Kommentare (13949, 13950, 13956) zu „ben-Batch“-Prüfungen vom 19.07. Die
  datierten Berichte hier stammen frühestens vom 22.07. (B-sammel26–29). Eine Zuordnung zu diesen
  Kommentaren ergibt sich aus den Berichten nicht.

## Offen

- **Inhalts-SHA von B-sammel29:** Die Markerzeile ist nicht reproduzierbar (siehe „Markerzeile
  nicht reproduzierbar“). Klären kann das nur, wer den Entstehungsweg des Berichts von 22.07.2026
  kennt. Der Bericht selbst ist byte-gleich gesichert.
- **Codekommentare mit „sammel33/34“** nennen keine Reihe. Die Zuordnung oben (B für
  WP-SHIP8-CLOSE, A für den Word-Kopierweg) ergibt sich aus dem Gegenstand und ist durch die
  Berichtstexte bestätigt. Die Kommentare selbst sind unverändert.
