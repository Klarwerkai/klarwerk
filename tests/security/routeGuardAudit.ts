// SCRUM-367 / AG-11 / FR-RBAC-04 / NFR-SEC-04: maschinenlesbarer RBAC-Route-Guard-Audit.
//
// Diese Datei ist die ERWARTETE Schutz-Matrix aller HTTP-Routen (App + Auth + Composition-Root).
// Der begleitende Test (route-guard-audit.test.ts) scannt die ECHTEN Route-Quelldateien und vergleicht
// die tatsächlich verdrahtete Schutzart gegen diese Erwartung. So ist AG-11 (RBAC-Vollabdeckung) als
// Regression belegt: Eine neue/umgehängte/herabgestufte Route bricht den Test, statt unbemerkt zu
// bleiben. Reine Daten + ein dateibasierter Scanner — kein laufender Server, kein DOM.

import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";

// Schutzarten:
//  - "public"             : bewusst ohne Auth (Begründung in REASONS Pflicht).
//  - "auth"               : jeder angemeldete Nutzer (requireUser).
//  - "admin"              : nur Admin (requireAdmin der Auth-Routen).
//  - <Permission>         : serverseitige Rechteprüfung (requirePermission).
//  - "action-dispatched"  : ein Endpunkt mit mehreren Aktionen, jede mit eigener Rechteprüfung
//                           (z. B. PUT /api/kos/:id) — nie öffentlich.
export type Protection =
  | "public"
  | "auth"
  | "admin"
  | "ko.read"
  | "ko.create"
  | "ko.validate"
  | "ko.assign"
  | "conflict.resolve"
  | "users.manage"
  | "action-dispatched";

export const KNOWN_PERMISSIONS: readonly Protection[] = [
  "ko.read",
  "ko.create",
  "ko.validate",
  "ko.assign",
  "conflict.resolve",
  "users.manage",
];

export const MUTATING_METHODS = ["POST", "PUT", "DELETE", "PATCH"] as const;

export interface ScannedRoute {
  method: string;
  url: string;
  protection: Protection;
  file: string;
}

const ROUTE_RE = /app\.(get|post|put|delete|patch)\b/g;

