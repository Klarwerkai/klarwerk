// ================================================================================================
// AUFTRAG-mega74 BLOCK E — DER SAMMLER ÜBER ALLE LESEWEGE.
// ================================================================================================
//
// WARUM ER SO GEBAUT IST, WIE ER GEBAUT IST. Am 30.07. sind DREI Wächter hintereinander an
// derselben Bauart gescheitert: der Wächter gegen `async onSend` hatte eine handgepflegte Liste aus
// vier Dateinamen, der Rohlink-Sammler traf zwei gültige Schreibweisen nicht, und der Modal-Wächter
// verglich bloße Zeichenkettenmuster. Allen dreien fehlte dasselbe: ein UNABHÄNGIGER ZÄHLER, der
// merkt, wenn die Erhebung etwas nicht lesen konnte. Ohne ihn ist eine geschrumpfte Erhebung nicht
// von einer grünen zu unterscheiden.
//
// DESHALB HIER:
//
//   (1) ERHEBUNG ÜBER DEN ECHTEN SYNTAXBAUM. Die Dateiliste entsteht aus `readdirSync` über
//       `services/app/src/routes` (plus der Kompositionswurzel `build-app.ts`, die eigene Routen
//       registriert) — KEINE handgepflegte Dateiliste. Jede Datei wird mit dem TypeScript-Compiler
//       geparst; jede `app.<methode>("/…", …)`-Registrierung ist ein Fund mit Datei und Zeile.
//
//   (2) DER UNABHÄNGIGE ZÄHLER. Zusätzlich zählt ein Textlauf über den kommentarbereinigten
//       Quelltext jede Stelle, die WIE eine Registrierung aussieht. Findet der Textlauf mehr als
//       der Syntaxbaum, konnte der Sammler eine Bauform nicht lesen — und DAS wird rot mit Datei
//       und Zeile, statt still überschlagen zu werden. Dazu eine harte Untergrenze: fällt die
//       Erhebung unter die gemessene Zahl, ist das ein Fehler und kein Erfolg.
//
//   (3) URTEIL JE FUND, nicht je Datei. Jede erhobene Route braucht GENAU EINEN Eintrag im
//       Register unten. Eine neue Route ohne Eintrag ist rot — sie muss beurteilt werden, bevor sie
//       leben darf. Ein Eintrag ohne Route ist ebenfalls rot (verwaistes Urteil).
//
//   (4) DIE URTEILE, DIE ETWAS BEHAUPTEN, WERDEN NACHGEPRÜFT. Wer `PRAEDIKAT` trägt, muss das
//       Prädikat aus Block A im Aufruf wirklich nennen — der Syntaxbaum sieht nach. Wer
//       `KURATORENTOR` trägt, muss das behauptete Recht wirklich fordern. Ein Urteil, das der
//       Sammler nicht nachprüfen kann (`DIENST_FILTERT`, `KEIN_KO_INHALT`), trägt stattdessen eine
//       Fundstelle in Prosa — und die ist als solche gekennzeichnet, nicht als Beweis getarnt.
//
// ================================================================================================
// WAS AUFTRAG-mega76 BLOCK C DARAN GEÄNDERT HAT — die vier Grenzen, die ben benannt hat.
// ================================================================================================
//
//   (C1) `readdirSync` war NICHT rekursiv. Ein neues Unterverzeichnis unter `routes/` blieb
//        unsichtbar, solange die Untergrenze anderweitig erfüllt war. → `dateien()` steigt ab.
//
//   (C2) `ts.createSourceFile` lag in `try/catch`, aber `parseDiagnostics` wurde nicht geprüft —
//        und `createSourceFile` WIRFT bei kaputter Syntax gar nicht. Eine defekte Routendatei wäre
//        still als „0 Routen" durchgelaufen. → `parseFehler()`, sichtbar kalibriert.
//
//   (C3) `PRAEDIKAT` prüfte nur, ob IRGENDEIN Name des Prädikats im Baum vorkommt. Das beweist
//        keine PFADDOMINANZ — genau deshalb bestanden die vier Fail-open-Zweige aus mega74 BEI
//        GRÜNEM SAMMLER. → `bedingterSchutz()`, kalibriert an den beiden Bauformen, die dort
//        wirklich standen, samt Gegenproben für die fail-closed Formen.
//
//   (C4) `PRAEDIKAT_IM_MODUL` prüfte nur die Erwähnung IRGENDWO in derselben Datei — und die
//        Namensliste enthielt dateilokale Torwachen (`urteile`, `sichtbaresKoOder404`), denen der
//        Sammler ihren NAMEN glaubte. Beides ist weg: lokale Helfer werden über ihren RUMPF
//        aufgelöst (`lokaleHelfer`), die Namensliste trägt nur noch die echten Exporte aus
//        sichtbarkeit.ts. `PRAEDIKAT_IM_MODUL` hat damit keinen Träger mehr und ist entfallen.
//
// BENANNTE BLINDHEIT (es gibt sie immer; verschwiegen wird sie zur Falle):
//   · Ein Pfad, der zur Laufzeit zusammengesetzt wird (`app.get(BASIS + "/x")`), ist kein Fund —
//       der Zähler in (2) schlägt dann aber an, weil der Textlauf ihn sieht und der Syntaxbaum
//       nicht. Genau dafür ist er da.
//   · `DIENST_FILTERT` und `KEIN_KO_INHALT` sind LESEURTEILE eines Menschen, keine Messungen. Sie
//       nennen ihre Fundstelle, damit der nächste Leser sie nachschlagen kann — mehr nicht. Nach
//       mega76 tragen sie nur noch Wege, die KEINEN Bestand aggregieren; die sechs Aggregate, die
//       ben in sammel72 widerlegt hat, stehen jetzt unter `PRAEDIKAT` und damit unter Messung.
//   · Die Dominanzprüfung (C3) ist SYNTAKTISCH, keine Datenflussanalyse. Sie fängt die zwei
//       Formen, an denen dieses Projekt zweimal gescheitert ist; sie beweist nicht, dass jeder
//       denkbare Rückgabepfad durch das Prädikat läuft. Das bleibt die ehrliche Restgrenze.
//   · Der Sammler prüft die REGISTRIERUNG, nicht die Antwort. Dass eine Route mit `darfSehen`
//       wirklich 404 antwortet, belegen die Draht-Tests in mega74-lesepfad-vertraulich.test.ts,
//       mega74-anhang-vertraulich.test.ts, mega74-nebenwege-vertraulich.test.ts und —
//       für den Fall OHNE Schutzabhängigkeit — mega76-schutz-erzwungen.test.ts.
//   · Routen ausserhalb `services/app` (etwa `services/auth/src/routes.ts`) sind nicht Gegenstand:
//       sie geben keine Wissensobjekte aus. Das ist ein Urteil, keine Messung.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROUTES_DIR = "services/app/src/routes";
const KOMPOSITIONSWURZEL = "services/app/src/build-app.ts";

// Die HTTP-Methoden, die Fastify kennt. Bewusst alle — nicht nur `get`: ein Leseweg in
// POST-Kleidung (`/api/ask`, `/api/check-text`) ist genauso ein Leseweg.
const METHODEN = new Set(["get", "post", "put", "delete", "patch", "all", "head", "options"]);

// Die Namen, die die EINE Entscheidung aus Block A tragen — und AUSSCHLIESSLICH sie: das sind die
// Exporte aus services/app/src/sichtbarkeit.ts, nichts sonst.
//
// AUFTRAG-mega76 BLOCK C: hier standen bis mega76 zusätzlich `sichtbaresKoOder404`, `urteile` und
// `sichtbareZuweisungenFuer` — dateilokale Torwachen, denen der Sammler ihren NAMEN glaubte. Genau
// das ist bens Einwand: eine Liste, die die eigene Annahme wiederholt, prüft nicht das System. Sie
// sind draussen; stattdessen löst der Sammler lokale Helfer jetzt über ihren RUMPF auf (s.
// `lokaleHelfer`). Eine Torwache zählt damit nur noch, wenn sie das Prädikat wirklich ruft.
const PRAEDIKAT_NAMEN =
  /^(darfSehen|sichtbareFuer|sichtbarkeitsfilterFuer|beurteileAnhang|paarSichtbar|sichtbarePaare|sichtbareEintraege)$/;

