# Nutzungsplan: belegte Nutzenmomente messbar machen

Auftrag `aufnahme:20260922:gesamt-adoption` (Revision 1). Originalpunkte R-1004, R-1925 und R-2193.
Die Grenze R-1050 gilt als entschiedene Grenze. Stand des Abgleichs ist der Arbeitsbaum auf
Basis `06468f058` (13.10.2026).

Dieser Plan ist **Kopfarbeit** (OFFEN.md K4: „kostet keinen Code-Takt“). Er baut nichts neu. Er
ordnet die Stellen, an denen Anwender im Produkt heute schon einen Nutzen erleben, und legt fest,
woran man misst, ob sie das System wirklich benutzen. Jeder Nutzenmoment nennt seine Fundstelle im
Code und das Ereignis, an dem er sich zählen lässt. `tests/adoption-nutzungsplan/fundstellen.test.ts`
prüft, dass diese Fundstellen existieren. Ändert sich der Code, schlägt der Test an, statt dass der
Plan unbemerkt veraltet.

## 1. Die Frage

> „Ein Wissenssystem, das niemand füttert, ist leer — und ein leeres Wissenssystem beantwortet keine
> Frage, egal wie gut das Retrieval ist.“ (OFFEN.md K4)

Damit Anwender das System dauerhaft nutzen, muss sich der Kreislauf für sie lohnen: **fragen →
Antwort oder Lücke → jemand füllt die Lücke → die fragende Person erfährt es → der Beitrag wird
geprüft und zitiert → die beitragende Person erfährt, dass er geholfen hat.** Jede Station dieses
Kreislaufs ist ein Moment, in dem jemand einen Nutzen erlebt. Der Plan misst, ob diese Momente
eintreten und wie oft.

## 2. Belegte Nutzenmomente

Spalten: Kennung · Moment · wer ihn erlebt · Fundstelle · Anker (Ereignis oder Feld im Code) ·
Messgröße · Lesweg heute.

| Kennung | Moment | Wer | Fundstelle | Anker | Messgröße | Lesweg heute |
|---|---|---|---|---|---|---|
| N1 | Eine Frage wird mit belegter Antwort beantwortet, ohne Wissenslücke | Fragende | `services/app/src/wissenskennzahlen.ts` | `"antwortquote"` | Antwortquote = beantwortet ohne Lücke / gestellte Fragen, je Zeitraum (7/30/90 Tage) mit Trend | `/analytics`, Abschnitt Wissenskennzahlen (Recht `users.manage`), CSV-Export |
| N2 | Die eigene offene Frage wird fachlich gelöst, und die fragende Person erhält die Meldung „gelöst“ | Fragende | `services/ask/src/service.ts` | `"gap.closed"` | Anteil fachlich geschlossener an neu entstandenen Lücken; Dauer von `createdAt` bis `abschluss.at` | Zahl neuer Lücken in den Wissenskennzahlen; Abschlüsse nur im Protokoll (Messlücke L2) |
| N3 | Eine andere Person markiert das eigene Wissen als hilfreich, und die Autorin oder der Autor erhält die Wirkungs-Rückmeldung (PMO-FEA-0002) | Beitragende | `services/app/src/notification-feed.ts` | `kind: "impact"` | Zahl der Rückmeldungen `answer.helpful` von anderen Personen, je Zeitraum | eigene Zahl über `GET /api/me/impact` (`helpfulReceived`); gesamt nur im Protokoll (Messlücke L1) |
| N4 | Das eigene Wissen trägt eine Antwort als führende Quelle | Beitragende | `services/app/src/impact.ts` | `cited: number` | Zahl der Antworten mit eigenem Wissensobjekt als führender Quelle | eigene Zahl über `GET /api/me/impact`; gesamt nicht erhoben |
| N5 | Der eigene Beitrag wird geprüft und gilt als validiert | Beitragende | `services/app/src/impact.ts` | `validatedByWeek` | validierte Objekte je Woche des Prüfzeitpunkts `validatedAt` | `GET /api/analytics/impact`, Karte auf `/analytics` |
| N6 | Wissen aus einem Gespräch wird mit einem Klick als Entwurf übernommen | Beitragende | `services/app/src/routes/chat-routes.ts` | `"chat.wissen_uebernommen"` | Übernahmen je Zeitraum | nur im Protokoll |
| N7 | Eine Vorlage verkürzt das Erfassen | Beitragende | `services/app/src/vorlagen.ts` | `"vorlage.verwendet"` | Erfassungen mit Vorlage je Zeitraum | nur im Protokoll |
| N8 | Beim Weggang einer Person entsteht ihr Vermächtnis-Buch aus dem, was sie gesichert hat | Übergebende und Nachfolgende | `services/app/src/routes/verantwortung-routes.ts` | `"vermaechtnis.erzeugt"` | erzeugte Bücher; darin aufgenommene Objekte (`aufgenommen`) | nur im Protokoll |
| N9 | Das Team bespricht neue, geprüfte Erkenntnisse der Woche (PMO-FEA-0004) | Team | `services/output/src/wochenupdate.ts` | `WOCHENUPDATE_TITEL` | Abrufe des Wissensupdates | nicht protokolliert (Messlücke L5) |
| N10 | Neues validiertes Wissen und „hat heute geholfen“ werden sichtbar; Namen und Fotos nur mit Zustimmung (PMO-FEA-0003) | alle | `services/app/src/routes/livewall-routes.ts` | `zustimmungsEreignisse` | keine eigene Messgröße, die Wand verstärkt N3 und N5 | Startkarte und `/livewall` |

