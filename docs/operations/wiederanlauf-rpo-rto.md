# Datenverlust und Wiederanlauf — RPO/RTO-Varianten, Messung, Wiederanlauf (produkt:20261011:peter-p09)

*Stand 11.10.2026. Grundlage: Peters Entscheidungen vom 11.10.2026, Paket PETER-20261011-P09
(„deine empfehlung, arbeite es aus" — RPO/RTO-Varianten ausarbeiten, am tatsächlichen Wiederanlauf
messen; Zahlen nicht beschlossen). Phase: **PoC-Messung; Betrieb nach PoC.***

Dieses Dokument ergänzt den gelieferten Restore/Export (`docs/operations/restore-drill.md`,
`docs/operations/sicherungsbestand.md`). Es führt **keinen zweiten Backupdienst** ein und bestellt
nichts: keine neue Infrastruktur, kein Umzug der Produktion, keine kostenpflichtige Leistung.

## 1. Begriffe

**RPO** ist das maximal tolerierte Alter des wiederherstellbaren Zustands — wie viel Arbeit nach einem
Ausfall höchstens fehlt. **RTO** ist die Zeit vom Ausfall bis zum vereinbarten nutzbaren
Wiederanlauf. Beides gilt für den **ganzen Umfang**: Wissen, Rechte, Historie, Verantwortlichkeit,
Konfiguration und Löschzustände. Die Ursache einer Störung und das gewählte Wiederanlaufszenario
gehören zu jeder Zusage dazu.

## 2. Varianten — VORSCHLÄGE, keine SLA

> **Status aller Zahlen dieses Abschnitts: Vorschlag.** Keine Variante ist vereinbart, keine ist
> gemessen bestätigt. Eine Zahl wird erst zum Ziel, wenn (a) der Kunde sie bestätigt **und** (b) eine
> Messung am Zielaufbau sie einhält (§3). Bis dahin ist sie keine SLA und wird nirgends als Zusage
> ausgegeben.

| Planungsvariante | RPO (Vorschlag) | RTO (Vorschlag) | Geeigneter Ausgangspunkt | Voraussetzung |
| --- | --- | --- | --- | --- |
| Basis | 24 Stunden | 8 Stunden | Arbeitsbereich mit akzeptabler Tagesnachpflege | tägliche geprüfte Sicherung, dokumentierter manueller Wiederanlauf |
| Standard | 1 Stunde | 4 Stunden | täglich genutztes Firmenwissen | häufige Sicherung/Logs, vorbereitete Ersatzumgebung |
| Erhöht | 15 Minuten | 1 Stunde | nachgewiesen zeitkritische Nutzung | passende Infrastruktur, Bereitschaft und gemessene Wiederherstellung |

**Empfehlung (Peter, 45):** Standard als erste nach dem PoC zu kalkulierende Variante; vor Verkauf
gegen Kundenbedarf und tatsächliche Kosten prüfen. Kritikalität des Kunden kann andere Werte
verlangen. Eine laufende Kopie oder RAID ersetzt keinen unabhängigen Wiederherstellungsnachweis.

### Umfang je Variante

Der wiederhergestellte **Umfang** ist in allen drei Varianten derselbe; die Varianten unterscheiden
sich nur darin, **wie alt** der Stand höchstens ist und **wie schnell** er wieder nutzbar ist.

| Bereich | Wo gesichert | Mit dem Restore zurück | Beleg |
| --- | --- | --- | --- |
| Wissen (Beiträge, Fassungen, Anhangsbytes, Quellen, Beziehungen) | Datenbanksicherung (`pg_dump`) | ja | Drill Glied 3/7b; `tests/wiederanlauf/isolierter-wiederanlauf.integration.test.ts` |
| Rechte (Konten mit Rolle/Freigabe, Spaces mit Mitgliedern) | Datenbanksicherung | ja, **im Sicherungsstand** — spätere Entzüge fehlen (§4) | Drill Glied 3b; Messprobe |
| Historie (Fassungen, Auditkette) | Datenbanksicherung | ja; die Kette der Sicherung steht bitgenau am Anfang | Messprobe (Kette), Drill Glied 7 |
| Verantwortlichkeit | Datenbanksicherung (`ownership` am Beitrag) | ja | PV-01, Messprobe |
| Konfiguration in der Anwendung (Upload-Grenzen, Prüferzahl, KI-Zuordnung, Branding …) | Datenbanksicherung | ja | Messprobe (Upload-Grenzen, Prüferzahl) |
| Konfiguration außerhalb (Umgebung, Geheimnisse, Plattform) | **nicht** in der Sicherung — Passwortmanager/Betreiber | neu setzen | `backup-disaster-recovery.md` §8 |
| Löschzustände (Papierkorb, Löschfristen) | Datenbanksicherung | ja, **im Sicherungsstand** — spätere Löschungen fehlen (§4) | Messprobe |

