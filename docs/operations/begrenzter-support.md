# Begrenzter Support — Konzept und Integrationsvertrag

*Auftrag `produkt:20261011:peter-p11` · Quelle: Peters Entscheidungen 11.10.2026, `PETER-20261011-P11`
(Frage 48 „Supportzugang") · Ausgangsstand `459da8fd` (`1.0.0-beta.1.951`)*

> **Phase: Konzept jetzt, Betreiber nach dem PoC.** Dieses Dokument und der Vertrag
> `services/app/src/supportzugang-vertrag.ts` legen fest, wie ein künftiger Supportzugang sich
> verhalten muss. Gebaut ist **kein** Zugang: keine Route, kein Konto, keine Relaisinstanz, keine
> Supportsitzung. Konkreter Betreiber und realer Kundensupport folgen erst nach dem PoC.

## 1. Bestand vor diesem Auftrag

- Das Produkt hat **keinen Fernzugang und kein eingebautes Supportkonto**
  (`docs/operations/kundenbetrieb-betriebsmodelle.md` §2.4). `KLARWERK_SUPPORT_URL` zeigt nur einen
  Kontaktweg (`services/app/src/routes/support-routes.ts`); es werden keine Daten übertragen.
- Supportzugriff auf Inhalte entsteht heute nur, wenn der Verwalter einer Firma ein normales Konto mit
  Rolle anlegt — ohne Zweck, Datenbereich, Ablauf oder getrennte Rechte.
- Der Fernhilfeweg der Insel (ausgehend, auf Klick, trennbar, protokolliert;
  `docs/operations/UEBERGABE-KLARWERK-Insel.md`) und sein Relaisblocker sind **unverändert**. Dieser
  Auftrag berührt sie nicht.
- Verknüpfter Elternvertrag `aufnahme:20260922:gesamt-supportzugriff` („Befristeten Supportzugriff
  benennen und belegbar entziehen", R-0621) bleibt mit seinen Kriterien und Belegen unverändert; dieses
  Dokument präzisiert ihn nur.

## 2. Ablauf

Supportfall → gewünschter Umfang → Freigabe durch den Kundenadmin → benannte Supportperson mit eigener
Identität und MFA → sichtbare aktive Sitzung → tatsächliches Ablaufdatum → sofortiger Widerruf →
Abschlussbeleg. Notfallzugriff ist ein **eigener, später zu beschließender** Prozess und keine versteckte
Hintertür; er ist hier nicht enthalten.

## 3. Kriterien und ihre Stelle im Vertrag

| Kriterium | Festlegung | Vertrag (`supportzugang-vertrag.ts`) |
| --- | --- | --- |
| P11-AC01 Namentliche Identität | Jede Freigabe gehört **einer** Person mit persönlicher Kennung, Namen, Betreiber und bestätigter MFA. Funktionskennungen (`support@`, `helpdesk`, `admin`, `team` …) gelten als geteiltes Dauerkonto und werden abgewiesen. Eine Identität ohne Freigabe hat keinen Zugriff. | `identitaetPruefen`, `freigabeErteilen` |
| P11-AC02 Bestätigung durch Kundenadmin | Nur ein Konto mit Nutzerverwaltung (`users.manage`, Rolle `admin`) erteilt die Freigabe; Fall, Zweck, Datenbereich und Dauer sind Pflicht; die Supportperson kann sich nicht selbst freigeben; die Erteilung trägt einen Beleg. | `freigabeErteilen` |
| P11-AC03 Diagnose zuerst | Jede Freigabe enthält Diagnose; ohne weitere Angabe **nur** Diagnose. Diagnose sieht Betriebszustand ohne Wissensinhalt (`DIAGNOSE_UMFANG`). | `mitInhaltszugriff`, `DIAGNOSE_UMFANG` |
| P11-AC04 Getrennte Rechte | Lesen, Ändern und Export werden **einzeln** beantragt und geprüft; keines schließt ein anderes ein. Export ist standardmäßig gesperrt und braucht eigenen Zweck und Löschfrist. | `zugriffPruefen`, `freigabeErteilen` |
| P11-AC05 Zeitwerte | 60 Minuten je Sitzung, 15 Minuten Inaktivität, höchstens 4 Stunden nur mit erneuter Freigabe — **Vorschläge, nicht beschlossen, keine SLA**. Konfigurierbar; geänderte Werte heißen `konfiguriert`, nie `beschlossen`. | `VORGESCHLAGENE_ZEITWERTE`, `zeitwerteFestlegen`, `ZEITWERTE_HINWEIS` |
| P11-AC06 Ablauf und Inaktivität | Nach Ablaufzeit oder Inaktivität verweigert jede Zugriffsprüfung. Nur Bedienung der Person zählt als Aktivität; Hintergrundabfragen verlängern nichts. Laufende Sitzungen und Jobs werden beim Ablauf beendet. | `freigabeZustand`, `zugriffPruefen`, `ablaufDurchsetzen` |
| P11-AC07 Widerruf | Widerruf durch den Kundenadmin gilt sofort und beendet alle unter der Freigabe laufenden Sitzungen **und** Jobs. Was sich nicht beenden ließ, steht offen im Ereignis (`vollstaendig: false`), wird nicht verschwiegen. | `widerrufen` |
| P11-AC08 Verlängerung und Abschluss | Verlängerung nur durch den Kundenadmin, nur bei aktiver Freigabe, höchstens um eine Sitzungsdauer und nie über die Höchstdauer, nur mit realem Beleg (Ticket oder Adminbestätigung mit auffindbarer Kennung; Platzhalter wie `TODO`, `-`, `offen` werden abgewiesen). Abschluss nennt Ergebnis und Beleg und beendet verbliebene Bindungen. | `verlaengern`, `abschliessen`, `belegPruefen`, `SupportEreignis` |

## 4. Anschluss beim späteren Bau

Der Vertrag ist absichtlich ohne Speicher und Zeitgeber, damit kein neues Verwaltungs-, Scheduler- oder
Policy-System entsteht. Beim Bau nach dem PoC:

- **Sitzungsprüfung:** jede Supportanfrage ruft `zugriffPruefen` mit dem tatsächlich benötigten Recht;
  Hintergrundabfragen mit `hintergrund`.
- **Jobs:** ein unter einer Freigabe gestarteter Job trägt deren Kennung als `FreigabeBindung` und prüft
  vor jedem Schritt erneut.
- **Ablauf:** an einem vorhandenen Lauf (z. B. derselbe Takt wie die Papierkorb-Endlöschung) ruft der
  Betrieb `ablaufDurchsetzen`; ein eigener Scheduler ist nicht vorgesehen.
- **Protokoll:** jedes `SupportEreignis` geht in das bestehende Prüfprotokoll.

## 5. Grenzen und offene Punkte

- **Nicht gebaut:** Route, Oberfläche, Speicherung, Anbindung an Prüfprotokoll und Jobs. Kein Weg öffnet
  heute einen Supportzugang; `SUPPORTZUGANG_PHASE.zugangAktiv` ist `false`.
- **Betreiber offen:** Anbieterzuständigkeit, Vertraulichkeitsvereinbarung, Auftragsverarbeitung und
  Bereitschaft hängen vom künftigen Betreiber ab. Bis dahin **keine** behauptete 24/7-Bereitschaft und
  keine Reaktionszeit.
- **Zeitwerte offen:** 60/15/240 Minuten sind Vorschläge; ein Beschluss steht aus.
- **Notfallzugriff:** eigener, später zu beschließender Prozess.
- **Nachweis:** belegt ist das Vertragsverhalten an fiktiven Testdaten
  (`tests/begrenzter-support/supportzugang-vertrag.test.ts`). Ein Lauf mit realem Betreiber, realer
  Supportperson oder realem Kundenadmin ist **nicht** belegt und gehört in die Phase nach dem PoC.