**Gegensignale.** Diese Stellen zeigen, wo kein Nutzen entsteht. Sie werden mitgemessen, aber nie
einer Person zugerechnet.

| Kennung | Gegensignal | Fundstelle | Anker | Lesweg heute |
|---|---|---|---|---|
| G1 | Suche ohne Treffer | `services/ask/src/nulltreffer.ts` | `NULLTREFFER_DECKEL` | nur die eigenen Suchen (Wissenskennzahlen, Nacharbeit 3) |
| G2 | Antwort als nicht hilfreich markiert (`POST /api/ask/not-helpful`, R-1649) | `services/ask/src/service.ts` | `"answer.not_helpful"` | nur im Protokoll |
| G3 | Häufig gefragt, noch offen (D-032) | `services/app/src/wissenskennzahlen.ts` | `"neue_luecken"` | Liste „Häufig gefragt, noch offen“ |

## 3. Messplan

Gemessen werden nur **Summen über den Bestand** und die **eigenen Zahlen der angemeldeten Person**.
Personen werden nicht verglichen (Abschnitt 5).

### Phase A — Ausgangswert (vor der Einführung, mindestens 30 Tage)

| Ziel | Kennzahl | Quelle | Prüfregel |
|---|---|---|---|
| A1 Ausgangswert steht fest | N1 Antwortquote, Zahl der Fragen, G3 | Wissenskennzahlen, CSV-Export, Zeitraum 30 Tage | Lage `gemessen` statt `unvollstaendig` (siehe `docs/entscheidungen/admin-11-wissenskennzahlen.md`) |
| A2 Bestand ist befüllbar | N5 validierte Objekte je Woche | `GET /api/analytics/impact` | `validatedUnknownWeek` ist bekannt und getrennt ausgewiesen |

Zielwerte werden **erst nach dem Ausgangswert** festgelegt. Ohne Ausgangswert wäre jede Zahl
erfunden. Die Festlegung ist eine Entscheidung für Pedi (Abschnitt 7).

### Phase B — Kreislauf schließen (erste 90 Tage im Betrieb)

