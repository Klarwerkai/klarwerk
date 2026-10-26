# Klara 11 · Vorhandenen Kalender bewusst bedienen (AW-17)

Auftrag `produkt:20261008:klara-kalender`, Revision 4. Stand dieser Fassung: **unabhängige frühe
Vorbereitung** auf Basis `ee3b2bc6a`. Das hier Beschriebene ist Code und Prüfung am Vertragsdouble,
**keine** Bereitstellung und **kein** Nachweis an einem echten Microsoft-365-Testkalender.

## Bestand vor dieser Fassung

- Im Arbeitsbaum gab es **keine** externe Kalenderanbindung, keine externe Kalenderkennung und keinen
  Kalenderzugang. Die Klara-Vorschau sagt ausdrücklich: „Erinnerung und Termin werden in keinen
  Kalender übertragen“ (`apps/web/src/texte/klaravorschau.ts`).
- Die Elternaufträge sind **nicht** im Hauptstand: `produkt:20261010:klara-eigener-kalender` (C06,
  `/kalender`, Sichtwahl) und `produkt:20261007:klara-erinnerungen-kalender` (C04, Erinnerungen,
  Scheduler) liegen laut `docs/klara-setup-shortcuts/BESTAND.md` nur als Kandidatenzweige vor. Deren
  Code wurde hier nicht gelesen und nicht verändert.
- Vorhandenes Muster für Microsoft Graph: `services/sharepoint/src/graph-client.ts` (injizierbares
  `fetch`, Origin-Pinning, `redirect: "error"`, feste Fehlersätze). Der neue Adapter folgt ihm.

## Was diese Fassung liefert

| Datei | Inhalt |
| --- | --- |
| `services/app/src/klara-kalender-anbindung.ts` | Regeln und Dienst: Anbindung, Rechte, feldweise Führung, Zuordnung, Abgleich, Sperrmarke, Entscheidung, Löschvorschau, Laufstand; In-Memory- und Postgres-Ablage (`KLARA_KALENDER_SCHEMA`) |
| `services/app/src/klara-kalender-m365.ts` | Microsoft-365-Anbieter gegen den Graph-Vertrag; Betreiber-Einspeisung `kalenderAnbieterAusEnv` |
| `services/app/src/routes/klara-kalender-routes.ts` | Anwendungstüren `/api/me/klara/kalender/…` (nur das eigene Konto) |
| `services/app/src/build-app.ts`, `db.ts` | Verdrahtung, Postgres-Ablage, Migration |
| `apps/web/src/pages/KalenderAnbindung.tsx`, `api/klaraKalender.ts`, `texte/klarakalender.ts` | Seite `/kalender-anbindung` (Profil › „Vorhandener Kalender“), Zauberhut-Assistent, Dialoge, DE/EN/NL |
| `apps/web/src/components/klara-vorschau/KlaraVorschau.tsx` | Klaras Bedienhilfe zu dieser Fähigkeit |
| `tests/klara-kalender/anbindung-am-dienst.test.ts` | Dienst gegen ein strenges Vertragsdouble des Anbieters |
| `tests/klara-kalender/m365-vertrag.test.ts` | Adapter gegen ein `fetch`-Double, Betreiber-Einspeisung |
| `tests/klara-kalender/kalender-am-server.test.ts` | Türen an der echten Anwendung (`buildApp`, `app.inject`) |
| `tests/klara-kalender/kalender-pg.integration.test.ts` | Dauerhaftigkeit gegen echtes PostgreSQL (neuer Pool je „Neustart“) |
| `tests/klara-kalender/kalender-seite-mounted.test.tsx` | Bedienung der Seite (jsdom, Netz-Attrappe) |

### Nacharbeit 1 (Ben, Kandidat `c77fb459e`)

- **Serienlöschung war unbedingt (AW17-K04).** Aus einem Vorkommen wurde die Serie mit leerer
  Fassung gelöscht — ohne `If-Match`. Jetzt: `loeschVorschau` liest das ZIEL (bei „ganze Serie“ den
  Serienmaster) samt Fassung; `loesche` verlangt genau diese Fassung (`fassung_fehlt` sonst), liest
  vor dem DELETE erneut und sendet `If-Match`. Weicht die Fassung ab — vor dem Löschen oder als 412
  beim DELETE —, entsteht der sichtbare Konflikt `loeschen_veraltet`, und nichts wird gelöscht. Der
  Adapter schickt ohne Fassung weder PATCH noch DELETE hinaus.
- **Prüfdouble war nachsichtig.** Es prüfte nur nichtleere Fassungen. Jetzt streng; jede leere
  Fassung wird als `ohneFassung` vermerkt und muss leer bleiben.