// Scannt eine einzelne Quelldatei: findet jede Routen-Registrierung, ihre URL und die im
// Handler-Block verwendete Schutzart. Block = von einer app.<method>(-Stelle bis zur nächsten.
export function scanRouteFile(text: string, file: string): ScannedRoute[] {
  const marks: { method: string; idx: number }[] = [];
  let m: RegExpExecArray | null;
  // Frischer Regex-Zustand je Aufruf (g-Flag teilt lastIndex).
  const re = new RegExp(ROUTE_RE.source, "g");
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatischer Regex-Scan
  while ((m = re.exec(text))) {
    marks.push({ method: (m[1] ?? "").toUpperCase(), idx: m.index });
  }
  const out: ScannedRoute[] = [];
  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];
    if (!mark) {
      continue;
    }
    const end = marks[i + 1]?.idx ?? text.length;
    const block = text.slice(mark.idx, end);
    const urlMatch = block.match(/"(\/[A-Za-z0-9/:_.-]+)"/);
    const url = urlMatch?.[1] ?? "(unknown)";
    if (!url.startsWith("/")) {
      continue;
    }
    const perms = [...block.matchAll(/requirePermission\("([a-z.]+)"/g)].map((x) => x[1] ?? "");
    let protection: Protection;
    if (perms.length === 1) {
      protection = perms[0] as Protection;
    } else if (perms.length > 1) {
      protection = "action-dispatched";
    } else if (/requireAdmin\(/.test(block)) {
      protection = "admin";
    } else if (/requireUser\(/.test(block)) {
      protection = "auth";
    } else if (/resolveAskUser\(/.test(block)) {
      // Add-on-API (KLARWERK_ADDON_API): resolveAskUser erzwingt in BEIDEN Zweigen ko.read — Flag AN +
      // gültiger Add-in-Key liefert einen synthetischen viewer (RBAC viewer = EXAKT ko.read), sonst
      // unverändert der Session-Guard requirePermission("ko.read"). Also niemals öffentlich.
      protection = "ko.read";
    } else {
      protection = "public";
    }
    out.push({ method: mark.method, url, protection, file });
  }
  return out;
}

// Alle Quelldateien mit Routen: App-Modulrouten + Auth-Routen + Composition-Root (inline Routen).
export function routeSourceFiles(): string[] {
  const routesDir = "services/app/src/routes";
  const appRoutes = readdirSync(routesDir)
    .filter((f) => f.endsWith("-routes.ts"))
    .map((f) => `${routesDir}/${f}`);
  return [...appRoutes, "services/auth/src/routes.ts", "services/app/src/build-app.ts"];
}

export function scanAllRoutes(
  read: (file: string) => string = (f) => readFileSync(f, "utf8"),
): ScannedRoute[] {
  return routeSourceFiles().flatMap((file) => scanRouteFile(read(file), file));
}

export function routeKey(method: string, url: string): string {
  return `${method.toUpperCase()} ${url}`;
}

// Erwartete Schutz-Matrix. Quelle: read-only Audit der Route-Dateien (SCRUM-367). `reason` ist für
// öffentliche Routen Pflicht (siehe Test) — macht jede public-Entscheidung bewusst und nachvollziehbar.
export interface ExpectedRoute {
  protection: Protection;
  reason?: string;
  // JOB 1331 D1 (Befund aus JOB 658 D2, am 20.08.2026 durch JOB 1318 D1 als einziger von acht
  // Pfaden bestätigt): `protection` ist das ROUTENrecht — wer die Tür überhaupt aufbekommt. Viele
  // Lesewege entscheiden ZUSÄTZLICH je Zeile, ob dieser Nutzer dieses Objekt sehen darf. Bis hierher
  // war das in dieser Tabelle unsichtbar: `GET /api/kos/:id/provenance` stand als reines `ko.read`,
  // obwohl seit mega74 `darfSehen` mitläuft — von einer Route ohne Zeilenrecht nicht zu
  // unterscheiden.
  //
  // Es stehen die GEMESSENEN Prädikatnamen aus `services/app/src/sichtbarkeit.ts`, nicht die Namen
  // dateilokaler Torwachen: `sichtbaresKoOder404` ist eine solche Torwache und wurde in mega76
  // Block C aus der Namensliste des Sammlers entfernt, weil sie ihm ihren NAMEN glaubte. Der
  // Wächter `g10-herkunft-zentrum-vertraulich.test.ts` löst lokale Helfer über ihren RUMPF auf und
  // macht jeden Eintrag rot, den die Erhebung nicht deckt — und jede Route rot, die ein Zeilenrecht
  // fährt, ohne es hier zu führen.
  zeilenrecht?: readonly string[];
}

export const ROUTE_GUARD_MATRIX: Record<string, ExpectedRoute> = {
  // --- Auth (services/auth/src/routes.ts) ---
  "POST /api/auth/register": {
    protection: "public",
    reason: "Registrierung legt erst ein Konto an.",
  },
  "POST /api/auth/login": {
    protection: "public",
    reason: "Login IST der Auth-Einstieg (Brute-Force-Limiter SCRUM-356).",
  },
  "POST /api/auth/logout": {
    protection: "public",
    reason: "Beendet die Sitzung; löscht nur das Cookie.",
  },
  "GET /api/auth/me": { protection: "auth" },
  // AUFTRAG-mega61 Block C: die Kenntnisnahme des Hinweises. Beide auf das EIGENE Konto und nur
  // darauf — der Nutzer kommt aus der Sitzung, nicht aus dem Pfad; es gibt keinen Weg, eine fremde
  // Quittung zu lesen oder zu setzen. Kein zusätzliches Recht nötig: Auch eine Betrachterin muss
  // den Pflichthinweis quittieren können, sonst bekäme sie ihn bei jedem Laden erneut.
  "GET /api/auth/notice": { protection: "auth" },
  "POST /api/auth/notice": { protection: "auth" },
  "POST /api/auth/password": { protection: "auth" },
  "POST /api/auth/forgot": {
    protection: "public",
    reason: "Reset-Anforderung; antwortet immer 204 (keine Enumeration), SCRUM-367 rate-limitiert.",
  },
  "POST /api/auth/reset": {
    protection: "public",
    reason: "Reset per Einmal-Token; SCRUM-367 rate-limitiert gegen Token-Bruteforce.",
  },
  "GET /api/auth/oidc/start": {
    protection: "public",
    reason: "SSO-Start (Authorization-Code-Flow).",
  },
  "POST /api/auth/oidc": { protection: "public", reason: "SSO-Callback; prüft state/nonce/PKCE." },
  "POST /api/auth/users/:id/approve": { protection: "admin" },
  "POST /api/auth/users/:id/reset": { protection: "admin" },
  "DELETE /api/auth/users/:id": { protection: "admin" },
  "GET /api/auth/status": {
    protection: "public",
    reason: "Setup-/SSO-Status für den Login-Screen; keine Nutzerdaten.",
  },
  "POST /api/auth/setup": {
    protection: "public",
    reason: "Ersteinrichtung des ersten Admins; serverseitig durch needsSetup() abgeriegelt.",
  },
  "GET /api/users": { protection: "admin" },
  "GET /api/directory": { protection: "auth" },
  "POST /api/users": { protection: "admin" },
  "PUT /api/users/:id": { protection: "admin" },
  "DELETE /api/users/:id": { protection: "admin" },

  // --- Composition-Root inline (services/app/src/build-app.ts) ---
  "GET /health": { protection: "public", reason: "Health-Probe; liefert nur { status: ok }." },
  "GET /api/reasoner/status": {
    protection: "public",
    reason: "KI-Verfügbarkeitsflag (FR-RSN-05); keine Nutzer-/Wissensdaten.",
  },
  "GET /api/ai-status": {
    protection: "public",
    reason: "KI-Verfügbarkeitsflag (§2.1); keine Nutzerdaten.",
  },
  // SCRUM-490 H: statisches Add-in-Bundle (nur bei KLARWERK_ADDON_API). Bewusst öffentlich lesbar (kein
  // Key nötig); explizite Datei-Map (traversal-sicher), kein Directory-Listing, keine Nutzer-/Wissensdaten.
  // Der Wildcard-Handler GET /addin/* ist ebenfalls „public", wird vom URL-Scanner (kein `*` in der
  // Zeichenklasse) aber nicht als eigene Zeile erfasst — er ist stattdessen im dedizierten Serving-Test
  // (addin-static-routes.test.ts: Traversal/Content-Types/Flag/Listing) abgedeckt.
  "GET /addin": {
    protection: "public",
    reason: "Add-in-Basis/Bundle-Serving (nur bei KLARWERK_ADDON_API); öffentlich, keine Daten.",
  },
  // SCRUM-510 WP2: Admin-Trigger Confluence-Space-Import (Source-Datei immer gescannt; Route nur bei
  // KLARWERK_CONFLUENCE_IMPORT registriert). Echte Admin-Auth via requirePermission("users.manage").
  "POST /api/admin/import/confluence": { protection: "users.manage" },
  // IC-1 (Import-Cockpit): READ-ONLY Erkundung — zählt/aggregiert nur, schreibt nichts. Gleiche
  // Admin-Auth wie der Import-Trigger; ebenfalls nur bei aktivem Confluence-Flag registriert.
  "POST /api/admin/import/confluence/explore": { protection: "users.manage" },
  // W2-A/148: der Leseweg der Laufdomaene. Dasselbe Recht wie der Start — waere er weicher,
  // koennte jemand ohne users.manage die Ergebnisse eines Imports lesen, den er nicht ausloesen darf.
  "GET /api/admin/import/runs/:importId": { protection: "users.manage" },
  "GET /api/admin/import/runs/:importId/result": { protection: "users.manage" },
  "GET /api/admin/import/source-records/:sourceRecordId": { protection: "users.manage" },
  // IC-3 (Import-Cockpit): READ-ONLY Auswahl-VORSCHAU (Prompt/Filter → gefilterte Vorschau). Schreibt
  // nichts (keine Kandidaten); gleiche Admin-Auth, nur bei aktivem Confluence-Flag registriert.
  "POST /api/admin/import/confluence/select": { protection: "users.manage" },
  // WP-IC-4: KI-Gruppierung (read-only) + Übernahme in die Review-Queue — gleiche Admin-Auth
  // und Feature-Flag-Disziplin wie explore/select.
  "POST /api/admin/import/confluence/group": { protection: "users.manage" },
  "POST /api/admin/import/confluence/apply": { protection: "users.manage" },
  // WP-D-CLEAN: zweistufiges Testdaten-Aufräumen (Vorschau/confirm) — Admin-Guard wie die
  // übrigen Import-Admin-Wege; immer registriert (library-routes, kein Feature-Flag).
  "POST /api/admin/import/cleanup": { protection: "users.manage" },
  // WP-B6: kuratierte Beispielpakete für die VIP-2-Tester (admin-routes).
  "POST /api/admin/examples/load": { protection: "users.manage" },
  "GET /api/analytics/impact": {
    protection: "ko.read",
    zeilenrecht: ["sichtbarkeitsfilterFuer"],
  },

  // --- KO (ko-routes.ts) ---
  "GET /api/kos": { protection: "ko.read", zeilenrecht: ["sichtbareFuer"] },
  // Die Torwache heisst hier `sichtbaresKoOder404`; ihr RUMPF ruft `darfSehen` (ko-routes.ts:484).
  // Es steht das gemessene Prädikat, nicht der Name der Torwache — s. Kopfkommentar zu `zeilenrecht`.
  "GET /api/kos/:id": { protection: "ko.read", zeilenrecht: ["darfSehen"] },
  "GET /api/kos/:id/versions": { protection: "ko.read", zeilenrecht: ["darfSehen"] },
  "GET /api/kos/:id/evidence": { protection: "ko.read", zeilenrecht: ["darfSehen"] },
  // AUFTRAG-mega45 Block A/D: die Herkunftskette eines Objekts. Nur bei gesetztem
  // KLARWERK_PROVENANCE_ENABLED überhaupt registriert; das Recht ist dasselbe wie am Objekt selbst.
  // JOB 1331: DIES ist die Zeile, die JOB 658 D2 als Befund gemeldet hat — sie führte `ko.read`
  // ohne das seit mega74 zusätzlich wirkende `darfSehen` (provenance-routes.ts:105, Registrierung :89).
  "GET /api/kos/:id/provenance": { protection: "ko.read", zeilenrecht: ["darfSehen"] },
  "GET /api/evidence": { protection: "ko.read", zeilenrecht: ["darfSehen"] },
  "POST /api/kos": { protection: "ko.create" },
  // AUFTRAG-mega19 Block B: die Erstanlage AUS Dokumenten (Inhalt + Anker + Belegstellen in EINEM
  // Vorgang). Dasselbe Basisrecht wie das gewöhnliche Einreichen — die Route ist eine ENGERE Tür
  // neben POST /api/kos, keine zusätzliche Befugnis: sie verwirft Client-`sources` genauso, und der
  // Entwurfsweg prüft zusätzlich dieselbe Sichtbarkeitsregel wie alle Entwurfs-Routen.
  "POST /api/kos/from-document": { protection: "ko.create" },
  // WP-SUBMIT-ASYNC: Retry der Hintergrund-KI-Prüfung — Prüfer-Recht (Knopf auf der Board-Karte).
  "POST /api/kos/:id/ai-check": { protection: "ko.validate" },
  // + Route prüft Autor-oder-Controller/Admin (Pedi 02.07.)
  "DELETE /api/kos/:id": { protection: "ko.read", zeilenrecht: ["darfSehen"] },
  "PUT /api/kos/:id": { protection: "action-dispatched", zeilenrecht: ["darfSehen"] },
  // SCRUM-421: Upload-Grenzen — lesen alle Leseberechtigten (Anzeige), ändern nur Admin.
  "GET /api/upload-limits": { protection: "ko.read" },
  "PUT /api/upload-limits": { protection: "users.manage" },
  // SCRUM-422: Papierkorb — nur Admin (users.manage): Liste, Wiederherstellen, Endlöschung.
  "GET /api/kos/trash": { protection: "users.manage" },
  "POST /api/kos/:id/restore": { protection: "users.manage" },
  "DELETE /api/kos/trash/:id": { protection: "users.manage" },

  // --- Validation (validation-routes.ts) ---
  "GET /api/validation/board": { protection: "ko.read", zeilenrecht: ["sichtbareFuer"] },
  "GET /api/validation/overview": {
    protection: "ko.read",
    zeilenrecht: ["sichtbarkeitsfilterFuer"],
  },
  // SCRUM-395: Standard-Prüferanzahl — lesen dürfen alle Leseberechtigten (Anzeige beim
  // Erfassen), ändern nur die Nutzerverwaltung.
  "GET /api/validation/settings": { protection: "ko.read" },
  "PUT /api/validation/settings": { protection: "users.manage" },
  // SCRUM-414: Regler „externe Wissensabfrage" — lesen alle Leseberechtigten, setzen nur Admin.
  "GET /api/external/policy": { protection: "ko.read" },
  "PUT /api/external/policy": { protection: "users.manage" },

  // --- AI-Check-Abdeckung (ai-check-coverage-routes.ts) ---
  // AUFTRAG-mega29 C2: schmale Bestands-Zusammenfassung (drei Zähler, keine Objektdaten) für die
  // LEEREN Konflikt-/Duplikat-Boards — dieselbe Lesegrenze wie die beiden Boards selbst.
  "GET /api/ai-check/coverage-summary": {
    protection: "ko.read",
    zeilenrecht: ["sichtbarkeitsfilterFuer"],
  },

  // --- Conflicts (conflicts-routes.ts) ---
  // JOB 1546 D2 (A28, OFFEN.md:165): das dauerhafte Signal am EIGENEN Objekt. Routenrecht ist
  // `ko.read` wie bei den beiden Boards; das Zeilenrecht ist `sichtbareFuer` und danach die
  // Autorschaft selbst (`eigeneKoIds` in conflicts-routes.ts, Rumpf = dieselbe Zeichenkettenpruefung
  // wie `darfSehen`). Die Antwort traegt ausschliesslich eigene Kennungen und zwei Wahrheitswerte —
  // kein Feld fuer die Gegenseite, weil `EigenerBefund` keines hat.
  "GET /api/duplicate-signal": { protection: "ko.read", zeilenrecht: ["sichtbareFuer"] },
  "GET /api/conflicts": { protection: "ko.read", zeilenrecht: ["sichtbarePaare"] },
  "GET /api/conflicts/:id": { protection: "ko.read", zeilenrecht: ["paarSichtbar"] },
  "POST /api/conflicts/:id/escalate": { protection: "conflict.resolve" },
  "POST /api/conflicts/:id/dismiss": { protection: "conflict.resolve" },
  "POST /api/conflicts/:id/second-opinion": { protection: "ko.validate" },

  // --- Duplicates / Overlaps (overlap-routes.ts) ---
  // Berater-Konzept Duplikate 04.07. (Stufe D3b): Liste/Detail lesen alle Leseberechtigten; die
  // menschlichen Abschlüsse sind kuratorische (redaktionelle) Entscheidungen (ko.validate).
  "GET /api/duplicates": { protection: "ko.read", zeilenrecht: ["sichtbarePaare"] },
  // Pedi 04.07.: einstellbare Anzeige-Schwelle — lesen alle Leseberechtigten, setzen nur Admin.
  "GET /api/duplicates/settings": { protection: "ko.read" },
  "PUT /api/duplicates/settings": { protection: "users.manage" },
  "GET /api/duplicates/:id": { protection: "ko.read", zeilenrecht: ["paarSichtbar"] },
  "POST /api/duplicates/:id/dismiss": { protection: "ko.validate" },
  "POST /api/duplicates/:id/keep-separate": { protection: "ko.validate" },
  "POST /api/duplicates/:id/link-related": { protection: "ko.validate" },

  // --- Capture/Drafts (capture-routes.ts) ---
  "GET /api/drafts": { protection: "ko.create" },
  "POST /api/drafts": { protection: "ko.create" },
  "GET /api/drafts/:id": { protection: "ko.create" },
  // JOB 1171 D1: die ableitende Auskunft. Dasselbe Recht und derselbe Torwaechter wie die
  // uebrigen Entwurfsrouten (`requireVisibleDraft`) — sie liest denselben Entwurf.
  "GET /api/drafts/:id/naechster-schritt": { protection: "ko.create" },
  "PUT /api/drafts/:id": { protection: "ko.create" },
  "DELETE /api/drafts/:id": { protection: "ko.create" },
  "POST /api/drafts/:id/promote": { protection: "ko.create" },

  // --- Ask (ask-routes.ts) ---
  "POST /api/ask": { protection: "ko.read" },
  "POST /api/ask/helpful": { protection: "ko.read" },
  // SCRUM-527: Live-Check (Ähnlichkeit/Widerspruch eines Entwurfstextes gegen den Bestand).
  "POST /api/knowledge/check": { protection: "ko.read" },
  // SCRUM-491 Slice 5 (check-text-routes.ts): Session-Zweig erzwingt ko.read; der Add-on-Zweig verlangt
  // checktext.validated (Hook + Handler). Nur bei KLARWERK_ADDON_API registriert.
  "POST /api/check-text": { protection: "ko.read" },
  "GET /api/gaps/summary": { protection: "ko.read" },
  "GET /api/gaps": { protection: "ko.read" },
  "PUT /api/gaps/:id": { protection: "ko.assign" },
  "DELETE /api/gaps/:id": { protection: "ko.validate" },

  // --- Klara Status / Sitzung / Zustimmung (klara-ai-routes.ts, W1 S4) ---
  //
  // WARUM ÜBERALL `ko.read` UND KEIN EIGENES `klara.*`. Die Rechtematrix in
  // `services/rbac/src/policy.ts` ist abgeschlossen; ein neues Recht wäre eine Erweiterung der
  // Berechtigungsfläche, die dieser Auftrag ausdrücklich nicht vornehmen darf. `ko.read` ist genau
  // das Recht, das ein Klara-Nutzer für den Ask-Weg ohnehin trägt — also kein Rechtezuwachs.
  //
  // DIE FEINE BINDUNG LEISTET NICHT RBAC. Actor, Add-in-Instanz und Dokumentkontext prüft der
  // Sitzungsdienst (`klara-session-service.ts`). RBAC entscheidet nur, WER überhaupt fragen darf;
  // WELCHE Sitzung er sieht, entscheidet die registrierte Zuordnung. Die drei `x-klara-*`-Header
  // sind dabei Lookup, keine Attestierung (KW-S4-20 §102).
  //
  // Die Routen zerfallen in zwei Klassen, und die Unterscheidung ist der Grund für die
  // Einzelbegründungen unten:
  //   (a) Policy-/Statusmetadaten — Modus, Anbieter, Modell, Versionen. Konfigurationslage.
  //   (b) Sitzungs-/Zustimmungsmetadaten — an eine Zuordnung gebunden, aber ebenfalls ohne
  //       KO-Inhalt. Wissen fliesst über KEINE dieser sieben Routen.

  // (a) Statusmetadaten, aber NUR gegen eine registrierte Zuordnung (BEN ROT-5 korrigiert):
  // ohne gültige Sitzungsbindung antwortet die Route mit NOT_FOUND statt mit der Konfiguration.
  "GET /api/klara/ai-status": { protection: "ko.read" },
  // W3-C (JOB 541 D3): die kanonische Antwort-Erklaerung. `ko.read`, weil sie Kennungen und
  // Fassungen von Wissensobjekten zeigt; die Eigentumspruefung liegt zusaetzlich im Dienst.
  "GET /api/klara/answers/:answerId/explanation": { protection: "ko.read" },
  // (b) Registriert die Zuordnung autoritativ und vergibt die opake documentContextId. Legt nur
  // Sitzungsmetadaten an, liest und schreibt kein KO.
  "POST /api/klara/sessions": { protection: "ko.read" },
  // (b) Rebind des Dokumentkontexts (temporär → gespeichert). Entwertet die alte Auflösung und
  // eine bestehende Zustimmung; kein KO-Zugriff.
  "POST /api/klara/sessions/:sessionId/document-context": { protection: "ko.read" },
  // (b) Liest den eigenen Sitzungszustand. Eine fremde sessionId ergibt NOT_FOUND — die Kennung
  // ist kein Leserecht und keine Existenzauskunft.
  "GET /api/klara/sessions/:sessionId": { protection: "ko.read" },
  // (b) Zustimmung zur externen KI. Erteilt kein Recht auf KO-Inhalt, sondern hebt ausschliesslich
  // die Sperre für den externen Weg auf — der derzeit ohnehin nicht ausführbar ist.
  "POST /api/klara/sessions/:sessionId/consent": { protection: "ko.read" },
  // (b) Widerruf, sofort wirksam. Reine Zustandsänderung an der eigenen Sitzung.
  "DELETE /api/klara/sessions/:sessionId/consent": { protection: "ko.read" },
  // (b) Schliesst die eigene Sitzung. Danach ist jeder Folgeaufruf CONFLICT.
  "POST /api/klara/sessions/:sessionId/close": { protection: "ko.read" },

  // --- Library / Import / Analytics / Graph (library-routes.ts) ---
  "GET /api/library/search": { protection: "ko.read", zeilenrecht: ["sichtbareFuer"] },
  "GET /api/library/export": { protection: "ko.read" },
  "POST /api/library/import": { protection: "ko.create" },
  "POST /api/library/import/candidates": { protection: "ko.create" },
  "GET /api/library/import/candidates": { protection: "ko.read" },
  "PUT /api/library/import/candidates/:id": { protection: "ko.validate" },
  "GET /api/analytics": { protection: "ko.read", zeilenrecht: ["sichtbarkeitsfilterFuer"] },
  "GET /api/analytics/busfactor": {
    protection: "ko.read",
    zeilenrecht: ["sichtbarkeitsfilterFuer"],
  },
  // Consultant-System (Experten-Matching): ENGER als die übrigen Analytics — nur ko.assign
  // (controller/admin), hinter Feature-Flag (Default AUS → 404). Datenschutzsensibel (BetrVG/DSGVO).
  "GET /api/analytics/expertise": { protection: "ko.assign" },
  "GET /api/graph": { protection: "ko.read", zeilenrecht: ["sichtbarkeitsfilterFuer"] },
  // AUFTRAG-mega68: Nachbarschaft eines Wissensobjekts (Anwendersicht des Wissensnetzes) —
  // Leserecht wie das Objekt selbst; vertrauliche NACHBARN filtert die Route zusätzlich über die
  // SCRUM-506-Regel (nur ko.validate sieht sie), belegt in tests/app/mega68-nachbarschaft-route.
  "GET /api/kos/:id/neighbors": {
    protection: "ko.read",
    zeilenrecht: ["sichtbarkeitsfilterFuer"],
  },

  // --- Lifecycle / Learning paths (lifecycle-routes.ts) ---
  "POST /api/lifecycle/couple": { protection: "ko.create" },
  "POST /api/lifecycle/asset-changed": { protection: "ko.validate" },
  "GET /api/lifecycle/pending": { protection: "ko.read" },
  "GET /api/lifecycle/couplings/:koId": { protection: "ko.read" },
  "POST /api/learning-paths": { protection: "ko.create" },
  "GET /api/learning-paths/:role": { protection: "ko.read" },
  "POST /api/learning-paths/:pathId/complete": { protection: "ko.read" },
  "GET /api/learning-paths/:pathId/progress": { protection: "ko.read" },

  // --- Output (output-routes.ts) ---
  "GET /api/output/sources": { protection: "ko.read" },
  "POST /api/output/generate": { protection: "ko.read" },

  // --- Management / Model-runs / External / Audit / Reasoner / Objects ---
  "GET /api/management/snapshot": {
    protection: "ko.read",
    zeilenrecht: ["sichtbarkeitsfilterFuer"],
  },
  "GET /api/model-runs": { protection: "ko.read" },
  "GET /api/external/search": { protection: "ko.read" },
  // Der Feed wird über den lokalen Helfer `loadFeed` gebaut; dessen RUMPF ruft beide Prädikate
  // (notifications-routes.ts:116) — nachgeprüft, nicht dem Helfernamen geglaubt.
  "GET /api/notifications": {
    protection: "auth",
    zeilenrecht: ["sichtbareEintraege", "sichtbarePaare"],
  },
  // Audit-P3 (SCRUM-397): eigenen Gelesen-Status markieren — jeder angemeldete Nutzer, nur eigene Sicht.
  "POST /api/notifications/seen": {
    protection: "auth",
    zeilenrecht: ["sichtbareEintraege", "sichtbarePaare"],
  },
  // Audit-P4 (SCRUM-398): Live-Wall — read-only Aggregation aus KO-Bestand + Wirkungs-Audit.
  "GET /api/livewall": { protection: "ko.read", zeilenrecht: ["sichtbareFuer"] },
  // FUNKE F1 (nacht24 Paket 6): persönliche Wirkungs-Zähler — jeder angemeldete Nutzer,
  // AUSSCHLIESSLICH über die eigene Identität (user.id) abgeleitet, nur Zahlen.
  "GET /api/me/impact": { protection: "auth" },
  // SCRUM-501 (nacht24 Paket 7.2): Simulationskorpus laden — nur Admin (users.manage), nie automatisch.
  "POST /api/admin/sim-corpus": { protection: "users.manage" },
  // Klara Stufe 2: KI-gestuetzte Hilfe-Antwort — jeder angemeldete Leser (viewer inkl.).
  "POST /api/help/explain": { protection: "ko.read" },
  "GET /api/audit": { protection: "ko.validate" },
  // SCRUM-439: aktive Integritätsprüfung der Audit-Kette — Governance-Einsicht wie /api/audit.
  "GET /api/audit/verify": { protection: "ko.validate" },
  // WP-D11: PPTX-Folien-Konvertierung — Import-Guard (ko.create) wie der Datei-/Draft-Pfad;
  // großes bodyLimit mit Auth VOR dem Body-Parsing (onRequest requireUser).
  "POST /api/capture/slides": { protection: "ko.create" },
  // WP-RETEST7 R8: leichter Verfügbarkeits-Check vor dem großen Upload (gleicher Guard).
  "GET /api/capture/slides/availability": { protection: "ko.create" },
  "POST /api/reasoner": { protection: "ko.read" },
  // WP-BILD-1c/1f: KI-Bildbeschreibungs-Vorschlag — eigene Route mit großem bodyLimit; gleicher
  // Guard wie der Text-Dispatcher, zusätzlich Auth VOR dem Body-Parsing (onRequest requireUser).
  "POST /api/reasoner/describe": { protection: "ko.read" },
  // SCRUM-426: Public-KI-Anreicherung — Schreibberechtigte; zusätzlich Stufen-Gate „offen".
  "POST /api/reasoner/enrich": { protection: "ko.create" },
  // SCRUM-428: Key-Test für den lokalen LLM — nur Admin (echter Mini-Aufruf).
  "POST /api/reasoner/test-local": { protection: "users.manage" },
  // WP-VIP2-GATE-2 (bens Fix 3): Provider-/Modellnamen sind echte Admin-Sicht (users.manage);
  // normale Nutzer sehen nur den abstrahierten Status (/api/reasoner/status).
  "GET /api/reasoner/config": { protection: "users.manage" },
  "PUT /api/reasoner/config": { protection: "users.manage" },
  // SCRUM-386: kundeneigene KI-Assist-Presets — lesen alle Rollen (Palette), pflegen nur Admin.
  "GET /api/reasoner/assist-presets": { protection: "ko.read" },
  "PUT /api/reasoner/assist-presets": { protection: "users.manage" },
  // Key-Test (Pedi 02.07.): echter Mini-Modellaufruf — nur Admin, kein Secret in der Antwort.
  "POST /api/reasoner/test": { protection: "users.manage" },
  // SCRUM-493: End-to-End-Selbsttest der Konflikterkennung — nur Admin (echte Erkennungskette).
  "POST /api/reasoner/conflict-self-test": { protection: "users.manage" },
  "POST /api/reasoner/duplicate-self-test": { protection: "users.manage" },
  "POST /api/objects": { protection: "ko.create" },
  "GET /api/objects/:id": { protection: "ko.read", zeilenrecht: ["beurteileAnhang"] },
  "GET /api/objects/:id/raw": { protection: "ko.read", zeilenrecht: ["beurteileAnhang"] },

  // --- media (media-routes.ts, SCRUM-382) ---
  "GET /api/media/status": { protection: "auth" },
  "POST /api/media/analyze": { protection: "ko.read" },

  // --- i18n (i18n-routes.ts) ---
  "GET /api/i18n/locales": {
    protection: "public",
    reason: "UI-Sprachstrings sind öffentlich lesbar.",
  },
  "GET /api/i18n/:locale/:key": {
    protection: "public",
    reason: "UI-Sprachstrings sind öffentlich lesbar.",
  },

  // --- Betriebsschalter (features-routes.ts) ---
  // AUFTRAG-mega46 Block F: Ja/Nein je Schalter, sonst nichts. BEWUSST nur „auth" und nicht
  // öffentlich (welche Flächen ein Betrieb freigeschaltet hat, geht niemanden vor der Anmeldung an)
  // und BEWUSST kein weitergehendes Recht (auch eine Betrachterin muss wissen, welche Flächen es
  // gibt, sonst rendert die Oberfläche für sie tote Knöpfe).
  "GET /api/features": { protection: "auth" },

  // --- Zugangs-Zustand des Imports (import-access-routes.ts) ---
  // AUFTRAG-mega67 Block C/D: rein LESEND — Schalter-Zustand, die BENANNTEN Zugangsvariablen mit
  // Ja/Nein und der HTTPS-Riegel. Niemals ein Wert, niemals eine Maske mit Länge; kein Aufruf an
  // Confluence, kein Schreibweg. `users.manage` wie JEDE Confluence-Import-Route — der Import ist
  // ohnehin admin-gebunden, eine weichere Tür für seinen Zustand wäre eine Rechte-Ausweitung durch
  // die Hintertür. Die Route liegt bewusst NICHT hinter dem `confluenceImport`-Schalter: sie muss
  // den Zustand „ausgeschaltet" melden können, und hinter dem Schalter gäbe es nur einen 404,
  // ununterscheidbar von „kaputt".
  "GET /api/import/confluence/zugang": { protection: "users.manage" },

  // --- Admin (admin-routes.ts) ---
  // AUFTRAG-mega14 Block H (SCRUM-437): LESENDER Demodaten-Stand für die Bereitschafts-Zeile.
  // Bewusst dieselbe Schranke wie Laden/Entfernen — die Auskunft „hier stehen Demodaten" ist
  // Verwaltungswissen und gehört nicht in jede Rolle.
  "GET /api/admin/demo-seed": { protection: "users.manage" },
  "POST /api/admin/demo-seed": { protection: "users.manage" },
  "DELETE /api/admin/demo-seed": { protection: "users.manage" },
  // Pedi 05.07. (Beta): Werksreset — Verfügbarkeit lesen + ausführen, beides nur Nutzerverwaltung.
  "GET /api/admin/factory-reset": { protection: "users.manage" },
  "POST /api/admin/factory-reset": { protection: "users.manage" },
};