| Ziel | Kennzahl | Prüfregel (messbar ohne erfundenen Zielwert) |
|---|---|---|
| B1 Fragen werden beantwortet | N1 Antwortquote | der Trend der Wissenskennzahlen über zwei aufeinanderfolgende 30-Tage-Zeiträume fällt nicht |
| B2 Lücken bleiben nicht liegen | N2 Abschlussanteil und -dauer | jede fachlich geschlossene Lücke erzeugt die Meldung „gelöst“ bei allen Fragenden; der Anteil steigt je Zeitraum |
| B3 Beitragende erfahren Wirkung | N3, N4 | die Summe `answer.helpful` von anderen Personen ist im Zeitraum größer als null; ein Wert von null bedeutet, dass N3 nicht stattfindet |
| B4 Wissen kommt ohne Mehraufwand herein | N6, N7, N8 | Übernahmen, Vorlagenverwendungen und Vermächtnis-Bücher werden je Zeitraum gezählt; ein Weg ohne Nutzung wird im Team erfragt, nicht beworben |

### Phase C — Gewohnheit (ab dem vierten Monat)

| Ziel | Kennzahl | Prüfregel |
|---|---|---|
| C1 Fragen statt Nachrufen | Zahl der Fragen je Zeitraum, G1 | Fragen steigen oder bleiben stabil, während G3 sinkt |
| C2 Teamrhythmus | N9 Wissensupdate im Teamgespräch | erst messbar, wenn L5 geklärt ist; bis dahin vermerkt das Team selbst, ob das Update besprochen wurde |

### Hebel: vorhandene Lieferungen, die die Momente auslösen

Alle Hebel bestehen bereits. Dieser Plan verwendet sie und baut keinen davon neu.

- **Lücke als Auftrag:** Fragen ohne Antwort werden zur Lücke mit Häufigkeit (D-032) und Zuständigen
  (`gap.assigned`); der Abschluss meldet „gelöst“ an die Fragenden (N2).
- **Danke-Knopf und Wirkungs-Rückmeldung** (PMO-FEA-0002, N3) und **„Meine Wirkung“** (FUNKE F1,
  SCRUM-477/529, `GET /api/me/impact`, N3 und N4).
- **Wissensupdate fürs Teamgespräch** (PMO-FEA-0004, N9), ohne automatischen Versand und ohne
  Personenliste.
- **Live-Wand** (PMO-FEA-0003, N10), Namen und Fotos nur mit Zustimmung.
- **Erfassen ohne leeres Blatt:** Chat-Übernahme (N6), Vorlagen (N7), „Aus Datei“ (PMO-FEA-0006),
  Vermächtnis-Buch bei der Übergabe (N8).

## 4. Messlücken

Diese Lücken werden hier **benannt, nicht gebaut**. Ob sie geschlossen werden, entscheidet ein
eigener Auftrag.

- **L1 Gesamtzahl der Danke-Rückmeldungen:** Es gibt keine Kennzahl je Zeitraum. Die Daten liegen im
  Protokoll `answer.helpful`, sichtbar sind nur die eigene Zahl und die Live-Wand des Tages.
- **L2 Abschlussanteil und -dauer von Lücken:** Die Daten sind vorhanden (`gap.closed`,
  `abschluss.at`, `createdAt`), werden aber nicht als Kennzahl gezeigt. Die Wissenskennzahlen zählen
  nur neu entstandene Lücken.
- **L3 Aktive Nutzende:** Dafür gibt es nur das Rohprotokoll `auth.login`. Eine Auswertung berührt
  die Verhaltenskontrolle von Beschäftigten. Sie ist nur als anonyme Summe denkbar und erst nach
  einer Betriebsvereinbarung zur Zweckbindung (`docs/compliance/gdpr-compliance-runbook.md`,
  Abschnitt Betriebsvereinbarung). Bis dahin wird sie nicht erhoben.
- **L4 Bereichsvergleich:** Fragen und Lücken tragen keinen Space. Mit Space- oder Teamfilter sind
  N1 und G3 „nicht erhoben“ (admin-11, Grenzen).