### Was heute erreichbar ist — ehrlich

| Variante | Heute erreichbar? | Grund |
| --- | --- | --- |
| Basis | **nein, solange keine tägliche Sicherung läuft** | Der `backup.sh`-Weg ist am Anwendungshost nicht eingerichtet, die Sicherung der nativen PostgreSQL ist weder belegt noch ausgeschlossen (`sicherungsbestand.md`, Punkte 4–5). |
| Standard | nein | braucht häufige Sicherung oder WAL-Archivierung; belegt ist `archive_mode` aus, 0 archivierte Segmente (`sicherungsbestand.md`) |
| Erhöht | nein | braucht Point-in-Time-Wiederherstellung, Bereitschaft und eine gemessene Ersatzumgebung |

## 3. Bestätigungsregel und Messung (P09-AC02, P09-AC03)

Eine Zahl aus §2 bleibt Vorschlag, bis **beides** vorliegt:

1. **Kundenbestätigung** der Variante (Kritikalität, Arbeitszeiten, akzeptierte Nachpflege).
2. **Messung** am Zielaufbau: ein isolierter Restore mit tatsächlicher Dauer und tatsächlichem
   Datenverlust, der das Ziel einhält.

**Das Messverfahren ist gebaut und läuft im PoC mit fiktiven Daten:**
`tests/wiederanlauf/isolierter-wiederanlauf.integration.test.ts`. Ablauf: fiktiver Bestand über die
echte Anwendung → Sicherung mit dem unveränderten `backup.sh` → Änderungen bis zum „Ausfall" (neuer
Beitrag, Löschung, Rollenentzug, entferntes Konto, Webhook-Zustellung) → Restore mit dem unveränderten
`restore-drill.sh` in eine leere Datenbank → Wiederanlauf mit Sperre, Nachführung, Freigabe (§4).

Gemessen und als `test-results/p09-wiederanlauf/messbericht.json` sowie als Zeile `[P09 MESSBERICHT]`
im Prüfprotokoll abgelegt:

| Feld | Bedeutung |
| --- | --- |
| `sicherung.sicherungsstand` | Zeitstempel der Sicherung (aus dem Dateinamen von `backup.sh`) |
| `ausfall` | Zeitpunkt des simulierten Ausfalls |
| `datenverlust.verlorenesZeitfensterMs` | Ausfall − Sicherungsstand: das gemessene RPO dieses Laufs |
| `datenverlust.verloreneBeitraege` | Beiträge, die es beim Ausfall gab und die im Ziel fehlen |
| `datenverlust.wiederaufgetaucht` | was die Sicherung zurückbringt, obwohl es danach gelöscht/entzogen war |
| `wiederherstellung.dauerMs` | Dauer des Restore-Drills |
| `wiederanlauf.bisFreigabeMs` | Start des Wiederanlaufs bis zur Freigabe |
| `gemesseneWiederanlaufzeitMs` | Ausfall bis Freigabe: das gemessene RTO dieses Laufs |

**Dieses Dokument nennt keine Messzahl.** Die Werte stehen im Bericht des jeweiligen Laufs mit
Kandidat (Commit) und Zeitpunkt. Sie belegen Verfahren und Ablauf **dieses Prüfaufbaus**, nicht die
Produktion: keine menschliche Reaktionszeit, kein Hostausfall (dieselbe Prüf-PostgreSQL, eigene leere
Datenbank), kein Produktionsbestand. Das RPO im Betrieb bestimmt der Sicherungstakt; das RTO
bestimmen zusätzlich Erkennung, Bereitstellung des Ersatzhosts und die Nachführung durch Menschen.