- **Integration**: Routen, Betreiber-Einspeisung, Postgres-Ablage, Oberfläche, Bedienhilfe, Laufstand.

### Regeln

- **Konto und Zielkalender** kommen vom Anbieter (`/me`, `/me/calendars`), nie vom Browser.
- **Vier getrennte Rechte**: lesen · eigene Termine schreiben · geteilten Kalender bearbeiten ·
  Personen einladen. Wirksam ist der gewählte Umfang (`nur_lesen` / `lesen_schreiben`) geschnitten mit
  dem, was der Anbieter gewährt. Ob der Zugang die Scopes trägt, zeigt erst die Antwort (403 → „Recht
  fehlt“).
- **Feldweise Führung (P07-AC04)** für `titel`, `zeit`, `ort`, `beschreibung`, `teilnehmer`:
  `klara` (Klara schreibt) · `kalender` (der Kalender führt, Klara übernimmt nur in den Termin) ·
  `nur_klara` (geht nicht hinaus). Je Feld Konfliktstrategie `nachfragen` (Vorgabe) oder
  `fuehrend_mit_hinweis` (die führende Seite gewinnt, sichtbar im Verlauf). Teilnehmer führt nie der
  Kalender. Absage und externe Löschung fragen immer nach.
- **Zuordnung (AW17-K03)**: stabiler Schlüssel `kk-…` (Hash aus Konto, Anbindung, Auftrag, Ereignis)
  ↔ externe Kennung mit Anbieter, Kalenderkonto, Kalender, Anbieterfassung (`@odata.etag`), Serienart.
  Der Schlüssel ist beim Anlegen zugleich `transactionId` und erweiterte Eigenschaft
  (`KlarwerkVorgang`) — eine verlorene Antwort führt zu keiner Dublette (AW17-K01).
- **Kein falscher Erfolg (K3, AW17-K06)**: „projiziert“ erst nach Nachlesen beim Anbieter UND
  gespeicherter Zuordnung. Fehlendes Recht → `fehlgeschlagen`; abgelaufene Verbindung, Ausfall des
  Anbieters oder der Ablage → `ausstehend`. Ohne Verbindung ist nur diese Anbindung betroffen.
- **Kein Last-write-wins (AW17-K04)**: Ändern und Löschen senden `If-Match`. Weicht die Fassung ab,
  wird abgeglichen; ein Feldkonflikt pausiert den Lauf mit sichtbarer Entscheidung.
- **Sperrmarke (AW17-K05)**: gelöscht, abgesagt, beendet, Serie pausiert. Ein verspäteter Abgleich
  oder Webhook stellt nichts wieder her; nur eine ausdrückliche Entscheidung trägt neu ein (mit neuem
  Vorgangsschlüssel je Generation).
- **Externe Löschung (P07-AC05/06, AW17-K08)**: pausiert nur den betroffenen Lauf. Entscheidungen:
  `fortfuehren_neu_eintragen`, `fortfuehren_ohne_kalender`, `beenden`; `dialog_geschlossen` ändert
  nichts. Bei einem Vorkommen einer Serie muss ausdrücklich `einzeltermin` oder `serie` gewählt werden.
- **Privat im geteilten Kalender (AW17-K07)**: Vorgabe „Beschäftigt“ ohne Ort und Beschreibung;
  `titel` oder `voll` nur ausdrücklich. Teilnehmer und Einladung nur mit genau passendem Auftrag und
  Einladerecht; eine Einladung gilt erst, wenn der Kalender genau diese Teilnehmer nachweist.
- **Kalendertext ist kein Auftrag (AW17-K08)**: Der Abgleich gibt nur Kalenderfelder als Übernahme
  zurück, nie eine Handlung oder Auftragsgrenze.
- **Interner Kalender und Scheduler bleiben unabhängig (K4, AW17-K02)**: Der Dienst liest einen
  internen Termin und gibt `laufWirkung` (`keine`/`pausiert`/`beendet`) zurück. Er ändert weder
  Erinnerungen noch Notizen noch Aufgaben.

## Bedienhilfe (Text für Klara)