- **L5 Wissensupdate und Live-Wand:** Abrufe werden nicht protokolliert. N9 lässt sich deshalb nicht
  zählen.
- **L6 Altbestand ohne Prüfzeitpunkt:** zählt in `validatedUnknownWeek`, aber in keine Woche.

## 5. Grenzen

- **Keine Punkte, Abzeichen oder Ranglisten** (R-1050; Pflichtenheft §6; EK-19-Richtung). Keine
  Kennzahl dieses Plans vergleicht oder sortiert Personen. Die freiwillige Wirkungsanzeige
  („Meine Wirkung“, Live-Wand mit Zustimmung) zeigt nur eigene Zahlen oder anonyme Summen und ist
  davon verschieden. Der Code hält diese Grenze bereits fest: `services/library-analytics/src/types.ts`
  (anti-Gamification), `services/output/src/wochenupdate.ts` (keine Personenliste).
- **Keine Kundenkontakte, keine Aktivierung und keine Produktionsfreigabe** durch diesen Plan.
- **Keine Zeit- oder Geldersparnis behaupten:** Die Kennzahlen messen Nutzung, nicht Ersparnis
  (admin-11, Wortwahl).

## 6. R-2193: die Teile getrennt bewertet

Der Ausschluss aus v1 (Pflichtenheft §6) ist kein dauerhafter Ausschluss. Jeder Teil hat einen
eigenen Auftrag, der ihn konkretisiert. Hier steht nur, was er für die Nutzung bedeutet. Es gibt
keine pauschale Freigabe.

| Teil | Bewertung für die Nutzung | Vorhanden | Gesonderter Auftrag |
|---|---|---|---|
| Native Apps | Später möglich. Nutzen am Arbeitsort (N1 ohne Browser); keine Store-App in diesem Plan | `desktop-app/`, `docs/word-addin/`, `docs/browser-extension/` | `aufnahme:20260922:gesamt-native-apps` |
| Drittsystemanschlüsse | Später möglich. Wissen dort abholen, wo es entsteht (N6-artig) | `services/confluence/`, `services/jira/`, `services/sharepoint/` | `aufnahme:20260922:gesamt-anlagendaten-abgleich`, `aufnahme:20260922:gesamt-chat-import`, `aufnahme:20260922:gesamt-email-eingang` |
| BI-Auswertungen | Später möglich. Dieser Plan kommt mit den vorhandenen Wissenskennzahlen und deren CSV-Export aus | `services/app/src/wissenskennzahlen.ts` | `aufnahme:20260922:gesamt-bi-anbindung` |
| Selbstbedienungsbereitstellung | Bleibt an eine Firma je Instanz gebunden; keine Mandanten-Selbstanlage für die Einführung | — | `aufnahme:20260922:gesamt-instanztrennung` |
| Gamification | Widerspricht der ausdrücklichen Grenze (R-1050); nicht Teil des Plans | Grenze im Code, siehe Abschnitt 5 | — |

## 7. R-1925: die sieben Konzeptvorgänge SCRUM-475–481 einzeln abgeglichen

Quelle: der datierte Originalexport `jira-SCRUM.json` vom 16.09.2026 (SHA-256 `753613a3…`), in den
Auftragsunterlagen als `QUELLEN-FUEHRUNG-ADOPTION-SCRUM-475-481-20261013.json` bereitgestellt. Er
enthält alle sieben Beschreibungen und alle vorhandenen Kommentare. Alle sieben stehen dort auf
„To Do“ und sind als Konzeptantwort für die Demo angelegt. Ausdrückliche Abnahmekriterien enthält
der Export nicht, und hier werden keine erfunden. Es ist ein historischer Export, kein heutiger
Jira-Stand.