**Offen (nicht gemessen):** Restore nach einem **ausgefallenen Host** — Peters Vorgabe „nicht nur eine
neue Datenbank" — über den Neuinstallationsweg (`docs/operations/kundeninstanz-neuinstallation.md`);
eine Probe am Sicherungsbestand der veröffentlichten Instanz; eine Messung mit realen Anwendern.

## 4. Der Wiederanlauf (P09-AC04, P09-AC05, P09-AC06)

Peters Entscheidung 45: *Wiederanlauf beginnt mit gestoppten Außenaktionen. Zuerst Integrität,
Rechteentzüge und Löschmarkierungen nachführen; anschließend Suche und Bibliothek öffnen.
Kalender-/Routinejobs erst nach Prüfung ihres letzten bestätigten Ausführungspunkts freigeben. Keine
wiederholte Mail, Freigabe oder Friständerung durch Replay.*

Umgesetzt als Schalter am bestehenden Serverstart (`services/app/src/wiederanlauf.ts`):

```bash
KLARWERK_WIEDERANLAUF=restore-20261011 <üblicher Start der Anwendung gegen die wiederhergestellte Datenbank>
```

1. **Außenaktionen gestoppt.** Mit dem Schalter starten Wissensereignis-Meldungen
   (`KLARWERK_WEBHOOKS`), Hintergrundprüfung (Modellvergleiche) und Lückenerkennung **nicht**. Die
   Fristläufe (Papierkorb-Endlöschung, Gedächtnis- und Klara-Aufräumlauf) laufen weiter: sie führen
   Löschfristen nach und wirken nicht nach außen. Auch der Restore-Drill startet seinen Probeserver
   ohne Webhook-Ziele und mit deterministischer KI-Zuordnung (`restore-drill.sh`).
2. **Replay-Grenze.** Vor jeder Anfrage hält die Anwendung fest, welche Meldungen der
   wiederhergestellte Bestand ableiten lässt, und schließt jeden Zustellvorgang ohne Abschluss als
   abgebrochen (`wissensereignis.wiederanlauf-grenze`, Grund `wiederanlauf-grenze`). Über die Grenze
   hinweg gilt **höchstens einmal**: nichts davor geht ein zweites Mal hinaus. Was vor dem Ausfall
   womöglich nie zugestellt wurde, steht namentlich in der Grenze (`unterdrueckt`) und wird mit dem
   Empfänger abgeglichen. Der letzte bestätigte Ausführungspunkt (jüngste Zustellung, letzter
   Hintergrundlauf) steht in der Auskunft.
3. **Sperre bis zur Freigabe.** Bibliothek, Suche, Fragen, Exporte, Schlüsselzugänge und
   Office-Zugriffe antworten mit `503 WIEDERANLAUF`. Offen bleiben Anmeldung, `/health`, der
   Verzeichnisabgleich (SCIM — führt Entzüge des Identitätsanbieters nach) und alles für Konten mit
   `users.manage`.
4. **Nachführen** — mit den vorhandenen Verwaltungswegen, für alles **nach dem Datenstand**
   (`GET /api/admin/wiederanlauf` nennt ihn; maßgeblich für das Alter ist der Sicherungsstand im
   Dateinamen der Sicherung): Konto sperren/Rolle ändern (`PUT /api/users/:id`), Konto entfernen,
   Space-Mitgliedschaft, Beitrag in den Papierkorb (`DELETE /api/kos/:id`). Quellen dafür liegen
   außerhalb der wiederhergestellten Datenbank: Identitätsanbieter/Austritte, bearbeitete
   Löschanträge, Tickets. Der Datenstand ist der jüngste Eintrag der wiederhergestellten Kette;
   lief ein Drill gegen dasselbe Ziel, ist es dessen Anmeldung.
5. **Freigabe** (`POST /api/admin/wiederanlauf/freigabe`, nur `users.manage`) mit allen vier
   Bestätigungen `integritaet`, `rechteentzuege`, `loeschmarkierungen`, `aussenaktionen`. Die
   Anwendung prüft die Auditkette selbst — mit der Regel des Drills (Kettenbrüche, unerklärte und
   ungeprüfte Abweichungen = 0); trägt sie nicht, gibt es keine Freigabe (409). Die Freigabe steht als
   `wiederanlauf.freigegeben` in der Kette und gilt auch nach einem Neustart mit derselben Kennung.
6. **Außenaktionen wieder an:** Neustart **ohne** `KLARWERK_WIEDERANLAUF`. Die Meldungen laufen ab
   der Grenze weiter.