> **Deinen vorhandenen Kalender anbinden.** Du wählst Konto und Kalender und ob Klara nur lesen oder
> auch schreiben darf. Je Feld legst du fest, wer führt: Klara, dein Kalender, oder das Feld bleibt
> bei Klara. Ändert jemand im Kalender etwas, das Klara führt, oder wird ein Termin dort gelöscht oder
> abgesagt, hält Klara nur diesen Lauf an und fragt dich: neu eintragen, ohne Kalender weiter, oder
> beenden — bei Serien für diesen Termin oder die ganze Serie. Schließt du die Frage, bleibt alles
> angehalten. Eingeladen wird nur, wen du für genau diesen Termin beauftragst. Private Termine
> erscheinen in geteilten Kalendern nur als „Beschäftigt“, solange du nichts anderes einstellst. Ist
> die Verbindung weg, laufen deine Erinnerungen und Klaras eigener Kalender weiter.

### Nacharbeit 4 (Ben, Kandidat `7c475f824`)

- **Kein falscher Löscherfolg in der Oberfläche.** Ein 202 mit `ok: false` (Anbieter-, Zugangs- oder
  Speicherausfall) zeigt jetzt Stand und Meldung statt „Gelöscht und nachgelesen“; der Knopf bleibt
  für die Wiederholung mit DERSELBEN gelesenen Fassung frei und sperrt erst nach `ok: true`.
- **Keine Dublette durch Wiederholung.** Die Ereigniskennung eines Termins entsteht einmal und bleibt
  über jede Wiederholung erhalten (nur die Fassung steigt nach bestätigtem Eintrag); eine neue
  Kennung vergibt nur „Neuer Termin“. Der Server findet bei verlorener Antwort über denselben
  Mapping-Schlüssel dasselbe externe Ereignis.

## Betrieb: Zugang einspeisen

Der Zugang kommt ausschließlich aus der Betreiber-Einspeisung (derselbe Weg wie der SharePoint-Import):

```
KLARWERK_KALENDER_M365_BASE_URL=https://graph.microsoft.com/v1.0
KLARWERK_KALENDER_M365_TOKEN=<delegiertes Zugangsmerkmal des abgegrenzten Testkalenderkontos>
KLARWERK_KALENDER_M365_KONTO_IDS=<unveränderliche Klarwerk-Konto-ID>[,<weitere>]
```

Nur die genannten Klarwerk-Konten erhalten diesen Anbieter; alle anderen sehen „nicht verbunden“. Es
gibt keine Kontenautomatik. Ein Zugang je Person über eine eigene Microsoft-Anmeldung ist eine offene
Produktentscheidung und hier nicht vorweggenommen.

## Laufstand für den Scheduler

`GET /api/me/klara/kalender/lauf?auftragId&ereignisId` und `KalenderAnbindungDienst.laufStand` geben
dauerhaft `laeuft`, `pausiert` oder `beendet` für GENAU diesen Lauf aus (aus den gespeicherten
Zuordnungen). Ein zweiter Scheduler wird nicht gebaut (AW18-K11).

## Nacharbeit 44: Anschluss an die Erinnerungssteuerung (C04) und den eigenen Kalender (C06)

Integriert sind die Elternkerne `produkt:20261007:klara-erinnerungen-kalender` (Kandidat 107e2bfd9)
und `produkt:20261010:klara-eigener-kalender` (Kandidat 864c1c2fc) — als **byte-gleiche Kopien** der
Kerndateien (`klara-erinnerung.ts`, `klara-erinnerung-start.ts`, `klara-erinnerung-zeit.ts`,
`klara-routine.ts`, `routes/klara-erinnerung-routes.ts`, `eigener-kalender.ts`,
`routes/eigener-kalender-routes.ts`, `docs/operations/klara/erinnerungen.md`, dazu die unveränderten
gemeinsamen Dateien `klara-notiz.ts`, `notification-feed.ts`, `routes/notifications-routes.ts`,
`server.ts`, `sicherungsumfang.ts`, `wiederanlauf.ts`), je gegen `git show <Elternkandidat>:<Pfad>`
verglichen. Die Elternhunks in `build-app.ts`, `db.ts`, `migrationsbeleg.ts`, `dateninventar.ts`,
`restore-drill.sh`, der Bestandsreset-Liste und den Routenregistern (`tabelle.ts`,
`routeGuardAudit.ts`, `mega74-lesewege-sammler.test.ts`, nur C06) sind von Hand übernommen; spätere
Produktfixes des Kandidaten bleiben. Keine Elternoberfläche, keine Elterntests im Baum — deren
Nachweise bleiben bei den Elternaufträgen; die Elternaufträge gelten damit NICHT als geliefert.

Die EINE Steuerung (`KlaraErinnerungSteuerung`, Takt in `server.ts`) ist um genau eine Prüfung
ergänzt (`klara-erinnerung.ts`, `kalenderGesperrt` in `gesperrt`): unmittelbar vor JEDER Wirkung —
erster Lauf, Sammelmeldung, Wiederaufnahme — liest sie `KalenderAnbindungDienst.vorkommenSperre`
für GENAU dieses Vorkommen (`vorkommen_id`):

