# Klarwerk — DSGVO-/Compliance-Runbook (Betreiber)

> **Keine Rechtsberatung.** Dieses Dokument ist eine **praktische Betreiber-Checkliste/Runbook**,
> um den Compliance-Start und das laufende Review zu strukturieren. Die rechtliche Bewertung
> (Rechtsgrundlagen, AV-Verträge, DSFA-Pflicht) verantwortet der **Betreiber** mit seinem
> Datenschutzbeauftragten (DSB) / juristischer Beratung.
> Technische Nachweise: `docs/qm/claude-after-report.md` (SCRUM-214 Audit, SCRUM-212 RBAC/Auth),
> Nutzer-Doku: `docs/onboarding/user-quickstart.md`, Betrieb: `docs/operations/*`.

---

## 0. Rollen & Verantwortung

- **Verantwortlicher i. S. d. DSGVO:** der Betreiber/Kunde, der Klarwerk für seine Belegschaft betreibt.
- **Klarwerk (Software):** stellt technische Schutzmaßnahmen bereit (RBAC, Auth, append-only Audit). Je nach Hosting-Konstellation kann ein **Auftragsverarbeitungs-Verhältnis (AVV)** entstehen (z. B. Managed-Hosting) — vom Betreiber zu klären.
- **Grenze:** Klarwerk trifft **keine** automatischen rechtlichen Entscheidungen; Erfassen/Validieren/Löschen bleiben menschliche Handlungen.

---

## 1. VVT-Check (Verzeichnis von Verarbeitungstätigkeiten)

> **Seit Auftrag „Betroffenenrechte" (R-0667) entsteht das Verzeichnis aus dem System selbst:**
> *Verwaltung → Sicherheit und Nachweise → Datenschutz → Verarbeitungsverzeichnis* (JSON oder
> Markdown; `GET /api/datenschutz/verarbeitungsverzeichnis`). Es wird aus dem Dateninventar
> (`services/app/src/dateninventar.ts`) und der Betriebslage zum Erzeugungszeitpunkt gebaut
> (effektiv zugeordnete externe Modellanbieter, externe Recherche, Mailversand). Rechtsgrundlage,
> Verantwortlicher/DSB und die im Code nicht festgelegten Fristen stehen darin ausdrücklich als
> „vom Betreiber einzutragen". Die Tabelle unten bleibt als Kurzüberblick; bei Abweichung gilt das
> erzeugte Verzeichnis.

Mindest-Verarbeitungen und Datenkategorien im aktuellen Stand (Betreiber ergänzt Rechtsgrundlage, Zwecke, Empfänger, Löschfristen):

| Verarbeitung | Datenkategorien (personenbezogen?) | Speicherort | Hinweis |
| --- | --- | --- | --- |
| **Benutzerkonten** | Name, **E-Mail**, Passwort-**Hash+Salt** (kein Klartext), Rolle, Freigabe-Status, Erstellzeit | `users`-Tabelle (Postgres) bzw. In-Memory | direkt personenbezogen |
| **Passwort-Reset** | Reset-Token + Bezug zum Konto, Ablauf | `password_resets` | personenbezogen, kurzlebig |
| **Zwei-Faktor-Anmeldung (eigene, TOTP)** | TOTP-Geheimnis + Bezug zum Konto, Einrichtungszeit, zuletzt verbrauchter Zeitschritt | `user_second_factors` | personenbezogen; das Geheimnis liegt (wie bei TOTP nötig) lesbar in der Datenbank und ist wie ein Zugangsgeheimnis zu schützen; wird beim Löschen des Kontos entfernt |
| **Wissensobjekte (KO)** | Titel, Aussage, Inhalt, Tags, **Autor/Original-Autor (User-ID)**, Quellen, Anhänge, Historie | KO-Store | i. d. R. Fachwissen; **Autorenbezug** = personenbezogen; Freitext kann unbeabsichtigt PII enthalten |
| **Kommentare/Validierungsfeedback** | Freitext + Autorbezug | am KO | personenbezogen (Autor), Freitext-PII möglich |
| **Fragen/Wissenslücken** | Fragetext + Steller, Priorität/Zuweisung | Ask/Gap-Store | personenbezogen (Steller), Freitext-PII möglich |
| **Audit-Log** | wer (User-ID), wann, Aktion, Ziel, Payload | Audit (append-only Hash-Kette) | personenbezogen; **bewusst append-only** |
| **Auth-Events / Server-Logs** | Login/Logout, ggf. IP über Reverse-Proxy | Audit + Proxy/Server-Logs | Proxy-Logs separat vom Betreiber zu erfassen |

**To-do Betreiber:** je Zeile Zweck, Rechtsgrundlage (Art. 6), Empfänger/Subprozessoren (Hosting, ggf. KI-Modellanbieter bei aktivem Modellmodus), Löschfristen und TOMs ergänzen. Vorlage: Standard-VVT-Muster der zuständigen Aufsichtsbehörde.