**Grenzen.** Mails, die eine Verwaltungshandlung während der Sperre selbst auslöst, sind keine
Wiederholung, gehen aber hinaus. Der Tagesverbrauch der Hintergrundprüfung zwischen Sicherung und
Ausfall fehlt der Kette; am Tag des Wiederanlaufs kann das Budget deshalb einmal zu hoch angesetzt
sein. Kalender- oder Routineaufträge mit eigener Fristwirkung gibt es im Produkt derzeit nicht;
käme einer dazu, gehört er in `GESTOPPTE_AUSSENAKTIONEN`.

Belege: `tests/wiederanlauf/sperre-und-freigabe.test.ts` (Sperre, Nachführung, Freigabe, Kettenbruch),
`tests/wiederanlauf/replay-grenze.test.ts` (Gegenprobe ohne Grenze, Grenze, Wiederholung),
`tests/wiederanlauf/serverstart.test.ts` (echter Prozess mit und ohne Schalter),
`tests/wiederanlauf/isolierter-wiederanlauf.integration.test.ts` (echter Restore).

## 5. Zweite unabhängige Sicherung — Plan nach dem PoC (P09-AC07)

**Ausdrücklich erst nach dem PoC auszuarbeiten und einzurichten.** Im PoC wird nichts davon bestellt
oder eingerichtet; der B3-Kandidat `fe14fb08` bleibt dafür offen (`sicherungsbestand.md`, Punkt 1).

Was der Plan nach dem PoC festlegen muss:

| Punkt | Festzulegen | Zuständig |
| --- | --- | --- |
| Unabhängiger Ausfallbereich | anderer Anbieter oder andere Region als Anwendungs- und Datenbankhost | Betreiber, nach PoC zu benennen |
| Betreiber der Zweitkopie | benannte Person/Firma samt Vertretung | Peter mit Kunde |
| Schlüsselzugriff | Verschlüsselung der Kopie; Schlüssel getrennt von der Kopie und vom Produktionshost | Betreiber |
| Takt | aus der gewählten Variante (§2): täglich (Basis) bis laufende Archivierung (Standard/Erhöht) | Betreiber |
| Nachweis | Restore aus der Zweitkopie mit diesem Drill und dieser Messprobe, datiert und protokolliert | Betreiber, Prüfung |
| Lagebild | kein ungetestetes „sicher": die Verwaltung zeigt Grün nur aus einem bestandenen Drill | Produkt (vorhanden, `sicherungsbestand.md`) |

## 6. Kosten und erreichbare Ziele vor einer SLA-Zusage (P09-AC08)

Eine RPO/RTO-Zusage an einen Kunden setzt **alle** Punkte dieses Tors voraus:

1. Variante mit dem Kunden gewählt (§2), Kritikalität begründet.
2. Kosten der Variante kalkuliert — Hosting/Sicherungen/Monitoring (K7) und Betriebsstunden inkl.
   Bereitschaft (K8) aus `docs/operations/budget-cost-planning-readiness.md`; Speicher und Übertragung
   der Zweitkopie (§5). **Dieses Dokument nennt keine Preise;** sie werden nach dem PoC aus Angeboten
   ermittelt, nicht geschätzt.
3. Messung am Zielaufbau hält die Werte ein (§3), einschließlich Hostausfall.
4. Zweite unabhängige Sicherung eingerichtet und aus ihr wiederhergestellt (§5).
5. Betreiber und Vertretung benannt; Wiederanlauf (§4) einmal mit diesen Menschen geübt.

| Variante | Kostentreiber (qualitativ) | Erreichbar ohne neue Infrastruktur? |
| --- | --- | --- |
| Basis | tägliche Sicherung + Zweitkopie, manueller Wiederanlauf in Arbeitszeit | ja, sobald die tägliche Sicherung tatsächlich läuft und geprüft ist |
| Standard | stündliche Sicherung oder WAL-Archivierung, vorbereitete Ersatzumgebung, Rufbereitschaft | nein — Archivierung und Ersatzumgebung fehlen |
| Erhöht | Point-in-Time-Wiederherstellung, warme Ersatzumgebung, 24/7-Bereitschaft | nein |

Solange das Tor nicht vollständig ist, gilt: **keine SLA**, nur die Vorschläge aus §2.