| Sperre | Wirkung am Lauf | Andere Vorkommen / Erinnerung |
| --- | --- | --- |
| `frei` | wirkt wie bisher | unberührt |
| `pausiert` (offene Entscheidung) | `unklar`, Grund `kalender_pausiert` — wartet, keine Meldung | unberührt; Status der Erinnerung bleibt `aktiv` |
| `beendet` (Einzeltermin) | `abgebrochen`, Grund `kalender_beendet` | unberührt |
| `beendet` (Serie, `sperrmarke.umfang = serie`) | jedes Vorkommen des Auftrags | Erinnerung über ihren Statusweg `beendet` |
| nicht lesbar | `fehlgeschlagen`, Grund `kalender_unlesbar`, begrenzte Wiederaufnahme | unberührt |

Die Sperre steht in `klara_kalender_zuordnungen` — sie überdauert Neustart, Fälligkeit und jeden
verspäteten Abgleich. Ausdrückliche Entscheidungen meldet `erinnerungsLaufAnschluss`
(`klara-kalender-lauf.ts`, in `buildApp` als `laufSteuerung` gesetzt) an dieselbe Ablage:
„fortführen“ macht genau den wartenden Lauf zu einem neuen Versuch mit Readback (wie die Klärung
„fortführen“, keine zweite Meldung); „beenden · Einzeltermin“ schließt genau diesen Lauf ab;
„beenden · Serie“ beendet die Erinnerung über `KlaraErinnerungDienst.status` (fassungsgebunden).
„Dialog geschlossen“ meldet `pausiert` und ändert nichts. Geht eine Meldung verloren, gibt sie nichts
frei: die Steuerung liest die Sperre vor jeder Wirkung selbst; „fortführen“ lässt sich dann auch über
die Klärung des Laufs auslösen und wird erneut gegen die Sperre geprüft.

**Umfang der Entscheidung (P07-AC06, Nacharbeit 45).** Steht ein Vorkommen einer INTERNEN Serie im
Kalender als eigenes Einzelereignis, bietet die Entscheidung trotzdem „nur dieser Termin“ und „ganze
Serie“ an — die Serie ist die interne. Die gespeicherte Serienart der Zuordnung bleibt die des
Kalenders; das Löschen am Serienmaster richtet sich weiter nur nach ihr.

**Gemeinsame Identität (S09).** Auftrag = Erinnerung (`erinnerungId`), Ereignis/Lauf =
`vorkommen_id` (`<erinnerungId>@<nominaler Termin>`). Der eigene Kalender verweist mit
`auftrag.taskId`/`lauf.runId` auf genau diese Kennungen; sein Ausführungsnachweis ist dieselbe
Erinnerungsablage (`erinnerungsAusfuehrung`: Lauf, Ergebnis, Serie, Absagen, Serie schalten;
aktiver Einzelabbruch nutzt inzwischen ebenfalls denselben persistenten Lauf mit Wirkungssperre,
Readback und Erhalt bereits gespeicherter Ergebnisse).
`POST …/anbindungen/:id/termine` nimmt statt `termin` auch `eigenerEintragId`: der Server liest den
eigenen Eintrag mit heutigen Rechten und trägt ihn mit SEINER Kennung ein (`kalenderIdentitaet`;
ohne Ende 400, geschützte Quelle 403, fremd 404). Der vorhandene Kalender in der gemeinsamen Sicht
(`GET /api/me/kalender`, Sichtwahl „beide“) zeigt nur Termine, die NICHT Klaras Projektion sind
(Vorgangsschlüssel `kk-…`) — derselbe Auftrag erscheint genau einmal.

Gegenproben: `tests/klara-kalender/scheduler-anschluss-am-server.test.ts` (echte Anwendung,
Vertragsdouble, Takt über die `server.ts`-Option) und
`tests/klara-kalender/scheduler-sperre-pg.integration.test.ts` (PostgreSQL, Neustart je Schritt).
Beide fiktiv, kein Microsoft 365. Der eigene Kalender zeigt einen wartenden Lauf als `geplant`
(seine Laufstände kennen keine Pause); die Pause sieht man an der Zuordnung und am Erinnerungslauf.

## Offen (nicht in dieser Fassung)