---

## 2. DSFA/DPIA-Entscheidungshilfe (Schwellwert)

Eine **DSFA ist zu prüfen**, wenn eine oder mehrere Fragen mit „ja" beantwortet werden:

- [ ] Werden **besondere Kategorien** (Art. 9: Gesundheit, etc.) oder Beschäftigtendaten in größerem Umfang verarbeitet?
- [ ] Erfolgt **systematische Überwachung/Bewertung** von Beschäftigten (z. B. Audit zur Leistungs-/Verhaltenskontrolle)?
- [ ] Wird der **Modellmodus** mit externem KI-Anbieter genutzt (Datenfluss an Dritte/Drittland)?
- [ ] Werden Inhalte aus **vielen Quellen** zu Personen zusammengeführt?

**Einordnung aktueller Stand (Hinweis, keine Bewertung):** Klarwerk verarbeitet primär *betriebliches Fachwissen* + minimale Konto-/Audit-Daten; im **deterministischen Default** verlassen keine Daten das System. Bei **aktivem Modellmodus** (externer API-Key) ist der Datenfluss an den Modellanbieter Teil der DSFA-Prüfung. Der Audit dient der **Nachvollziehbarkeit/Integritätsprüfung** (append-only, hash-verkettet; Abweichungen rechnerisch prüfbar, nicht verhindert), nicht der Mitarbeiterüberwachung — diese Zweckbindung sollte in einer Betriebsvereinbarung festgehalten werden.

---

## 3. Betroffenenrechte — Umsetzung & Lücken

| Recht | Produkt-Unterstützung heute | Organisatorisch/Betreiber |
| --- | --- | --- |
| **Auskunft** (Art. 15) | **Profil → „Meine Daten"**: Konto, eigene Objekte, Bearbeitungen, Kommentare, Entwürfe, Fragen, Antwortbelege, Bewertungen, Zuweisungen, Kenntnisnahmen, Uploads (Metadaten), Lernpfade, Bereichsverantwortung/Ruhestandshorizont, Löschanträge, Nachfolge bei Befristung (als befristetes Konto, Nachfolge oder setzende Person), Protokollzeilen — mit Übergabe-Stand und der Liste dessen, was nicht enthalten ist (mit Grund). Für Konten ohne Anmeldung: Auskunft durch die Verwaltung (Datenschutzkarte). Jede erteilte Auskunft steht im Prüfprotokoll (`datenschutz.auskunft`). | Fristen und Identitätsprüfung bei Anfragen ausserhalb des Systems festlegen |
| **Berichtigung** (Art. 16) | Profil-Selbstbedienung (Name/Passwort); Admin-Korrektur; KO-Inline-Bearbeitung (neue Version, Historie) | Prozess für Korrekturanträge festlegen |
| **Löschung** (Art. 17) | **Profil → „Konto löschen lassen"**: Antrag mit Frist (ein Monat, Art. 12 Abs. 3), als Aufgabe in Glocke und Datenschutzkarte der Verwaltung; Erledigen löscht über `user.delete` (Konto + Sitzungen), Ablehnen nur mit Grund. Admin kann weiterhin **KOs löschen** (`ko.deleted`). | **Verweise bleiben stehen** (Umschreiben auf „ehemalige Person" ist offen, R-0642); **Audit-Einträge werden nicht gelöscht** (append-only, hash-verkettet) → Abwägung Recht auf Löschung ↔ Nachweispflicht dokumentieren |
| **Einschränkung** (Art. 18) | über Rollen/Rechte (Zugriff einschränken) | manueller Prozess |
| **Datenübertragbarkeit/Export** (Art. 20) | „Meine Daten" als **JSON-Datei**; dazu der fachliche KO-/Bibliotheks-Export (JSON/Markdown/MediaWiki/HTML) | Datei-Bytes eigener Uploads sind am Objekt abrufbar, nicht in der JSON-Datei |
| **Widerspruch** (Art. 21) | — | organisatorischer Prozess |

**Ehrlicher Hinweis:** Auskunft/Datenmitnahme und Löschantrag sind seit Auftrag „Betroffenenrechte" Produktfunktion (NFR-PRV-04). **Nicht** umgesetzt sind *Löschung im Audit* (bewusst), das *Umschreiben der Verweise* bei Kontolöschung (R-0642) und *Löschfristen je Datenart* (Betreiberentscheidung, `docs/entscheidungen/loeschung-aufbewahrung.md`). Lieferstand und Grenzen: `docs/entscheidungen/betroffenenrechte.md`.

---

## 4. Technische Schutznachweise (Stand belegt)