„Vorhanden“ nennt Bestand in Fassung `1.0.0-beta.1.956` (Kandidat `715cf8d6d`), jeweils mit einer
Fundstelle und einem vorhandenen Test als Beleg. Dieser Abgleich baut nichts, gibt nichts frei und
legt keine Personal- oder Preispolitik fest.

| Vorgang | Inhalt laut Export | Konzeptergebnis für die Nutzung | Vorhanden (Fassung 1.0.0-beta.1.956) | Gesondert oder heute ungeklärt |
|---|---|---|---|---|
| SCRUM-475 | Bonuspunkte-System mit Stufen Blue/Silver/Gold/Diamant; Punkte fürs Eingeben, Auszeichnung des besten Beitrags | **Abgelehnt.** Widerspricht der jüngeren ausdrücklichen Grenze R-1050 (keine Punkte, Abzeichen oder Ranglisten; Pflichtenheft §6). Das Ziel „zum Pflegen animieren“ übernimmt die freiwillige Wirkungsanzeige ohne Personenwertung (N3, N4, N10) | `services/app/src/impact.ts` (nur eigene Zahlen), Beleg `tests/app/impact-e2e.test.ts` | Keine Gamification-Freigabe. Eine spätere Umkehr wäre eine neue Entscheidung von Pedi |
| SCRUM-476 | Offene Fragen eingeben und zuweisen, von ausgeschiedenen Mitarbeitenden (Rentnern) gegen Bezahlung abarbeiten lassen; „Basis existiert: Gap-System“ | Die Basis ist vorhanden: Lücken mit Zuständigen und der Meldung „gelöst“ (N2), dazu das Vermächtnis-Buch beim Weggang (N8). Bezahlung und Vertragsform sind keine Produktfrage dieses Plans | `services/ask/src/service.ts` (Lückenvorgang, `gap.assigned`), `services/app/src/routes/ausscheiden-routes.ts` (Status „Ausgeschieden“), Beleg `tests/aufgaben-ansicht/autorenuebergabe-aufgabe.test.ts` | **Widerspruch zum heutigen Stand:** Nach Peters Entscheidung vom 12.10.2026 verliert ein ausgeschiedenes Konto Zugang und Sitzungen, und offene Lücken gehen an eine Vertretung. Ein Rentnermodell bräuchte einen eigenen Zugangsweg. Ob eine Wiederfreigabe Ausgeschiedener gewollt ist, ist nicht entschieden (`docs/aufnahme/20260922-gesamt-aufgabenansicht-autorenuebergabe.md`). Offen für Pedi; hier nicht gebaut |
| SCRUM-477 | Kernfrage: Warum nehmen sich Anwender täglich 15 Minuten? Geringe Reibung, Anreize, nicht-invasiver Begleiter (Klara ausbauen) | **Konzeptantwort vorhanden** (Kommentar vom 17.07.2026, Pedi und Kopf): Konsumieren lohnt sofort, wenn der Bestand steht. Pflegen lohnt nur mit „Import zuerst“, KI-Screening, sichtbarem Lückenbedarf und Nachfragezähler. Einwand „lieber face-to-face“: „Klarwerk konkurriert nicht mit dem Gespräch, sondern mit dem Vergessen danach.“ Ihre **messbaren Erfolgsbedingungen** — niedrige Leere-Antwort-Rate und minimale Pflege-Reibung — übernimmt dieser Plan als N1/G3 und B4. Die dort genannte Achillesferse „erlebter Rückfluss“ entspricht N2 bis N4 | FUNKE (SCRUM-477/529): `services/app/src/impact.ts`, `apps/web/src/components/FunkeCards.tsx`, Beleg `tests/app/funke.test.ts`; Nachfragezähler D-032 in `services/app/src/wissenskennzahlen.ts` | **SCRUM-518** („Internationaler Frühschoppen“: Experten-Meeting aufzeichnen, auswerten, als Kandidaten prüfen) ist die operative Antwort aus dem Kommentar. Es ist ein eigener Vorgang auf „To Do“ mit den Toren BR/DSGVO (484) und Media-Chunking (382), diesem Auftrag nicht als Originalpunkt zugeordnet. Der heutige Erfüllungsstand ist ungeklärt; Bausteine siehe SCRUM-480 |
| SCRUM-478 | Kopierschutz des Systems („Secure the IP“) und Bewertung der Information nach dem Firmen-IP-Wert | **Kopierschutz:** Strategie- und Rechtsfrage, keine Nutzungsfrage; im Arbeitsbaum gibt es dazu keinen Bestand. **Informationsbewertung:** vorhanden nur als gekennzeichnetes Schätzmodell, nicht als gemessener IP-Wert. Für die Nutzung zählt der Schutz der Kundeninformation: Vertraulichkeitsstufen und kein Abfluss vertraulicher Inhalte | Schätzmodell `apps/web/src/pages/Stufe2.tsx` (Abschnitt `mgmt.valuation`); Vertraulichkeit `services/knowledge-object/src/confidentiality.ts` | Kopierschutz und eine IP-Bewertung über das Schätzmodell hinaus: kein Bestand, kein zugeordneter Auftrag, heute ungeklärt. Hier nicht gebaut |
| SCRUM-479 | Video in beide Richtungen: aus Wissen Video erzeugen und aus Video Wissen gewinnen | **Video → Wissen:** teilweise vorhanden; Video und Audio werden importiert und transkribiert, ohne aktiven Dienst ehrlich „inactive“, vertrauliche Medien nur lokal oder freigegeben. **Wissen → Video:** kein Bestand gefunden | `services/media/src/transcriber.ts` (SCRUM-382), Beleg `tests/app/media-analyze-e2e.test.ts` | Wissen → Video: kein Bestand, kein zugeordneter Auftrag, heute ungeklärt. Hier nicht gebaut |
| SCRUM-480 | Note-Taker per Sprache für Meetings; Auswertung von Meeting- und Notiz-Inhalten auf verwertbares Wissen | Teilweise vorhanden: Transkription (SCRUM-382), Bindung von Meeting-Aussagen an Folien und Dokumentstellen (BPA-16), Übernahme von Wissen aus Gesprächen als Entwurf (N6). Ein durchgehender Note-Taker vom Meeting bis zum validierten Wissen ist nicht belegt | `services/app/src/meeting-dokumentbezug.ts`, `services/app/src/routes/chat-routes.ts`; Belege `tests/meeting-dokumentbezug/`, `tests/interner-chat/` | Durchgehender Note-Taker: heute ungeklärt, eng verwandt mit SCRUM-518. Hier nicht gebaut |
| SCRUM-481 | White-Label: Der Kunde gibt das System als sein eigenes aus. Konkretisierung vom 14.07.: Basic-CI mit Logo, Anzeigename, Primär- und Akzentfarbe | Laut Kommentar **geparkt als Idee**, mit der Vorbedingung „Abgrenzung zum Mandanten-/Tenant-Konzept klären“. Im heutigen Bestand gibt es eine Instanz je Firma. Ein Unternehmensprofil mit Name, optionalem Logo und einer Akzentfarbe aus fester Liste ist vorhanden; ausdrücklich kein Theme-Editor und keine freie Primärfarbe | `services/app/src/unternehmensprofil.ts` (ADMIN-15, `produkt:20261009:admin-unternehmensprofil`), Beleg `tests/admin-unternehmensprofil/` | Ein volles White-Label (eigene Marke statt Klarwerk, freie Farben) bleibt geparkt; Instanztrennung siehe `aufnahme:20260922:gesamt-instanztrennung`. Hier nicht gebaut |