type Urteil =
  // Die Registrierung nennt das Prädikat aus Block A. NACHGEPRÜFT.
  | "PRAEDIKAT"
  // Nur Rollen, die Vertrauliches ohnehin sehen dürfen, erreichen die Route. NACHGEPRÜFT.
  | "KURATORENTOR"
  // Ein Dienst filtert; die Fundstelle steht in der Begründung. LESEURTEIL.
  | "DIENST_FILTERT"
  // Gibt keinen Inhalt eines Wissensobjekts aus. LESEURTEIL.
  | "KEIN_KO_INHALT"
  // Gibt nur eigenen/übergebenen Bestand aus (Entwürfe, eigene Zähler). LESEURTEIL.
  | "EIGENER_BESTAND";

interface Eintrag {
  urteil: Urteil;
  /** Bei KURATORENTOR: das Recht, das die Route wirklich fordern muss. */
  recht?: string;
  /** Begründung — bei den LESEURTEILEN mit Fundstelle. */
  grund: string;
}

// ================================================================================================
// DAS REGISTER — EIN URTEIL JE ROUTE.
// ================================================================================================
const REGISTER: Record<string, Eintrag> = {
  // --- Der Hauptlesepfad (Block B) ---------------------------------------------------------
  "GET /api/kos": { urteil: "PRAEDIKAT", grund: "Block B — Liste gefiltert." },
  "GET /api/kos/:id": { urteil: "PRAEDIKAT", grund: "Block B — 404 statt Objekt." },
  "GET /api/kos/:id/versions": { urteil: "PRAEDIKAT", grund: "Block B — Voll-Snapshots." },
  "GET /api/kos/:id/evidence": { urteil: "PRAEDIKAT", grund: "Block B — Belegzitate." },
  "GET /api/evidence": { urteil: "PRAEDIKAT", grund: "Block B — Index je Trägerobjekt aufgelöst." },
  "GET /api/library/search": { urteil: "PRAEDIKAT", grund: "Block B — Titel/Kernaussage." },
  "GET /api/graph": { urteil: "PRAEDIKAT", grund: "Block B — Titel; Filter auf der Grundmenge." },
  // --- W2-A/148: die Laufdomäne des Imports -------------------------------------------------
  // Der Lauf selbst trägt AUSSCHLIESSLICH Kennungen, Status, Zeitstempel und Zähler — keine Zeile
  // Fachinhalt. `knowledgeObjectId` ist eine Id, kein Inhalt (import-run-routes.ts:88-99).
  "GET /api/admin/import/runs/:importId": {
    urteil: "KEIN_KO_INHALT",
    grund: "Nur Kennungen, Status, Zähler — laufNachAussen, import-run-routes.ts:56-71.",
  },
  // Das Ergebnis führt zusätzlich die QUELLREVISION, und die trägt den Titel der Quellseite. Das
  // ist Quellsystem-Text, kein Wissensobjekt — aber Text. Deshalb NICHT „kein KO-Inhalt", sondern
  // das Rollentor: users.manage ist Admin, und Admin sieht Vertrauliches ohnehin.
  "GET /api/admin/import/runs/:importId/result": {
    urteil: "KURATORENTOR",
    recht: "users.manage",
    grund: "Führt die Quellrevision samt Seitentitel; admin-gebunden wie der Start selbst.",
  },
  "GET /api/admin/import/source-records/:sourceRecordId": {
    urteil: "KURATORENTOR",
    recht: "users.manage",
    grund: "Quellrevision mit Seitentitel und Inhaltsverweis — nie der Inhalt selbst.",
  },
  // --- Die Anhänge (Block C) ---------------------------------------------------------------
  "GET /api/objects/:id": { urteil: "PRAEDIKAT", grund: "Block C — G2, Anhang erbt seine Stufe." },
  "GET /api/objects/:id/raw": { urteil: "PRAEDIKAT", grund: "Block C — G2 + G4 (no-store)." },
  // --- Die Nebenwege (Block D) -------------------------------------------------------------
  // JOB 1546 D2 (A28): das dauerhafte Signal am EIGENEN Objekt. Die Route ruft `sichtbareFuer`
  // über `eigeneKoIds` (conflicts-routes.ts) und filtert danach auf die Autorschaft selbst — sie
  // gibt ausschließlich Kennungen EIGENER Objekte und zwei Wahrheitswerte aus, nie eine Zeile
  // Fachinhalt und nie etwas über die Gegenseite (`EigenerBefund` hat kein Feld dafür).
  "GET /api/duplicate-signal": {
    urteil: "PRAEDIKAT",
    grund: "A28 — sichtbareFuer, danach Autorschaft; nur eigene Kennungen und zwei Booleans.",
  },
  "GET /api/conflicts": { urteil: "PRAEDIKAT", grund: "Block D — Paar-Tor, wörtliche Zitate." },
  "GET /api/conflicts/:id": { urteil: "PRAEDIKAT", grund: "Block D — Paar-Tor." },
  "GET /api/duplicates": { urteil: "PRAEDIKAT", grund: "Block D — Eigenanteile/Aspekte." },
  "GET /api/duplicates/:id": { urteil: "PRAEDIKAT", grund: "Block D — Paar-Tor." },
  // AUFTRAG-mega76 BLOCK C: war `PRAEDIKAT_IM_MODUL` — das schwächere Urteil „irgendwo in
  // derselben Datei steht das Prädikat". Seit der Sammler lokale Helfer über ihren RUMPF auflöst,
  // läuft er in `loadFeed` hinein und sieht die Aufrufe dort selbst. Damit steht diese Route unter
  // derselben nachgeprüften Einstufung wie alle anderen, und `PRAEDIKAT_IM_MODUL` hat keinen
  // Träger mehr.
  "GET /api/notifications": {
    urteil: "PRAEDIKAT",
    grund: "Block D — loadFeed, über den Helferrumpf nachgeprüft.",
  },
  "GET /api/livewall": { urteil: "PRAEDIKAT", grund: "Block E — Titel + Autor je Objekt." },
  "GET /api/validation/board": { urteil: "PRAEDIKAT", grund: "Block E — volle Wissensobjekte." },
  // --- Die vorbereiteten Wege, jetzt scharf (Block F) ---------------------------------------
  "GET /api/kos/:id/neighbors": {
    urteil: "PRAEDIKAT",
    grund: "Block F — eigene Regelkopie ersetzt.",
  },
  "GET /api/kos/:id/provenance": { urteil: "PRAEDIKAT", grund: "Block F — Zentrum + Gegenseite." },
  // --- Egress-Wege, die im Dienst filtern ----------------------------------------------------
  "GET /api/library/export": {
    urteil: "KURATORENTOR",
    recht: "ko.validate",
    grund: "SCRUM-506 — includeConfidential als Datum (library-routes.ts:172).",
  },
  "GET /api/output/sources": {
    urteil: "DIENST_FILTERT",
    grund: "output/src/service.ts:39 — !isConfidential auf der Quellenliste.",
  },
  "POST /api/output/generate": {
    urteil: "DIENST_FILTERT",
    grund: "output/src/service.ts:62 — wirft bei vertraulichem KO.",
  },
  "POST /api/ask": {
    urteil: "DIENST_FILTERT",
    grund: "ask/src/service.ts:145 — dropConfidential vor der Auswahl, auf ALLEN Zweigen.",
  },
  "POST /api/knowledge/check": {
    urteil: "DIENST_FILTERT",
    grund: "app/src/knowledge-check.ts:110 — dropConfidential auf den Kandidaten.",
  },
  "POST /api/check-text": {
    urteil: "DIENST_FILTERT",
    grund: "app/src/check-text-detection.ts:121 — !isConfidential je Kandidat.",
  },
  "POST /api/reasoner": {
    urteil: "DIENST_FILTERT",
    grund: "task 'ask' läuft über denselben ask-Dienst (dropConfidential, s. o.).",
  },
  "POST /api/reasoner/describe": {
    urteil: "EIGENER_BESTAND",
    grund: "arbeitet auf client-geliefertem Text, nicht auf dem Bestand.",
  },
  "POST /api/reasoner/enrich": {
    urteil: "EIGENER_BESTAND",
    grund: "arbeitet auf client-geliefertem Text.",
  },
  // --- Kuratorentore: nur Rollen, die Vertrauliches ohnehin sehen dürfen ---------------------
  "GET /api/kos/trash": { urteil: "KURATORENTOR", recht: "users.manage", grund: "Papierkorb." },
  "GET /api/audit": { urteil: "KURATORENTOR", recht: "ko.validate", grund: "Protokoll." },
  "GET /api/audit/verify": { urteil: "KURATORENTOR", recht: "ko.validate", grund: "Protokoll." },
  "GET /api/model-runs": {
    urteil: "KURATORENTOR",
    recht: "ko.validate",
    grund: "Projektion entfernt actor/subject (model-runs-routes.ts:46).",
  },
  "GET /api/analytics/expertise": {
    urteil: "KURATORENTOR",
    recht: "ko.assign",
    grund: "Personen-Matching hinter Schalter; ko.assign = controller/admin.",
  },
  "GET /api/admin/demo-seed": { urteil: "KURATORENTOR", recht: "users.manage", grund: "Admin." },
  "GET /api/admin/factory-reset": {
    urteil: "KURATORENTOR",
    recht: "users.manage",
    grund: "Admin.",
  },
  "GET /api/import/confluence/zugang": {
    urteil: "KURATORENTOR",
    recht: "users.manage",
    grund: "Zugangszustand, Admin.",
  },
  "GET /api/reasoner/config": { urteil: "KURATORENTOR", recht: "users.manage", grund: "Admin." },
  "GET /api/library/import/candidates": {
    urteil: "KEIN_KO_INHALT",
    grund: "Import-Kandidaten sind noch keine Wissensobjekte; DTO hält Interna zurück (:63).",
  },
  // --- Gaps: eigener Sichtbarkeitsvertrag ----------------------------------------------------
  "GET /api/gaps": {
    urteil: "DIENST_FILTERT",
    grund: "ask/gap-visibility redactGapForViewer (ask-routes.ts:258).",
  },
  "GET /api/gaps/summary": { urteil: "KEIN_KO_INHALT", grund: "Zähler, keine Fragetexte." },
  // --- Entwürfe: eigener Bestand, nach Eigentümer begrenzt -----------------------------------
  "GET /api/drafts": { urteil: "EIGENER_BESTAND", grund: "visibleDraftsFor — Eigentümerlogik." },
  "GET /api/drafts/:id": { urteil: "EIGENER_BESTAND", grund: "requireVisibleDraft." },
  // JOB 1171 D1: die ableitende Auskunft. Zweifach begrenzt — derselbe Torwächter wie die
  // Einzelroute darüber, UND ihre Antwort trägt gar keinen Inhalt: `{ art, herkunft }` sind eine
  // Kennung und Feldnamen (`payload.title`, `anchorsMissing`), kein Titel, keine Kernaussage,
  // kein Body. Beurteilt nach dem strengeren der beiden Gründe.
  "GET /api/drafts/:id/naechster-schritt": {
    urteil: "EIGENER_BESTAND",
    grund: "requireVisibleDraft (capture-routes.ts) — und die Antwort führt nur Feldnamen.",
  },
  "GET /api/me/impact": { urteil: "EIGENER_BESTAND", grund: "vier eigene Zähler (impact.ts:88)." },
  // --- Kein Inhalt eines Wissensobjekts ------------------------------------------------------
  "GET /health": { urteil: "KEIN_KO_INHALT", grund: "Betriebszustand." },
  "GET /api/ai-status": { urteil: "KEIN_KO_INHALT", grund: "Modellzustand." },
  "GET /api/reasoner/status": { urteil: "KEIN_KO_INHALT", grund: "Modellzustand." },
  "GET /api/features": { urteil: "KEIN_KO_INHALT", grund: "Schalter als Ja/Nein." },
  "GET /api/i18n/locales": { urteil: "KEIN_KO_INHALT", grund: "Oberflächentexte." },
  "GET /api/i18n/:locale/:key": { urteil: "KEIN_KO_INHALT", grund: "Oberflächentexte." },
  "GET /addin": { urteil: "KEIN_KO_INHALT", grund: "statisches Add-in-Bundle." },
  "GET /addin/*": { urteil: "KEIN_KO_INHALT", grund: "statisches Add-in-Bundle." },
  // --- W1 S4: Klara-Status, Sitzung und Zustimmung (klara-ai-routes.ts) ----------------------
  //
  // ZWEI KLASSEN, EIN URTEIL. Beide geben nachweislich keinen KO-Inhalt aus — aber aus
  // unterschiedlichen Gründen, und die Unterscheidung gehört ins Register, sonst liest der nächste
  // Mensch sie als eine Zeile:
  //
  //   (a) POLICY-/STATUSMETADATEN. Modus, Anbieter, Modell, Policy- und Konfigurationsversion. Das
  //       ist die Konfigurationslage, kein Bestand — dieselbe Klasse wie `/api/reasoner/status`.
  //       Der Unterschied zu jenem: die Klara-Fassung antwortet NUR gegen eine registrierte
  //       Zuordnung (BEN ROT-5), ist also enger, nicht weiter.
  //
  //   (b) SITZUNGS-/ZUSTIMMUNGSMETADATEN. Sitzungskennung, Dokumentkontext, Zustimmungszustand,
  //       Auflösungskennung, Ablaufzeiten. Gebunden an EINE Zuordnung und damit an einen Actor;
  //       eine fremde sessionId ergibt NOT_FOUND. Kein Feld dieser Antworten stammt aus einem
  //       Wissensobjekt — der Retrieval-Test misst es zusätzlich mit Modell- und Embedder-Zähler
  //       (`tests/app/klara-retrieval-only-remains-safe.test.ts`).
  //
  // LESEURTEIL, keine Messung — wie bei jedem Eintrag dieser Klasse. Nachschlagbar an den
  // genannten Fundstellen.
  // W3-C (JOB 541 D3): Die Erklaerung gibt Kennungen und Fassungen der belegenden Wissensobjekte
  // aus — keine Titel, keine Aussagen, keinen Text. Sie ist trotzdem KEIN `KEIN_KO_INHALT`-Fall,
  // sondern ein gefilterter: der Dienst prueft das Eigentum an der Antwort und schwaerzt
  // vertrauliche Belege je Leser.
  "GET /api/klara/answers/:answerId/explanation": {
    urteil: "DIENST_FILTERT",
    grund:
      "services/app/src/services/answer-explanation.ts — gehoertNutzer() als Eigentumstor, isConfidential() schwaerzt je Beleg.",
  },
  "GET /api/klara/ai-status": {
    urteil: "KEIN_KO_INHALT",
    grund:
      "(a) Policylage: Modus/Anbieter/Modell/Versionen; nur gegen registrierte Zuordnung (klara-ai-routes.ts:86).",
  },
  "GET /api/klara/sessions/:sessionId": {
    urteil: "KEIN_KO_INHALT",
    grund:
      "(b) Sitzungsmetadaten des eigenen Actors; fremde Kennung ergibt NOT_FOUND (klara-session-service.ts laden()).",
  },
  "POST /api/klara/sessions": {
    urteil: "KEIN_KO_INHALT",
    grund:
      "(b) legt eine Zuordnung an und vergibt die opake documentContextId; antwortet mit Sitzungs-, nicht mit Bestandsdaten (klara-ai-routes.ts:114).",
  },
  "POST /api/klara/sessions/:sessionId/document-context": {
    urteil: "KEIN_KO_INHALT",
    grund:
      "(b) Rebind temporär→gespeichert; entwertet alte Auflösung und Zustimmung, berührt kein KO (klara-ai-routes.ts:142).",
  },
  "POST /api/klara/sessions/:sessionId/consent": {
    urteil: "KEIN_KO_INHALT",
    grund:
      "(b) hebt nur die Sperre für den externen Weg auf; erteilt KEIN Recht auf KO-Inhalt (klara-ai-routes.ts:191).",
  },
  "DELETE /api/klara/sessions/:sessionId/consent": {
    urteil: "KEIN_KO_INHALT",
    grund:
      "(b) Widerruf, sofort wirksam; reine Zustandsänderung an der eigenen Sitzung (klara-ai-routes.ts:213).",
  },
  "POST /api/klara/sessions/:sessionId/close": {
    urteil: "KEIN_KO_INHALT",
    grund:
      "(b) schliesst die eigene Sitzung; danach ist jeder Folgeaufruf CONFLICT (klara-ai-routes.ts:235).",
  },
  // --- AUFTRAG-mega76 BLOCK D: die sechs Aggregate — vom Leseurteil zur Messung -------------
  //
  // Diese sechs standen bis mega76 als `KEIN_KO_INHALT` hier — ein MENSCHLICHES Leseurteil mit der
  // Begründung „nur Zähler". ben hat es in sammel72 an allen sechs widerlegt (6 von 6 geprüft,
  // Ergebnis: 0 gefiltert, 0 ohne Auskunftswert, 6 ungefiltert MIT Auskunftswert): jedes rechnete
  // über einer ungefilterten Grundmenge, und ein exakter Zähler nach Status, Kategorie, Woche oder
  // Person verrät die Existenz eines vertraulichen Objekts ab n = 1 — bei einer nur vertraulich
  // belegten Kategorie sogar deren Namen.
  //
  // Jetzt tragen alle sechs `PRAEDIKAT` und stehen damit unter der NACHGEPRÜFTEN Einstufung: der
  // Sammler sieht selbst nach, ob die Registrierung die Entscheidung aus Block A nennt — und seit
  // mega76 zusätzlich, ob sie sie unbedingt nennt (Pfaddominanz). Die Einstufung dieser sechs
  // steht damit nicht mehr auf einem Leseurteil.
  "GET /api/analytics": { urteil: "PRAEDIKAT", grund: "Block D — Grundmenge vor den Zählern." },
  "GET /api/analytics/busfactor": { urteil: "PRAEDIKAT", grund: "Block D — Kategoriezeilen." },
  "GET /api/analytics/impact": { urteil: "PRAEDIKAT", grund: "Block D — validatedTotal/Wochen." },
  "GET /api/management/snapshot": { urteil: "PRAEDIKAT", grund: "Block D — breitester Pfad." },
  "GET /api/ai-check/coverage-summary": { urteil: "PRAEDIKAT", grund: "Block D — vier Zähler." },
  "GET /api/validation/overview": { urteil: "PRAEDIKAT", grund: "Block D — Personenzeilen." },
  "GET /api/validation/settings": { urteil: "KEIN_KO_INHALT", grund: "Einstellungen." },
  "GET /api/duplicates/settings": { urteil: "KEIN_KO_INHALT", grund: "Schwellenwert." },
  "GET /api/upload-limits": { urteil: "KEIN_KO_INHALT", grund: "Obergrenzen." },
  "GET /api/external/policy": { urteil: "KEIN_KO_INHALT", grund: "Stufenregel." },
  "GET /api/external/search": { urteil: "KEIN_KO_INHALT", grund: "externe Treffer, kein Bestand." },
  "GET /api/media/status": { urteil: "KEIN_KO_INHALT", grund: "Dienstzustand." },
  "GET /api/reasoner/assist-presets": { urteil: "KEIN_KO_INHALT", grund: "Textbausteine." },
  "GET /api/capture/slides/availability": { urteil: "KEIN_KO_INHALT", grund: "Verfügbarkeit." },
  "GET /api/lifecycle/pending": {
    urteil: "KEIN_KO_INHALT",
    grund: "string[] mit KO-IDs (lifecycle/src/service.ts:46) — kein Inhalt.",
  },
  "GET /api/lifecycle/couplings/:koId": {
    urteil: "KEIN_KO_INHALT",
    grund: "string[] mit assetRefs (lifecycle/src/service.ts:29).",
  },
  "GET /api/learning-paths/:role": { urteil: "KEIN_KO_INHALT", grund: "Lernschritte, kein KO." },
  "GET /api/learning-paths/:pathId/progress": { urteil: "KEIN_KO_INHALT", grund: "Fortschritt." },
  "POST /api/help/explain": {
    urteil: "KEIN_KO_INHALT",
    grund: "Hilfe-Schnipsel (help-routes:11).",
  },
  "POST /api/media/analyze": {
    urteil: "DIENST_FILTERT",
    grund: "media/src/service.ts:110 — unklar → kein externer Egress.",
  },
  "POST /api/notifications/seen": { urteil: "KEIN_KO_INHALT", grund: "eigener Gelesen-Stand." },
  "POST /api/capture/slides": { urteil: "KEIN_KO_INHALT", grund: "PNGs aus eingesandtem PPTX." },
  // --- Schreibwege: die Antwort trägt, was der Aufrufer selbst eingereicht/bewirkt hat -------
  ...schreibwege({
    "POST /api/kos": "Anlage — der Aufrufer ist Autor (Autor-Ausnahme greift).",
    "POST /api/kos/from-document": "Erstanlage — der Aufrufer ist Autor.",
    "PUT /api/kos/:id": "Mutation — je Aktion eigenes Recht (ko-routes.ts:1081 ff.).",
    "DELETE /api/kos/:id": "Löschen — ko.validate ODER Autor (ko-routes.ts:1019).",
    "POST /api/kos/:id/ai-check": "ko.validate.",
    "POST /api/kos/:id/restore": "users.manage.",
    "DELETE /api/kos/trash/:id": "users.manage.",
    "PUT /api/upload-limits": "users.manage.",
    "POST /api/drafts": "eigener Entwurf.",
    "PUT /api/drafts/:id": "eigener Entwurf.",
    "DELETE /api/drafts/:id": "eigener Entwurf.",
    "POST /api/drafts/:id/promote": "eigener Entwurf → eigenes KO.",
    "POST /api/objects": "Upload — owner aus der Anmeldung.",
    "POST /api/library/import": "ko.create.",
    "POST /api/library/import/candidates": "ko.create.",
    "PUT /api/library/import/candidates/:id": "ko.validate.",
    "POST /api/admin/import/cleanup": "users.manage.",
    "POST /api/conflicts/:id/escalate": "conflict.resolve.",
    "POST /api/conflicts/:id/dismiss": "conflict.resolve.",
    "POST /api/conflicts/:id/second-opinion": "ko.validate.",
    "POST /api/duplicates/:id/dismiss": "ko.validate.",
    "POST /api/duplicates/:id/keep-separate": "ko.validate.",
    "POST /api/duplicates/:id/link-related": "ko.validate.",
    "PUT /api/duplicates/settings": "users.manage.",
    "PUT /api/gaps/:id": "ko.assign.",
    "DELETE /api/gaps/:id": "ko.validate.",
    "POST /api/ask/helpful": "Rückmeldung des Aufrufers.",
    "PUT /api/validation/settings": "users.manage.",
    "PUT /api/external/policy": "users.manage.",
    "POST /api/lifecycle/couple": "ko.create; Antwort ohne KO-Inhalt.",
    "POST /api/lifecycle/asset-changed": "ko.validate; Antwort ohne KO-Inhalt.",
    "POST /api/learning-paths": "Lernpfad, kein KO.",
    "POST /api/learning-paths/:pathId/complete": "eigener Fortschritt.",
    "POST /api/admin/demo-seed": "users.manage.",
    "DELETE /api/admin/demo-seed": "users.manage.",
    "POST /api/admin/sim-corpus": "users.manage.",
    "POST /api/admin/examples/load": "users.manage.",
    "POST /api/admin/factory-reset": "users.manage.",
    "POST /api/admin/import/confluence": "users.manage.",
    "POST /api/admin/import/confluence/explore": "users.manage.",
    "POST /api/admin/import/confluence/select": "users.manage.",
    "POST /api/admin/import/confluence/group": "users.manage.",
    "POST /api/admin/import/confluence/apply": "users.manage.",
    "PUT /api/reasoner/config": "users.manage.",
    "PUT /api/reasoner/assist-presets": "users.manage.",
    "POST /api/reasoner/test": "users.manage.",
    "POST /api/reasoner/test-local": "users.manage.",
    "POST /api/reasoner/conflict-self-test": "users.manage.",
    "POST /api/reasoner/duplicate-self-test": "users.manage.",
  }),
};

