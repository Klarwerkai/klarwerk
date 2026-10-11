# Sicherheitsbewertung NFR-SEC-04 / R-2059 — Injection, XSS im WYSIWYG-HTML, CSRF, IDOR

Auftrag: `aufnahme:20260922:gesamt-sicherheit-erzwingen` (R-0643, R-2059, SOLL:NFR-SEC-04).
Anforderung (`specs/reference/Pflichtenheft.md:188`): „Schutz gegen OWASP-Top-10 (Injection, XSS im
WYSIWYG-HTML, CSRF, IDOR). AK: Security-Review bestanden."

Diese Bewertung ist das Security-Review des Codes für genau diese vier Klassen. Sie ordnet jeder
Klasse den Schutzmechanismus im Code, die ausgeführten Prüfungen mit Ergebnis und die verbleibenden
Nachweislücken zu. Ein Urteil steht nur dort, wo ein ausgeführter Prüfbericht es trägt.

Nicht Teil dieser Bewertung und getrennt offen:

- **Penetrationstest (AG-07).** Er ist das Abnahmekriterium von NFR-SEC-03 (`Pflichtenheft.md:187`),
  nicht von NFR-SEC-04. R-0643 nennt ihn ausstehend; er ist als Aufgabe der Systemadministration
  geführt (`PROJECT_CONTEXT/13_ASSISTENT_ZWISCHENBERICHT.md`).
- **Übrige OWASP-Top-10-Klassen** (etwa unsichere Abhängigkeiten, Fehlkonfiguration im Betrieb). Das
  Pflichtenheft nennt in Klammern ausdrücklich die vier Klassen oben.

Prüfberichte (unverändert archiviert im Auftragsordner unter `HISTORIE/`):

| Lauf | Datei | Ergebnis |
| --- | --- | --- |
| nacharbeit-1 | `PRUEFUNG/owasp-csrf-xss-idor.log` | 92 von 94; rot nur `route-guard-audit` (Scannerfehler, s. IDOR) |
| nacharbeit-2 | `PRUEFUNG/routenwaechter-nacharbeit.log` | 58 von 59; rot nur `g10` (fehlender Matrixeintrag, s. IDOR) |
| nacharbeit-3 | `PRUEFUNG/zeilenrecht-matrix-nacharbeit.log` | `g10` 7/7, `route-guard-audit` 13/13 |

## 1. Injection

**Mechanismus.** Alle Werte gehen als Platzhalter (`$1 …`) an Postgres, nie als Text in die Anweisung:
Schreibweg `services/knowledge-object/src/repo-pg.ts:406`, Detailabruf `:439`, Listenfilter
`:578–607` (`type`, `status`, `category`, `tag` als `$n`, Tag über `JSON.stringify` und `::jsonb`),
Kandidatensuche `:835–868`.

**Prüfungen.**