**Ergebnis für R-1925:** Zu jedem der sieben Vorgänge stehen hier Konzeptergebnis, vorhandener
Bestand und der offene Rest. SCRUM-475 ist durch R-1050 abgelehnt. SCRUM-477 hat seit dem 17.07.
eine Konzeptantwort, die dieser Plan weiterverwendet. SCRUM-481 ist geparkt. Die übrigen Reste
(Rentnermodell, Kopierschutz, Wissen → Video, durchgehender Note-Taker, SCRUM-518) sind Ideen ohne
zugeordneten Auftrag. Ihr heutiger Erfüllungsstand bleibt ungeklärt, bis jemand sie beauftragt.

## 8. Offene Belege, Widersprüche und Entscheidungen

- **SCRUM-475–481 jetzt abgeglichen** (Abschnitt 7) gegen den Originalexport vom 16.09.2026. Offen
  bleibt nur, was der Export selbst nicht enthält: ausdrückliche Abnahmekriterien und ein heutiger
  Jira-Stand. Im Arbeitsbaum selbst liegt der Wortlaut weiterhin nicht.
- **Adoption-Playbook „Drei Akte“** (KBB-112, `BETA_ADOPTION_PLAYBOOK_DREI_AKTE_V1.md`, Repository
  `klarwerk-business-backend`) und `PEDI_INPUT_KONZEPTDELTA_ADOPTION_2026-07-01.md` liegen nicht im
  Arbeitsbaum (wie schon `docs/wissensupdate-teamgespraech.md` vermerkt). Die Momente oben stammen
  aus dem Code, nicht aus dem Playbook.