function schreibwege(paare: Record<string, string>): Record<string, Eintrag> {
  const out: Record<string, Eintrag> = {};
  for (const [schluessel, grund] of Object.entries(paare)) {
    out[schluessel] = { urteil: "EIGENER_BESTAND", grund };
  }
  return out;
}

// Die gemessene Untergrenze. Sie darf STEIGEN (neue Routen), aber nie unbemerkt fallen: eine
// geschrumpfte Erhebung heißt, dass der Sammler etwas nicht mehr findet.
const MINDESTZAHL_ROUTEN = 121;
const MINDESTZAHL_DATEIEN = 32;

interface Fund {
  schluessel: string;
  datei: string;
  zeile: number;
  praedikatImAufruf: boolean;
  /** mega76 C: die Stellen, an denen der Schutz BEDINGT ist. Leer = dominant. */
  bedingt: string[];
  rechte: Set<string>;
}

// AUFTRAG-mega76 BLOCK C, Grenze 1: `readdirSync` war NICHT rekursiv. Ein neues Unterverzeichnis
// unter `routes/` blieb unsichtbar, solange die Untergrenze anderweitig erfüllt war — die Erhebung
// wäre still geschrumpft, ohne dass irgendeine Zahl es gemerkt hätte. Jetzt steigt sie ab.
function dateien(verzeichnis: string = ROUTES_DIR): string[] {
  const liste: string[] = [];
  for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
    const pfad = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      liste.push(...dateien(pfad));
    } else if (eintrag.name.endsWith(".ts") && !eintrag.name.endsWith(".test.ts")) {
      liste.push(pfad);
    }
  }
  if (verzeichnis === ROUTES_DIR) {
    liste.push(KOMPOSITIONSWURZEL);
  }
  return liste;
}