- Strukturprüfungen am erzeugten SQL über einen Pool-Ersatz: `repo-pg-candidates.test.ts`,
  `search-projection-repo-pg.test.ts` („vollständig parametrisiert"). Sie belegen die Bauform,
  nicht das Verhalten einer echten Datenbank.
- **Neu:** `tests/security/injection-am-echten-postgres.integration.test.ts`. Am echten Postgres
  werden Zeichenkettenausbruch, Tautologie, gestapelte Anweisung und JSONB-Ausbruch über den
  Schreibweg, den Detailabruf und die Listenfilter von `GET /api/kos` geschickt. Erwartet: der Wert
  wird wörtlich gespeichert, Tautologien finden nichts, die Tabelle steht und behält ihre Zeilenzahl.
  Gegenprobe: derselbe Wert wörtlich als Filter trifft genau den Eintrag, der ihn trägt.

**Urteil.** Noch offen — die neue Postgres-Prüfung ist eingeplant, aber noch nicht ausgeführt. Ein
übersprungener Lauf (ohne Postgres) ist kein Beleg.

**Verbleibende Nachweislücke.** Die Suchprojektion (`KoSearchProjectionRepo.findActive`) und die
übrigen Pg-Ablagen sind nur strukturell, nicht am echten Postgres gegen eingeschleuste Werte geprüft.

## 2. XSS im WYSIWYG-HTML

**Mechanismus.** Der Editor-Inhalt wird serverseitig bereinigt gespeichert:
`services/knowledge-object/src/service.ts:647` (`sanitizeHtml`), Regeln in
`services/structure/src/sanitize.ts`. Hochgeladenes HTML wird nicht als Seite ausgeliefert
(`application/octet-stream`, `Content-Disposition: attachment`, `nosniff`). Zweite Ebene: strikte
CSP `script-src 'self'` (`services/app/src/security-headers.ts:168–188`).

**Prüfungen (nacharbeit-1, grün).** `services/structure/src/sanitize.test.ts` 50/50,
`tests/security/job2675-sanitizer-attribut-escape.test.ts` 10/10,
`services/app/src/routes/object-raw-xss.test.ts` 4/4; CSP und Kopfzeilen in
`tests/app/csp-upgrade-insecure-requests.test.ts` und `tests/app/word-addin-csp.test.ts`
(Suite `kopfzeilen-und-zugriffsbremse` 33/33).

**Urteil.** Kein offener Befund in den geprüften Wegen.

**Verbleibende Nachweislücke.** Die Ausnahme-CSP des Word-Taskpanes erlaubt `'unsafe-inline'`
(`security-headers.ts:43`). Dort trägt allein die Bereinigung; das ist eine bewusste, dokumentierte
Ausnahme, keine Lücke im Bereiniger.

## 3. CSRF

**Mechanismus.** Herkunftsprüfung jedes schreibenden Aufrufs mit Sitzungscookie
(`services/app/src/csrf.ts:224`, verdrahtet in `services/app/src/build-app.ts:2644`): nur
`Sec-Fetch-Site: same-origin|none` bzw. eigene `Origin`; sonst 403. Zweite Ebene: Sitzungscookie
`SameSite=Lax`, `HttpOnly` (`services/auth/src/routes.ts:133`). Bearer-Token und Dienst-Schlüssel
sind kein automatisch mitgesendeter Nachweis.

**Prüfungen.** `services/app/src/csrf.test.ts` 13/13 (nacharbeit-1) am echten `buildApp`;
Cookie-Attribute am echten Login in `tests/security/schutz-am-echten-aufbau.test.ts` 6/6.

**Urteil.** Kein offener Befund in den geprüften Wegen.

**Verbleibende Nachweislücke, im Code benannt.** Ein Browser ohne `Sec-Fetch-Site` und ohne `Origin`
wird durchgelassen; für ihn bleibt nur `SameSite=Lax` (`csrf.ts:72–76`).

## 4. IDOR (unberechtigter Objektzugriff)

**Mechanismus.** Serverseitiges Routenrecht je Route (`requirePermission`, `requireUser`,
Dienst-Schlüssel-Wache) und Zeilenrecht je Objekt (`darfSehen`, `sichtbareFuer`,
`services/app/src/sichtbarkeit.ts`). Fehlt die Schutzabhängigkeit, antworten die Lesewege
fail-closed.

**Prüfungen.**

- `tests/security/mega76-schutz-erzwungen.test.ts` 9/9 (nacharbeit-1): Routen und Dienste ohne
  Schutzabhängigkeit liefern leer bzw. 404.
- `tests/security/route-guard-audit.test.ts` 13/13 (nacharbeit-3): jede verdrahtete Route steht mit
  Schutzart in der Matrix; keine schreibende Route ist öffentlich außer den Anmelde-Einstiegen.
  Der Lauf in nacharbeit-1 war rot (92/94), weil der Scanner `POST /api/ask` falsch las; der Scanner
  liest seitdem den Registrierungskopf und erfasst `/mcp` erstmals.
- `tests/security/g10-herkunft-zentrum-vertraulich.test.ts` 7/7 (nacharbeit-3): jede Route mit
  Zeilenprädikat führt es in der Matrix. Der Lauf in nacharbeit-2 war rot, weil drei Importrouten
  (`/api/library/import…`) ihr `darfSehen` nicht in der Matrix trugen; nachgetragen.

**Urteil.** Kein offener Befund in den geprüften Wegen.

**Verbleibende Nachweislücke.** Der Routenwächter liest Quelltext. Er belegt die Verdrahtung, nicht
jeden Zugriff zur Laufzeit; die Laufzeitbelege decken die in `mega76` und `g10` genannten Wege ab.

## Gesamturteil

XSS, CSRF und IDOR: bestanden für die geprüften Wege, mit den oben benannten Restrisiken.
Injection: noch nicht bestanden — es fehlt der Bericht des ausgeführten Postgres-Laufs. Erst mit
ihm ist das Abnahmekriterium von NFR-SEC-04 für alle vier Klassen erfüllt.