- **Zugriffsschutz/RBAC** (SCRUM-212): Rollen viewer/experte/controller/admin; serverseitige Guards (`requirePermission`, 401/403) auf allen Routen; UI-Gating konsistent; Auth via Passwort + OIDC (PKCE), Freigabe-Workflow.
- **Nachvollziehbarkeit/Integrität** (SCRUM-214): lückenloses **append-only Audit-Log** mit Hash-Kette + Abweichungserkennung (tamper-evident; kein extern verankerter Kettenkopf); Einsicht Controller/Admin (Analytics-Audit + `GET /api/audit`).
- **Keine Geheimnisse im Client** (G-7): keine Secrets/Schlüssel im Browser-Bundle.
- **Vorab-Schutz** (`docs/operations/pre-launch-protection.md`): noindex + Basic-Auth-Gate am Reverse-Proxy; TLS/HTTPS und Backups über die Hosting-Schicht (`docs/operations/deploy-hetzner.md`).
- **Demo-/Default-Credentials:** vor Produktivnutzung **zwingend ändern** (Demo-Seed ist produktionsgeschützt/idempotent).

---

## 5. Nutzungsrichtlinie / AUP (KI- & Knowledge-OS-Nutzung)

Kurz-Richtlinie für Endnutzer (in Betriebsvereinbarung/AUP übernehmen):

1. **Datenminimierung:** Nur betrieblich notwendiges Fachwissen erfassen. **Keine** personenbezogenen/sensiblen Daten Dritter und keine besonderen Kategorien (Art. 9) in Freitext/Anhänge, sofern nicht ausdrücklich erforderlich und rechtlich gedeckt.
2. **Quellenbindung:** Wissen mit Quelle/Beleg erfassen; keine vertraulichen Fremddaten ohne Nutzungsrecht.
3. **KI ist Hilfsmittel, nicht Wahrheit:** Die KI strukturiert/formuliert; **Mensch prüft, validiert und entscheidet**. Antworten stammen nur aus validiertem Wissen; ohne Grundlage → ehrliche Wissenslücke.
4. **Kein Missbrauch:** Audit/RBAC dienen Nachvollziehbarkeit und Schutz — keine Umgehung, kein unbefugter Zugriff.
5. **Modellmodus-Hinweis:** Bei aktivem externem Modell gelten zusätzliche Datenfluss-Regeln (s. DSFA) — sensible Inhalte ggf. ausschließen.

---

## 6. Regelmäßiges Compliance-Review (Kadenz/Prozess)

**Quartalsweise** (oder bei Trigger-Events) durch Betreiber/DSB:

- [ ] VVT aktuell? Neue Verarbeitungen/Subprozessoren (z. B. KI-Modellanbieter) ergänzt?
- [ ] DSFA-Schwellwert erneut geprüft (insb. bei Aktivierung Modellmodus)?
- [ ] Rollen/Rechte-Review: Least-Privilege noch gegeben? Verwaiste/zu hohe Admin-Konten? (Nutzerliste `/admin`).
- [ ] Audit-Integrität stichprobenhaft geprüft (`verify`/Analytics-Audit); auffällige Aktionen reviewt.
- [ ] Default-/Demo-Credentials geändert; Vorab-Gate/TLS/Backups aktiv.
- [ ] Betroffenenrechte-Anfragen im Quartal: Bearbeitungsstand/Fristen.
- [ ] AUP/Onboarding aktuell und kommuniziert.

**Trigger-Events** (Review sofort): neue Datenkategorie, Aktivierung externer KI, Rollen-/Berechtigungsänderung in der Breite, Sicherheitsvorfall, Personalwechsel mit Admin-Rechten.

> **Terminierung:** Der Betreiber legt einen festen Quartalstermin + Verantwortlichen fest (z. B. „erster Werktag im Quartal, DSB + Admin"). Dieses Runbook ist die Checkliste dafür.

---

## 7. Offene Betreiberpflichten / Restlücken (ehrlich)

- **Rechtliche Bewertung** (Rechtsgrundlagen, AVV/Subprozessoren, DSFA-Pflicht, Aufbewahrungs-/Löschfristen) — durch DSB/Anwalt, **nicht** durch dieses Dokument.
- **Self-Service DSGVO-Workflows** — Auskunft/Datenmitnahme und Löschantrag sind Produktfunktion (s. §3). Offen bleiben Löschung im append-only Audit (bewusst nicht), Verweisumschreibung bei Kontolöschung (R-0642) und Fristen je Datenart.
- **Server-/Proxy-Logs & IP-Adressen** außerhalb des App-Audits — Betreiber-Logging-Policy.
- **Betriebsvereinbarung** zur Audit-Zweckbindung (Nachvollziehbarkeit/Integritätsprüfung, nicht Leistungskontrolle) — organisatorisch.

---

*Read-only Betreiber-Runbook. Kein Produktcode geändert; verweist nur auf vorhandene Funktionen/Doku. Keine Rechtsberatung — Verantwortung beim Betreiber.*