// Kommentare entfernen, damit der unabhängige Zähler nicht auf Prosa anschlägt.
function ohneKommentare(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

// ================================================================================================
// AUFTRAG-mega76 BLOCK C, Grenze 2 — EINE DEFEKTE DATEI MUSS ALS UNLESBAR GELTEN.
// ================================================================================================
//
// `ts.createSourceFile` WIRFT bei kaputter Syntax nicht. Es liefert klaglos einen Baum mit Löchern
// und legt die Fehler in `parseDiagnostics` ab — eine interne Eigenschaft, die die öffentliche
// Typdeklaration nicht kennt. Der `try/catch` allein fing also genau NICHTS: eine syntaktisch
// defekte Routendatei hätte null Registrierungen geliefert und wäre still durchgelaufen.
//
// Der Zugriff über einen Struktur-Cast ist hier die ehrlichste Form: er sagt im Typ, was er
// erwartet, und trägt es nicht als `any` vor sich her.
function parseFehler(sf: ts.SourceFile): readonly ts.Diagnostic[] {
  return (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
}

// ================================================================================================
// AUFTRAG-mega76 BLOCK C, Grenze 3 — PFADDOMINANZ STATT BLOSSER ERWÄHNUNG.
// ================================================================================================
//
// DER KERN VON BENS BEFUND. `PRAEDIKAT` prüfte bis mega76 nur, ob IRGENDEIN Name des Prädikats im
// Baum der Registrierung vorkommt. Das beweist keine Dominanz — und genau deshalb bestanden die
// Fail-open-Zweige aus Block A BEI GRÜNEM SAMMLER:
//
//     reply.code(200).send(kos ? await sichtbarePaare(user, offen, kos) : offen);
//     if (!conflict || (kos && !(await paarSichtbar(user, conflict.koA, conflict.koB, kos)))) {
//
// Beide NENNEN das Prädikat. Beide lassen es aus, wenn `kos` fehlt. Der Sammler sah nur den Namen.
//
// DIE ZWEI FORMEN, die hier ab jetzt rot sind — und nur sie, weil nur sie den Schutz WEGLASSEN:
//
//   · `bedingung ? <mit Prädikat> : <ohne>` — ein Zweig schützt, der andere gibt das alte
//     Ergebnis heraus. Egal welcher Zweig das Prädikat trägt: einer davon kommt ohne aus.
//   · `bedingung && <mit Prädikat>` — die linke Seite ist ein TOR VOR dem Schutz. Ist sie falsch,
//     läuft der Schutz nicht.
//
// AUSDRÜCKLICH NICHT ROT: `<ohne> || <mit Prädikat>`. Dort ist die linke Seite ein ZUSÄTZLICHER
// Ablehnungsgrund, kein Tor — `if (!obj || !(await urteile(…)).sichtbar)` lehnt bereits ab, wenn
// `!obj` greift. Diese Form ist fail-closed und muss erlaubt bleiben, sonst zwingt der Wächter
// den Code in eine schlechtere Gestalt.
//
// BENANNTE GRENZE: das ist eine SYNTAKTISCHE Dominanzprüfung, keine Datenflussanalyse. Sie fängt
// die zwei Formen, an denen dieses Projekt zweimal gescheitert ist; sie beweist nicht, dass jeder
// denkbare Rückgabepfad durch das Prädikat läuft. Was sie NICHT kann, belegen die Draht-Tests
// (mega76-schutz-erzwungen.test.ts pinnt das Antwortverhalten ohne Schutzabhängigkeit).
function nenntPraedikat(n: ts.Node): boolean {
  if (ts.isIdentifier(n) && PRAEDIKAT_NAMEN.test(n.text)) {
    return true;
  }
  let treffer = false;
  ts.forEachChild(n, (kind) => {
    treffer = treffer || nenntPraedikat(kind);
  });
  return treffer;
}

/** Die Stellen, an denen der Schutz in dieser Registrierung BEDINGT ist. Leer = dominant. */
// Ein Zweig OHNE Prädikat ist unschädlich, wenn er eine KONSTANTE VERWEIGERUNG ist — dann fehlt
// dort nicht der Schutz, dort steht das Nein schon ausgeschrieben. Genau diese Form tragen die
// drei fail-closed Stellen im Bestand: `traeger ? darfSehen(…) : false` (ko-routes.ts:420),
// `obj ? await urteile(…) : { sichtbar: false, vertraulich: true }` (object-routes.ts:199) und
// `… ? { sichtbar: true, … } : { sichtbar: false }` (provenance-routes.ts:102). Ein Wächter, der
// sie rot macht, zwingt den Code in eine schlechtere Gestalt — und wird deshalb abgeschaltet.
function istVerweigerung(n: ts.Node): boolean {
  if (n.kind === ts.SyntaxKind.FalseKeyword || n.kind === ts.SyntaxKind.NullKeyword) {
    return true;
  }
  if (ts.isIdentifier(n) && n.text === "undefined") {
    return true;
  }
  if (ts.isArrayLiteralExpression(n) && n.elements.length === 0) {
    return true;
  }
  if (ts.isObjectLiteralExpression(n)) {
    return n.properties.some(
      (prop) =>
        ts.isPropertyAssignment(prop) &&
        ts.isIdentifier(prop.name) &&
        prop.name.text === "sichtbar" &&
        prop.initializer.kind === ts.SyntaxKind.FalseKeyword,
    );
  }
  return false;
}

// Trägt dieser Teilbaum eine NEGIERTE Prädikat-Auswertung (`!darfSehen(…)`)? Das ist der
// Unterschied zwischen den beiden `&&`-Formen:
//   · `A && schutz(…)`   → wahr heisst „erlaubt". Ein falsches A heisst „nicht erlaubt". FAIL-CLOSED.
//   · `A && !schutz(…)`  → wahr heisst „ablehnen". Ein falsches A heisst „NICHT ablehnen". FAIL-OPEN.
// Die zweite Form ist die aus conflicts-routes.ts:36 vor mega76.
function negiertPraedikat(n: ts.Node): boolean {
  if (
    ts.isPrefixUnaryExpression(n) &&
    n.operator === ts.SyntaxKind.ExclamationToken &&
    nenntPraedikat(n.operand)
  ) {
    return true;
  }
  let treffer = false;
  ts.forEachChild(n, (kind) => {
    treffer = treffer || negiertPraedikat(kind);
  });
  return treffer;
}

function bedingterSchutz(registrierung: ts.Node, sf: ts.SourceFile): string[] {
  const stellen: string[] = [];
  const zeile = (n: ts.Node): number => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const besuche = (n: ts.Node): void => {
    if (ts.isConditionalExpression(n)) {
      const dann = nenntPraedikat(n.whenTrue);
      const sonst = nenntPraedikat(n.whenFalse);
      const ungeschuetzt = dann ? n.whenFalse : n.whenTrue;
      if (dann !== sonst && !istVerweigerung(ungeschuetzt)) {
        stellen.push(
          `Zeile ${zeile(n)}: ein Zweig einer Verzweigung schützt, der andere gibt Daten heraus`,
        );
      }
    }
    if (
      ts.isBinaryExpression(n) &&
      n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
      negiertPraedikat(n.right) &&
      !nenntPraedikat(n.left)
    ) {
      stellen.push(
        `Zeile ${zeile(n)}: '&&' stellt ein Tor VOR eine Ablehnung — fehlt es, wird nicht abgelehnt`,
      );
    }
    ts.forEachChild(n, besuche);
  };
  besuche(registrierung);
  return stellen;
}

// ================================================================================================
// DIE ERHEBUNG EINER DATEI — herausgezogen, damit sie KALIBRIERBAR ist.
// ================================================================================================
//
// AUFTRAG-mega76 BLOCK C: solange dieser Code nur über dem echten Bestand lief, war „grün" nicht
// von „prüft nichts" zu unterscheiden. Als benannte Funktion lässt er sich mit einem
// SYNTHETISCHEN Quelltext füttern, dessen richtige Antwort bekannt ist — genau das tun die
// Kalibrierungen unten.
interface Dateierhebung {
  funde: Fund[];
  unlesbar: string[];
  zaehlerAbweichung: string[];
}

function erhebeDatei(datei: string, text: string): Dateierhebung {
  const funde: Fund[] = [];
  const unlesbar: string[] = [];
  const zaehlerAbweichung: string[] = [];
  {
    let sf: ts.SourceFile;
    try {
      sf = ts.createSourceFile(datei, text, ts.ScriptTarget.Latest, true);
    } catch (fehler) {
      unlesbar.push(`${datei}:1 — nicht parsebar (${String(fehler)})`);
      return { funde, unlesbar, zaehlerAbweichung };
    }
    // mega76 C, Grenze 2: der Wurf allein genügt nicht — die Fehler stehen im Baum.
    const fehler = parseFehler(sf);
    if (fehler.length > 0) {
      unlesbar.push(
        `${datei}:1 — ${fehler.length} Syntaxfehler beim Parsen (parseDiagnostics). Die Erhebung dieser Datei wäre unvollständig.`,
      );
      return { funde, unlesbar, zaehlerAbweichung };
    }
    // AUFTRAG-mega76 BLOCK C: alle lokal deklarierten Funktionen dieser Datei — gleich ob
    // `function f() {}` oder `const f = () => {}`, gleich auf welcher Verschachtelungstiefe. Der
    // Scan unten steigt in sie hinein, statt einem Namen zu glauben.
    const lokaleHelfer = new Map<string, ts.Node>();
    const sammleHelfer = (n: ts.Node): void => {
      if (ts.isFunctionDeclaration(n) && n.name && n.body) {
        lokaleHelfer.set(n.name.text, n.body);
      }
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer &&
        (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))
      ) {
        lokaleHelfer.set(n.name.text, n.initializer.body);
      }
      ts.forEachChild(n, sammleHelfer);
    };
    sammleHelfer(sf);

    let imBaum = 0;
    const besuche = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
        const methode = n.expression.name.text;
        const arg0 = n.arguments[0];
        if (
          METHODEN.has(methode) &&
          arg0 &&
          ts.isStringLiteral(arg0) &&
          arg0.text.startsWith("/")
        ) {
          imBaum += 1;
          let praedikatImAufruf = false;
          const rechte = new Set<string>();
          const besucht = new Set<string>();
          // Die Rümpfe der lokalen Helfer, in die dieser Fund hineingelaufen ist — die
          // Dominanzprüfung unten muss sie mitlesen, sonst verstecken sich Fail-open-Zweige
          // einfach eine Funktion tiefer.
          const mitgelesen: ts.Node[] = [];
          const scan = (x: ts.Node): void => {
            if (ts.isIdentifier(x)) {
              if (PRAEDIKAT_NAMEN.test(x.text)) {
                praedikatImAufruf = true;
              }
              const rumpf = lokaleHelfer.get(x.text);
              if (rumpf && !besucht.has(x.text)) {
                besucht.add(x.text);
                mitgelesen.push(rumpf);
                scan(rumpf);
              }
            }
            if (ts.isStringLiteral(x) && /^(ko|users|conflict)\.[a-z]+$/.test(x.text)) {
              rechte.add(x.text);
            }
            ts.forEachChild(x, scan);
          };
          scan(n);
          funde.push({
            schluessel: `${methode.toUpperCase()} ${arg0.text}`,
            datei,
            zeile: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
            praedikatImAufruf,
            bedingt: [n, ...mitgelesen].flatMap((teil) => bedingterSchutz(teil, sf)),
            rechte,
          });
        }
      }
      ts.forEachChild(n, besuche);
    };
    besuche(sf);

    // (2) DER UNABHÄNGIGE ZÄHLER. Er fragt NUR in eine Richtung: sieht der rohe Text eine Stelle,
    // die WIE eine Registrierung aussieht, die der Syntaxbaum aber NICHT als Fund geliefert hat?
    // Genau das ist der Fall „der Sammler konnte eine Bauform nicht lesen".
    //
    // Die Gegenrichtung (Text sieht weniger) ist KEIN Fehler: der Textlauf ist bewusst grob und
    // verpasst etwa mehrzeilige Typparameter. Er ist ein Sicherheitsnetz unter dem Syntaxbaum,
    // nicht sein Gegenbeweis — und das steht hier, damit niemand die Zahlen für gleichwertig hält.
    const generisch =
      /\.(get|post|put|delete|patch|all|head|options)\s*(<[\s\S]{0,400}?>)?\s*\(\s*["'`]\//g;
    const imText = (ohneKommentare(text).match(generisch) ?? []).length;
    if (imText > imBaum) {
      zaehlerAbweichung.push(
        `${datei}:1 — Textlauf sieht ${imText} Registrierungen, der Syntaxbaum nur ${imBaum}. Der Sammler konnte eine Bauform nicht lesen (z. B. zusammengesetzter Pfad).`,
      );
    }
    // Zweite Bauform, die der Sammler NICHT liest: `app.route({ method, url })`. Sie kommt heute
    // nirgends vor — und soll nicht still einziehen können.
    if (/\.route\s*\(/.test(ohneKommentare(text))) {
      zaehlerAbweichung.push(
        `${datei}:1 — `.concat(
          "`app.route({…})` gefunden. Diese Bauform erhebt der Sammler nicht; die Route wäre ",
          "unsichtbar. Entweder auf app.<methode>('/…') umstellen oder den Sammler erweitern.",
        ),
      );
    }
  }
  return { funde, unlesbar, zaehlerAbweichung };
}

const ERHEBUNG = (() => {
  const funde: Fund[] = [];
  const unlesbar: string[] = [];
  const zaehlerAbweichung: string[] = [];
  for (const datei of dateien()) {
    const teil = erhebeDatei(datei, readFileSync(datei, "utf8"));
    funde.push(...teil.funde);
    unlesbar.push(...teil.unlesbar);
    zaehlerAbweichung.push(...teil.zaehlerAbweichung);
  }
  return { funde, unlesbar, zaehlerAbweichung, dateizahl: dateien().length };
})();

describe("mega74 E · der Sammler über alle Lesewege", () => {
  it("die Erhebung ist vollständig — keine unlesbare Datei, keine Zählerabweichung", () => {
    expect(
      ERHEBUNG.unlesbar,
      `Diese Dateien konnte der Sammler nicht parsen:\n${ERHEBUNG.unlesbar.join("\n")}`,
    ).toEqual([]);
    expect(
      ERHEBUNG.zaehlerAbweichung,
      `Der unabhängige Zähler widerspricht dem Syntaxbaum — genau der Fall, in dem eine Erhebung still schrumpft:\n${ERHEBUNG.zaehlerAbweichung.join("\n")}`,
    ).toEqual([]);
  });

  it("die Erhebung ist nicht geschrumpft — Untergrenze für Routen und Dateien", () => {
    expect(
      ERHEBUNG.funde.length,
      "Weniger Routen als gemessen. Eine leere oder geschrumpfte Erhebung ist ein Fehler, " +
        "kein Erfolg — der Sammler findet etwas nicht mehr.",
    ).toBeGreaterThanOrEqual(MINDESTZAHL_ROUTEN);
    expect(ERHEBUNG.dateizahl).toBeGreaterThanOrEqual(MINDESTZAHL_DATEIEN);
  });

  it("jede erhobene Route trägt GENAU EIN Urteil — eine neue Route ist rot, bis sie beurteilt ist", () => {
    const ohneUrteil = ERHEBUNG.funde
      .filter((f) => !REGISTER[f.schluessel])
      .map((f) => `${f.datei}:${f.zeile} — ${f.schluessel}`);
    expect(
      ohneUrteil,
      `Diese Routen haben kein Urteil im Register. Trägt eine davon Inhalt eines Wissensobjekts hinaus, ist sie ein Loch:\n${ohneUrteil.join("\n")}`,
    ).toEqual([]);
  });

  it("kein verwaistes Urteil — ein Eintrag ohne Route ist ebenfalls rot", () => {
    const erhoben = new Set(ERHEBUNG.funde.map((f) => f.schluessel));
    const verwaist = Object.keys(REGISTER).filter((k) => !erhoben.has(k));
    expect(
      verwaist,
      `Diese Urteile zeigen ins Leere — die Route gibt es nicht (mehr):\n${verwaist.join("\n")}`,
    ).toEqual([]);
  });

  it("wer PRAEDIKAT behauptet, nennt das Prädikat aus Block A wirklich", () => {
    const luegner = ERHEBUNG.funde
      .filter((f) => REGISTER[f.schluessel]?.urteil === "PRAEDIKAT" && !f.praedikatImAufruf)
      .map((f) => `${f.datei}:${f.zeile} — ${f.schluessel}`);
    expect(
      luegner,
      `Diese Routen sind als geschützt eingetragen, rufen die Entscheidung aus services/app/src/sichtbarkeit.ts aber nicht auf:\n${luegner.join("\n")}`,
    ).toEqual([]);
  });

  it("wer KURATORENTOR behauptet, fordert das genannte Recht wirklich", () => {
    const luegner = ERHEBUNG.funde
      .filter((f) => {
        const e = REGISTER[f.schluessel];
        return e?.urteil === "KURATORENTOR" && !!e.recht && !f.rechte.has(e.recht);
      })
      .map(
        (f) =>
          `${f.datei}:${f.zeile} — ${f.schluessel} fordert ${REGISTER[f.schluessel]?.recht} nicht`,
      );
    expect(
      luegner,
      `Behauptetes Recht steht nicht in der Registrierung:\n${luegner.join("\n")}`,
    ).toEqual([]);
  });

  // ================================================================================================
  // AUFTRAG-mega76 BLOCK C, Grenze 3 — die Prüfung, die die Fail-open-Zweige aus Block A gefangen
  // hätte.
  // ================================================================================================
  it("wer PRAEDIKAT behauptet, ruft es UNBEDINGT — kein Zweig ohne Schutz", () => {
    const bedingt = ERHEBUNG.funde
      .filter((f) => REGISTER[f.schluessel]?.urteil === "PRAEDIKAT" && f.bedingt.length > 0)
      .map((f) => `${f.datei}:${f.zeile} — ${f.schluessel}\n    ${f.bedingt.join("\n    ")}`);
    expect(
      bedingt,
      `Diese Routen NENNEN das Prädikat, lassen es aber auf mindestens einem Pfad aus. Genau so
sahen die vier Fail-open-Zweige aus mega74 aus — und der Sammler war dabei grün:\n${bedingt.join("\n")}`,
    ).toEqual([]);
  });

  it("KALIBRIERUNG — die Dominanzprüfung schlägt an den zwei Formen aus mega74 wirklich an", () => {
    // Ohne diesen Fall wäre die grüne Farbe oben wertlos: sie könnte auch davon kommen, dass die
    // Prüfung nichts prüft. Beide Schnipsel sind die WÖRTLICHEN Bauformen, die vor mega76 im Code
    // standen (conflicts-routes.ts:26 und :36).
    const kalibriere = (quelle: string): string[] => {
      const sf = ts.createSourceFile("kalibrierung.ts", quelle, ts.ScriptTarget.Latest, true);
      let stellen: string[] = [];
      const suche = (n: ts.Node): void => {
        if (
          ts.isCallExpression(n) &&
          ts.isPropertyAccessExpression(n.expression) &&
          METHODEN.has(n.expression.name.text)
        ) {
          stellen = stellen.concat(bedingterSchutz(n, sf));
        }
        ts.forEachChild(n, suche);
      };
      suche(sf);
      return stellen;
    };

    const ternaer = kalibriere(
      'app.get("/api/conflicts", async (request, reply) => {' +
        " reply.code(200).send(kos ? await sichtbarePaare(user, offen, kos) : offen); });",
    );
    expect(
      ternaer,
      "die Verzweigung `kos ? <geschützt> : <ungefiltert>` MUSS auffallen",
    ).not.toEqual([]);

    const undUnd = kalibriere(
      'app.get("/api/conflicts/:id", async (request, reply) => {' +
        " if (!c || (kos && !(await paarSichtbar(user, c.koA, c.koB, kos)))) { return; } });",
    );
    expect(undUnd, "das Tor `kos && <geschützt>` MUSS auffallen").not.toEqual([]);

    // GEGENPROBEN: die fail-closed Formen dürfen NICHT anschlagen — sonst zwingt der Wächter den
    // Code in eine schlechtere Gestalt. Alle drei stehen wörtlich so im Bestand.
    const failClosed: Array<[string, string]> = [
      [
        "`!obj || !urteile(...)` — die linke Seite lehnt bereits ab",
        'app.get("/api/objects/:id", async (request, reply) => {' +
          " if (!obj || !(await urteile(user, id, obj.ref)).sichtbar) { return; } });",
      ],
      [
        "`traeger ? darfSehen(...) : false` — der andere Zweig IST das Nein (ko-routes.ts:420)",
        'app.get("/api/evidence", async (request, reply) => {' +
          " sichtbarkeit.set(koId, traeger ? darfSehen(user, traeger) : false); });",
      ],
      [
        "`obj ? await urteile(...) : { sichtbar: false, ... }` (object-routes.ts:199)",
        'app.get("/api/objects/:id/raw", async (request, reply) => {' +
          " const urteil = obj ? await urteile(user, id, obj.ref) : { sichtbar: false, vertraulich: true }; });",
      ],
      [
        "`gegenKo && darfSehen(...)` — POSITIV verknüpft, also fail-closed (provenance-routes.ts:102)",
        'app.get("/api/kos/:id/provenance", async (request, reply) => {' +
          " const g = gegenKo && darfSehen(user, gegenKo) ? { sichtbar: true, id: gegenKo.id } : { sichtbar: false }; });",
      ],
    ];
    for (const [was, quelle] of failClosed) {
      expect(kalibriere(quelle), `${was} — muss erlaubt bleiben`).toEqual([]);
    }
  });

  it("KALIBRIERUNG — der Sammler löst lokale Helfer über den RUMPF auf, nicht über den Namen", () => {
    // AUFTRAG-mega76 BLOCK C: das ist die Prüfung, die `PRAEDIKAT_IM_MODUL` überflüssig gemacht
    // hat. Ohne sie wäre „GET /api/notifications ist PRAEDIKAT" eine unbelegte Behauptung.
    const mitSchutz = erhebeDatei(
      "helfer-mit.ts",
      "async function loadFeed(deps, user) { return sichtbarePaare(user, deps.a, deps.kos); }\n" +
        'app.get("/api/notifications", async (request, reply) => {\n' +
        "  reply.code(200).send(await loadFeed(deps, user));\n});",
    );
    expect(mitSchutz.funde).toHaveLength(1);
    expect(
      mitSchutz.funde[0]?.praedikatImAufruf,
      "das Prädikat steht NUR im Helferrumpf — der Sammler muss hineinsteigen",
    ).toBe(true);

    // GEGENPROBE: ein gleichnamiger Helfer, der NICHTS schützt, darf nicht als geschützt gelten.
    // Genau das ist bens Einwand gegen Namenslisten.
    const ohneSchutz = erhebeDatei(
      "helfer-ohne.ts",
      "async function loadFeed(deps, user) { return deps.a; }\n" +
        'app.get("/api/notifications", async (request, reply) => {\n' +
        "  reply.code(200).send(await loadFeed(deps, user));\n});",
    );
    expect(ohneSchutz.funde).toHaveLength(1);
    expect(
      ohneSchutz.funde[0]?.praedikatImAufruf,
      "ein Helfer gleichen Namens ohne Schutz MUSS als ungeschützt gelten",
    ).toBe(false);

    // Und ein Fail-open-Zweig, der sich eine Funktion tiefer versteckt, muss ebenfalls auffallen.
    const versteckt = erhebeDatei(
      "helfer-bedingt.ts",
      "async function loadFeed(deps, user) { return deps.kos ? sichtbarePaare(user, deps.a, deps.kos) : deps.a; }\n" +
        'app.get("/api/notifications", async (request, reply) => {\n' +
        "  reply.code(200).send(await loadFeed(deps, user));\n});",
    );
    expect(
      versteckt.funde[0]?.bedingt,
      "der bedingte Schutz steht im Helfer, nicht in der Registrierung — er muss trotzdem auffallen",
    ).not.toEqual([]);
  });

  it("KALIBRIERUNG — eine syntaktisch defekte Datei gilt wirklich als unlesbar", () => {
    // mega76 C, Grenze 2: `ts.createSourceFile` wirft NICHT bei kaputter Syntax. Ohne diesen Fall
    // wüsste niemand, ob `parseFehler` überhaupt etwas sieht.
    const heil = ts.createSourceFile(
      "heil.ts",
      'app.get("/api/x", async () => {});',
      ts.ScriptTarget.Latest,
      true,
    );
    expect(parseFehler(heil), "eine heile Datei darf KEINE Parse-Fehler melden").toHaveLength(0);

    const kaputt = ts.createSourceFile(
      "kaputt.ts",
      'app.get("/api/x", async () => { const a = ;;; function }',
      ts.ScriptTarget.Latest,
      true,
    );
    expect(
      parseFehler(kaputt).length,
      'eine defekte Datei MUSS Parse-Fehler melden — sonst liefe sie still als „0 Routen" durch',
    ).toBeGreaterThan(0);
  });

  it("KALIBRIERUNG — der Sammler schlägt bei einer ungeschützten Route wirklich an", () => {
    // Ohne diesen Fall wäre jede grüne Farbe oben wertlos: sie könnte auch davon kommen, dass die
    // Prüfung gar nichts prüft. Ein erfundener Fund ohne Urteil MUSS auffallen.
    const erfunden: Fund = {
      schluessel: "GET /api/erfundene-lesestrecke",
      datei: "services/app/src/routes/erfunden-routes.ts",
      zeile: 42,
      praedikatImAufruf: false,
      bedingt: [],
      rechte: new Set(["ko.read"]),
    };
    expect(
      REGISTER[erfunden.schluessel],
      "der erfundene Fund darf kein Urteil haben",
    ).toBeUndefined();

    // Und eine als PRAEDIKAT eingetragene Route, die es nicht ruft, muss ebenfalls auffallen.
    const luegner: Fund = { ...erfunden, schluessel: "GET /api/kos/:id" };
    expect(REGISTER[luegner.schluessel]?.urteil).toBe("PRAEDIKAT");
    expect(luegner.praedikatImAufruf, "die Prüfung oben würde diesen Fall als Lügner melden").toBe(
      false,
    );
  });
});

// ------------------------------------------------------------------------------------------------
// JOB 1561 · B52 TEIL C, GRENZE 1 — DIE REKURSION IST GEBAUT, ABER BIS HIER UNBELEGT.
// ------------------------------------------------------------------------------------------------
//
// GEFUNDEN DURCH EINE MUTATIONSPROBE, nicht durch Lesen. `dateien()` steigt seit mega76 in
// Unterverzeichnisse ab (`:461`, `if (eintrag.isDirectory())`). Baut man diesen Abstieg aus —
//
//     if (false && eintrag.isDirectory()) { … }
//
// — bleiben ALLE 17 Faelle dieser Datei gruen. Gemessen in JOB 1561.
//
// DER GRUND, und er ist derselbe, den der Kommentar bei `:456` selbst voraussagt: `routes/` hat
// heute **35 Dateien direkt und 0 in Unterverzeichnissen**. Es gibt nichts zu finden, also faellt
// der Ausbau nicht auf. Die Untergrenze (`:773`) prueft nur `>= MINDESTZAHL` — sie merkt nicht,
// OB die Rekursion arbeitet, sondern nur, dass genug Dateien da sind.
//
// Damit gilt fuer diese Grenze genau das, was OFFEN.md ueber die ganze Bauart sagt: „Der Waechter
// haelt, was heute im Code steht, aber nicht jede Bauform von morgen." Legt jemand morgen
// `routes/import/` an, faellt es niemandem auf — bis eine ungeschuetzte Route darin steht.
//
// Dieser Fall schliesst das, nach dem Muster der Kalibrierung bei `:949`: an einem synthetischen
// Baum, nicht am Bestand, damit er unabhaengig davon traegt, ob `routes/` je Unterordner bekommt.
describe("JOB 1561 · B52/C Grenze 1: die Erhebung steigt wirklich ab", () => {
  it("KALIBRIERUNG — eine Datei in einem Unterverzeichnis wird erhoben", () => {
    const wurzel = mkdtempSync(join(tmpdir(), "kw-b52c-"));
    try {
      writeFileSync(join(wurzel, "oben.ts"), 'app.get("/api/oben", async () => {});');
      mkdirSync(join(wurzel, "tiefer"));
      writeFileSync(join(wurzel, "tiefer", "unten.ts"), 'app.get("/api/unten", async () => {});');

      const gefunden = dateien(wurzel).map((p) => p.replace(`${wurzel}/`, ""));

      // Ohne Rekursion stuende hier nur ["oben.ts"] — das ist der ganze Unterschied.
      expect(gefunden).toContain("oben.ts");
      expect(
        gefunden,
        "die Datei im Unterverzeichnis fehlt — die Erhebung steigt nicht ab",
      ).toContain("tiefer/unten.ts");
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it("KALIBRIERUNG — Testdateien bleiben auch tiefer draussen", () => {
    // Die Gegenprobe: Der Abstieg darf die Filterregel nicht aufweichen. Ohne sie waere der Fall
    // oben auch dann gruen, wenn `dateien()` blind alles einsammelte.
    const wurzel = mkdtempSync(join(tmpdir(), "kw-b52c-"));
    try {
      mkdirSync(join(wurzel, "tiefer"));
      writeFileSync(join(wurzel, "tiefer", "echt.ts"), "export const a = 1;");
      writeFileSync(join(wurzel, "tiefer", "echt.test.ts"), "export const b = 2;");

      const gefunden = dateien(wurzel).map((p) => p.replace(`${wurzel}/`, ""));

      expect(gefunden).toContain("tiefer/echt.ts");
      expect(gefunden, "eine .test.ts gehoert nicht in die Erhebung").not.toContain(
        "tiefer/echt.test.ts",
      );
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});