- **JOB 1043 / BEN-Urteil ROT (D4, 20.08.):** Der Inhalt dieses Urteils liegt nicht vor. Was damals
  beanstandet wurde, ist nicht abgeglichen.
- **Widerspruch zur Zeitachse „validiert je Woche“:** `docs/wissensupdate-teamgespraech.md` beschreibt
  „Validiert je Woche“ in Analytics nach `createdAt`, und der Kommentar in
  `services/output/src/wochenupdate.ts` nennt dieselbe Zeitachse für `impact.ts`. Heute gruppiert
  `services/app/src/impact.ts` aber nach dem Prüfzeitpunkt `validatedAt` (R-0750/R-1741), und
  admin-11 nennt den früheren Balken entfallen. Für N5 gilt `validatedAt`. Die beiden älteren Stellen
  sind überholt und wurden hier nicht geändert.
- **Spannung „kein Leistungs-Tracking“ und Analytics je Person:** Die Prüfaufgaben je Person
  (FR-VAL-06/FR-ANA-01) und der Bus-Faktor nennen Personen. Das ist laut
  `docs/team2-austausch/paul-nachtrag-fixes-0307.md` ein Thema für das Co-Design mit dem
  Betriebsrat; PMO-REQ-0004 (Einwilligungs- und BR-Paket) ist offen. Dieser Plan verwendet keine
  dieser Flächen als Nutzungskennzahl.
- **Entscheidungen für Pedi:** (1) Zielwerte nach dem Ausgangswert in Phase A; (2) ob L1, L2 und L5
  als eigener Auftrag geschlossen werden; (3) ob L3 nach einer Betriebsvereinbarung erhoben wird.
- **Nicht erprobt:** Ob der Plan im echten Betrieb trägt, zeigt erst ein Einsatz mit echten
  Anwendern. Das ersetzt dieser Plan nicht.

## Abgrenzung

- **OFFEN.md K5 (Lehrlings-Bild)** gehört laut OFFEN.md als Antwort zu K4, ist aber diesem Auftrag
  nicht als Originalpunkt zugeordnet. Hier wurde daran nichts geändert.
- **Wissensupdate, Live-Wand, Wirkungs-Rückmeldung, FUNKE und Wissenskennzahlen** sind vorhandene
  Lieferungen aus eigenen Aufträgen (`aufnahme:20260922:gesamt-wochenupdate`,
  `aufnahme:20260922:gesamt-aktivitaetsanzeige`, `produkt:20261009:admin-wissenskennzahlen`). Sie
  werden verwendet und nicht geändert.