1. **Echter abgegrenzter Microsoft-365-Testkalender**: Mandant, Lizenz, App-Registrierung, Scopes
   (`Calendars.ReadWrite`, für geteilte Kalender `Calendars.ReadWrite.Shared`) und ein eingespeister
   Zugang sind nicht belegt. Kein Lauf gegen Graph. Am echten Dienst zu prüfen: Lesen/Anlegen/Ändern/
   Löschen, Teilnehmerwirkung, `transactionId`, Filter auf die erweiterte Eigenschaft,
   Zeitzonennamen (IANA vs. Windows), Serien und Sommerzeit, `If-Match` beim Serienmaster.
2. **Elternlieferungen C04/C06** sind als Kerne integriert (oben), aber nicht regulär geliefert:
   Elternoberflächen, Elterntests, Elternabnahme und der zentrale Elternvergleich bleiben bei ihren
   Aufträgen. Seit Nacharbeit 46 bietet die Seite „Kalenderanbindung“ bei schreibender Anbindung
   „Aus meinem Kalender übernehmen“: Auswahl eines eigenen Eintrags (geschützte stehen nicht zur
   Wahl), sichtbarer Auftrag und Lauf, Eintragen nur mit `eigenerEintragId`, danach die gemeinsame
   Kennung des Servers. Ein Browserlauf dieses Wegs steht aus (gemountete Seitenprobe U7).
3. **Tatsächliche Wirkung am Host**: Steuerung und Sperre sind an der Anwendung und gegen PostgreSQL
   belegt (fiktiv); ein Lauf auf einem Host mit echtem Dienstneustart und Restore steht aus.
4. **Anbieter-Benachrichtigungen (Webhooks/Delta)** sind nicht gebaut; externe Änderungen werden über
   „Abgleichen“ (`POST …/abgleich`) aus dem gespeicherten Stand verarbeitet.
5. **Browserlauf, Host, Restore** dieser Fassung: nicht ausgeführt; die gemountete Probe ersetzt keinen
   Browser- oder Hostnachweis. Der lokale Anbindungs-Löschweg ist jetzt vorhanden (unten); seine technischen App/PG/UI-Belege
   ersetzen weiterhin keine echte Provider-/Officeprobe.
6. RTL für den Zauberhut ist ausdrücklich „später“ (P07).

## Lokale Anbindung entfernen

Jede eigene Anbindung hat **Anbindung entfernen**. Der vorhandene Bestätigungsdialog beschreibt
vorher die konkrete Wirkung: lokale Kontoverbindungsdaten und Terminzuordnungen entfernen;
externe Termine, interne Aufträge und tatsächliche Ergebnisse erhalten. Bereits begonnene
externe Vorgänge können noch enden. Kein Provideraufruf und kein Zugriffstoken wird zum lokalen
Entfernen benötigt. Abbrechen oder Dialogschließen entfernt nichts.

Offene Laufentscheidungen werden zuerst an der bestehenden Originalzuordnung ausdrücklich
geklärt. Das Entfernen kann einen pausierten Lauf weder still fortsetzen noch ungefragt beenden.
Bereits ausdrücklich beendete Läufe behalten nur eine technische Endmarke mit Konto-, Anbindungs-,
Auftrags- und Ereigniskennung, Zeitpunkt und Umfang; keine Termintexte, Kalender-/Kontoadressen,
Teilnehmer, externe Kennung oder Anbieterfassung. Diese Marke ist über die ursprüngliche
Zuordnungstür nicht mehr als Termin lesbar, hält aber denselben Schedulerlauf weiter beendet.
Alle übrigen Zuordnungen und die Anbindungszeile werden tatsächlich gelöscht.

Der authentifizierte Weg ist `POST /api/me/klara/kalender/anbindungen/:id/entfernen` mit
`bestaetigt:true`. Fremd und unbekannt antworten404. Die atomare Entfernung sperrt die Elternzeile,
liest danach die heutigen Entscheidungen und entfernt/reduziert die Zuordnungen in derselben
Transaktion, auch am gated-pool. Zuordnungsschreiben hält dieselbe Elternsperre: ein verspäteter
Abgleich kann nach Entfernen keine privaten Zuordnungsdaten neu speichern.

Nachweise: echte App/API in `kalender-am-server.test.ts`, vorhandene montierte Seite mit
kontrolliertem Transport in `kalender-seite-mounted.test.tsx`, echte PostgreSQL-Transaktionen in
`kalender-pg.integration.test.ts` (Sperrwartung mit pg_blocking_pids, neuer Pool, Fehlerrollback,
Wiederholung und Schreibversuch nach Löschung). Der Anbieter dieser Proben bleibt ausdrücklich
das Vertragsdouble. Keine neuen Tabellen, Zugänge, Scheduler oder externen Löschaktionen.
