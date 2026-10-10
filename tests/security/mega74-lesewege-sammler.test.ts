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
//       → ÜBERHOLT durch R-1175 (s. unten).
//
// ================================================================================================
// R-1175 (aufnahme:20260922:gesamt-rechte-inventar) — DIE GRUNDMENGE KOMMT AUS DEM SERVER.
// ================================================================================================
//
// Die Originalanforderung: „Ein Prüfwerkzeug erhebt selbst alle Wege … Was es nicht lesen kann,
// meldet es rot mit Datei und Zeile. Es folgt ausdrücklich keiner handgepflegten Dateiliste."
// Gemessen am Stand 41ba0b7f hielt der Sammler das an drei Stellen nicht:
//
//   (R1) DIE DATEIMENGE war eine Verzeichniswahl (`routes/**` plus `build-app.ts`) und die
//        Ausnahme `services/auth` ein Urteil. `services/app/src/web-static.ts:89` registriert eine
//        Route und lag ausserhalb. → Die Dateien kommen jetzt ZUSÄTZLICH aus `routenquellen()`
//        (schnittstellenErhebung.ts): jede Produktdatei unter `services/**`, in der etwas wie eine
//        Registrierung steht. Die 23 Anmelde- und Kontowege sind damit Funde mit eigenem Urteil.
//   (R2) EIN KONSTANTENPFAD war kein Fund — und der Textlauf schlug nicht an, weil er ein Literal
//        verlangt (`routes/naechster-schritt-entwurf.ts:88`, `web-static.ts:89`). → Eine Konstante
//        derselben Datei wird aufgelöst; was an `app.<methode>(…)` hängt und sich nicht auflösen
//        lässt, ist ROT mit Datei und Zeile. Die Zeile oben „der Zähler in (2) schlägt dann aber
//        an" stimmte für `app.get(BASIS + "/x")` gerade NICHT: der Textlauf verlangt `("/`.
//   (R3) DER ZÄHLER meldete `datei:1` und nur einen Überschuss in der Summe. → Jede Stelle, die
//        der Textlauf sieht und der Syntaxbaum nicht, steht einzeln mit ihrer Zeile da.
//
// Die übrigen benannten Grenzen oben (Dominanz syntaktisch, Leseurteile sind Leseurteile, Prüfung
// der Registrierung und nicht der Antwort) gelten unverändert; die der Erhebung selbst stehen im
// Kopf von schnittstellenErhebung.ts.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { REPO_WURZEL } from "../support/repoPfad";
import {
  pfadVon,
  routenquellen,
  serverInstanzen,
  textlaufLuecken,
  zeichenkettenKonstanten,
} from "./schnittstellenErhebung";

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
  // Ein Dienst filtert. Seit Nacharbeit 2 NACHGEPRÜFT: `kette`/`entscheidung` (oder `weiterleitung`)
  // werden im Syntaxbaum nachgegangen; die Begründung ist nur noch Erläuterung.
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
  /**
   * NACHARBEIT 2 (Befund ben, R-1175): bei DIENST_FILTERT der NACHPRÜFBARE Weg zur Entscheidung.
   * Die Registrierung ruft `kette[0].funktion`, jedes Glied ruft das nächste, das letzte ruft
   * `entscheidung`. Ohne Kette und Entscheidung — oder wenn ein Glied fehlt — ist der Eintrag rot.
   */
  kette?: readonly Glied[];
  entscheidung?: string;
  /**
   * NACHARBEIT 3 (Befund ben, R-1175): die Entscheidung wird an der ROUTE gebildet und als Filter in
   * den Dienst gereicht. Dann muss (a) die Registrierung `entscheidung` AUFRUFEN und (b) das letzte
   * Glied den übergebenen Filter unter diesem Namen AUFRUFEN — die Entscheidung muss also gebildet
   * UND angewendet werden.
   */
  anwendung?: string;
  /** Statt einer Kette: die Registrierung reicht an diese (selbst verfolgte) Route weiter. */
  weiterleitung?: string;
}

interface Glied {
  datei: string;
  funktion: string;
  /**
   * NACHARBEIT 5 (Befund ben, R-1175): WO der Filter in dieses Glied hineinkommt — Argument-Index
   * und bei einem Objektparameter die Eigenschaft. Bei `anwendung` Pflicht für jedes Glied: die
   * Route muss an dieser Stelle die zentrale Entscheidung ÜBERGEBEN, jedes Glied reicht seinen
   * Parameter an derselben Stelle des nächsten weiter, das letzte ruft ihn auf.
   */
  filter?: { index: number; eigenschaft?: string };
}

/**
 * Die EINZIGEN zulässigen Entscheidungen eines wissensführenden Dienstwegs: die Prädikate aus
 * `services/app/src/sichtbarkeit.ts` und die Naht des Wissensnetzes, die die Kompositionswurzel mit
 * genau dieser Policy schliesst (`policyFuer`, `policyNahtSchliessen`).
 *
 * NACHARBEIT 3 (Befund ben): bis hierher standen daneben die Vertraulichkeitsregeln
 * (`isConfidential`/`dropConfidential`/`redactGapForViewer`) als gleichwertig, und eine Liste
 * `NUR_VERTRAULICHKEITSREGEL` erklärte elf Wege ohne die eine Sichtbarkeitsentscheidung für
 * bestanden. Beides ist entfernt: R-1175 verlangt DIE EINE Entscheidung. Die zehn wissensführenden
 * Wege sind im Produkt angebunden (Vertraulichkeitssperren bleiben dort ZUSÄTZLICH bestehen);
 * `GET /api/gaps` gibt keinen Wissensobjekt-Inhalt aus und ist neu als KEIN_KO_INHALT beurteilt.
 */
const ZENTRALE_ENTSCHEIDUNGEN = new Set([
  "darfSehen",
  "sichtbareFuer",
  "sichtbarkeitsfilterFuer",
  "beurteileAnhang",
  "paarSichtbar",
  "sichtbarePaare",
  "sichtbareEintraege",
  "policyFuer",
]);

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
  // JOB 3326 · LESEVARIANTE. Die beiden Leserouten geben Titel/Kernaussage/Inhalt eines
  // Wissensobjekts in einer anderen Sprache aus — also KO-Inhalt. Sie fahren deshalb dasselbe
  // Prädikat wie ihr Original: `darfSehen` am Einzelobjekt (lesevarianten-routes.ts, Route
  // `/api/kos/:id/lesevariante/:lang`) und `sichtbareFuer` + SQL-Trim über der Grundmenge, deren
  // Kennungen die Übersicht überhaupt erst passieren dürfen (Route `/api/lesevarianten`).
  "GET /api/kos/:id/lesevariante/:lang": {
    urteil: "PRAEDIKAT",
    grund: "JOB 3326 — darfSehen am Objekt, 404 statt Variante.",
  },
  "GET /api/lesevarianten": {
    urteil: "PRAEDIKAT",
    grund: "JOB 3326 — sichtbareFuer + sqlSichtbarkeitFuer über der Grundmenge.",
  },
  // Die Ladeaktion gibt keinen KO-Inhalt aus: ihre Antwort ist eine Bilanz aus Zahlen und den
  // Paketschlüsseln der Lieferung (`nichtZugeordnet`) — keine Titel, keine Kennungen des Bestands.
  "POST /api/admin/lesevarianten/laden": {
    urteil: "KEIN_KO_INHALT",
    grund:
      "JOB 3326 — Antwort ist eine Zählbilanz plus Lieferschlüssel (lesevarianten.ts, LadeBilanz).",
  },
  "GET /api/library/search": { urteil: "PRAEDIKAT", grund: "Block B — Titel/Kernaussage." },
  "GET /api/categories": {
    urteil: "PRAEDIKAT",
    grund: "JOB 3507 — Kategorien und Zähler erst nach sqlSichtbarkeitFuer + sichtbareFuer.",
  },
  // JOB 3095 · M5: Bilder anhand Beschreibung/Benennung. Die Kandidaten laufen durch denselben
  // SQL-Trim und `sichtbareFuer` wie die Bibliothekssuche; der Rumpf jedes Treffers wird zusätzlich
  // am vollen Objekt gegen `darfSehen` gehalten (library-routes.ts, Route `/api/library/images`).
  "GET /api/library/images": {
    urteil: "PRAEDIKAT",
    grund: "JOB 3095 — Bild, Unterschrift, Name, Titel; sichtbareFuer + darfSehen am Rumpf.",
  },
  "GET /api/graph": { urteil: "PRAEDIKAT", grund: "Block B — Titel; Filter auf der Grundmenge." },
  // JOB 2009 D2 (H3): der Leser des Wissensnetz-Lesemodells. Der Sammler hat ihn beim ersten Lauf
  // gemeldet — genau dafuer ist er da.
  //
  // WARUM `DIENST_FILTERT` UND NICHT `PRAEDIKAT`: In der Route steht kein Praedikatname aus Block A,
  // und das ist Absicht — der Einstieg NIMMT KEINES entgegen (`h3-consumer-typvertrag.test.ts` C3).
  // Gefiltert wird im Modul, mit der zentralen Policy, die die Kompositionswurzel hereinreicht.
  // Ein `PRAEDIKAT`-Urteil waere hier eine Behauptung, die die Nachpruefung nicht deckt.
  //
  // WAS HINAUSGEHT: Zaehler und THEMENNAMEN (`category`) — kein Titel, keine Kernaussage. Der
  // Lesemodell-Port sagt es ausdruecklich (`lesemodell-ports.ts:43-46`): „Titel und Aussage stehen
  // hier NICHT … was nicht mitreist, kann nicht auslaufen." Und die Themen entstehen NUR aus
  // Objekten, die der Filter bereits durchgelassen hat — getrimmt wird vor dem Zaehlen
  // (`lesemodell.ts:164`).
  "GET /api/wissensnetz/luecken": {
    urteil: "DIENST_FILTERT",
    kette: [
      { datei: "services/wissensnetz/src/luecken-einstieg.ts", funktion: "wissensnetzMetrikFuer" },
      { datei: "services/wissensnetz/src/luecken-einstieg.ts", funktion: "wissensnetzLuecken" },
    ],
    entscheidung: "policyFuer",
    grund:
      "Das Wissensnetz-Modul filtert vor dem Zaehlen: luecken-einstieg.ts:36 ruft policyFuer(betrachter), " +
      "die zentrale Policy kommt aus build-app.ts (policyNahtSchliessen). Ist die Naht offen, wirft " +
      "das Modul VOR dem ersten Lesen — es gibt dann keine leere Sicht, die sich fuer vollstaendig " +
      "erklaert. Ausgegeben werden Zaehler und Themennamen, kein KO-Titel und keine Aussage.",
  },
  // --- JOB 4151: die kuratierten Beziehungen (kanten-routes.ts) -----------------------------
  //
  // WAS HINAUSGEHT UND WARUM DAS URTEIL `PRAEDIKAT` IST: Die Leseauskunft trägt den TITEL des
  // Gegenendpunkts (`KantenGegenstueck`, kanten-service.ts) — also KO-Inhalt. Sie fährt deshalb
  // `sichtbarkeitsfilterFuer`, und zwar VOR der Ausgabe: `KantenLeseService.kantenFuer` trimmt die
  // Grundmenge und zählt `total` danach; ein unsichtbarer oder unauflösbarer Gegenendpunkt erzeugt
  // WEDER Kante NOCH Kennung, Titel oder Zähler (`alsAnsicht`). Einen Schnittzähler gibt es
  // ausdrücklich nicht — er wäre selbst die Existenzauskunft.
  //
  // DASSELBE PRÄDIKAT LIEGT AM AUSGANGSPUNKT (JOB 4151, BEN R2): Bis zur Korrektur wurde nur das
  // GEGENSTÜCK geprüft; der ANGEFRAGTE Eintrag ging ungeprüft durch, und ein fremder Experte bekam
  // für eine vertrauliche Kennung Beziehungen, `total` und Fassungsdaten. Seither beantwortet
  // `kantenFuer` einen Eintrag, den der Abrufende nicht erreicht, wie einen, den es nicht gibt:
  // `{ kanten: [], total: 0 }`, ohne eigenen Fehler — ein eigener Fehler wäre die Auskunft selbst.
  //
  // DIE BEIDEN SCHREIBWEGE STEHEN HIER MIT DEMSELBEN URTEIL, und das ist kein Versehen des
  // Sammlers: sie geben das gespeicherte Aggregat zurück (Endpunktkennungen, Urheber, Zeitpunkt)
  // und prüfen vorher BEIDE Endpunkte gegen dasselbe Prädikat (`KantenSchreibService.erreichbar`).
  // Ohne diese Prüfung liesse sich über die Antwort — 403 gegen 409 — die Existenz eines
  // unsichtbaren Objekts erschliessen; mit ihr sind alle Gründe ununterscheidbar.
  "GET /api/kos/:id/beziehungen": {
    urteil: "PRAEDIKAT",
    grund:
      "JOB 4151 — Titel des Gegenstücks; Trimm VOR der Ausgabe, total zählt danach. BEIDE Enden " +
      "gehen durch dasselbe Prädikat: ein für den Abrufenden unerreichbarer AUSGANGSPUNKT " +
      "antwortet wie einer, den es nicht gibt (leer, kein eigener Fehler).",
  },
  "POST /api/kos/:id/beziehungen": {
    urteil: "PRAEDIKAT",
    grund: "JOB 4151 — beide Endpunkte werden vor dem Schreiben gegen dasselbe Prädikat gehalten.",
  },
  "POST /api/beziehungen/:beziehungId/widerruf": {
    urteil: "PRAEDIKAT",
    grund: "JOB 4151 — Widerruf, kein Löschen; dieselbe Prüfung beider Endpunkte vor der Antwort.",
  },
  // --- WIKI-BEARBEITUNGSRESERVIERUNG: der Bearbeitungshinweis --------------------------------
  // Er trägt keinen Inhalt des Eintrags hinaus (nur Name, Beginn, Ablauf) — aber schon „dort
  // bearbeitet jemand" wäre über ein unsichtbares Objekt eine Existenzauskunft. Alle drei Türen
  // halten deshalb den Eintrag VOR jeder Antwort gegen dasselbe Prädikat wie der Detailabruf.
  "GET /api/kos/:id/bearbeitungen": {
    urteil: "PRAEDIKAT",
    grund: "Bearbeitungshinweis — darfSehen vor der Ausgabe, sonst 404 wie GET /api/kos/:id.",
  },
  "PUT /api/kos/:id/bearbeitungen/:sitzung": {
    urteil: "PRAEDIKAT",
    grund: "Bearbeitungshinweis — darfSehen vor dem Schreiben, sonst 404.",
  },
  "DELETE /api/kos/:id/bearbeitungen/:sitzung": {
    urteil: "PRAEDIKAT",
    grund: "Bearbeitungshinweis — darfSehen vor dem Beenden, sonst 404.",
  },
  // --- Kenntnisnahme einer gültigen Fassung ------------------------------------------------------
  // Übersicht und eigene Anforderungen tragen den Titel des Eintrags; alle fünf Türen halten den
  // Eintrag vor jeder Antwort gegen dasselbe Prädikat wie der Detailabruf. Ein entzogener Zugriff
  // macht die eigene Anforderung unsichtbar und das Bestätigen zum 404.
  "GET /api/kos/:id/kenntnisnahmen": {
    urteil: "PRAEDIKAT",
    grund: "Kenntnisnahme — Übersicht nur zu einem Eintrag, den der Anfordernde sehen darf.",
  },
  "POST /api/kos/:id/kenntnisnahmen": {
    urteil: "PRAEDIKAT",
    grund: "Kenntnisnahme — darfSehen vor dem Anfordern, sonst 404.",
  },
  "POST /api/kenntnisnahmen/:anforderungId/erinnern": {
    urteil: "PRAEDIKAT",
    grund: "Kenntnisnahme — darfSehen am Eintrag der Anforderung vor dem Erinnern, sonst 404.",
  },
  "GET /api/kenntnisnahmen/meine": {
    urteil: "PRAEDIKAT",
    grund: "Kenntnisnahme — eigene Anforderungen, je Eintrag über darfSehen gefiltert.",
  },
  "POST /api/kenntnisnahmen/:anforderungId/bestaetigen": {
    urteil: "PRAEDIKAT",
    grund: "Kenntnisnahme — nur die eigene Anforderung und nur bei darfSehen, sonst 404.",
  },
  // --- R-1644: Wissensauskunft zum Zeitpunkt -------------------------------------------------------
  // Trägt Titel und Kernaussage der damals geltenden Fassung; darfSehen vor jeder Antwort.
  "GET /api/kos/:id/wissensauskunft": {
    urteil: "PRAEDIKAT",
    grund: "Wissensauskunft — darfSehen am Eintrag vor der Ausgabe, sonst 404.",
  },
  // --- R-1656 „Du solltest auch wissen…" ----------------------------------------------------------
  // Die Empfehlung trägt Titel der Gegenseiten: das Zentrum über darfSehen (sonst 404), jede
  // Gegenseite über sichtbarkeitsfilterFuer. Das Co-Reading-Signal hält BEIDE Einträge gegen
  // darfSehen, bevor gezählt wird.
  "GET /api/kos/:id/empfehlungen": {
    urteil: "PRAEDIKAT",
    grund: "Empfehlung — Zentrum über darfSehen, Gegenseiten über sichtbarkeitsfilterFuer.",
  },
  "POST /api/kos/:id/mitgelesen": {
    urteil: "PRAEDIKAT",
    grund: "Co-Reading — beide Einträge über darfSehen, sonst 404; keine Kontokennung gespeichert.",
  },
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
  // R-0142 (Lauf 5): das Importergebnis EINES Wissensobjekts — Quellrevision (Seitentitel), Lauf,
  // Ausgang. Zusätzlich zum Rollentor fährt die Route `darfSehen` am Objekt (unsichtbar ⇒ 404).
  "GET /api/admin/import/knowledge/:koId": {
    urteil: "PRAEDIKAT",
    grund: "darfSehen am Objekt vor jeder Auskunft, sonst 404 — import-run-routes.ts.",
  },
  // --- Die Anhänge (Block C) ---------------------------------------------------------------
  "GET /api/objects/:id": { urteil: "PRAEDIKAT", grund: "Block C — G2, Anhang erbt seine Stufe." },
  "GET /api/objects/:id/raw": { urteil: "PRAEDIKAT", grund: "Block C — G2 + G4 (no-store)." },
  // --- Die Nebenwege (Block D) -------------------------------------------------------------
  // JOB 1546 D2 (A28): das dauerhafte Signal am EIGENEN Objekt. Die Route ruft `sichtbareFuer`
  // über `eigeneKoIds` (conflicts-routes.ts) und filtert danach auf die Autorschaft selbst — sie
  // gibt ausschließlich Kennungen EIGENER Objekte aus, nie eine Zeile Fachinhalt und nie etwas
  // über die Gegenseite (`EigenerBefund` hat kein Feld dafür).
  // JOB 3032 (N5): dazu kommt die Deckungslage des Laufs, der das EIGENE Objekt angesehen hat —
  // ein Zustandswort und zwei Zählwerte aus dem eigenen Abdeckungsprotokoll (`completed`,
  // `available`). Sie stammen aus dem eigenen `aiCheck` und benennen kein fremdes Objekt.
  "GET /api/duplicate-signal": {
    urteil: "PRAEDIKAT",
    grund:
      "A28 — sichtbareFuer, danach Autorschaft; nur eigene Kennungen, zwei Booleans und die " +
      "Deckungslage des eigenen Prüflaufs.",
  },
  "GET /api/conflicts": { urteil: "PRAEDIKAT", grund: "Block D — Paar-Tor, wörtliche Zitate." },
  "GET /api/conflicts/geloest": {
    urteil: "PRAEDIKAT",
    grund:
      "R-1662 — Paar-Tor wie die Liste; bei Redaktion auch Entscheidung und Zweitmeinung leer.",
  },
  "GET /api/conflicts/:id": { urteil: "PRAEDIKAT", grund: "Block D — Paar-Tor." },
  // R-0263 (Aufnahme gesamt-konfliktklassifikation): Vorrang am Punkt — Paar-Tor je Eintrag,
  // der Geltungsbereich (Menschentext) zusätzlich hinter `feldFreigabe`.
  "GET /api/conflicts/vorrang/:id": {
    urteil: "PRAEDIKAT",
    grund: "R-0263 — Paar-Tor je Eintrag, Geltungsbereich hinter feldFreigabe.",
  },
  // R-0252 (Nacharbeit 6): der Einordnungsweg ändert UND antwortet mit dem Konflikt — deshalb das
  // Paar-Tor vor der Änderung (unsichtbar ⇒ 404, nichts geändert) und die Antwort durch
  // feldFreigabe/redigiereKonflikt wie der Detailweg.
  "POST /api/conflicts/:id/arbeitsart": {
    urteil: "PRAEDIKAT",
    grund: "R-0252 — Paar-Tor vor der Einordnung, Antwort redigiert wie GET /api/conflicts/:id.",
  },
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
    entscheidung: "sichtbarkeitsfilterFuer",
    kette: [
      {
        datei: "services/output/src/service.ts",
        funktion: "listEligible",
        filter: { index: 0 },
      },
    ],
    anwendung: "sichtbar",
    grund:
      "Route bildet sichtbarkeitsfilterFuer(user); listEligible wendet ihn an (neben isConfidential).",
  },
  "POST /api/output/generate": {
    urteil: "DIENST_FILTERT",
    entscheidung: "sichtbarkeitsfilterFuer",
    kette: [
      { datei: "services/output/src/service.ts", funktion: "generate", filter: { index: 1 } },
    ],
    anwendung: "sichtbar",
    grund: "Unsichtbares KO antwortet wie unbekanntes (UNKNOWN_KO); vertrauliches wirft weiterhin.",
  },
  // RECHERCHE:pmo-fea-0004: das Wissensupdate nimmt nur validierte, nicht vertrauliche Objekte.
  // Nacharbeit 18 (Integration main): bis hierher nur Prosa und nur Status/Vertraulichkeit — ohne
  // die EINE Entscheidung kam ein Titel aus einem fremden Space ins Update. Jetzt nachgeprüfter Weg.
  "GET /api/output/wochenupdate": {
    urteil: "DIENST_FILTERT",
    entscheidung: "sichtbarkeitsfilterFuer",
    kette: [
      { datei: "services/output/src/service.ts", funktion: "wochenupdate", filter: { index: 1 } },
      { datei: "services/output/src/wochenupdate.ts", funktion: "erzeuge", filter: { index: 1 } },
    ],
    anwendung: "sichtbar",
    grund:
      "erzeuge begrenzt die Grundmenge mit sichtbar(ko); danach validiert UND !isConfidential " +
      "(wochenupdate.ts, waehleWochenupdate).",
  },
  "POST /api/output/scorm/pruefen": {
    urteil: "DIENST_FILTERT",
    entscheidung: "sichtbarkeitsfilterFuer",
    kette: [
      { datei: "services/output/src/scorm.ts", funktion: "pruefe", filter: { index: 1 } },
      { datei: "services/output/src/scorm.ts", funktion: "bereite", filter: { index: 1 } },
      { datei: "services/output/src/scorm.ts", funktion: "lade", filter: { index: 2 } },
    ],
    anwendung: "sichtbar",
    grund: "scorm.ts lade — unsichtbar blockiert wie UNKNOWN_KO; vertraulich bleibt CONFIDENTIAL.",
  },
  "POST /api/output/scorm/paket": {
    urteil: "DIENST_FILTERT",
    entscheidung: "sichtbarkeitsfilterFuer",
    kette: [
      { datei: "services/output/src/scorm.ts", funktion: "exportiere", filter: { index: 1 } },
      { datei: "services/output/src/scorm.ts", funktion: "bereite", filter: { index: 1 } },
      { datei: "services/output/src/scorm.ts", funktion: "lade", filter: { index: 2 } },
    ],
    anwendung: "sichtbar",
    grund: "scorm.ts lade — unsichtbares oder vertrauliches KO blockiert, kein Paket.",
  },
  "POST /api/ask": {
    urteil: "DIENST_FILTERT",
    entscheidung: "sichtbarkeitsfilterFuer",
    kette: [{ datei: "services/ask/src/service.ts", funktion: "ask", filter: { index: 4 } }],
    anwendung: "grundlageSichtbarFuer",
    grund:
      "Sitzung: sichtbarkeitsfilterFuer(betrachter); Schlüssel: sichtbarkeitsfilterFuer(schluessel" +
      "Betrachter(offeneSpaces)); ask wendet die Grundlage an, dropConfidential bleibt daneben.",
  },
  // JOB 3091 (KA6 Memo): der Zuruf traegt Kernaussagen validierter Wissensobjekte als Belege zum
  // Modell und Titel/Version als Herkunft zurueck ans Panel. Der Erzeuger filtert an EINER Stelle,
  // bevor irgendetwas hinausgeht: nur `status === "validiert"` (zuruf.ts:384) und `dropConfidential`
  // (zuruf.ts:389); und er sammelt erst NACH bestaetigter Einwilligung des Sitzungstors (zuruf.ts:250).
  "POST /api/klara/sessions/:sessionId/zuruf": {
    urteil: "DIENST_FILTERT",
    entscheidung: "sichtbarkeitsfilterFuer",
    kette: [
      { datei: "services/output/src/zuruf.ts", funktion: "schlageVor", filter: { index: 1 } },
      { datei: "services/output/src/zuruf.ts", funktion: "sammleQuellen", filter: { index: 1 } },
    ],
    anwendung: "sichtbar",
    grund:
      "output/src/zuruf.ts:384/389 — nur validierte KOs, dropConfidential auf der Quellenliste; " +
      "Einwilligung (zuruf.ts:250) vor jedem Bestandszugriff.",
  },
  // R-0700: Klaras eigener Ausführungszugang ruft DENSELBEN Fragedienst wie `POST /api/ask`.
  // R-0700 (aus main) · Nacharbeit 28: Klaras Zugang läuft über DENSELBEN `antwortLauf` wie
  // POST /api/ask — dieselbe nachgeprüfte Kette statt einer Prosabegründung.
  "POST /api/klara/sessions/:sessionId/execute": {
    urteil: "DIENST_FILTERT",
    entscheidung: "sichtbarkeitsfilterFuer",
    kette: [{ datei: "services/ask/src/service.ts", funktion: "ask", filter: { index: 4 } }],
    anwendung: "grundlageSichtbarFuer",
    grund:
      "antwortLauf: sichtbarkeitsfilterFuer(betrachter) bzw. (schluesselBetrachter(offen)) als " +
      "Grundlage an ask; dropConfidential bleibt daneben (ask/src/service.ts).",
  },
  "POST /api/knowledge/check": {
    // produkt:20261007:spaces: zusätzlich zu dropConfidential filtert die Route die Kandidaten
    // mit `sichtbarkeitsfilterFuer` (führender Space) — nachgeprüft statt nur behauptet.
    urteil: "PRAEDIKAT",
    grund: "Kandidaten durch sichtbarkeitsfilterFuer, danach dropConfidential.",
  },
  "POST /api/check-text": {
    urteil: "DIENST_FILTERT",
    entscheidung: "sichtbarkeitsfilterFuer",
    kette: [
      {
        datei: "services/app/src/check-text-detection.ts",
        funktion: "checkText",
        filter: { index: 1, eigenschaft: "poolSichtbar" },
      },
      {
        datei: "services/app/src/check-text-detection.ts",
        funktion: "selectPool",
        filter: { index: 1, eigenschaft: "poolSichtbar" },
      },
      {
        datei: "services/app/src/check-text-detection.ts",
        funktion: "istPoolKandidat",
        filter: { index: 2, eigenschaft: "poolSichtbar" },
      },
    ],
    anwendung: "poolSichtbar",
    grund:
      "istPoolKandidat wendet poolSichtbar (sichtbarkeitsfilterFuer der Route) neben !isConfidential an.",
  },
  "POST /api/reasoner": {
    urteil: "DIENST_FILTERT",
    entscheidung: "sichtbarkeitsfilterFuer",
    kette: [{ datei: "services/ask/src/service.ts", funktion: "ask", filter: { index: 4 } }],
    anwendung: "grundlageSichtbarFuer",
    grund: "task 'ask' reicht dieselbe Grundlage wie /api/ask in den ask-Dienst.",
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
  "GET /api/audit/seite": { urteil: "KURATORENTOR", recht: "ko.validate", grund: "Protokoll." },
  "GET /api/audit/verify": { urteil: "KURATORENTOR", recht: "ko.validate", grund: "Protokoll." },
  "GET /api/audit/export": { urteil: "KURATORENTOR", recht: "ko.validate", grund: "Protokoll." },
  "GET /api/audit/ko/:koId/findings": {
    urteil: "KURATORENTOR",
    recht: "ko.validate",
    grund: "Protokoll.",
  },
  "GET /api/model-runs": {
    urteil: "KURATORENTOR",
    recht: "ko.validate",
    grund: "Projektion entfernt actor/subject (model-runs-routes.ts:46).",
  },
  // Aufnahme gesamt-ki-laufprotokoll: nur Zähler und Summen über Läufe (Aufgabe, Status, Token,
  // Kosten) — kein Anfragender, kein Gegenstand, kein Fehlertext, kein Wissensobjekt.
  "GET /api/model-runs/auswertung": {
    urteil: "KEIN_KO_INHALT",
    grund: "nur Laufsummen je Aufgabe/Währung (model-runs-routes.ts:52-68).",
  },
  "GET /api/analytics/expertise": {
    urteil: "KURATORENTOR",
    recht: "ko.assign",
    grund: "Personen-Matching hinter Schalter; ko.assign = controller/admin.",
  },
  "GET /api/admin/demo-seed": { urteil: "KURATORENTOR", recht: "users.manage", grund: "Admin." },
  // JOB 3277: die Demopaket-Übersicht nennt Beschreibung, Umfang und den GEZÄHLTEN Stand
  // (geladen/bearbeitet) — kein Wissensinhalt, aber Verwaltungswissen über diese Instanz.
  "GET /api/admin/demo-packages": {
    urteil: "KURATORENTOR",
    recht: "users.manage",
    grund: "Admin.",
  },
  // JOB 3277 R2: die Vorschau vor dem Zurücksetzen/Entfernen. Sie gibt — anders als die Übersicht
  // darüber — TITEL von Wissensobjekten aus (je zugeordnetem Objekt Kennung, Art, Lauf, Titel);
  // `KEIN_KO_INHALT` wäre hier also unwahr. Sie ist ausschliesslich über `users.manage` erreichbar,
  // nachgemessen in tests/demopaket-advisor/register-und-tiefer-reset.test.ts (403 ohne das Recht).
  "GET /api/admin/demo-packages/:id/preview": {
    urteil: "KURATORENTOR",
    recht: "users.manage",
    grund: "Admin; Titel zugeordneter Paketobjekte.",
  },
  "GET /api/admin/factory-reset": {
    urteil: "KURATORENTOR",
    recht: "users.manage",
    grund: "Admin.",
  },
  // JOB 4025 (KUNDENBETRIEB-BACKUP): die Sicherungsauskunft. Sie gibt Dateinamen, Zeitstempel,
  // Größen und Prüfsummen aus dem Sicherungsverzeichnis heraus — KEINEN Inhalt eines
  // Wissensobjekts: der Dump wird nie geöffnet, nur `readdir` und `stat` laufen darüber
  // (`admin-routes.ts`, `befundFuer`). Das Urteil ist trotzdem `KURATORENTOR` und nicht
  // `KEIN_KO_INHALT`, und zwar ausdrücklich: es ist das STÄRKERE und nachgeprüfte Urteil — die
  // Route fordert `users.manage`, und der Sammler misst das nach, statt es mir zu glauben. Was sie
  // herausgibt, ist Wissen über die Betriebsumgebung (absoluter Pfad, Sicherungsstand), und das
  // gehört ohnehin nur in Admin-Hände.
  // ADMIN-13: dazu die vier Schutzwege — letzter Backup-Lauf und letzte Restore-Probe (Zahlen,
  // Zeitpunkte, Kennungen aus den Skriptspuren), Export- und Papierkorbstand (Zähler und Zeitpunkte
  // aus Audit und `trashed()`). Weiterhin kein Titel und kein Text eines Wissensobjekts.
  "GET /api/admin/sicherungen": {
    urteil: "KURATORENTOR",
    recht: "users.manage",
    grund:
      "Admin; Dateinamen, Prüfsummen, Lauf-/Drillprotokoll, Export- und Papierkorbzähler — kein KO-Inhalt.",
  },
  "GET /api/import/confluence/zugang": {
    urteil: "KURATORENTOR",
    recht: "users.manage",
    grund: "Zugangszustand, Admin.",
  },
  // R-0134 / R-1005: der Betreiberschalter. Nimmt genau ein Ja/Nein entgegen und antwortet mit
  // derselben Zugangsauskunft wie der Leseweg darüber — kein Inhalt eines Wissensobjekts.
  "PUT /api/import/confluence/schalter": {
    urteil: "KURATORENTOR",
    recht: "users.manage",
    grund: "Betreiberschalter (Ja/Nein) + Zugangszustand, Admin.",
  },
  // JOB 4086: dieselbe Auskunft für SharePoint/OneDrive. Sie gibt Schalterzustand, die NAMEN der
  // Umgebungsvariablen und ja/nein je Variable aus — nie einen Wert, nie eine Maske mit Länge und
  // keinen Inhalt eines Wissensobjekts (`services/sharepoint/src/credential-state.ts`).
  "GET /api/import/sharepoint/zugang": {
    urteil: "KURATORENTOR",
    recht: "users.manage",
    grund: "Zugangszustand, Admin.",
  },
  // ADMIN-02: der Verbindungstest. Antwortet mit Zeitpunkt, Umfang, Ergebniswort und Dauer — keine
  // Dateinamen, kein Inhalt, kein Wissensobjekt.
  "POST /api/import/sharepoint/verbindungstest": {
    urteil: "KURATORENTOR",
    recht: "users.manage",
    grund: "Verbindungstest (feste Ergebniswörter), Admin.",
  },
  // ADMIN-02: derselbe Verbindungstest für Confluence — feste Ergebniswörter, kein Seiteninhalt.
  "POST /api/import/confluence/verbindungstest": {
    urteil: "KURATORENTOR",
    recht: "users.manage",
    grund: "Verbindungstest (feste Ergebniswörter), Admin.",
  },
  // ADMIN-02: die Importliste. Je Lauf dieselbe Form wie der Einzelweg (`laufNachAussen`):
  // Kennungen, Status, Zeitpunkte, Zähler, Fehlercode — und den Scope der Quelle. Rollentor Admin.
  "GET /api/admin/import/runs": {
    urteil: "KURATORENTOR",
    recht: "users.manage",
    grund: "Laufliste (laufNachAussen), Admin.",
  },
  // R-0170: dieselbe Auskunft für Jira (`services/jira/src/credential-state.ts`) — Namen und
  // ja/nein je Variable, nie ein Wert, kein Inhalt eines Wissensobjekts.
  "GET /api/import/jira/zugang": {
    urteil: "KURATORENTOR",
    recht: "users.manage",
    grund: "Zugangszustand, Admin.",
  },
  "GET /api/reasoner/config": { urteil: "KURATORENTOR", recht: "users.manage", grund: "Admin." },
  "GET /api/library/import/candidates": {
    urteil: "KEIN_KO_INHALT",
    grund: "Import-Kandidaten sind noch keine Wissensobjekte; DTO hält Interna zurück (:63).",
  },
  // JOB 3363 · die Leseübersetzung EINES Kandidaten. DASSELBE Urteil wie die Zeile darüber, und aus
  // demselben Grund: ein Import-Kandidat ist noch kein Wissensobjekt (`koId` ist null, bis jemand
  // annimmt), also gibt diese Route keinen KO-Inhalt aus. Ausgegeben wird der Text der LOKALEN
  // LIEFERUNG (`example-packages/advisor-ict-v1.lokalisierung.json`) zu genau dem Herkunftsanker,
  // den der Kandidat selbst führt — kein Bestandstext, keine Bestandskennung. Die Auflösung setzt
  // ZUERST den geladenen Kandidaten voraus (`kandidaten.findById`); ohne ihn antwortet die Route
  // 404, es gibt also keinen Weg, die Lieferung mit einer frei gewählten Quellkennung zu befragen.
  "GET /api/library/import/candidates/:id/lesevariante/:lang": {
    urteil: "KEIN_KO_INHALT",
    grund:
      "JOB 3363 — Text der lokalen Lieferung zum Anker des Kandidaten; kein Wissensobjekt, keine koId.",
  },
  // --- Gaps: eigener Sichtbarkeitsvertrag ----------------------------------------------------
  // NACHARBEIT 3: eine Wissenslücke ist kein Wissensobjekt. Die Sicht `GapView`
  // (ask/src/gap-visibility.ts) trägt id, Fragetext des Fragenden (geschwärzt für Dritte), Status,
  // Zuständigen, Priorität, Zeitpunkt, Sprache — kein Feld und keine Kennung eines Wissensobjekts.
  // Der Schutz des FRAGETEXTS bleibt `redactGapForViewer` (Eigentum/Zuständigkeit).
  "GET /api/gaps": {
    urteil: "KEIN_KO_INHALT",
    grund: "GapView ohne Wissensobjekt-Feld; Fragetext redigiert durch redactGapForViewer.",
  },
  "GET /api/gaps/summary": { urteil: "KEIN_KO_INHALT", grund: "Zähler, keine Fragetexte." },
  // R-1663 / R-2178: gibt Titel der Objekte aus, auf denen die Spuren einer Person liegen — also
  // KO-Inhalt. Die Grundmenge läuft durch `sichtbarkeitsfilterFuer` (und `dropConfidential`) im
  // AskService, bevor gezählt wird; dazu Schalter `expertMatching` und `ko.assign`.
  "GET /api/gaps/:id/ansprechpartner": {
    urteil: "PRAEDIKAT",
    grund:
      "R-2178 — sichtbarkeitsfilterFuer über der Objektgrundlage, Titel nur sichtbarer Objekte.",
  },
  // --- Entwürfe: eigener Bestand, nach Eigentümer begrenzt -----------------------------------
  // Pool-Auftrag (R-2099): dazu kommen Entwürfe, die ihr Autor BEWUSST in den gemeinsamen Pool
  // gegeben hat — Entwürfe, keine Wissensobjekte; entschieden von derselben einen Regel
  // (`entwurfSichtbarFuer`), die auch den Anhang-Leseweg trägt.
  "GET /api/drafts": {
    urteil: "EIGENER_BESTAND",
    grund: "visibleDraftsFor — Eigentümerlogik plus bewusst geteilter Pool.",
  },
  "GET /api/drafts/:id": { urteil: "EIGENER_BESTAND", grund: "requireVisibleDraft." },
  // JOB 3668 (Entwurfs-Papierkorb): derselbe Bestand, dieselbe Eigentümerlogik — nur die gelöschten
  // Entwürfe. Zweifach begrenzt: die Ablage lädt fremde gar nicht erst (`listTrashed(user.id)`), und
  // `canSeeDraft` entscheidet danach noch einmal. Ein Entwurf ist ohnehin kein Wissensobjekt; was
  // hier herausgeht, hat der Fragende selbst geschrieben.
  "GET /api/drafts/trash": {
    urteil: "EIGENER_BESTAND",
    grund: "listTrashed(user.id) + canSeeDraft — dieselbe Eigentümerlogik wie GET /api/drafts.",
  },
  // JOB 1171 D1: die ableitende Auskunft. Zweifach begrenzt — derselbe Torwächter wie die
  // Einzelroute darüber, UND ihre Antwort trägt gar keinen Inhalt: `{ art, herkunft }` sind eine
  // Kennung und Feldnamen (`payload.title`, `anchorsMissing`), kein Titel, keine Kernaussage,
  // kein Body. Beurteilt nach dem strengeren der beiden Gründe.
  "GET /api/drafts/:id/naechster-schritt": {
    urteil: "EIGENER_BESTAND",
    grund: "requireVisibleDraft (capture-routes.ts) — und die Antwort führt nur Feldnamen.",
  },
  // R-1133: Entwürfe, keine Wissensobjekte. Der gefragte über requireVisibleDraft, jeder Treffer
  // über canSeeDraft — die Antwort trägt Kennung und Titel nur sichtbarer Entwürfe.
  "GET /api/drafts/:id/gleicher-inhalt": {
    urteil: "EIGENER_BESTAND",
    grund: "requireVisibleDraft + canSeeDraft je Treffer (capture-routes.ts).",
  },
  "GET /api/me/impact": { urteil: "EIGENER_BESTAND", grund: "vier eigene Zähler (impact.ts:88)." },
  // Betroffenenrechte (datenschutz-routes.ts). Die Auskunft gibt die EIGENEN Beiträge immer aus
  // (Kommentartext, Fragetext, Entwurf) — den TITEL eines Objekts nur, wenn der Betrachter es heute
  // sehen darf: `sichtbarkeitsfilterFuer` des Betrachters geht unbedingt in die Zusammenstellung.
  // Nacharbeit 16 (Befund ben): die Route BILDET den Filter nur; ANGEWENDET wird er im Dienst
  // (`erstelleSelbstauskunft`, Bildung von `titelVon`). Deshalb DIENST_FILTERT mit Kette und
  // Filterstelle — nachgeprüft werden Übergabe, Unversehrtheit und Aufruf im Dienst, nicht nur der
  // Fabrikaufruf in der Route.
  "GET /api/me/daten": {
    urteil: "DIENST_FILTERT",
    entscheidung: "sichtbarkeitsfilterFuer",
    kette: [
      {
        datei: "services/app/src/selbstauskunft.ts",
        funktion: "erstelleSelbstauskunft",
        filter: { index: 2 },
      },
    ],
    anwendung: "sichtbar",
    grund: "Selbstauskunft — Objekttitel nur, wo sichtbar(k) des Betrachters (selbstauskunft.ts).",
  },
  "GET /api/datenschutz/auskunft/:nutzerId": {
    urteil: "DIENST_FILTERT",
    entscheidung: "sichtbarkeitsfilterFuer",
    kette: [
      {
        datei: "services/app/src/selbstauskunft.ts",
        funktion: "erstelleSelbstauskunft",
        filter: { index: 2 },
      },
    ],
    anwendung: "sichtbar",
    grund: "Auskunft durch die Verwaltung — Objekttitel nur, wo sichtbar(k) der Verwaltung.",
  },
  "GET /api/me/loeschantrag": {
    urteil: "EIGENER_BESTAND",
    grund: "Die eigenen Löschanträge (loeschantraege.ts, vonNutzer).",
  },
  "POST /api/me/loeschantrag": {
    urteil: "EIGENER_BESTAND",
    grund: "Antwort ist der eigene neue Antrag.",
  },
  "POST /api/me/loeschantrag/:id/zurueckziehen": {
    urteil: "EIGENER_BESTAND",
    grund: "Nur der eigene Antrag; ein fremder ist 404.",
  },
  "GET /api/livewall/consent": {
    urteil: "EIGENER_BESTAND",
    grund: "nur die eigene Namenszustimmung als Wahrheitswert (livewall-routes.ts, user.id).",
  },
  "PUT /api/livewall/consent": {
    urteil: "EIGENER_BESTAND",
    grund: "setzt/widerruft nur die eigene Namenszustimmung, Antwort nur der Wahrheitswert.",
  },
  "PUT /api/livewall/photo": {
    urteil: "EIGENER_BESTAND",
    grund: "hinterlegt nur das eigene Foto (user.id), Antwort nur der Wahrheitswert.",
  },
  "DELETE /api/livewall/photo": {
    urteil: "EIGENER_BESTAND",
    grund: "löscht nur das eigene Foto (user.id), Antwort nur der Wahrheitswert.",
  },
  "GET /api/me/gedaechtnis": {
    urteil: "EIGENER_BESTAND",
    grund: "nur die eigenen Gedächtniseinträge (gedaechtnis-routes.ts, user.id); kein KO-Inhalt.",
  },
  "POST /api/me/gedaechtnis": {
    urteil: "EIGENER_BESTAND",
    grund: "legt nur einen eigenen Eintrag an; die Antwortkennung muss eine eigene sein.",
  },
  "DELETE /api/me/gedaechtnis/:id": {
    urteil: "EIGENER_BESTAND",
    grund: "löscht nur einen eigenen Eintrag (user.id), fremd und unbekannt antworten 404.",
  },
  "DELETE /api/me/gedaechtnis": {
    urteil: "EIGENER_BESTAND",
    grund: "löscht nur das eigene Gedächtnis (user.id), Antwort nur die Zahl.",
  },
  // --- Kein Inhalt eines Wissensobjekts ------------------------------------------------------
  "GET /health": { urteil: "KEIN_KO_INHALT", grund: "Betriebszustand." },
  "GET /api/ai-status": { urteil: "KEIN_KO_INHALT", grund: "Modellzustand." },
  "GET /api/reasoner/status": { urteil: "KEIN_KO_INHALT", grund: "Modellzustand." },
  // R-0599: Modus, Anbieter und Herkunft des arbeitenden KI-Zugangs — Konfigurationslage, kein KO.
  "GET /api/ki-lage": { urteil: "KEIN_KO_INHALT", grund: "KI-Lage (Modus, Anbieter, Herkunft)." },
  "GET /api/features": { urteil: "KEIN_KO_INHALT", grund: "Schalter als Ja/Nein." },
  // R-1064: Supportweg der Installation — Zustand, geprüftes Ziel und Beschriftung aus zwei
  // Betreiberwerten (support-routes.ts:119), kein Feld aus einem Wissensobjekt.
  "GET /api/support": {
    urteil: "KEIN_KO_INHALT",
    grund:
      "R-1064 — Supportkontakt der Instanz aus der Umgebung (support-routes.ts), kein Bestand.",
  },
  // JOB 3510 · die Markenwahl. Beide Wege geben ausschließlich die Darstellungslage der Instanz
  // aus: Profilname, `aktiv`, Änderungszahl und — nur bei eingeschalteter Wahl — Markenname, zwei
  // Logofarben und der Pfad des mitgelieferten Logos (`branding-settings.ts`, BRANDING_PROFILE).
  // Kein Feld dieser Antworten stammt aus einem Wissensobjekt; die Ablage kennt den Bestand nicht.
  "GET /api/branding": {
    urteil: "KEIN_KO_INHALT",
    grund: "JOB 3510 — Erscheinungsbild der Instanz (branding-routes.ts), kein Bestand.",
  },
  "PUT /api/admin/branding": {
    urteil: "KEIN_KO_INHALT",
    grund: "JOB 3510 — Antwort ist derselbe Stand wie der Leseweg; users.manage im Rumpf.",
  },
  // ADMIN-15 · Unternehmensprofil und interne Richtlinien (unternehmen-routes.ts). Profil- und
  // Richtlinienfassungen sowie das Handlungsprotokoll liegen in einer eigenen Ablage
  // (`unternehmensprofil.ts`); kein Feld dieser Antworten stammt aus einem Wissensobjekt.
  "GET /api/unternehmensprofil": {
    urteil: "KEIN_KO_INHALT",
    grund: "ADMIN-15 — Name, Logo und Akzent des Unternehmens, kein Bestand.",
  },
  "GET /api/admin/unternehmensprofil": {
    urteil: "KEIN_KO_INHALT",
    grund: "ADMIN-15 — Profilfassungen und feste Gestaltungsoptionen; users.manage im Rumpf.",
  },
  "PUT /api/admin/unternehmensprofil": {
    urteil: "KEIN_KO_INHALT",
    grund: "ADMIN-15 — Antwort ist die neue Profilfassung.",
  },
  "GET /api/richtlinien": {
    urteil: "KEIN_KO_INHALT",
    grund: "ADMIN-15 — geltende Richtlinienfassungen und die eigene Handlung, kein Bestand.",
  },
  "POST /api/richtlinien/:id/handlungen": {
    urteil: "KEIN_KO_INHALT",
    grund: "ADMIN-15 — Antwort ist der eigene Protokolleintrag (Fassung, Handlung, Zeitpunkt).",
  },
  "GET /api/admin/richtlinien": {
    urteil: "KEIN_KO_INHALT",
    grund: "ADMIN-15 — Richtlinienfassungen und Zähler zur aktuellen Fassung.",
  },
  "GET /api/admin/richtlinien/:id/protokoll": {
    urteil: "KEIN_KO_INHALT",
    grund: "ADMIN-15 — Handlungsprotokoll einer Richtlinie; users.manage im Rumpf.",
  },
  "POST /api/admin/richtlinien/wirkung": {
    urteil: "KEIN_KO_INHALT",
    grund: "ADMIN-15 — Zähler der Wirkung einer geplanten Fassung; schreibt nichts.",
  },
  "POST /api/admin/richtlinien": {
    urteil: "KEIN_KO_INHALT",
    grund: "ADMIN-15 — Antwort ist die neue Richtlinienfassung samt Wirkung.",
  },
  "POST /api/admin/richtlinien/:id/fassungen": {
    urteil: "KEIN_KO_INHALT",
    grund: "ADMIN-15 — Antwort ist die neue Richtlinienfassung samt Wirkung.",
  },
  // Firmenwörterbuch (begriffe-routes.ts): Katalogeinträge und Hinweise. Kein Feld stammt aus
  // einem Wissensobjekt — der Abgleich liest nur den Katalog und den mitgesendeten Text.
  "GET /api/begriffe": { urteil: "KEIN_KO_INHALT", grund: "Begriffskatalog, kein Bestand." },
  "GET /api/begriffe/:id": { urteil: "KEIN_KO_INHALT", grund: "Fassungen eines Katalogeintrags." },
  "GET /api/begriffe/:id/fassungen/:version": {
    urteil: "KEIN_KO_INHALT",
    grund: "Eine Fassung eines Katalogeintrags.",
  },
  "POST /api/begriffe": { urteil: "KEIN_KO_INHALT", grund: "Antwort ist die neue Katalogfassung." },
  "PUT /api/begriffe/:id": {
    urteil: "KEIN_KO_INHALT",
    grund: "Antwort ist die neue Katalogfassung.",
  },
  "POST /api/begriffe/pruefen": {
    urteil: "KEIN_KO_INHALT",
    grund: "Hinweise aus Katalog und mitgesendetem Text; liest kein Wissensobjekt.",
  },
  // Betroffenenrechte (datenschutz-routes.ts): Anträge, Entscheidungen und das Verzeichnis tragen
  // Kontonamen, Fristen und das Dateninventar — kein Feld stammt aus einem Wissensobjekt.
  "GET /api/datenschutz/loeschantraege": {
    urteil: "KEIN_KO_INHALT",
    grund:
      "Anträge mit Name/Adresse des Kontos und Frist (datenschutz-routes.ts, verwaltungssicht).",
  },
  "POST /api/datenschutz/loeschantraege/:id/erledigen": {
    urteil: "KEIN_KO_INHALT",
    grund: "Antwort ist der abgeschlossene Antrag.",
  },
  "POST /api/datenschutz/loeschantraege/:id/ablehnen": {
    urteil: "KEIN_KO_INHALT",
    grund: "Antwort ist der abgelehnte Antrag.",
  },
  "GET /api/datenschutz/verarbeitungsverzeichnis": {
    urteil: "KEIN_KO_INHALT",
    grund: "Dateninventar und Betriebslage (dateninventar.ts); liest keinen Bestand.",
  },
  // R-1646 · Ausgangsprüfung (ausgangspruefung-routes.ts): die Vorschau zeigt den ausgehenden Text,
  // also Frage- und Kandidatentexte — deshalb Kuratorenstufe. Vertrauliches erreicht sie nie: der
  // Chokepoint lehnt es vor der Prüfung ab (ConfidentialEgressError, model-concurrency.ts).
  "GET /api/ausgangspruefung": {
    urteil: "KURATORENTOR",
    recht: "ko.validate",
    grund: "Ausgehender Text vor der Freigabe, ohne die ersetzten Originale.",
  },
  "POST /api/ausgangspruefung/:id/freigeben": {
    urteil: "KEIN_KO_INHALT",
    grund: "Antwort ist Kennung und Entscheidung; der Text geht nicht zurück.",
  },
  "POST /api/ausgangspruefung/:id/ablehnen": {
    urteil: "KEIN_KO_INHALT",
    grund: "Antwort ist Kennung und Entscheidung; der Text geht nicht zurück.",
  },
  // Spaces (spaces-routes.ts): Space-Daten sind kein Wissensobjekt; jede Artikelzeile läuft durch
  // `sichtbareFuer`/`darfSehen` samt führendem Space.
  "GET /api/spaces": { urteil: "PRAEDIKAT", grund: "Zähler je Space über sichtbare Artikel." },
  "GET /api/spaces/konten": { urteil: "KEIN_KO_INHALT", grund: "Kennung, Name, Rolle der Konten." },
  "GET /api/spaces/:id": { urteil: "KEIN_KO_INHALT", grund: "Space-Fassung und ihr Verlauf." },
  "POST /api/spaces": { urteil: "KEIN_KO_INHALT", grund: "Antwort ist die neue Space-Fassung." },
  "PUT /api/spaces/:id": { urteil: "KEIN_KO_INHALT", grund: "Antwort ist die neue Space-Fassung." },
  "GET /api/spaces/:id/artikel": { urteil: "PRAEDIKAT", grund: "Artikel je Space/Ansicht." },
  "GET /api/spaces/kontext/artikel/:koId": {
    urteil: "PRAEDIKAT",
    grund: "Spacekontext eines Artikels — 404 statt Auskunft.",
  },
  "POST /api/spaces/verschiebung/vorschau": {
    urteil: "PRAEDIKAT",
    grund: "Rechtevorschau nur zu einem sichtbaren Artikel.",
  },
  "POST /api/spaces/verschiebung": {
    urteil: "PRAEDIKAT",
    grund: "Spacewechsel nur an einem sichtbaren Artikel.",
  },
  // Hauptverantwortung übergeben (verantwortung-routes.ts): Titel nur über `darfSehen`; für nicht
  // einsehbare Beiträge Kennung, Status und Space, aber kein Inhalt.
  "GET /api/verantwortung/person/:id": {
    urteil: "PRAEDIKAT",
    grund: "Bestand einer Person — Titel nur für einsehbare Beiträge.",
  },
  "GET /api/verantwortung/ungeklaert": {
    urteil: "KEIN_KO_INHALT",
    grund: "Anzahl je Person ohne aktive Verantwortung; keine Titel, keine Kennungen.",
  },
  // ADMIN-04 (aus main, Nacharbeit 23 nachgetragen).
  "GET /api/verantwortung/uebersicht": {
    urteil: "KEIN_KO_INHALT",
    grund: "Je Konto Zugangsstand und Anzahlen (Beiträge, Entwürfe, Lücken, Prüfaufgaben).",
  },
  "GET /api/verantwortung/person/:id/vorgaenge": {
    urteil: "PRAEDIKAT",
    grund:
      "Entwürfe/Lücken nur als Kennung; Prüfaufgaben mit Titel nur über titelFuer → darfSehen.",
  },
  "POST /api/verantwortung/vorschau": {
    urteil: "PRAEDIKAT",
    grund: "Vorschau je Nachfolger — Titel nur für einsehbare Beiträge.",
  },
  "POST /api/verantwortung/uebergabe": {
    urteil: "PRAEDIKAT",
    grund: "Ergebnis je Beitrag — Titel nur für einsehbare Beiträge.",
  },
  "POST /api/verantwortung/deaktivierung": {
    urteil: "PRAEDIKAT",
    grund: "Übergabeergebnis vor der Deaktivierung — Titel nur für einsehbare Beiträge.",
  },
  // ADMIN-05: der gemeinsame Übergabeablauf. Entwürfe und Lücken nur als Kennung.
  "POST /api/verantwortung/ablauf/vorschau": {
    urteil: "PRAEDIKAT",
    grund: "Pakete je Nachfolger — Titel nur für einsehbare Beiträge und Prüfaufgaben.",
  },
  "POST /api/verantwortung/ablauf": {
    urteil: "PRAEDIKAT",
    grund: "Bilanz je Zeile — Titel nur für einsehbare Beiträge und Prüfaufgaben.",
  },
  "GET /api/verantwortung/person/:id/ablaeufe": {
    urteil: "KEIN_KO_INHALT",
    grund: "Bilanzvermerke `verantwortung.ablauf`: nur Kennungen, Anzahlen und Zugangsstand.",
  },
  "GET /api/i18n/locales": { urteil: "KEIN_KO_INHALT", grund: "Oberflächentexte." },
  "GET /api/i18n/:locale/:key": { urteil: "KEIN_KO_INHALT", grund: "Oberflächentexte." },
  // R-1034 / FR-I18N-02: gepflegte Oberflächentexte und Sprachen (i18n-routes.ts, uebersetzungen.ts).
  // Kein Feld stammt aus einem Wissensobjekt; die Ablage kennt den Bestand nicht.
  "GET /api/i18n/:locale": { urteil: "KEIN_KO_INHALT", grund: "Gepflegte Oberflächentexte." },
  "PUT /api/admin/i18n/:locale/:key": {
    urteil: "KEIN_KO_INHALT",
    grund: "R-1034 — Antwort ist der gesetzte Oberflächentext; users.manage im Rumpf.",
  },
  "DELETE /api/admin/i18n/:locale/:key": {
    urteil: "KEIN_KO_INHALT",
    grund: "R-1034 — Antwort ist Sprache, Schlüssel und ob entfernt wurde; users.manage im Rumpf.",
  },
  "PUT /api/admin/i18n-sprachen/:locale": {
    urteil: "KEIN_KO_INHALT",
    grund: "FR-I18N-02 — Antwort ist Sprachkennung und Name; users.manage im Rumpf.",
  },
  "GET /addin": { urteil: "KEIN_KO_INHALT", grund: "statisches Add-in-Bundle." },
  "GET /addin/*": { urteil: "KEIN_KO_INHALT", grund: "statisches Add-in-Bundle." },
  // R-0713 (mcp-routes.ts), beurteilt mit R-1175 Nacharbeit 1: der MCP-Zugang. `GET` antwortet
  // nur 405; `POST` gibt KO-Inhalt aus — aber ausschließlich das, was `POST /api/ask` demselben
  // Dienst-Schlüssel liefert (interne Weiterleitung, `dienste.weiterleiten`). Gefiltert wird dort,
  // nicht hier: der Dienst-Schlüssel-Zweig der Fragefunktion gibt nur validiertes, nicht
  // vertrauliches Wissen aus Inhalt ohne Space oder offenen Spaces heraus (Kopf von mcp-routes.ts).
  "GET /mcp": {
    urteil: "KEIN_KO_INHALT",
    grund: "R-0713 — antwortet nur 405, kein Ereignisstrom.",
  },
  "POST /mcp": {
    urteil: "DIENST_FILTERT",
    weiterleitung: "POST /api/ask",
    grund:
      "R-0713 — Werkzeugaufrufe gehen mit demselben Dienst-Schlüssel an POST /api/ask " +
      "(mcp-routes.ts, `weiterleiten`); dessen Schlüsselzweig gibt nur validiertes, nicht " +
      "vertrauliches Wissen heraus. Die Hülle selbst liest keinen Bestand.",
  },
  // R-1175 (R1/R2): die gestempelte Seite des Klara-Aufgabenfensters (web-static.ts, JOB 1077).
  // Liest eine Datei aus dem Build und ersetzt nur den Fassungsplatzhalter.
  "GET /word-addin/taskpane.html": {
    urteil: "KEIN_KO_INHALT",
    grund: "statische Seite aus dem Build mit Fassungsstempel (web-static.ts), kein Bestand.",
  },
  // --- R-1175 (R1): Anmeldung und Konten (services/auth/src/routes.ts) ------------------------
  // Bis hierher „nicht Gegenstand" per Urteil im Kopf; jetzt Funde der Erhebung und deshalb je
  // ein Urteil. Keiner dieser Wege liest den Bestand: Antworten tragen Sitzung, Konto (ohne
  // Kennwort-Hash), Anzeigenamen (`/api/directory`: nur id + Name) oder Einrichtungsstatus.
  ...ohneKoInhalt({
    "POST /api/auth/register": "legt ein Konto an; Antwort ist das Konto.",
    "POST /api/auth/login": "Anmeldung; Antwort ist Sitzung und Konto.",
    "POST /api/auth/logout": "beendet die Sitzung.",
    "GET /api/auth/me": "das eigene Konto.",
    // R-0582 (aus main, Nacharbeit 27 nachgetragen): Name/E-Mail des eigenen Kontos berichtigen.
    "PUT /api/auth/me": "berichtigt Name/E-Mail des eigenen Kontos; Antwort ist das Konto.",
    "GET /api/auth/notice": "eigene Kenntnisnahme des Pflichthinweises.",
    "POST /api/auth/notice": "setzt die eigene Kenntnisnahme.",
    "POST /api/auth/password": "ändert das eigene Kennwort.",
    "POST /api/auth/office-handover": "erzeugt einen Übergabecode der eigenen Sitzung.",
    "POST /api/auth/office-handover/redeem": "löst einen Übergabecode ein, Antwort: Sitzung.",
    "POST /api/auth/forgot": "Rücksetzanforderung; immer 204.",
    "POST /api/auth/reset": "Rücksetzen per Einmal-Token.",
    "GET /api/auth/oidc/start": "SSO-Start.",
    "POST /api/auth/oidc": "SSO-Rückruf; Antwort ist Sitzung und Konto.",
    "POST /api/auth/users/:id/approve": "Freigabe eines Kontos (Admin).",
    "POST /api/auth/users/:id/reset": "Kennwort eines Kontos setzen (Admin).",
    "DELETE /api/auth/users/:id": "Konto löschen (Admin).",
    "GET /api/auth/status": "Einrichtungs- und SSO-Status, keine Nutzerdaten.",
    "POST /api/auth/setup": "Ersteinrichtung des ersten Admins.",
    "GET /api/users": "Kontenliste ohne Kennwort-Hashes (Admin).",
    "GET /api/directory": "Verzeichnis aus id und Anzeigename.",
    "POST /api/users": "legt ein Konto an (Admin).",
    "PUT /api/users/:id": "ändert ein Konto (Admin).",
    "DELETE /api/users/:id": "löscht ein Konto (Admin).",
  }),
  // --- Nacharbeit 12 (Integration Hauptstand): neue Anmelde- und Verzeichniswege aus main --------
  // R-0562 zweiter Faktor, R-0560 SAML (services/auth/src/routes.ts), R-0556 SCIM
  // (verzeichnis-routes.ts: Antworten sind Konten in SCIM-Form, `alsScim(konto)`). Dieselbe Klasse
  // wie die Anmeldewege darüber: Sitzung, Konto, Faktorstatus — kein Bestand. LESEURTEIL.
  ...ohneKoInhalt({
    "POST /api/auth/login/second-factor": "zweiter Anmeldeschritt; Antwort ist Sitzung und Konto.",
    "GET /api/auth/second-factor": "Status des eigenen zweiten Faktors.",
    "POST /api/auth/second-factor/setup": "richtet den eigenen zweiten Faktor ein.",
    "POST /api/auth/second-factor/confirm": "bestätigt den eigenen zweiten Faktor.",
    "POST /api/auth/second-factor/disable": "schaltet den eigenen zweiten Faktor ab.",
    "DELETE /api/users/:id/second-factor": "setzt den zweiten Faktor eines Kontos zurück (Admin).",
    "GET /api/auth/saml/start": "SAML-Start (Weiterleitung an den Anbieter).",
    "GET /api/auth/saml/metadata": "SAML-Metadaten des Dienstes, keine Nutzerdaten.",
    "POST /api/auth/saml/acs": "SAML-Rücksprung des Anbieters; Weiterleitung mit Abschlusscode.",
    "GET /api/auth/saml/abschluss": "SAML-Abschluss; Antwort ist die Sitzung.",
    "GET /scim/v2/ServiceProviderConfig": "SCIM-Fähigkeiten des Dienstes, keine Nutzerdaten.",
    "GET /scim/v2/Users": "Kontenliste in SCIM-Form (Verzeichnisschlüssel).",
    "GET /scim/v2/Users/:id": "ein Konto in SCIM-Form (Verzeichnisschlüssel).",
    "POST /scim/v2/Users": "legt ein Konto an (Verzeichnisschlüssel).",
    "PUT /scim/v2/Users/:id": "ersetzt ein Konto (Verzeichnisschlüssel).",
    "PATCH /scim/v2/Users/:id": "ändert ein Konto (Verzeichnisschlüssel).",
    "DELETE /scim/v2/Users/:id": "deaktiviert ein Konto (Verzeichnisschlüssel).",
  }),
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
    entscheidung: "sichtbarkeitsfilterFuer",
    kette: [
      {
        datei: "services/app/src/services/answer-explanation.ts",
        funktion: "erklaere",
        filter: { index: 1, eigenschaft: "sichtbar" },
      },
    ],
    anwendung: "sichtbar",
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
  // R-1639 / R-2183 (Nacharbeit 3): der Bereichsblick zählt Objekte je Kategorie und nennt
  // Kennungen offener Objekte — Grundmenge über `sichtbarkeitsfilterFuer`, wie der Snapshot.
  "GET /api/management/risk-horizon": {
    urteil: "PRAEDIKAT",
    grund: "Nacharbeit 3 — Kategoriezeilen und Objektkennungen erst nach dem Trimm der Grundmenge.",
  },
  // Die Pflege der Bereichsprofile und Ruhestandshorizonte ist admin-gebunden; die Antworten tragen
  // Kategorienamen, Konto-Kennungen, Stufen und Fristen — keinen Inhalt eines Wissensobjekts.
  "GET /api/management/profiles": {
    urteil: "KURATORENTOR",
    recht: "users.manage",
    grund: "Nacharbeit 3 — gepflegte Profile/Horizonte, nur mit users.manage.",
  },
  "PUT /api/management/profiles/category": {
    urteil: "KURATORENTOR",
    recht: "users.manage",
    grund: "Nacharbeit 3 — Pflege eines Bereichsprofils, nur mit users.manage.",
  },
  "PUT /api/management/profiles/retirement/:userId": {
    urteil: "KURATORENTOR",
    recht: "users.manage",
    grund: "Nacharbeit 3 — Pflege eines Ruhestandshorizonts, nur mit users.manage.",
  },
  "GET /api/ai-check/coverage-summary": { urteil: "PRAEDIKAT", grund: "Block D — vier Zähler." },
  // Aufnahme 20260922 · Paarpflichten-dauerhaft (G2): Antworten nur mit Kennungen und Zählwerten;
  // jede Aussage des Laufs geht vorher durch `darfSehen` (lokale Helfer, über ihren Rumpf erhoben).
  "POST /api/paarpflichten/laeufe": { urteil: "PRAEDIKAT", grund: "G2 — 404 statt Auskunft." },
  "GET /api/paarpflichten/laeufe/:laufId": {
    urteil: "PRAEDIKAT",
    grund: "G2 — 404 statt Auskunft.",
  },
  "POST /api/paarpflichten/laeufe/:laufId/fortsetzen": {
    urteil: "PRAEDIKAT",
    grund: "G2 — 404 statt Auskunft.",
  },
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
  "GET /api/lifecycle/revalidiert": {
    urteil: "PRAEDIKAT",
    grund: "R-1662 — sichtbareEintraege vor dem Lesen; nur Kennung, Zeitpunkt und Fassung.",
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
  // JOB 2021 (G8): war bis 23.08. `DIENST_FILTERT` mit der Fundstelle „service.ts:110 — unklar →
  // kein externer Egress". Die Fundstelle stimmt, das Urteil trug sie nicht: sie belegt, dass der
  // INHALT nicht nach draussen geht — nicht, dass der LESER geprüft wird. `analyze()` nimmt gar
  // keinen Betrachter entgegen (service.ts:87). Die Route liest denselben Bestand wie
  // `GET /api/objects/:id` und steht seit G8 unter demselben Prädikat, also unter Messung.
  "POST /api/media/analyze": { urteil: "PRAEDIKAT", grund: "Block C — G8, 404 statt Auskunft." },
  "POST /api/media/transcribe": {
    urteil: "KEIN_KO_INHALT",
    grund: "transcribeRecording — Transkript der eingesandten Aufnahme, kein Bestand.",
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
    // JOB 2613 D3: die .docx-Uebernahme legt einen EIGENEN Entwurf an (`user.id` aus der Anmeldung)
    // und liest nichts aus dem Bestand — die Bytes kommen vom Aufrufer selbst. Sie traegt damit
    // keinen fremden Wissensinhalt hinaus.
    "POST /api/drafts/from-docx": "eigener Entwurf.",
    "PUT /api/drafts/:id": "eigener Entwurf.",
    "DELETE /api/drafts/:id": "eigener Entwurf.",
    "POST /api/drafts/:id/promote": "eigener Entwurf → eigenes KO.",
    // Pool-Auftrag (R-2099): nur der Autor (`canManageDraft`), die Antwort ist sein eigener Entwurf.
    "PUT /api/drafts/:id/pool":
      "eigener Entwurf — Autor gibt ihn in den Pool oder nimmt ihn zurück.",
    // JOB 3668: die zwei schreibenden Papierkorb-Wege. Beide gehen durch
    // `requireVisibleTrashedDraft` (dasselbe `canSeeDraft`) und tragen keinen fremden Inhalt
    // hinaus: `restore` gibt den EIGENEN Entwurf zurück, `purge` antwortet mit 204 ohne Rumpf.
    "POST /api/drafts/:id/restore": "eigener Entwurf aus dem Papierkorb.",
    "DELETE /api/drafts/trash/:id": "eigener Entwurf — 204 ohne Inhalt.",
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
    "POST /api/duplicates/:id/status": "ko.validate.",
    // R-1107 (overlap-routes.ts): Zusammenführen — ko.validate; `fuehreZusammen` verlangt vor jedem
    // Schreibschritt Einsicht in beide Seiten. Seit dem Dublettenvergleich ohne Urteil hier.
    "POST /api/duplicates/:id/merge": "ko.validate; Einsicht in beide Seiten prüft fuehreZusammen.",
    "PUT /api/duplicates/settings": "users.manage.",
    "PUT /api/gaps/:id": "ko.assign.",
    "DELETE /api/gaps/:id": "ko.validate.",
    "POST /api/ask/helpful": "Rückmeldung des Aufrufers.",
    // R-1089: die Quittung nennt nur den Titel einer Quelle, die DIESEM Aufrufer im eigenen
    // Antwortvorgang ausgeliefert wurde (Beleg-Bindung), nie die verantwortliche Person.
    "POST /api/ask/report": "Rückmeldung des Aufrufers — Quittung zur eigenen Quelle.",
    // R-1649: Antwort nur `{ vermerkt, entwurfId }` — der eigene Vermerk und der eigene Entwurf.
    "POST /api/ask/not-helpful": "Rückmeldung des Aufrufers; optional eigener Entwurf.",
    "PUT /api/validation/settings": "users.manage.",
    "PUT /api/external/policy": "users.manage.",
    "POST /api/lifecycle/couple": "ko.create; Antwort ohne KO-Inhalt.",
    "POST /api/lifecycle/asset-changed": "ko.validate; Antwort ohne KO-Inhalt.",
    // R-0554 / R-2128: die Wissensübergabe beim Ausscheiden. Die Vorschau nennt Kennung und Titel
    // der Wissensobjekte einer Person — an `users.manage`, also an eine Rolle, für die `darfSehen`
    // ohnehin jedes Objekt freigibt. Entwürfe und Lücken nur als Kennung; die Ausführung antwortet
    // mit Zählern und Kennungen.
    "POST /api/lifecycle/handover/preview": "users.manage; Titel nur an die Verwaltung.",
    "POST /api/lifecycle/handover": "users.manage; Antwort mit Zählern und Kennungen.",
    "POST /api/learning-paths": "Lernpfad, kein KO.",
    "POST /api/learning-paths/:pathId/complete": "eigener Fortschritt.",
    "POST /api/admin/demo-seed": "users.manage.",
    "DELETE /api/admin/demo-seed": "users.manage.",
    "POST /api/admin/sim-corpus": "users.manage.",
    "POST /api/admin/examples/load": "users.manage.",
    // JOB 3277: Demopakete — laden/zurücksetzen/entfernen, je Paket. Die Antwort trägt AUSSCHLIESSLICH
    // Zähler des eigenen Laufs (created/updated/skipped/removed) und keinen Inhalt eines
    // Wissensobjekts; die Schranke ist dieselbe wie beim Gesamt-Purge.
    "POST /api/admin/demo-packages/:id/load": "users.manage.",
    "POST /api/admin/demo-packages/:id/reset": "users.manage.",
    "DELETE /api/admin/demo-packages/:id": "users.manage.",
    "POST /api/admin/factory-reset": "users.manage.",
    "POST /api/admin/import/confluence": "users.manage.",
    "POST /api/admin/import/confluence/explore": "users.manage.",
    "POST /api/admin/import/confluence/select": "users.manage.",
    "POST /api/admin/import/confluence/group": "users.manage.",
    "POST /api/admin/import/confluence/apply": "users.manage.",
    // JOB 4086: die zwei Türen des SharePoint-Imports. Wie die Confluence-Zeilen darüber sind sie
    // POST-Wege mit `users.manage`; `files` liest dabei nur (Dateiliste der Bibliothek), `apply`
    // stellt Kandidaten in die Prüf-Warteschlange. Beide geben keinen Inhalt eines
    // Wissensobjekts aus — sie geben Namen, Adressen und Stände von QUELLDATEIEN aus.
    "POST /api/admin/import/sharepoint/files": "users.manage.",
    "POST /api/admin/import/sharepoint/apply": "users.manage.",
    // R-0145/R-0190: `folder-apply` ist derselbe Übernahmeweg für ein Los eines Ordners — er gibt
    // dieselben Quelldatei-Angaben aus wie `apply`, dazu die Kennungen des Loses.
    "POST /api/admin/import/sharepoint/folder-apply": "users.manage.",
    // R-0170: die drei Türen des Jira-Imports, dieselbe Bauform wie SharePoint. `issues` liest nur
    // (Vorgangsliste des Projekts); `apply` und `project-apply` stellen Kandidaten in die
    // Prüf-Warteschlange. Keine gibt den Inhalt eines Wissensobjekts aus — sie geben Schlüssel,
    // Titel, Adressen und Stände von QUELLVORGÄNGEN aus, dazu die Zahl der Leserechte.
    "POST /api/admin/import/jira/issues": "users.manage.",
    "POST /api/admin/import/jira/apply": "users.manage.",
    "POST /api/admin/import/jira/project-apply": "users.manage.",
    "PUT /api/reasoner/config": "users.manage.",
    "PUT /api/reasoner/assist-presets": "users.manage.",
    "POST /api/reasoner/test": "users.manage.",
    "POST /api/reasoner/test-local": "users.manage.",
    "POST /api/reasoner/conflict-self-test": "users.manage.",
    "POST /api/reasoner/duplicate-self-test": "users.manage.",
  }),
  // ==============================================================================================
  // JOB 4154 (WIKI-GESAMTANWEISUNG) · zehn Wege, zehn Urteile.
  // ==============================================================================================
  //
  // Eine Anweisung bindet FREMDE Wissenseinträge über `(koId, koVersion, nachweisHash)`. Jeder Weg,
  // der eine Anweisung ausgibt, kann damit Inhalt eines Wissensobjekts hinaustragen — Titel und
  // Autor der gebundenen Fassung stehen in der Herkunftszeile je Baustein, Tabellenüberschriften
  // und Abbildungsnamen im Inhaltsbefund. Deshalb ist das Urteil hier neunmal PRAEDIKAT und nicht
  // „kein KO-Inhalt": es wird wirklich welcher ausgegeben, und er wird wirklich getrimmt.
  //
  // DAS PRÄDIKAT IST `darfSehen`, und es fällt JE BAUSTEIN, nicht einmal an der Anweisung. Die
  // Route bildet die Entscheidung einmal (`sichtbarFuer(user)` aus `../sichtbarkeit`) und reicht
  // sie in den Dienst; der wendet sie auf jede gebundene Fassung an. Beim LESEN trimmt er (der
  // verborgene Baustein erscheint gar nicht, die Antwort sagt `unvollstaendig` und nennt nur die
  // ANZAHL), beim SCHREIBEN und beim VERGLEICHEN verweigert er mit 403 — ein Vergleich über eine
  // getrimmte Teilmenge sagte „unverändert", wo der Leser die geänderte Hälfte nur nicht sehen
  // durfte.
  // JOB 4357 · DER BESTAND. Er gibt je Anweisung den Kopf und ZWEI ZAHLEN aus und keinen einzigen
  // Baustein — die Zahlen entstehen in `lesestand`, also in genau derselben `darfSehen`-Entscheidung
  // je gebundener Fassung wie beim Einzelabruf darunter (`auflisten` → `listeneintrag` → `lesestand`).
  // Ein verborgener Baustein zählt dort als verborgen; sein Titel, seine Fassungskennung und sein
  // Rumpf haben in `AnweisungListeneintrag` überhaupt kein Feld.
  "GET /api/gesamtanweisungen": {
    urteil: "PRAEDIKAT",
    grund:
      "JOB 4357 — darfSehen je gebundenem Baustein über lesestand; die Liste nennt nur Kopf und zwei Zahlen.",
  },
  "GET /api/gesamtanweisungen/:id": {
    urteil: "PRAEDIKAT",
    grund: "JOB 4154 — darfSehen je gebundenem Baustein; verborgene Bausteine fallen ganz weg.",
  },
  "PUT /api/gesamtanweisungen/:id": {
    urteil: "PRAEDIKAT",
    grund: "JOB 4154 — Schreibweg: darfSehen an JEDEM gebundenen Baustein, sonst 403.",
  },
  "POST /api/gesamtanweisungen/:id/bausteine": {
    urteil: "PRAEDIKAT",
    grund: "JOB 4154 — darfSehen am Bestand UND zusätzlich an der neu gebundenen Fassung.",
  },
  "PUT /api/gesamtanweisungen/:id/reihenfolge": {
    urteil: "PRAEDIKAT",
    grund: "JOB 4154 — Schreibweg: darfSehen an JEDEM gebundenen Baustein, sonst 403.",
  },
  "PUT /api/gesamtanweisungen/:id/bausteine/:bausteinId/voraussetzung": {
    urteil: "PRAEDIKAT",
    grund: "JOB 4154 — Schreibweg: darfSehen an JEDEM gebundenen Baustein, sonst 403.",
  },
  "GET /api/gesamtanweisungen/:id/staende": {
    urteil: "PRAEDIKAT",
    grund: "JOB 4154 — Versionsnummern erst nach darfSehen an jedem gebundenen Baustein.",
  },
  "GET /api/gesamtanweisungen/:id/vergleich": {
    urteil: "PRAEDIKAT",
    grund:
      "JOB 4154 — gibt Tabellenüberschriften und Abbildungsnamen aus; kein getrimmter Vergleich, 403.",
  },
  "POST /api/gesamtanweisungen/:id/vorlegen": {
    urteil: "PRAEDIKAT",
    grund: "JOB 4154 — Schreibweg: darfSehen an JEDEM gebundenen Baustein, sonst 403.",
  },
  "POST /api/gesamtanweisungen/:id/entscheiden": {
    urteil: "PRAEDIKAT",
    grund: "JOB 4154 — Schreibweg mit ko.validate UND darfSehen an jedem gebundenen Baustein.",
  },
  "POST /api/gesamtanweisungen/:id/bausteine/:bausteinId/uebernehmen": {
    urteil: "PRAEDIKAT",
    grund: "aufnahme:20260928 — darfSehen am Bestand UND an der neu gebundenen Fassung.",
  },
  // Die Anlage gibt NICHTS aus ausser dem gerade selbst eingegebenen Kopf: Titel, Zweck,
  // Geltungsbereich, Voraussetzungen, leere Bausteinliste. Es gibt in diesem Augenblick keinen
  // gebundenen Eintrag — deshalb hier kein Prädikat und trotzdem kein Loch. LESEURTEIL, nachlesbar
  // an `anweisungAnlegen` (`gesamtanweisung-service.ts`): `bausteine: []`.
  "POST /api/gesamtanweisungen": {
    urteil: "KEIN_KO_INHALT",
    grund: "JOB 4154 — legt eine LEERE Anweisung an; die Antwort trägt nur den eigenen Kopf.",
  },
};

function schreibwege(paare: Record<string, string>): Record<string, Eintrag> {
  const out: Record<string, Eintrag> = {};
  for (const [schluessel, grund] of Object.entries(paare)) {
    out[schluessel] = { urteil: "EIGENER_BESTAND", grund };
  }
  return out;
}

function ohneKoInhalt(paare: Record<string, string>): Record<string, Eintrag> {
  const out: Record<string, Eintrag> = {};
  for (const [schluessel, grund] of Object.entries(paare)) {
    out[schluessel] = { urteil: "KEIN_KO_INHALT", grund };
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
  /** Nacharbeit 2: die Namen aller AUFGERUFENEN Funktionen/Methoden der Registrierung samt Helfern. */
  aufrufe: Set<string>;
  /** Nacharbeit 2: der Quelltext der Registrierung (für die Weiterleitungsbindung). */
  aufrufText: string;
  /** Nacharbeit 5: die AUSGEFÜHRTEN Aufrufknoten der Registrierung samt Helfern (Argumentbindung). */
  ausgefuehrteAufrufe?: readonly ts.CallExpression[];
}

/** Der Name des Aufgerufenen: `f(…)` → `f`, `x.y.f(…)` → `f`; sonst `undefined`. */
function aufgerufenerName(e: ts.Expression): string | undefined {
  if (ts.isIdentifier(e)) {
    return e.text;
  }
  if (ts.isPropertyAccessExpression(e)) {
    return e.name.text;
  }
  return undefined;
}

/** Array-Methoden, die einen übergebenen Rückruf selbst aufrufen. */
const RUECKRUF_METHODEN = new Set(["filter", "map", "flatMap", "some", "every", "find", "forEach"]);

// ================================================================================================
// NACHARBEIT 3 (Befund ben, R-1175) — NUR AUSGEFÜHRTE RÜMPFE ZÄHLEN.
// ================================================================================================
//
// Bis hierher stieg die Erhebung mit `forEachChild` in JEDEN verschachtelten Funktionsrumpf. In
// `liste() { const unbenutzt = () => isConfidential(ko.c); return kos; }` galt die Entscheidung
// damit als aufgerufen, obwohl die Ausgabe ungefiltert hinausgeht — und im Handler einer Route
// genauso. Jetzt gilt ein verschachtelter Rumpf nur als ausgeführt, wenn die Funktion
//   · als Literal unmittelbar an einen Aufruf übergeben wird (Rückruf, auch als Wert eines
//     Objektliterals, das selbst Argument ist — Fastify-Hooks wie `preValidation`),
//   · unmittelbar aufgerufen wird (`(() => …)()`),
//   · oder als BENANNTER Helfer aufgerufen bzw. als Rückruf an eine Array-Methode gereicht wird
//     (dann über `helfer` aufgelöst).
// Ein Helfer, der nur DEFINIERT wird, schützt nichts.

function istFunktionsknoten(n: ts.Node): boolean {
  return (
    ts.isArrowFunction(n) ||
    ts.isFunctionExpression(n) ||
    ts.isFunctionDeclaration(n) ||
    ts.isMethodDeclaration(n) ||
    ts.isConstructorDeclaration(n) ||
    ts.isGetAccessorDeclaration(n) ||
    ts.isSetAccessorDeclaration(n)
  );
}

/** Wird dieses Funktionsliteral an Ort und Stelle ausgeführt (Rückruf eines Aufrufs oder IIFE)? */
function istAusgefuehrtesLiteral(n: ts.Node): boolean {
  if (!ts.isArrowFunction(n) && !ts.isFunctionExpression(n)) {
    return false;
  }
  let kind: ts.Node = n;
  let eltern = n.parent;
  while (eltern && ts.isParenthesizedExpression(eltern)) {
    kind = eltern;
    eltern = eltern.parent;
  }
  if (!eltern) {
    return false;
  }
  if (ts.isCallExpression(eltern)) {
    return eltern.expression === kind || eltern.arguments.some((a) => a === kind);
  }
  // `{ preValidation: async (…) => … }` als Argument eines Aufrufs (auch verschachtelt).
  if (ts.isPropertyAssignment(eltern) && eltern.initializer === kind) {
    let objekt: ts.Node = eltern.parent;
    while (ts.isObjectLiteralExpression(objekt) && ts.isPropertyAssignment(objekt.parent)) {
      objekt = objekt.parent.parent;
    }
    return (
      ts.isObjectLiteralExpression(objekt) &&
      ts.isCallExpression(objekt.parent) &&
      objekt.parent.arguments.some((a) => a === objekt)
    );
  }
  return false;
}

/** Die benannten Helfer einer Datei — `function f() {}` und `const f = () => {}`, jede Tiefe. */
function benannteHelfer(sf: ts.Node): Map<string, ts.Node> {
  const helfer = new Map<string, ts.Node>();
  const besuche = (n: ts.Node): void => {
    if (ts.isFunctionDeclaration(n) && n.name && n.body) {
      helfer.set(n.name.text, n.body);
    }
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer &&
      (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))
    ) {
      helfer.set(n.name.text, n.initializer.body);
    }
    ts.forEachChild(n, besuche);
  };
  besuche(sf);
  return helfer;
}

/**
 * Läuft über alles, was ab `wurzel` AUSGEFÜHRT wird, und meldet jeden Knoten an `besuche`.
 * Aufgerufene oder als Array-Rückruf gereichte benannte Helfer werden über `helfer` mitgelesen;
 * `beiHelfer` erfährt jeden mitgelesenen Rumpf (für die Dominanzprüfung).
 */
function laufeAusgefuehrt(
  wurzel: ts.Node,
  helfer: ReadonlyMap<string, ts.Node>,
  besuche: (x: ts.Node) => void,
  beiHelfer: (rumpf: ts.Node) => void = () => {},
): void {
  const gelesen = new Set<string>();
  const folge = (name: string): void => {
    const rumpf = helfer.get(name);
    if (rumpf && !gelesen.has(name)) {
      gelesen.add(name);
      beiHelfer(rumpf);
      lauf(rumpf, rumpf);
    }
  };
  const lauf = (x: ts.Node, start: ts.Node): void => {
    if (x !== start && istFunktionsknoten(x) && !istAusgefuehrtesLiteral(x)) {
      return;
    }
    besuche(x);
    if (ts.isCallExpression(x)) {
      const name = aufgerufenerName(x.expression);
      if (name !== undefined) {
        folge(name);
        if (RUECKRUF_METHODEN.has(name)) {
          for (const arg of x.arguments) {
            if (ts.isIdentifier(arg)) {
              folge(arg.text);
            }
          }
        }
      }
    }
    ts.forEachChild(x, (k) => lauf(k, start));
  };
  lauf(wurzel, wurzel);
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

// R-1175 (R3): `ohneKommentare` stand hier und ENTFERNTE die Kommentare — danach stimmte keine
// Position mehr, und der Zähler konnte nur `datei:1` melden. Der Textlauf schwärzt sie jetzt
// längentreu (`kommentareGeschwaerzt` in schnittstellenErhebung.ts) und meldet jede Stelle mit
// ihrer Zeile.

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

    // R-1175 (R2): Konstanten derselben Datei, damit `app.get(PFAD, …)` ein Fund ist.
    const konstanten = zeichenkettenKonstanten(sf);
    // R-1175 (R3): die Methodennamen, die der Syntaxbaum beurteilt hat — der Textlauf unten
    // meldet jede Stelle, die NICHT darunter ist, mit ihrer Zeile.
    const gelesen = new Set<number>();
    // Nacharbeit 2: die Serverinstanzen dieser Datei, unabhängig vom Namen (schnittstellenErhebung.ts).
    const instanzen = serverInstanzen(sf);
    const besuche = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
        const methode = n.expression.name.text;
        const pfad = pfadVon(n.arguments[0], konstanten);
        const empfaenger = n.expression.expression;
        if (METHODEN.has(methode)) {
          gelesen.add(n.expression.name.getStart(sf));
        }
        if (
          METHODEN.has(methode) &&
          !pfad?.startsWith("/") &&
          ts.isIdentifier(empfaenger) &&
          instanzen.has(empfaenger.text)
        ) {
          unlesbar.push(
            `${datei}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1} — ${empfaenger.text}.${methode}(…) mit einem Pfad, den der Sammler nicht auflösen kann (weder Literal noch Konstante dieser Datei). Ein Leseweg ohne Urteil wäre unsichtbar.`,
          );
        }
        if (METHODEN.has(methode) && pfad?.startsWith("/")) {
          let praedikatImAufruf = false;
          const rechte = new Set<string>();
          const aufrufe = new Set<string>();
          const ausgefuehrteAufrufe: ts.CallExpression[] = [];
          // Die Rümpfe der lokalen Helfer, in die dieser Fund hineingelaufen ist — die
          // Dominanzprüfung unten muss sie mitlesen, sonst verstecken sich Fail-open-Zweige
          // einfach eine Funktion tiefer.
          const mitgelesen: ts.Node[] = [];
          // NACHARBEIT 2 (Befund ben, R-1175): nur ein AUFRUF zählt, keine blosse Namensnennung.
          // NACHARBEIT 3 (Befund ben): und nur in AUSGEFÜHRTEN Rümpfen — ein im Handler bloss
          // definierter Helfer (`const unbenutzt = () => darfSehen(…)`) schützt nichts
          // (`laufeAusgefuehrt`, s. dort).
          laufeAusgefuehrt(
            n,
            lokaleHelfer,
            (x) => {
              if (ts.isCallExpression(x)) {
                ausgefuehrteAufrufe.push(x);
                const name = aufgerufenerName(x.expression);
                if (name !== undefined) {
                  aufrufe.add(name);
                  if (PRAEDIKAT_NAMEN.test(name)) {
                    praedikatImAufruf = true;
                  }
                }
              }
              if (ts.isStringLiteral(x) && /^(ko|users|conflict)\.[a-z]+$/.test(x.text)) {
                rechte.add(x.text);
              }
            },
            (rumpf) => mitgelesen.push(rumpf),
          );
          // Das geforderte Routenrecht (KURATORENTOR) wird wie bisher am ganzen Aufruf gelesen —
          // es ist eine Angabe der Registrierung, kein Schutz, der ausgeführt werden müsste.
          const sammleRechte = (x: ts.Node): void => {
            if (ts.isStringLiteral(x) && /^(ko|users|conflict)\.[a-z]+$/.test(x.text)) {
              rechte.add(x.text);
            }
            ts.forEachChild(x, sammleRechte);
          };
          sammleRechte(n);
          funde.push({
            schluessel: `${methode.toUpperCase()} ${pfad}`,
            datei,
            zeile: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
            praedikatImAufruf,
            bedingt: [n, ...mitgelesen].flatMap((teil) => bedingterSchutz(teil, sf)),
            rechte,
            aufrufe,
            aufrufText: n.getText(sf),
            ausgefuehrteAufrufe,
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
    //
    // R-1175 (R3): nicht mehr als SUMME je Datei (`datei:1`, „Text sieht n, Baum m"), sondern JE
    // STELLE mit Zeile — und neben `("/…` auch jedes `app.<methode>(`, gleich welchen Pfades, und
    // jedes `.route(`. Dieselbe Regel wie im Routen-Audit (schnittstellenErhebung.ts).
    zaehlerAbweichung.push(...textlaufLuecken(sf, datei, gelesen));
  }
  return { funde, unlesbar, zaehlerAbweichung };
}

const ERHEBUNG = (() => {
  // R-1175 (R1): die alte Verzeichniswahl BLEIBT (sie ist die gemessene Untergrenze), und dazu
  // kommt jede Produktdatei unter `services/**`, die WIE eine Routendatei aussieht.
  const alle = [...new Set([...dateien(), ...routenquellen()])];
  const funde: Fund[] = [];
  const unlesbar: string[] = [];
  const zaehlerAbweichung: string[] = [];
  for (const datei of alle) {
    const teil = erhebeDatei(datei, readFileSync(join(REPO_WURZEL, datei), "utf8"));
    funde.push(...teil.funde);
    unlesbar.push(...teil.unlesbar);
    zaehlerAbweichung.push(...teil.zaehlerAbweichung);
  }
  return { funde, unlesbar, zaehlerAbweichung, dateizahl: alle.length };
})();

// ================================================================================================
// NACHARBEIT 2 (Befund ben, R-1175) — DIENST_FILTERT IST KEIN LESEURTEIL MEHR, SONDERN EIN WEG.
// ================================================================================================
//
// Bis hierher genügte für einen wissensführenden Dienstweg eine Fundstelle in Prosa. Wer den Filter
// im Dienst entfernte, liess den Sammler grün. Jetzt muss der Eintrag den Weg NENNEN — Registrierung
// → Glied für Glied → Entscheidung — und der Sammler geht ihn im Syntaxbaum nach: jedes Glied muss
// in seiner Datei als Funktion/Methode stehen und das nächste wirklich AUFRUFEN, das letzte die
// Entscheidung. Was fehlt oder nicht lesbar ist, ist rot mit Datei und Zeile.
//
// BENANNTE GRENZEN: Glieder werden über ihren NAMEN in der genannten Datei gefunden, nicht über den
// Typprüfer; nachgewiesen ist, dass der Weg die Entscheidung AUFRUFT, nicht, dass jeder Rückgabepfad
// durch sie läuft (dieselbe syntaktische Grenze wie bei PRAEDIKAT).

/**
 * Die Namen aller in diesem Rumpf TATSÄCHLICH AUFGERUFENEN Funktionen und Methoden — nur in
 * ausgeführten Teilen (NACHARBEIT 3, `laufeAusgefuehrt`); aufgerufene Helfer der Datei mitgelesen.
 */
function aufrufeIn(knoten: ts.Node, helfer: ReadonlyMap<string, ts.Node>): Set<string> {
  const namen = new Set<string>();
  laufeAusgefuehrt(knoten, helfer, (n) => {
    if (ts.isCallExpression(n)) {
      const name = aufgerufenerName(n.expression);
      if (name !== undefined) {
        namen.add(name);
      }
    }
  });
  return namen;
}

/** Der Rumpf der ersten Funktion oder Methode dieses Namens in der Datei, samt Zeile. */
interface Funktionsfund {
  rumpf: ts.Node;
  zeile: number;
  knoten: ts.SignatureDeclarationBase;
}

function funktionsRumpf(sf: ts.SourceFile, name: string): Funktionsfund | undefined {
  let treffer: Funktionsfund | undefined;
  const heisst = (k: ts.Node | undefined): boolean =>
    k !== undefined && (ts.isIdentifier(k) || ts.isPrivateIdentifier(k)) && k.text === name;
  const zeile = (n: ts.Node): number => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const besuche = (n: ts.Node): void => {
    if (treffer) {
      return;
    }
    if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && heisst(n.name) && n.body) {
      treffer = { rumpf: n.body, zeile: zeile(n), knoten: n };
      return;
    }
    if (
      (ts.isVariableDeclaration(n) || ts.isPropertyDeclaration(n)) &&
      heisst(n.name) &&
      n.initializer &&
      (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))
    ) {
      treffer = { rumpf: n.initializer.body, zeile: zeile(n), knoten: n.initializer };
      return;
    }
    ts.forEachChild(n, besuche);
  };
  besuche(sf);
  return treffer;
}

// ================================================================================================
// NACHARBEIT 5 (Befund ben, R-1175) — DIE ÜBERGABE, NICHT NUR DIE NAMEN.
// ================================================================================================
//
// Bis hierher genügte, dass die Route `sichtbarkeitsfilterFuer` IRGENDWO aufrief und der Dienst
// IRGENDEINEN Aufruf namens `sichtbar` enthielt. `sichtbarkeitsfilterFuer(user);
// reply.send(await output.listEligible());` war damit grün — und der Dienst lief mit seinem
// Vorgabewert, der alles durchlässt. Jetzt wird die ARGUMENTBINDUNG nachgegangen:
//   · jeder ausgeführte Aufruf des ersten Glieds in der Route übergibt an `filter` einen Ausdruck,
//     der sich auf einen Aufruf der zentralen Entscheidung zurückführen lässt (direkt, über eine
//     Konstante/Variable mit ALLEN Zuweisungen, über eine Objekteigenschaft samt Spreads, über
//     beide Zweige einer Bedingung);
//   · jedes Glied reicht seinen Filterparameter an derselben Stelle des nächsten Glieds weiter;
//   · das letzte Glied ruft genau diesen Parameter auf.
// Was sich nicht so zurückführen lässt — fehlend, ersetzt, unauflösbar — ist rot mit Datei:Zeile.

function ohneHuelleAusdruck(n: ts.Expression): ts.Expression {
  let x = n;
  while (
    ts.isParenthesizedExpression(x) ||
    ts.isAsExpression(x) ||
    ts.isNonNullExpression(x) ||
    ts.isSatisfiesExpression(x)
  ) {
    x = x.expression;
  }
  return x;
}

/** Ist das eine Zuweisung (`=`, `??=`, `||=`, `+=` …)? */
function istZuweisung(n: ts.Node): n is ts.BinaryExpression {
  return (
    ts.isBinaryExpression(n) &&
    n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    n.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  );
}

/** Der Block, in dem dieser Bezeichner als Variable deklariert ist, samt Deklaration. */
function deklarationVon(
  id: ts.Identifier,
): { bereich: ts.Node; deklaration: ts.VariableDeclaration } | undefined {
  for (let p: ts.Node | undefined = id.parent; p; p = p.parent) {
    if (!(ts.isBlock(p) || ts.isSourceFile(p) || ts.isModuleBlock(p))) {
      continue;
    }
    for (const anweisung of p.statements) {
      if (!ts.isVariableStatement(anweisung)) {
        continue;
      }
      for (const d of anweisung.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.name.text === id.text) {
          return { bereich: p, deklaration: d };
        }
      }
    }
  }
  return undefined;
}

/** Alle Werte, die dieser Bezeichner annehmen kann: Initialisierer plus jede Zuweisung im Block. */
function wertDefinitionen(id: ts.Identifier): ts.Expression[] | undefined {
  const fund = deklarationVon(id);
  if (!fund) {
    return undefined;
  }
  const werte: ts.Expression[] = fund.deklaration.initializer ? [fund.deklaration.initializer] : [];
  const sammle = (n: ts.Node): void => {
    // Nacharbeit 7: jede Zuweisungsart (auch `??=`, `||=`), nicht nur `=`.
    if (istZuweisung(n) && ts.isIdentifier(n.left) && n.left.text === id.text) {
      werte.push(n.right);
    }
    ts.forEachChild(n, sammle);
  };
  sammle(fund.bereich);
  return werte.length > 0 ? werte : undefined;
}

// ================================================================================================
// NACHARBEIT 7 (Befund ben, R-1175) — SCHREIBZUGRIFFE AUF DEN FILTER.
// ================================================================================================
//
// Bis hierher sah die Übergabeprüfung nur das Objektliteral bzw. den Parameternamen. Sie hielt
// `const deps = { sichtbar: sichtbarkeitsfilterFuer(user) }; deps.sichtbar = () => true;
// dienst.liste(deps);` für geschützt — und im Dienst `sichtbar = () => true; return
// kos.filter((k) => sichtbar(k));` ebenso. Jetzt werden Schreibzugriffe gesucht:
//   · auf eine Filtereigenschaft vor der Übergabe (`obj.eig = …` zählt als weiterer Wert und muss
//     selbst zentral sein; `obj[…] = …`, `delete obj.eig`, `Object.assign(obj, …)` und
//     zusammengesetzte Zuweisungen sind nicht auflösbar und damit rot);
//   · auf den Filterparameter eines Glieds (jede Zuweisung an ihn oder an seine Filtereigenschaft,
//     `delete`, `Object.assign`) — ein Dienst ersetzt die übergebene Entscheidung nicht.

interface Schreibzugriff {
  knoten: ts.Node;
  /** Bei schlichtem `obj.eig = wert`: der neue Wert. Sonst nicht auflösbar. */
  wert?: ts.Expression;
}

/** Schreibzugriffe auf `objekt` (ohne Eigenschaft) bzw. auf `objekt.eigenschaft` in `bereich`. */
function schreibzugriffe(bereich: ts.Node, objekt: string, eigenschaft?: string): Schreibzugriff[] {
  const treffer: Schreibzugriff[] = [];
  const istObjekt = (e: ts.Expression): boolean => {
    const x = ohneHuelleAusdruck(e);
    return ts.isIdentifier(x) && x.text === objekt;
  };
  const zielt = (ziel: ts.Expression): boolean => {
    const x = ohneHuelleAusdruck(ziel);
    if (eigenschaft === undefined) {
      return istObjekt(x);
    }
    return (
      (ts.isPropertyAccessExpression(x) &&
        x.name.text === eigenschaft &&
        istObjekt(x.expression)) ||
      (ts.isElementAccessExpression(x) && istObjekt(x.expression))
    );
  };
  const besuche = (n: ts.Node): void => {
    if (istZuweisung(n) && zielt(n.left)) {
      const x = ohneHuelleAusdruck(n.left);
      const schlicht =
        n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        (eigenschaft === undefined || ts.isPropertyAccessExpression(x));
      treffer.push(schlicht ? { knoten: n, wert: n.right } : { knoten: n });
    }
    if (ts.isDeleteExpression(n) && zielt(n.expression)) {
      treffer.push({ knoten: n });
    }
    if (
      eigenschaft !== undefined &&
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === "assign" &&
      ts.isIdentifier(n.expression.expression) &&
      n.expression.expression.text === "Object" &&
      n.arguments[0] !== undefined &&
      istObjekt(n.arguments[0])
    ) {
      treffer.push({ knoten: n });
    }
    ts.forEachChild(n, besuche);
  };
  besuche(bereich);
  return treffer;
}

/** Lässt sich dieser Ausdruck vollständig auf einen Aufruf der zentralen Entscheidung zurückführen? */
function istZentraleEntscheidung(n: ts.Expression, tiefe = 0): boolean {
  if (tiefe > 6) {
    return false;
  }
  const x = ohneHuelleAusdruck(n);
  if (ts.isCallExpression(x)) {
    const name = aufgerufenerName(x.expression);
    return name !== undefined && ZENTRALE_ENTSCHEIDUNGEN.has(name);
  }
  if (ts.isConditionalExpression(x)) {
    return (
      istZentraleEntscheidung(x.whenTrue, tiefe + 1) &&
      istZentraleEntscheidung(x.whenFalse, tiefe + 1)
    );
  }
  if (ts.isIdentifier(x)) {
    const werte = wertDefinitionen(x);
    return werte?.every((w) => istZentraleEntscheidung(w, tiefe + 1)) ?? false;
  }
  return false;
}

interface Eigenschaftslage {
  /** Die Ausdrücke, die die Eigenschaft tragen können. */
  werte: ts.Expression[];
  /** Ist sie sicher gesetzt (auf jedem Zweig)? */
  sicher: boolean;
  /** Könnte ein nicht lesbarer Spread sie überschreiben? */
  unklar: boolean;
}

/** Welche Werte trägt `name` in diesem Objektausdruck — samt Spreads und Bedingungen? */
function eigenschaftIn(n: ts.Expression, name: string, tiefe = 0): Eigenschaftslage {
  const unklar: Eigenschaftslage = { werte: [], sicher: false, unklar: true };
  if (tiefe > 6) {
    return unklar;
  }
  const x = ohneHuelleAusdruck(n);
  if (ts.isIdentifier(x)) {
    const werte = wertDefinitionen(x);
    if (werte === undefined) {
      return unklar;
    }
    const lagen = werte.map((w) => eigenschaftIn(w, name, tiefe + 1));
    // Nacharbeit 7: nachträgliche Schreibzugriffe auf `x.name` im Deklarationsblock. Ein schlichtes
    // `x.name = wert` ist ein weiterer möglicher Wert; alles andere ist nicht auflösbar.
    const bereich = deklarationVon(x)?.bereich;
    const zugriffe = bereich ? schreibzugriffe(bereich, x.text, name) : [];
    return {
      werte: [
        ...lagen.flatMap((l) => l.werte),
        ...zugriffe.flatMap((z) => (z.wert ? [z.wert] : [])),
      ],
      // Eine nachträgliche Zuweisung macht die Eigenschaft nicht SICHER (sie kann bedingt sein).
      sicher: lagen.every((l) => l.sicher),
      unklar: lagen.some((l) => l.unklar) || zugriffe.some((z) => z.wert === undefined),
    };
  }
  if (ts.isConditionalExpression(x)) {
    const a = eigenschaftIn(x.whenTrue, name, tiefe + 1);
    const b = eigenschaftIn(x.whenFalse, name, tiefe + 1);
    return {
      werte: [...a.werte, ...b.werte],
      sicher: a.sicher && b.sicher,
      unklar: a.unklar || b.unklar,
    };
  }
  if (!ts.isObjectLiteralExpression(x)) {
    return unklar;
  }
  let lage: Eigenschaftslage = { werte: [], sicher: false, unklar: false };
  for (const prop of x.properties) {
    if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === name) {
      lage = { werte: [prop.initializer], sicher: true, unklar: false };
    } else if (ts.isShorthandPropertyAssignment(prop) && prop.name.text === name) {
      lage = { werte: [prop.name], sicher: true, unklar: false };
    } else if (ts.isSpreadAssignment(prop)) {
      const innen = eigenschaftIn(prop.expression, name, tiefe + 1);
      if (innen.unklar) {
        lage = { ...lage, unklar: true };
      } else if (innen.sicher) {
        lage = { werte: innen.werte, sicher: true, unklar: false };
      } else if (innen.werte.length > 0) {
        lage = { ...lage, werte: [...lage.werte, ...innen.werte] };
      }
    }
  }
  return lage;
}

/** Trägt dieses Argument (bzw. seine Eigenschaft) die zentrale Entscheidung? */
function uebergibtZentral(
  aufruf: ts.CallExpression,
  filter: { index: number; eigenschaft?: string },
): boolean {
  const arg = aufruf.arguments[filter.index];
  if (!arg) {
    return false;
  }
  if (filter.eigenschaft === undefined) {
    return istZentraleEntscheidung(arg);
  }
  const lage = eigenschaftIn(arg, filter.eigenschaft);
  return (
    lage.sicher &&
    !lage.unklar &&
    lage.werte.length > 0 &&
    lage.werte.every((w) => istZentraleEntscheidung(w))
  );
}

/** Die ausgeführten Aufrufknoten in einem Rumpf (samt aufgerufener Helfer der Datei). */
function ausgefuehrteAufrufeIn(
  knoten: ts.Node,
  helfer: ReadonlyMap<string, ts.Node>,
): ts.CallExpression[] {
  const aufrufe: ts.CallExpression[] = [];
  laufeAusgefuehrt(knoten, helfer, (n) => {
    if (ts.isCallExpression(n)) {
      aufrufe.push(n);
    }
  });
  return aufrufe;
}

/** Der Name des Parameters an `index` — nur ein schlichter Bezeichner zählt. */
function parameterAn(f: ts.SignatureDeclarationBase, index: number): string | undefined {
  const p = f.parameters[index];
  return p && ts.isIdentifier(p.name) ? p.name.text : undefined;
}

/** Ruft dieser Aufruf den Filter `param` (bzw. `param.eigenschaft`) selbst auf? */
function ruftFilter(aufruf: ts.CallExpression, param: string, eigenschaft?: string): boolean {
  const e = ohneHuelleAusdruck(aufruf.expression);
  if (eigenschaft === undefined) {
    return ts.isIdentifier(e) && e.text === param;
  }
  return (
    ts.isPropertyAccessExpression(e) &&
    e.name.text === eigenschaft &&
    ts.isIdentifier(e.expression) &&
    e.expression.text === param
  );
}

function zeileVon(n: ts.Node): number {
  const sf = n.getSourceFile();
  return sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
}

/** Nacharbeit 5: die Übergabe der Entscheidung durch die ganze Kette — leer = belegt. */
function pruefeUebergabe(
  schluessel: string,
  kette: readonly Glied[],
  fund: Pick<Fund, "datei" | "zeile" | "ausgefuehrteAufrufe">,
  lies: (datei: string) => string,
): string[] {
  const ort = `${fund.datei}:${fund.zeile}`;
  const erstes = kette[0];
  if (!erstes || fund.ausgefuehrteAufrufe === undefined) {
    return [
      `${ort} — ${schluessel}: Übergabe nicht prüfbar (keine Kette oder keine Aufrufknoten).`,
    ];
  }
  if (kette.some((g) => g.filter === undefined)) {
    return [`${ort} — ${schluessel}: ein Glied nennt nicht, wo der Filter ankommt (filter).`];
  }
  const anErstes = fund.ausgefuehrteAufrufe.filter(
    (c) => aufgerufenerName(c.expression) === erstes.funktion,
  );
  if (anErstes.length === 0) {
    return [`${ort} — ${schluessel}: ruft das Glied ${erstes.funktion} nicht auf.`];
  }
  const maengel: string[] = [];
  for (const c of anErstes) {
    if (!uebergibtZentral(c, erstes.filter ?? { index: -1 })) {
      maengel.push(
        `${fund.datei}:${zeileVon(c)} — ${schluessel}: ${erstes.funktion}(…) bekommt an der Filterstelle nicht die zentrale Entscheidung (fehlt, ersetzt oder nicht auflösbar).`,
      );
    }
  }
  if (maengel.length > 0) {
    return maengel;
  }
  for (let i = 0; i < kette.length; i++) {
    const glied = kette[i];
    if (!glied?.filter) {
      return [`${ort} — ${schluessel}: Glied ${i} ohne Filterstelle.`];
    }
    let text: string;
    try {
      text = lies(glied.datei);
    } catch {
      return [`${glied.datei}:1 — ${schluessel}: Datei des Glieds ${glied.funktion} nicht lesbar.`];
    }
    const sf = ts.createSourceFile(glied.datei, text, ts.ScriptTarget.Latest, true);
    const f = funktionsRumpf(sf, glied.funktion);
    if (!f) {
      return [`${glied.datei}:1 — ${schluessel}: Funktion ${glied.funktion} nicht gefunden.`];
    }
    const stelle = `${glied.datei}:${f.zeile}`;
    const param = parameterAn(f.knoten, glied.filter.index);
    if (param === undefined) {
      return [
        `${stelle} — ${schluessel}: ${glied.funktion} hat an Stelle ${glied.filter.index} keinen benannten Parameter.`,
      ];
    }
    // Nacharbeit 7: ein Glied darf die übergebene Entscheidung nicht ersetzen — keine Zuweisung an
    // den Filterparameter und keine an seine Filtereigenschaft (im ganzen Rumpf, auch in Helfern).
    const ersetzt = [
      ...schreibzugriffe(f.rumpf, param),
      ...(glied.filter.eigenschaft
        ? schreibzugriffe(f.rumpf, param, glied.filter.eigenschaft)
        : []),
    ];
    const ersterErsatz = ersetzt[0];
    if (ersterErsatz) {
      const was = glied.filter.eigenschaft ? `${param}.${glied.filter.eigenschaft}` : param;
      return [
        `${glied.datei}:${zeileVon(ersterErsatz.knoten)} — ${schluessel}: ${glied.funktion} schreibt auf den übergebenen Filter ${was} — die zentrale Entscheidung wäre ersetzbar.`,
      ];
    }
    const aufrufe = ausgefuehrteAufrufeIn(f.rumpf, benannteHelfer(sf));
    const naechstes = kette[i + 1];
    if (naechstes === undefined) {
      if (!aufrufe.some((c) => ruftFilter(c, param, glied.filter?.eigenschaft))) {
        const was = glied.filter.eigenschaft ? `${param}.${glied.filter.eigenschaft}` : param;
        return [
          `${stelle} — ${schluessel}: ${glied.funktion} ruft den übergebenen Filter ${was} nicht auf.`,
        ];
      }
      continue;
    }
    const weiter = aufrufe.filter((c) => aufgerufenerName(c.expression) === naechstes.funktion);
    if (weiter.length === 0) {
      return [`${stelle} — ${schluessel}: ruft das Glied ${naechstes.funktion} nicht auf.`];
    }
    for (const c of weiter) {
      const arg = naechstes.filter ? c.arguments[naechstes.filter.index] : undefined;
      const durchgereicht =
        arg !== undefined &&
        ts.isIdentifier(ohneHuelleAusdruck(arg)) &&
        (ohneHuelleAusdruck(arg) as ts.Identifier).text === param &&
        naechstes.filter?.eigenschaft === glied.filter.eigenschaft;
      if (!durchgereicht) {
        return [
          `${glied.datei}:${zeileVon(c)} — ${schluessel}: ${naechstes.funktion}(…) bekommt den Filter ${param} nicht an seiner Filterstelle.`,
        ];
      }
    }
  }
  return [];
}

/**
 * Geht den Weg eines DIENST_FILTERT-Eintrags nach. Leer = belegt; sonst je Mangel Datei:Zeile.
 *
 * NACHARBEIT 3: die Entscheidung MUSS eine der zentralen sein. Mit `anwendung` muss die Route sie
 * bilden und das letzte Glied den übergebenen Filter aufrufen; ohne ruft das letzte Glied (bzw. die
 * Route bei leerer Kette) die Entscheidung selbst.
 */
function pruefeDienstweg(
  schluessel: string,
  e: Eintrag,
  fund: Pick<Fund, "datei" | "zeile" | "aufrufe" | "aufrufText" | "ausgefuehrteAufrufe">,
  lies: (datei: string) => string,
): string[] {
  const ort = `${fund.datei}:${fund.zeile}`;
  if (e.weiterleitung !== undefined) {
    const ziel = REGISTER[e.weiterleitung];
    const pfad = e.weiterleitung.split(" ")[1] ?? "";
    const maengel: string[] = [];
    if (!fund.aufrufText.includes(`"${pfad}"`)) {
      maengel.push(
        `${ort} — ${schluessel}: die Weiterleitung an ${e.weiterleitung} steht nicht im Aufruf`,
      );
    }
    if (!ziel || ziel.weiterleitung !== undefined || (ziel.urteil !== "PRAEDIKAT" && !ziel.kette)) {
      maengel.push(
        `${ort} — ${schluessel}: das Ziel ${e.weiterleitung} ist selbst nicht verfolgbar`,
      );
    }
    return maengel;
  }
  if (e.kette === undefined || e.entscheidung === undefined) {
    return [
      `${ort} — ${schluessel}: DIENST_FILTERT ohne nachprüfbaren Weg (kette/entscheidung) — eine Prosabegründung genügt nicht.`,
    ];
  }
  if (!ZENTRALE_ENTSCHEIDUNGEN.has(e.entscheidung)) {
    return [
      `${ort} — ${schluessel}: „${e.entscheidung}“ ist nicht die zentrale Sichtbarkeitsentscheidung (sichtbarkeit.ts) — eine Vertraulichkeitsregel allein genügt nicht.`,
    ];
  }
  if (e.anwendung !== undefined) {
    // Nacharbeit 5: die Entscheidung wird gebildet UND übergeben UND angewendet — die blosse
    // Anwesenheit der Aufrufnamen genügt nicht mehr (`pruefeUebergabe`).
    return pruefeUebergabe(schluessel, e.kette, fund, lies);
  }
  const ziel = e.entscheidung;
  let rufe: ReadonlySet<string> = fund.aufrufe;
  let stelle = ort;
  for (const glied of e.kette) {
    if (!rufe.has(glied.funktion)) {
      return [`${stelle} — ${schluessel}: ruft das Glied ${glied.funktion} nicht auf.`];
    }
    let text: string;
    try {
      text = lies(glied.datei);
    } catch {
      return [`${glied.datei}:1 — ${schluessel}: Datei des Glieds ${glied.funktion} nicht lesbar.`];
    }
    const sf = ts.createSourceFile(glied.datei, text, ts.ScriptTarget.Latest, true);
    const f = funktionsRumpf(sf, glied.funktion);
    if (!f) {
      return [`${glied.datei}:1 — ${schluessel}: Funktion ${glied.funktion} nicht gefunden.`];
    }
    rufe = aufrufeIn(f.rumpf, benannteHelfer(sf));
    stelle = `${glied.datei}:${f.zeile}`;
  }
  if (!rufe.has(ziel)) {
    return [`${stelle} — ${schluessel}: ruft die Entscheidung ${ziel} nicht auf.`];
  }
  return [];
}

const LIES_AUS_DEM_BAUM = (datei: string): string => readFileSync(join(REPO_WURZEL, datei), "utf8");

// ================================================================================================
// NACHARBEIT 9 (Befund ben, R-1175) — AUSGÄNGE AUSSERHALB DER ROUTEN.
// ================================================================================================
//
// Bis hierher erhob der Sammler ausschliesslich Routenregistrierungen. Der integrierte Hauptstand
// hat mit `WissensereignisMelder` (services/app/src/wissensereignisse.ts) einen Weg, der Kennungen,
// Fassungen und Ereignisse von Wissensobjekten SELBST an Fremdwerkzeuge schickt — ohne Route. Er
// war für den Wächter unsichtbar.
//
// Jetzt erhebt der Sammler zusätzlich jede AUSGANGSSTELLE in `services/**` selbst, ohne Dateiliste:
//   · jeder Aufruf eines Bezeichners, dessen Name `fetch` enthält (`fetch`, `fetchFn`, `doFetch`,
//     `fetchMitSignal` …), und `globalThis.fetch(…)`;
//   · jeder Aufruf einer aus `http`/`https`/`http2`/`net`/`tls` eingeführten Netzfunktion (`request`,
//     `get`, `connect`, `createConnection` — auch umbenannt oder über den Namensraum);
//   · jedes `….sendMail(…)`, jedes `new WebSocket(…)`/`new EventSource(…)`.
// Jede Ausgangsstelle braucht ihr EIGENES Urteil in `AUSGAENGE` (Nacharbeit 10: Schlüssel je Stelle,
// nicht je Datei); eine neue ist rot mit
// Datei und Zeile, ein Urteil ohne Ausgangsstelle ebenfalls. Das Urteil SCHUTZ_VOR_VERSAND wird
// nachgegangen: die Ausgangsfunktion ist nur über die genannte Verbindung erreichbar, jeder Versand
// über sie steht hinter einer Abbruchprüfung durch den Wächter, und der Wächter ruft über eine
// Kette die zentrale Entscheidung.
//
// BENANNTE GRENZEN: Eine Ausgangsstelle wird über die Bauform des Aufrufs erkannt. Ein Netzaufruf
// über einen Bezeichner ohne `fetch` im Namen, der nicht aus einem Netzmodul eingeführt ist (etwa
// eine weitergereichte Funktion unter anderem Namen), bleibt unerkannt. KEIN_KO_INHALT und
// AUFTRAGSVERARBEITER sind LESEURTEILE mit Fundstelle, keine Messungen.

type Ausgangsurteil =
  // Der Ausgang trägt keinen Inhalt eines Wissensobjekts (Abruf an eine Quelle, Anmeldung, Mail
  // mit Kontotext oder blosser Kennung). LESEURTEIL.
  | "KEIN_KO_INHALT"
  // Empfänger ist ein vom Betreiber konfigurierter Verarbeiter (KI-Anbieter, Transkription), keine
  // Person mit eigener Sicht. Die Personensichtbarkeit entscheidet der Weg, der das Ergebnis
  // ausgibt (Routenwächter); Vertrauliches sperrt der Egress-Chokepoint. LESEURTEIL.
  | "AUFTRAGSVERARBEITER"
  // Der Ausgang geht an Fremdwerkzeuge und steht hinter der zentralen Entscheidung. NACHGEPRÜFT.
  | "SCHUTZ_VOR_VERSAND";

// NACHARBEIT 10 (Befund ben): Bis hierher galt ein Urteil je DATEI — ein zusätzliches `fetch` in
// einer bereits beurteilten Datei erbte deren Urteil und blieb grün. Jetzt gilt ein Urteil je
// AUSGANGSSTELLE. Ihr Schlüssel ist `datei::funktion#n`: die n-te erhobene Stelle (Quellreihenfolge)
// in der umgebenden Funktion. Eine weitere Stelle — in derselben oder einer anderen Funktion —
// erzeugt einen neuen Schlüssel ohne Urteil und ist rot mit Datei und Zeile. Die Erhebung selbst
// bleibt automatisch; das Register benennt nur Urteile zu erhobenen Stellen.
interface Ausgangseintrag {
  urteil: Ausgangsurteil;
  grund: string;
  /**
   * Bei SCHUTZ_VOR_VERSAND: der Name, unter dem die Funktion dieser Ausgangsstelle gerufen wird
   * (`this.zusteller = … ?? fetchZusteller`).
   */
  verbindung?: string;
  /** … die Funktion, die über die Verbindung versendet. */
  versand?: string;
  /** … der Wächter, der jeden Versand vorher abbrechen kann. */
  waechter?: string;
  /** … der Weg vom Wächter zur zentralen Entscheidung (erstes Glied = Wächter). */
  kette?: readonly Glied[];
  entscheidung?: string;
}

const AUSGAENGE: Record<string, Ausgangseintrag> = {
  "services/app/src/wissensereignisse.ts::fetchZusteller#1": {
    urteil: "SCHUTZ_VOR_VERSAND",
    verbindung: "zusteller",
    versand: "stelleZu",
    waechter: "nochMeldbar",
    kette: [
      { datei: "services/app/src/wissensereignisse.ts", funktion: "nochMeldbar" },
      { datei: "services/app/src/wissensereignisse.ts", funktion: "meldbar" },
    ],
    entscheidung: "darfSehen",
    grund:
      "Webhook-Versand: jede Zustellung prüft unmittelbar davor frisch nochMeldbar → meldbar → " +
      "darfSehen (Betrachter viewer ohne Spaces) und bricht sonst ab.",
  },
  "services/notifications/src/smtp.ts::send#1": {
    urteil: "KEIN_KO_INHALT",
    grund:
      "Mailversand: Kontotexte (Rücksetzen, Freigabe) und bei der Prüfzuweisung nur die Kennung " +
      "des Objekts an die zugewiesene Person (notify.ts) — kein Titel, keine Aussage.",
  },
  "services/confluence/src/rest-client.ts::mitFrist#1": {
    urteil: "KEIN_KO_INHALT",
    grund:
      "Eingehender Import: der gemeinsame Fristrahmen aller Abrufe an Confluence mit Space-/" +
      "Seitenkennungen, kein Bestand.",
  },
  "services/jira/src/rest-client.ts::holeJson#1": {
    urteil: "KEIN_KO_INHALT",
    grund: "Eingehender Import: Abrufe an Jira mit Projekt-/Vorgangskennungen, kein Bestand.",
  },
  "services/sharepoint/src/graph-client.ts::gebundenerTransport#1": {
    urteil: "KEIN_KO_INHALT",
    grund: "Eingehender Import: Inhaltsabruf einer Datei aus Microsoft Graph, kein Bestand.",
  },
  "services/sharepoint/src/graph-client.ts::holeJson#1": {
    urteil: "KEIN_KO_INHALT",
    grund: "Eingehender Import: Metadaten (Liste, Merkmale) aus Microsoft Graph, kein Bestand.",
  },
  "services/auth/src/oidc.ts::createTokenExchanger#1": {
    urteil: "KEIN_KO_INHALT",
    grund: "SSO-Token-Tausch mit dem Identitätsanbieter (Code, PKCE), kein Bestand.",
  },
  "services/external-search/src/wikipedia.ts::search#1": {
    urteil: "KEIN_KO_INHALT",
    grund: "Externe Suche: geht nur der Suchbegriff des Fragenden hinaus, kein Bestand.",
  },
  "services/reasoner/src/model-client.ts::postMessages#1": {
    urteil: "AUFTRAGSVERARBEITER",
    grund:
      "KI-Anbieter des Betreibers (Messages-Schnittstelle); Inhalte stellen die aufrufenden Wege " +
      "zusammen (deren Ausgabe prüft der Routenwächter), Vertrauliches sperrt der Chokepoint " +
      "(rejectsConfidential).",
  },
  "services/reasoner/src/model-client.ts::postChatCompletions#1": {
    urteil: "AUFTRAGSVERARBEITER",
    grund:
      "KI-Anbieter des Betreibers (Chat-Completions-Schnittstelle); Inhalte stellen die " +
      "aufrufenden Wege zusammen (deren Ausgabe prüft der Routenwächter), Vertrauliches sperrt " +
      "der Chokepoint (rejectsConfidential).",
  },
  "services/media/src/transcriber.ts::transcribe#1": {
    urteil: "AUFTRAGSVERARBEITER",
    grund:
      "Transkription eines Anhangs beim konfigurierten Anbieter; die Route POST /api/media/analyze " +
      "entscheidet vorher mit beurteileAnhang.",
  },
};

const NETZMODULE = /^(node:)?(http|https|http2|net|tls)$/;
const NETZFUNKTIONEN = new Set(["request", "get", "connect", "createConnection"]);

interface Ausgangsstelle {
  datei: string;
  zeile: number;
  /** Name der umgebenden Funktion, Methode oder Pfeilfunktions-Konstante; sonst "(Modul)". */
  funktion: string;
  knoten: ts.Node;
}

/** Der Name der Funktion, in der dieser Knoten steht. */
function umgebendeFunktion(n: ts.Node): string {
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
    if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) && p.name) {
      return p.name.getText();
    }
    if (
      (ts.isArrowFunction(p) || ts.isFunctionExpression(p)) &&
      ts.isVariableDeclaration(p.parent) &&
      ts.isIdentifier(p.parent.name)
    ) {
      return p.parent.name.text;
    }
  }
  return "(Modul)";
}

/** Alle Ausgangsstellen einer Datei (Bauformen s. Kopf dieses Abschnitts). */
function erhebeAusgaenge(datei: string, text: string): Ausgangsstelle[] {
  const sf = ts.createSourceFile(datei, text, ts.ScriptTarget.Latest, true);
  const netzBindungen = new Set<string>();
  const netzNamensraeume = new Set<string>();
  for (const anweisung of sf.statements) {
    if (
      !ts.isImportDeclaration(anweisung) ||
      !ts.isStringLiteral(anweisung.moduleSpecifier) ||
      !NETZMODULE.test(anweisung.moduleSpecifier.text) ||
      anweisung.importClause?.isTypeOnly
    ) {
      continue;
    }
    const klausel = anweisung.importClause;
    if (klausel?.name) {
      netzNamensraeume.add(klausel.name.text);
    }
    const gebunden = klausel?.namedBindings;
    if (gebunden && ts.isNamespaceImport(gebunden)) {
      netzNamensraeume.add(gebunden.name.text);
    }
    if (gebunden && ts.isNamedImports(gebunden)) {
      for (const el of gebunden.elements) {
        const eingefuehrt = (el.propertyName ?? el.name).text;
        if (!el.isTypeOnly && NETZFUNKTIONEN.has(eingefuehrt)) {
          netzBindungen.add(el.name.text);
        }
      }
    }
  }
  const stellen: Ausgangsstelle[] = [];
  const merke = (n: ts.Node): void => {
    stellen.push({
      datei,
      zeile: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
      funktion: umgebendeFunktion(n),
      knoten: n,
    });
  };
  const besuche = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const e = n.expression;
      if (ts.isIdentifier(e) && (/fetch/i.test(e.text) || netzBindungen.has(e.text))) {
        merke(n);
      } else if (ts.isPropertyAccessExpression(e)) {
        const name = e.name.text;
        const empfaenger = e.expression;
        const imNamensraum =
          ts.isIdentifier(empfaenger) &&
          netzNamensraeume.has(empfaenger.text) &&
          NETZFUNKTIONEN.has(name);
        const globalesFetch =
          name === "fetch" &&
          ts.isIdentifier(empfaenger) &&
          ["globalThis", "window", "self"].includes(empfaenger.text);
        if (name === "sendMail" || imNamensraum || globalesFetch) {
          merke(n);
        }
      }
    }
    if (
      ts.isNewExpression(n) &&
      ts.isIdentifier(n.expression) &&
      (n.expression.text === "WebSocket" || n.expression.text === "EventSource")
    ) {
      merke(n);
    }
    ts.forEachChild(n, besuche);
  };
  besuche(sf);
  return stellen;
}

const AUSGANGSHINWEIS =
  /fetch|sendMail|WebSocket|EventSource|from\s+["'](node:)?(http|https|http2|net|tls)["']/i;

function produktdateienUnter(verzeichnis: string): string[] {
  const liste: string[] = [];
  for (const eintrag of readdirSync(join(REPO_WURZEL, verzeichnis), { withFileTypes: true })) {
    if (eintrag.name === "node_modules" || eintrag.name === "dist") {
      continue;
    }
    const pfad = `${verzeichnis}/${eintrag.name}`;
    if (eintrag.isDirectory()) {
      liste.push(...produktdateienUnter(pfad));
    } else if (
      eintrag.name.endsWith(".ts") &&
      !eintrag.name.endsWith(".test.ts") &&
      !eintrag.name.endsWith(".d.ts")
    ) {
      liste.push(pfad);
    }
  }
  return liste;
}

const AUSGANGSSTELLEN: Ausgangsstelle[] = produktdateienUnter("services").flatMap((datei) => {
  const text = LIES_AUS_DEM_BAUM(datei);
  return AUSGANGSHINWEIS.test(text) ? erhebeAusgaenge(datei, text) : [];
});

// Gemessene Untergrenze am integrierten Stand (Quelleninspektion): neun Dateien mit elf
// Ausgangsstellen. Sie darf steigen, aber nie unbemerkt fallen.
const MINDESTZAHL_AUSGANGSDATEIEN = 9;
const MINDESTZAHL_AUSGANGSSTELLEN = 11;

/** Je Ausgangsstelle ihr Registerschlüssel `datei::funktion#n` (n zählt je Datei und Funktion). */
function mitSchluessel(
  stellen: readonly Ausgangsstelle[],
): { stelle: Ausgangsstelle; schluessel: string }[] {
  const gezaehlt = new Map<string, number>();
  return stellen.map((stelle) => {
    const basis = `${stelle.datei}::${stelle.funktion}`;
    const n = (gezaehlt.get(basis) ?? 0) + 1;
    gezaehlt.set(basis, n);
    return { stelle, schluessel: `${basis}#${n}` };
  });
}

/** Ausgangsstellen ohne eigenes Urteil — je Stelle Datei:Zeile. */
function unbeurteilteStellen(
  stellen: readonly Ausgangsstelle[],
  urteile: Readonly<Record<string, Ausgangseintrag>>,
): string[] {
  return mitSchluessel(stellen)
    .filter(({ schluessel }) => !urteile[schluessel])
    .map(
      ({ stelle, schluessel }) =>
        `${stelle.datei}:${stelle.zeile} — Ausgangsstelle ${schluessel} ohne eigenes Urteil`,
    );
}

/** Urteile, zu denen die Erhebung keine Ausgangsstelle mehr findet. */
function verwaisteUrteile(
  stellen: readonly Ausgangsstelle[],
  urteile: Readonly<Record<string, Ausgangseintrag>>,
): string[] {
  const erhoben = new Set(mitSchluessel(stellen).map(({ schluessel }) => schluessel));
  return Object.keys(urteile).filter((k) => !erhoben.has(k));
}

// ------------------------------------------------------------------------------------------------
// NACHARBEIT 10 (Befund ben): DIE RICHTUNG DER ENTSCHEIDUNG.
// ------------------------------------------------------------------------------------------------
//
// Bis hierher genügte, dass der Wächter IRGENDWO in der Bedingung einer abbrechenden Anweisung
// vorkam. `if (await this.nochOk(e)) { continue; } await this.zusteller(e);` war damit grün — und
// versendete genau dann, wenn die Entscheidung VERWEIGERT. Jetzt wird die Richtung nachgewiesen:
//   · vor dem Versand steht `if (!wächter(…)) <Abbruch>` (auch als Glied einer `||`-Kette, Klammern
//     und `await` dürfen dazwischen stehen); jede andere Bedingung ist rot;
//   · jedes Glied der Kette liefert einen FALSCHEN Wert, sobald das nächste verweigert:
//     (A) jede Rückgabe ist ein Falschwert oder eine `&&`-Kette, deren Glied den nächsten unmittelbar
//         aufruft (`return a && darfSehen(b, ko)`), oder
//     (B) unbedingt erreicht (nur in Blöcken und Schleifen) steht `if (!nächster(…)) return false;`,
//         und vorher gibt keine Rückgabe einen anderen als einen Falschwert zurück;
//   · die Entscheidung am Ende ist eine Ja/Nein-Entscheidung (`darfSehen`).
// `return !darfSehen(b, ko)`, `if (meldbar(m)) return false;` oder eine Bedingung, die sich so nicht
// auflösen lässt, sind rot — mit Datei und Zeile.

/** Zentrale Entscheidungen mit Ja/Nein-Ergebnis (nur sie tragen einen Richtungsnachweis). */
const ZENTRALE_JA_NEIN = new Set(["darfSehen"]);

function ohneKlammern(e: ts.Expression): ts.Expression {
  let x = e;
  while (ts.isParenthesizedExpression(x)) {
    x = x.expression;
  }
  return x;
}

/** Ist `e` — ohne Klammern und `await` — ein Aufruf von `name`? */
function istAufrufVon(e: ts.Expression, name: string): boolean {
  let x = e;
  while (ts.isParenthesizedExpression(x) || ts.isAwaitExpression(x)) {
    x = x.expression;
  }
  return ts.isCallExpression(x) && aufgerufenerName(x.expression) === name;
}

/** Ist die Bedingung sicher wahr, wenn `name` verweigert? (`!name(…)`, auch in einer `||`-Kette) */
function wahrBeiVerweigerung(bedingung: ts.Expression, name: string): boolean {
  const x = ohneKlammern(bedingung);
  if (ts.isBinaryExpression(x) && x.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
    return wahrBeiVerweigerung(x.left, name) || wahrBeiVerweigerung(x.right, name);
  }
  return (
    ts.isPrefixUnaryExpression(x) &&
    x.operator === ts.SyntaxKind.ExclamationToken &&
    istAufrufVon(x.operand, name)
  );
}

function istFalschwert(e: ts.Expression | undefined): boolean {
  if (e === undefined) {
    return true;
  }
  const x = ohneKlammern(e);
  return (
    x.kind === ts.SyntaxKind.FalseKeyword ||
    x.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isIdentifier(x) && x.text === "undefined") ||
    (ts.isNumericLiteral(x) && Number(x.text) === 0) ||
    (ts.isStringLiteral(x) && x.text === "")
  );
}

/** Alle Rückgaben in `knoten`, ohne in verschachtelte Funktionen abzusteigen. */
function rueckgabenIn(knoten: ts.Node): ts.ReturnStatement[] {
  const liste: ts.ReturnStatement[] = [];
  const besuche = (x: ts.Node): void => {
    if (ts.isFunctionLike(x) || ts.isClassLike(x)) {
      return;
    }
    if (ts.isReturnStatement(x)) {
      liste.push(x);
    }
    ts.forEachChild(x, besuche);
  };
  ts.forEachChild(knoten, besuche);
  return liste;
}

/** Bricht die Anweisung ab (Versandseite: continue/break/return/throw am Ende)? */
function bricht(s: ts.Statement): boolean {
  if (
    ts.isContinueStatement(s) ||
    ts.isReturnStatement(s) ||
    ts.isThrowStatement(s) ||
    ts.isBreakStatement(s)
  ) {
    return true;
  }
  const letzte = ts.isBlock(s) ? s.statements[s.statements.length - 1] : undefined;
  return letzte !== undefined && bricht(letzte);
}

/** Endet die Anweisung mit Falschwert oder Ausnahme, ohne vorher anderes zurückzugeben? */
function liefertFalsch(s: ts.Statement): boolean {
  if (ts.isReturnStatement(s)) {
    return istFalschwert(s.expression);
  }
  if (ts.isThrowStatement(s)) {
    return true;
  }
  if (!ts.isBlock(s)) {
    return false;
  }
  const letzte = s.statements[s.statements.length - 1];
  return (
    letzte !== undefined &&
    liefertFalsch(letzte) &&
    rueckgabenIn(s).every((r) => istFalschwert(r.expression))
  );
}

/** Die Glieder einer `&&`-Kette (ein einzelner Ausdruck ist eine Kette aus einem Glied). */
function undGlieder(e: ts.Expression): ts.Expression[] {
  const x = ohneKlammern(e);
  if (ts.isBinaryExpression(x) && x.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    return [...undGlieder(x.left), ...undGlieder(x.right)];
  }
  return [x];
}

/**
 * Liefert der Rumpf sicher einen Falschwert, sobald `naechster` verweigert (Regel A oder B oben)?
 * Leer = nachgewiesen; sonst der Mangel.
 */
function verweigerungSchlaegtDurch(rumpf: ts.Node, naechster: string): string | undefined {
  const fuehrt = (e: ts.Expression | undefined): boolean =>
    istFalschwert(e) || (e !== undefined && undGlieder(e).some((g) => istAufrufVon(g, naechster)));
  // Pfeilfunktion mit Ausdrucksrumpf: der Ausdruck ist die einzige Rückgabe.
  if (!ts.isBlock(rumpf)) {
    return fuehrt(rumpf as ts.Expression)
      ? undefined
      : `liefert das Ergebnis von ${naechster} nicht als &&-Glied`;
  }
  const rueckgaben = rueckgabenIn(rumpf);
  // Regel A.
  if (rueckgaben.length > 0 && rueckgaben.every((r) => fuehrt(r.expression))) {
    return undefined;
  }
  // Regel B.
  const unbedingt = (n: ts.Node): boolean => {
    for (let p = n.parent; p && p !== rumpf; p = p.parent) {
      if (
        !ts.isBlock(p) &&
        !ts.isForOfStatement(p) &&
        !ts.isForInStatement(p) &&
        !ts.isForStatement(p) &&
        !ts.isWhileStatement(p) &&
        !ts.isDoStatement(p)
      ) {
        return false;
      }
    }
    return true;
  };
  const findeSperre = (x: ts.Node): ts.IfStatement | undefined => {
    if (ts.isFunctionLike(x) || ts.isClassLike(x)) {
      return undefined;
    }
    if (
      ts.isIfStatement(x) &&
      wahrBeiVerweigerung(x.expression, naechster) &&
      liefertFalsch(x.thenStatement) &&
      unbedingt(x)
    ) {
      return x;
    }
    return ts.forEachChild(x, findeSperre);
  };
  const sperre = ts.forEachChild(rumpf, findeSperre);
  if (sperre === undefined) {
    return `bricht nicht mit einem Falschwert ab, wenn ${naechster} verweigert`;
  }
  const vorher = rueckgaben.filter(
    (r) => r.getStart() < sperre.getStart() && !istFalschwert(r.expression),
  );
  return vorher.length === 0
    ? undefined
    : `gibt vor der Sperre durch ${naechster} schon etwas anderes als einen Falschwert zurück`;
}

/**
 * Steht der Aufruf hinter `if (!waechter(…)) <Abbruch>` (frühere Geschwisteranweisung)? Eine
 * Bedingung, die den Wächter anders verwendet (unverneint, nur als Teil, nicht auflösbar), zählt nicht.
 */
function hinterWaechter(aufruf: ts.Node, waechter: string): boolean {
  let anweisung: ts.Node = aufruf;
  while (anweisung.parent && !ts.isBlock(anweisung.parent)) {
    anweisung = anweisung.parent;
  }
  const block = anweisung.parent;
  if (!block || !ts.isBlock(block)) {
    return false;
  }
  const vorher = block.statements.slice(0, block.statements.indexOf(anweisung as ts.Statement));
  const sperrt = (s: ts.Statement): boolean =>
    ts.isIfStatement(s) && bricht(s.thenStatement) && wahrBeiVerweigerung(s.expression, waechter);
  return vorher.some(sperrt);
}

/** Geht ein SCHUTZ_VOR_VERSAND-Urteil einer Ausgangsstelle nach. Leer = belegt; sonst Datei:Zeile. */
function pruefeVersandschutz(
  stelle: Ausgangsstelle,
  e: Ausgangseintrag,
  lies: (datei: string) => string,
): string[] {
  const { datei, funktion: ausgangsfunktion } = stelle;
  const { verbindung, versand, waechter, kette, entscheidung } = e;
  if (!verbindung || !versand || !waechter || !kette || !entscheidung) {
    return [`${datei}:${stelle.zeile} — SCHUTZ_VOR_VERSAND ohne vollständigen Nachweisweg.`];
  }
  if (!ZENTRALE_ENTSCHEIDUNGEN.has(entscheidung)) {
    return [`${datei}:1 — „${entscheidung}“ ist nicht die zentrale Sichtbarkeitsentscheidung.`];
  }
  if (!ZENTRALE_JA_NEIN.has(entscheidung)) {
    return [`${datei}:1 — „${entscheidung}“ trägt keinen Ja/Nein-Richtungsnachweis.`];
  }
  if (ausgangsfunktion === "(Modul)") {
    return [`${datei}:${stelle.zeile} — Ausgangsstelle ausserhalb einer benannten Funktion.`];
  }
  const sf = ts.createSourceFile(datei, lies(datei), ts.ScriptTarget.Latest, true);
  // (1) Die Ausgangsfunktion ist NUR über die Verbindung erreichbar: jede Erwähnung ausserhalb ihrer
  // Deklaration steht rechts in einer Zuweisung an `verbindung`.
  const maengel: string[] = [];
  let verbunden = false;
  const besuche = (n: ts.Node): void => {
    if (ts.isIdentifier(n) && n.text === ausgangsfunktion) {
      const eltern = n.parent;
      const istDeklaration = ts.isVariableDeclaration(eltern) && eltern.name === n;
      if (!istDeklaration) {
        let zuweisung: ts.Node | undefined = eltern;
        while (zuweisung && !istZuweisung(zuweisung)) {
          zuweisung = zuweisung.parent;
        }
        const ziel = zuweisung && istZuweisung(zuweisung) ? zuweisung.left : undefined;
        const zielName =
          ziel && ts.isPropertyAccessExpression(ziel)
            ? ziel.name.text
            : ziel && ts.isIdentifier(ziel)
              ? ziel.text
              : undefined;
        if (zielName === verbindung) {
          verbunden = true;
        } else {
          maengel.push(
            `${datei}:${zeileVon(n)} — ${ausgangsfunktion} wird ausserhalb der Verbindung ${verbindung} verwendet.`,
          );
        }
      }
    }
    ts.forEachChild(n, besuche);
  };
  besuche(sf);
  if (!verbunden) {
    maengel.push(`${datei}:1 — ${ausgangsfunktion} ist nicht an ${verbindung} gebunden.`);
  }
  if (maengel.length > 0) {
    return maengel;
  }
  // (2) Jeder Versand über die Verbindung steht hinter dem Wächter.
  const f = funktionsRumpf(sf, versand);
  if (!f) {
    return [`${datei}:1 — Versandfunktion ${versand} nicht gefunden.`];
  }
  const versandAufrufe = ausgefuehrteAufrufeIn(f.rumpf, benannteHelfer(sf)).filter(
    (c) => aufgerufenerName(c.expression) === verbindung,
  );
  if (versandAufrufe.length === 0) {
    return [`${datei}:${f.zeile} — ${versand} versendet nicht über ${verbindung}.`];
  }
  for (const c of versandAufrufe) {
    if (!hinterWaechter(c, waechter)) {
      maengel.push(
        `${datei}:${zeileVon(c)} — Versand über ${verbindung} ohne vorherige Abbruchprüfung durch ${waechter}.`,
      );
    }
  }
  // Ein Aufruf der Verbindung AUSSERHALB der Versandfunktion wäre ein Weg am Wächter vorbei.
  const ueberall: ts.CallExpression[] = [];
  const sammle = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && aufgerufenerName(n.expression) === verbindung) {
      ueberall.push(n);
    }
    ts.forEachChild(n, sammle);
  };
  sammle(sf);
  for (const c of ueberall) {
    if (umgebendeFunktion(c) !== versand) {
      maengel.push(
        `${datei}:${zeileVon(c)} — ${verbindung} wird ausserhalb von ${versand} gerufen.`,
      );
    }
  }
  if (maengel.length > 0) {
    return maengel;
  }
  // (3) Der Wächter führt über die Kette zur zentralen Entscheidung — und zwar in der richtigen
  // Richtung: verweigert das nächste Glied, liefert jedes Glied einen Falschwert (Nacharbeit 10).
  if (kette[0]?.funktion !== waechter) {
    return [`${datei}:${f.zeile} — die Kette beginnt nicht beim Wächter ${waechter}.`];
  }
  for (const [i, glied] of kette.entries()) {
    const naechster = kette[i + 1]?.funktion ?? entscheidung;
    const gsf = ts.createSourceFile(glied.datei, lies(glied.datei), ts.ScriptTarget.Latest, true);
    const g = funktionsRumpf(gsf, glied.funktion);
    if (!g) {
      return [`${glied.datei}:1 — Funktion ${glied.funktion} nicht gefunden.`];
    }
    if (!aufrufeIn(g.rumpf, benannteHelfer(gsf)).has(naechster)) {
      return [`${glied.datei}:${g.zeile} — ${glied.funktion} ruft ${naechster} nicht auf.`];
    }
    const mangel = verweigerungSchlaegtDurch(g.rumpf, naechster);
    if (mangel) {
      return [`${glied.datei}:${g.zeile} — ${glied.funktion} ${mangel}.`];
    }
  }
  return [];
}

/** Kalibrierhilfe (Nacharbeit 5): ein Dienstweg-Eintrag über `probe/dienst.ts::liste(sichtbar)`. */
function probeEintrag(): Eintrag {
  return {
    urteil: "DIENST_FILTERT",
    entscheidung: "sichtbarkeitsfilterFuer",
    kette: [{ datei: "probe/dienst.ts", funktion: "liste", filter: { index: 0 } }],
    anwendung: "sichtbar",
    grund: "Probe.",
  };
}

/** Kalibrierhilfe (Nacharbeit 5): der Fund einer synthetischen Route — mit echten Aufrufknoten. */
function probeRoute(rumpf: string): Fund {
  const quelle = `app.get("/probe", async (request, reply) => {\n  const user = await waechter(request);\n  ${rumpf}\n});`;
  const fund = erhebeDatei("probe-routes.ts", quelle).funde[0];
  if (!fund) {
    throw new Error("die Proberoute wurde nicht erhoben — die Kalibrierung prüfte nichts");
  }
  return fund;
}

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

  // NACHARBEIT 2 (Befund ben, R-1175): der Schutz eines Dienstwegs wird nachgegangen, nicht geglaubt.
  it("wer DIENST_FILTERT behauptet, ist bis zur aufgerufenen Entscheidung verfolgbar", () => {
    const maengel = ERHEBUNG.funde.flatMap((f) => {
      const e = REGISTER[f.schluessel];
      return e?.urteil === "DIENST_FILTERT"
        ? pruefeDienstweg(f.schluessel, e, f, LIES_AUS_DEM_BAUM)
        : [];
    });
    expect(
      maengel,
      `Diese Dienstwege tragen KO-Inhalt, ohne dass der Weg zur Schutzentscheidung nachweisbar ist:\n${maengel.join("\n")}`,
    ).toEqual([]);
  });

  // NACHARBEIT 3 (Befund ben): keine Ausnahmeliste mehr — jeder Dienstweg fährt eine ZENTRALE
  // Entscheidung, und zwar jeder, nicht nur die heute eingetragenen.
  it("jeder DIENST_FILTERT-Eintrag nennt eine zentrale Entscheidung aus sichtbarkeit.ts", () => {
    const abweichend = Object.entries(REGISTER)
      .filter(([, e]) => e.urteil === "DIENST_FILTERT" && e.weiterleitung === undefined)
      .filter(([, e]) => !ZENTRALE_ENTSCHEIDUNGEN.has(e.entscheidung ?? ""))
      .map(([schluessel, e]) => `${schluessel}: ${e.entscheidung ?? "(keine)"}`);
    expect(abweichend).toEqual([]);
  });

  it("KALIBRIERUNG — ein entfernter Dienstfilter oder eine blosse Erwähnung wird rot", () => {
    const eintrag = probeEintrag();
    const fund = probeRoute("reply.send(await dienst.liste(sichtbarkeitsfilterFuer(user)));");
    const mitFilter =
      "class D { liste(sichtbar) { return kos.filter((k) => !isConfidential(k.c) && sichtbar(k)); } }";
    expect(pruefeDienstweg("GET /probe", eintrag, fund, () => mitFilter)).toEqual([]);

    const ohneFilter = "class D { liste(sichtbar) { return kos; } }";
    expect(pruefeDienstweg("GET /probe", eintrag, fund, () => ohneFilter).join("\n")).toContain(
      "probe/dienst.ts:1 — GET /probe: liste ruft den übergebenen Filter sichtbar nicht auf",
    );
    // Eine Erwähnung ohne Aufruf ist kein Filter.
    const nurErwaehnt = "class D { liste(sichtbar) { void sichtbar; return kos; } }";
    expect(pruefeDienstweg("GET /probe", eintrag, fund, () => nurErwaehnt)).not.toEqual([]);
    // Ruft die Route das erste Glied nicht, ist der Weg unterbrochen.
    const ohneAufruf = probeRoute("sichtbarkeitsfilterFuer(user); reply.send(kos);");
    expect(pruefeDienstweg("GET /probe", eintrag, ohneAufruf, () => mitFilter)).not.toEqual([]);
    // Und ein Eintrag nur mit Prosa ist rot.
    const nurProsa: Eintrag = { urteil: "DIENST_FILTERT", grund: "service.ts:1 — filtert." };
    expect(pruefeDienstweg("GET /probe", nurProsa, fund, () => mitFilter)).not.toEqual([]);
  });

  // NACHARBEIT 16 (Befund ben, R-1175): die Auskunftswege am ECHTEN Bestand. Die Route bildet den
  // Filter, `erstelleSelbstauskunft` wendet ihn bei `titelVon` an. Wird die Anwendung entfernt oder
  // ersetzt oder der Parameter überschrieben, ist das rot mit Datei und Zeile.
  it("GEGENPROBE (Nacharbeit 16) — Auskunftswege: ohne Filteranwendung im Dienst rot", () => {
    const DIENST = "services/app/src/selbstauskunft.ts";
    const echt = LIES_AUS_DEM_BAUM(DIENST);
    const ANWENDUNG = "sichtbar(k) ? k.title : null";
    expect(echt, "die Filteranwendung steht nicht mehr in der erwarteten Form").toContain(
      ANWENDUNG,
    );
    const KOPF = "export async function erstelleSelbstauskunft";
    const zeilen = echt.split("\n");
    const zeileDienst = zeilen.findIndex((z) => z.includes(KOPF)) + 1;
    const zeileAnwendung = zeilen.findIndex((z) => z.includes(ANWENDUNG)) + 1;
    expect(zeileDienst).toBeGreaterThan(0);
    function lies(dienstText: string): (datei: string) => string {
      return (datei) => (datei === DIENST ? dienstText : LIES_AUS_DEM_BAUM(datei));
    }

    for (const schluessel of ["GET /api/me/daten", "GET /api/datenschutz/auskunft/:nutzerId"]) {
      const fund = ERHEBUNG.funde.find((f) => f.schluessel === schluessel);
      const eintrag = REGISTER[schluessel];
      expect(fund, `${schluessel} nicht erhoben`).toBeDefined();
      expect(eintrag?.urteil).toBe("DIENST_FILTERT");
      if (!fund || !eintrag) {
        continue;
      }
      // Der Bestand: grün.
      expect(pruefeDienstweg(schluessel, eintrag, fund, lies(echt))).toEqual([]);
      // Bens Fall: `sichtbar(k)` entfernt, jeder Titel geht hinaus — rot mit Datei und Zeile.
      const entfernt = echt.replace(ANWENDUNG, "k.title");
      expect(pruefeDienstweg(schluessel, eintrag, fund, lies(entfernt))).toEqual([
        `${DIENST}:${zeileDienst} — ${schluessel}: erstelleSelbstauskunft ruft den übergebenen Filter sichtbar nicht auf.`,
      ]);
      // Ersetzt durch eine andere Regel: rot.
      const ersetzt = echt.replace(ANWENDUNG, "!k.deletedAt ? k.title : null");
      expect(pruefeDienstweg(schluessel, eintrag, fund, lies(ersetzt))).toEqual([
        `${DIENST}:${zeileDienst} — ${schluessel}: erstelleSelbstauskunft ruft den übergebenen Filter sichtbar nicht auf.`,
      ]);
      // Der übergebene Filter wird vor der Anwendung überschrieben: rot an der Zeile des Schreibens.
      const ueberschrieben = echt.replace(
        "  const titelVon = new Map",
        "  sichtbar = () => true;\n  const titelVon = new Map",
      );
      expect(pruefeDienstweg(schluessel, eintrag, fund, lies(ueberschrieben))).toEqual([
        `${DIENST}:${zeileAnwendung} — ${schluessel}: erstelleSelbstauskunft schreibt auf den übergebenen Filter sichtbar — die zentrale Entscheidung wäre ersetzbar.`,
      ]);
    }
  });

  // NACHARBEIT 5 (Befund ben, R-1175): die Entscheidung muss ÜBERGEBEN werden, nicht bloss irgendwo
  // gebildet. Der Dienst hat einen Vorgabewert, der alles durchlässt — ohne Übergabe gilt er.
  it("KALIBRIERUNG (Nacharbeit 5) — gebildet, aber nicht übergeben, ist rot (Bens Fall)", () => {
    const eintrag = probeEintrag();
    const dienst =
      "class D { liste(sichtbar = () => true) { return kos.filter((k) => sichtbar(k)); } }";
    const bens = probeRoute("sichtbarkeitsfilterFuer(user);\n  reply.send(await dienst.liste());");
    expect(pruefeDienstweg("GET /probe", eintrag, bens, () => dienst).join("\n")).toContain(
      "liste(…) bekommt an der Filterstelle nicht die zentrale Entscheidung",
    );
    // Ersetzt: ein eigener Filter statt der zentralen Entscheidung.
    const ersetzt = probeRoute(
      "sichtbarkeitsfilterFuer(user);\n  reply.send(await dienst.liste(() => true));",
    );
    expect(pruefeDienstweg("GET /probe", eintrag, ersetzt, () => dienst)).not.toEqual([]);
    // Über eine Variable mit EINER ersetzenden Zuweisung: rot.
    const umgehaengt = probeRoute(
      "let sicht = sichtbarkeitsfilterFuer(user);\n  if (x) { sicht = () => true; }\n" +
        "  reply.send(await dienst.liste(sicht));",
    );
    expect(pruefeDienstweg("GET /probe", eintrag, umgehaengt, () => dienst)).not.toEqual([]);
    // GEGENPROBE: über eine Konstante übergeben ist grün.
    const konstante = probeRoute(
      "const sicht = sichtbarkeitsfilterFuer(user);\n  reply.send(await dienst.liste(sicht));",
    );
    expect(pruefeDienstweg("GET /probe", eintrag, konstante, () => dienst)).toEqual([]);
  });

  // NACHARBEIT 7 (Befund ben, R-1175): Schreibzugriffe auf den Filter — beide Fälle aus dem Befund.
  it("KALIBRIERUNG (Nacharbeit 7) — eine nachträglich ersetzte Filtereigenschaft ist rot", () => {
    const objektEintrag: Eintrag = {
      ...probeEintrag(),
      kette: [
        {
          datei: "probe/dienst.ts",
          funktion: "liste",
          filter: { index: 0, eigenschaft: "sichtbar" },
        },
      ],
    };
    const dienst = "class D { liste(deps) { return kos.filter((k) => deps.sichtbar(k)); } }";
    const anfang = "const deps = { sichtbar: sichtbarkeitsfilterFuer(user) };\n  ";
    const ende = "\n  reply.send(await dienst.liste(deps));";
    // Bens Fall, wörtlich.
    const bens = probeRoute(`${anfang}deps.sichtbar = () => true;${ende}`);
    expect(pruefeDienstweg("GET /probe", objektEintrag, bens, () => dienst).join("\n")).toContain(
      "liste(…) bekommt an der Filterstelle nicht die zentrale Entscheidung",
    );
    // Nicht auflösbare Schreibzugriffe: Index, delete, Object.assign, zusammengesetzte Zuweisung.
    for (const schreiben of [
      'deps["sichtbar"] = sichtbarkeitsfilterFuer(user);',
      "delete deps.sichtbar;",
      "Object.assign(deps, fremd());",
      "deps.sichtbar ??= () => true;",
    ]) {
      const route = probeRoute(`${anfang}${schreiben}${ende}`);
      const maengel = pruefeDienstweg("GET /probe", objektEintrag, route, () => dienst);
      expect(maengel, schreiben).not.toEqual([]);
    }
    // GEGENPROBEN: ohne Schreibzugriff grün; eine erneute ZENTRALE Zuweisung bleibt grün.
    const ohneSchreiben = probeRoute(`${anfang}${ende}`);
    expect(pruefeDienstweg("GET /probe", objektEintrag, ohneSchreiben, () => dienst)).toEqual([]);
    const zentralNeu = probeRoute(`${anfang}deps.sichtbar = sichtbarkeitsfilterFuer(user);${ende}`);
    expect(pruefeDienstweg("GET /probe", objektEintrag, zentralNeu, () => dienst)).toEqual([]);
  });

  it("KALIBRIERUNG (Nacharbeit 7) — ein Dienstglied, das den Filter überschreibt, ist rot", () => {
    const route = probeRoute("reply.send(await dienst.liste(sichtbarkeitsfilterFuer(user)));");
    // Bens Fall, wörtlich: der Parameter wird im Dienst ersetzt und danach aufgerufen.
    const ersetzt =
      "class D { liste(sichtbar) {\n  sichtbar = () => true;\n  return kos.filter((k) => sichtbar(k)); } }";
    expect(
      pruefeDienstweg("GET /probe", probeEintrag(), route, () => ersetzt).join("\n"),
    ).toContain(
      "probe/dienst.ts:2 — GET /probe: liste schreibt auf den übergebenen Filter sichtbar",
    );
    // Dasselbe an einer Filtereigenschaft.
    const objektEintrag: Eintrag = {
      ...probeEintrag(),
      kette: [
        {
          datei: "probe/dienst.ts",
          funktion: "liste",
          filter: { index: 0, eigenschaft: "sichtbar" },
        },
      ],
    };
    const objektRoute = probeRoute(
      "reply.send(await dienst.liste({ sichtbar: sichtbarkeitsfilterFuer(user) }));",
    );
    const eigenschaftErsetzt =
      "class D { liste(deps) { deps.sichtbar = () => true;\n" +
      "  return kos.filter((k) => deps.sichtbar(k)); } }";
    expect(
      pruefeDienstweg("GET /probe", objektEintrag, objektRoute, () => eigenschaftErsetzt),
    ).not.toEqual([]);
    // GEGENPROBE: ohne Überschreiben grün.
    const sauber = "class D { liste(sichtbar) { return kos.filter((k) => sichtbar(k)); } }";
    expect(pruefeDienstweg("GET /probe", probeEintrag(), route, () => sauber)).toEqual([]);
  });

  it("KALIBRIERUNG (Nacharbeit 5) — Objektparameter und Weitergabe zwischen Gliedern", () => {
    const objektEintrag: Eintrag = {
      ...probeEintrag(),
      kette: [
        {
          datei: "probe/dienst.ts",
          funktion: "liste",
          filter: { index: 0, eigenschaft: "sichtbar" },
        },
      ],
    };
    const objektDienst = "class D { liste(deps) { return kos.filter((k) => deps.sichtbar(k)); } }";
    const gut = probeRoute(
      "const basis = { a: 1 };\n" +
        "  reply.send(await dienst.liste({ ...basis, sichtbar: sichtbarkeitsfilterFuer(user) }));",
    );
    expect(pruefeDienstweg("GET /probe", objektEintrag, gut, () => objektDienst)).toEqual([]);
    // Ein nicht lesbarer Spread NACH der Eigenschaft könnte sie überschreiben: rot.
    const ueberschrieben = probeRoute(
      "reply.send(await dienst.liste({ sichtbar: sichtbarkeitsfilterFuer(user), ...fremd() }));",
    );
    expect(
      pruefeDienstweg("GET /probe", objektEintrag, ueberschrieben, () => objektDienst),
    ).not.toEqual([]);

    const zweiGlieder: Eintrag = {
      ...probeEintrag(),
      kette: [
        { datei: "probe/dienst.ts", funktion: "liste", filter: { index: 0 } },
        { datei: "probe/dienst.ts", funktion: "innen", filter: { index: 1 } },
      ],
    };
    const route = probeRoute("reply.send(await dienst.liste(sichtbarkeitsfilterFuer(user)));");
    const weitergereicht =
      "class D { liste(sichtbar) { return this.innen(kos, sichtbar); }\n" +
      "  innen(kos, s) { return kos.filter((k) => s(k)); } }";
    expect(pruefeDienstweg("GET /probe", zweiGlieder, route, () => weitergereicht)).toEqual([]);
    const unterwegsErsetzt =
      "class D { liste(sichtbar) { return this.innen(kos, () => true); }\n" +
      "  innen(kos, s) { return kos.filter((k) => s(k)); } }";
    expect(pruefeDienstweg("GET /probe", zweiGlieder, route, () => unterwegsErsetzt)).not.toEqual(
      [],
    );
  });

  it("KALIBRIERUNG (Nacharbeit 3) — eine Vertraulichkeitsregel allein ist rot, auch wenn sie greift", () => {
    const nurStufe: Eintrag = {
      urteil: "DIENST_FILTERT",
      kette: [{ datei: "probe/dienst.ts", funktion: "liste" }],
      entscheidung: "isConfidential",
      grund: "Probe.",
    };
    const fund = {
      datei: "probe-routes.ts",
      zeile: 7,
      aufrufe: new Set(["liste"]),
      aufrufText: "",
    };
    const mitStufe = "class D { liste() { return kos.filter((k) => !isConfidential(k.c)); } }";
    expect(pruefeDienstweg("GET /probe", nurStufe, fund, () => mitStufe).join("\n")).toContain(
      "nicht die zentrale Sichtbarkeitsentscheidung",
    );
  });

  it("KALIBRIERUNG (Nacharbeit 3) — ein nie aufgerufener Rumpf schützt nicht (Dienstkette)", () => {
    // Befund ben, wörtlich: die Entscheidung steht in einem lokalen Helfer, der nie läuft.
    const eintrag = probeEintrag();
    const fund = probeRoute("reply.send(await dienst.liste(sichtbarkeitsfilterFuer(user)));");
    const unbenutzt =
      "class D { liste(sichtbar) { const unbenutzt = () => sichtbar(ko); return kos; } }";
    expect(pruefeDienstweg("GET /probe", eintrag, fund, () => unbenutzt)).not.toEqual([]);
    // GEGENPROBE: derselbe Helfer, aufgerufen bzw. als Rückruf an filter gereicht, schützt.
    const aufgerufen =
      "class D { liste(sichtbar) { const pruefe = (k) => sichtbar(k); return kos.filter(pruefe); } }";
    expect(pruefeDienstweg("GET /probe", eintrag, fund, () => aufgerufen)).toEqual([]);
  });

  it("KALIBRIERUNG — nur ein AUFRUF des Prädikats zählt, keine blosse Namensnennung", () => {
    const erwaehnt = erhebeDatei(
      "erwaehnt.ts",
      'app.get("/api/x", async (request, reply) => { void darfSehen; reply.send(geheim); });',
    );
    expect(erwaehnt.funde[0]?.praedikatImAufruf, "`void darfSehen` ist kein Schutz").toBe(false);

    // NACHARBEIT 3 (Befund ben): ein IM HANDLER definierter, nie aufgerufener Helfer schützt nicht.
    const unbenutzterHelfer = erhebeDatei(
      "unbenutzt.ts",
      'app.get("/api/x", async (request, reply) => {\n' +
        "  const unbenutzt = () => darfSehen(user, ko);\n  reply.send(geheim);\n});",
    );
    expect(
      unbenutzterHelfer.funde[0]?.praedikatImAufruf,
      "ein nie aufgerufener Rumpf im Handler ist kein Schutz",
    ).toBe(false);
    // GEGENPROBE: derselbe Helfer, aufgerufen, schützt.
    const aufgerufenerHelfer = erhebeDatei(
      "aufgerufen.ts",
      'app.get("/api/x", async (request, reply) => {\n' +
        "  const pruefe = () => darfSehen(user, ko);\n  if (pruefe()) { reply.send(ko); }\n});",
    );
    expect(aufgerufenerHelfer.funde[0]?.praedikatImAufruf).toBe(true);

    const helferNurGenannt = erhebeDatei(
      "helfer-genannt.ts",
      "const schuetze = (u, k) => darfSehen(u, k);\n" +
        'app.get("/api/x", async (request, reply) => { void schuetze; reply.send(geheim); });',
    );
    expect(
      helferNurGenannt.funde[0]?.praedikatImAufruf,
      "ein nur genannter Helfer schützt nicht",
    ).toBe(false);

    const helferAlsRueckruf = erhebeDatei(
      "helfer-rueckruf.ts",
      "const schuetze = (k) => darfSehen(user, k);\n" +
        'app.get("/api/x", async (request, reply) => { reply.send(alle.filter(schuetze)); });',
    );
    expect(helferAlsRueckruf.funde[0]?.praedikatImAufruf, "Rückruf an filter wird gerufen").toBe(
      true,
    );
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
      aufrufe: new Set(),
      aufrufText: "",
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
describe("R-1175 · Nacharbeit 9: Ausgänge ausserhalb der Routen", () => {
  it("jede Ausgangsstelle in services/** trägt ein EIGENES Urteil — eine neue ist rot", () => {
    const ohneUrteil = unbeurteilteStellen(AUSGANGSSTELLEN, AUSGAENGE);
    expect(
      ohneUrteil,
      `Diese Stellen sprechen nach außen und sind nicht beurteilt:\n${ohneUrteil.join("\n")}`,
    ).toEqual([]);
  });

  it("kein verwaistes Ausgangsurteil, und die Erhebung ist nicht geschrumpft", () => {
    expect(verwaisteUrteile(AUSGANGSSTELLEN, AUSGAENGE)).toEqual([]);
    expect(new Set(AUSGANGSSTELLEN.map((s) => s.datei)).size).toBeGreaterThanOrEqual(
      MINDESTZAHL_AUSGANGSDATEIEN,
    );
    expect(AUSGANGSSTELLEN.length).toBeGreaterThanOrEqual(MINDESTZAHL_AUSGANGSSTELLEN);
  });

  it("SCHUTZ_VOR_VERSAND ist bis zur zentralen Entscheidung nachgegangen (Webhook-Melder)", () => {
    const geschuetzt = mitSchluessel(AUSGANGSSTELLEN).filter(
      ({ schluessel }) => AUSGAENGE[schluessel]?.urteil === "SCHUTZ_VOR_VERSAND",
    );
    const maengel = geschuetzt.flatMap(({ stelle, schluessel }) => {
      const e = AUSGAENGE[schluessel];
      return e ? pruefeVersandschutz(stelle, e, LIES_AUS_DEM_BAUM) : [];
    });
    expect(maengel).toEqual([]);
    // Der Webhook-Melder MUSS dabei sein — sonst prüfte dieser Fall nichts.
    expect(geschuetzt.map(({ schluessel }) => schluessel)).toContain(
      "services/app/src/wissensereignisse.ts::fetchZusteller#1",
    );
  });

  it("KALIBRIERUNG (Nacharbeit 10) — eine weitere Stelle in einer beurteilten Datei braucht ihr eigenes Urteil", () => {
    const datei = "probe/mail.ts";
    const urteile: Record<string, Ausgangseintrag> = {
      "probe/mail.ts::send#1": { urteil: "KEIN_KO_INHALT", grund: "Probe." },
    };
    const einzeln = "export function send(t) { t.sendMail({}); }";
    expect(unbeurteilteStellen(erhebeAusgaenge(datei, einzeln), urteile)).toEqual([]);
    expect(verwaisteUrteile(erhebeAusgaenge(datei, einzeln), urteile)).toEqual([]);
    // Ein zusätzliches fetch in DERSELBEN Funktion erbt das Urteil nicht: rot mit Datei und Zeile.
    const gleicheFunktion = "export function send(t) {\n  t.sendMail({});\n  fetch(t.url);\n}";
    expect(unbeurteilteStellen(erhebeAusgaenge(datei, gleicheFunktion), urteile)).toEqual([
      "probe/mail.ts:3 — Ausgangsstelle probe/mail.ts::send#2 ohne eigenes Urteil",
    ]);
    // … und in einer ANDEREN Funktion derselben Datei ebenso.
    const andereFunktion = `${einzeln}\nexport function heimlich(u) { fetch(u); }`;
    expect(unbeurteilteStellen(erhebeAusgaenge(datei, andereFunktion), urteile)).toEqual([
      "probe/mail.ts:2 — Ausgangsstelle probe/mail.ts::heimlich#1 ohne eigenes Urteil",
    ]);
    // Ein Urteil, dessen Stelle verschwunden ist, ist verwaist.
    expect(verwaisteUrteile(erhebeAusgaenge(datei, "export const a = 1;"), urteile)).toEqual([
      "probe/mail.ts::send#1",
    ]);
  });

  it("KALIBRIERUNG — die Ausgangserhebung erkennt die Bauformen und nur sie", () => {
    const quelle = [
      'import { request as r } from "node:https";',
      'import type { IncomingMessage } from "node:http";',
      'export function a() { r("x"); }',
      'const b = () => fetch("u");',
      "transport.sendMail({});",
      'new WebSocket("w");',
      'globalThis.fetch("u");',
      'adapter.fetchItem("id");',
      "net.isIP('1');",
    ].join("\n");
    const stellen = erhebeAusgaenge("probe/ausgang.ts", quelle);
    expect(stellen.map((s) => s.zeile)).toEqual([3, 4, 5, 6, 7]);
    expect(stellen.map((s) => s.funktion).slice(0, 2)).toEqual(["a", "b"]);
  });

  it("KALIBRIERUNG — Versandschutz: grün nur mit Wächter vor jedem Versand und zentraler Kette", () => {
    const datei = "probe/melder.ts";
    const NOCH_OK = "if (!meldbar(m)) { return false; } return true;";
    const bau = (
      versand: string,
      extra = "",
      meldbar = "darfSehen(B, ko)",
      nochOk = NOCH_OK,
    ): string =>
      [
        `function meldbar(ko) { return ${meldbar}; }`,
        "export const sender = async (a) => { await fetch(a.url); };",
        "class M {",
        "  constructor(d) { this.zusteller = d.z ?? sender; }",
        `  async nochOk(m) { ${nochOk} }`,
        `  async versende() {\n    for (const e of this.q) {\n${versand}\n    }\n  }`,
        `  ${extra}`,
        "}",
      ].join("\n");
    const mitWaechter =
      "      if (!(await this.nochOk(e))) { continue; }\n      await this.zusteller(e);";
    const eintrag: Ausgangseintrag = {
      urteil: "SCHUTZ_VOR_VERSAND",
      verbindung: "zusteller",
      versand: "versende",
      waechter: "nochOk",
      kette: [
        { datei, funktion: "nochOk" },
        { datei, funktion: "meldbar" },
      ],
      entscheidung: "darfSehen",
      grund: "Probe.",
    };
    const pruefe = (text: string): string[] =>
      erhebeAusgaenge(datei, text).flatMap((s) => pruefeVersandschutz(s, eintrag, () => text));

    expect(erhebeAusgaenge(datei, bau(mitWaechter)).map((s) => s.funktion)).toEqual(["sender"]);
    expect(pruefe(bau(mitWaechter))).toEqual([]);
    // Ohne Wächter: rot.
    expect(pruefe(bau("      await this.zusteller(e);"))).not.toEqual([]);
    // Wächter NACH dem Versand: rot.
    const danach =
      "      await this.zusteller(e);\n      if (!(await this.nochOk(e))) { continue; }";
    expect(pruefe(bau(danach))).not.toEqual([]);
    // Ein Weg an der Verbindung vorbei (direkter Aufruf der Ausgangsfunktion): rot.
    expect(pruefe(bau(mitWaechter, "async direkt(x) { await sender(x); }"))).not.toEqual([]);
    // Ein zweiter Versand über die Verbindung ausserhalb der Versandfunktion: rot.
    expect(pruefe(bau(mitWaechter, "async heimlich(x) { await this.zusteller(x); }"))).not.toEqual(
      [],
    );
    // Der Wächter ruft die zentrale Entscheidung nicht: rot.
    expect(pruefe(bau(mitWaechter, "", "!ko.deletedAt"))).not.toEqual([]);
  });

  it("KALIBRIERUNG (Nacharbeit 10) — eine verweigerte Entscheidung muss den Versand verhindern", () => {
    const datei = "probe/melder.ts";
    const bau = (versand: string, nochOk: string, meldbar: string): string =>
      [
        `function meldbar(ko) { ${meldbar} }`,
        "export const sender = async (a) => { await fetch(a.url); };",
        "class M {",
        "  constructor(d) { this.zusteller = d.z ?? sender; }",
        `  async nochOk(m) { ${nochOk} }`,
        `  async versende() {\n    for (const e of this.q) {\n${versand}\n    }\n  }`,
        "}",
      ].join("\n");
    const eintrag: Ausgangseintrag = {
      urteil: "SCHUTZ_VOR_VERSAND",
      verbindung: "zusteller",
      versand: "versende",
      waechter: "nochOk",
      kette: [
        { datei, funktion: "nochOk" },
        { datei, funktion: "meldbar" },
      ],
      entscheidung: "darfSehen",
      grund: "Probe.",
    };
    const pruefe = (versand: string, nochOk: string, meldbar: string): string[] => {
      const text = bau(versand, nochOk, meldbar);
      return erhebeAusgaenge(datei, text).flatMap((s) =>
        pruefeVersandschutz(s, eintrag, () => text),
      );
    };
    const VERSAND = "      await this.zusteller(e);";
    const RECHT = "      if (!(await this.nochOk(e))) { continue; }";
    const NOCH_OK = "for (const id of m.ids) { if (!meldbar(id)) { return false; } } return true;";
    const MELDBAR = "return ko !== undefined && !ko.deletedAt && darfSehen(B, ko);";

    // Die Bauform des Bestands: grün.
    expect(pruefe(`${RECHT}\n${VERSAND}`, NOCH_OK, MELDBAR)).toEqual([]);
    // Bens Fall: die Bedingung ist umgekehrt — versendet, wenn die Entscheidung verweigert. Rot.
    const umgekehrt = "      if (await this.nochOk(e)) { continue; }";
    expect(pruefe(`${umgekehrt}\n${VERSAND}`, NOCH_OK, MELDBAR)).toEqual([
      `${datei}:9 — Versand über zusteller ohne vorherige Abbruchprüfung durch nochOk.`,
    ]);
    // Der Wächter steht in der Bedingung, entscheidet sie aber nicht (`&&`): rot.
    const nurTeil = "      if (!(await this.nochOk(e)) && e.eilig) { continue; }";
    expect(pruefe(`${nurTeil}\n${VERSAND}`, NOCH_OK, MELDBAR)).not.toEqual([]);
    // Nicht auflösbar (das Ergebnis läuft über eine Variable): rot.
    const ueberVariable = "      const ok = await this.nochOk(e);\n      if (!ok) { continue; }";
    expect(pruefe(`${ueberVariable}\n${VERSAND}`, NOCH_OK, MELDBAR)).not.toEqual([]);
    // Eine weitere `||`-Bedingung neben der verneinten Entscheidung bricht ebenfalls ab: grün.
    const oder = "      if (e.gesperrt || !(await this.nochOk(e))) { continue; }";
    expect(pruefe(`${oder}\n${VERSAND}`, NOCH_OK, MELDBAR)).toEqual([]);
    // Der Wächter gibt bei Verweigerung WAHR zurück: rot mit Datei und Zeile des Glieds.
    const nochOkUmgekehrt = "if (meldbar(m)) { return false; } return true;";
    expect(pruefe(`${RECHT}\n${VERSAND}`, nochOkUmgekehrt, MELDBAR)).toEqual([
      `${datei}:5 — nochOk bricht nicht mit einem Falschwert ab, wenn meldbar verweigert.`,
    ]);
    // Der Wächter ignoriert das Ergebnis: rot.
    const nochOkIgnoriert = "meldbar(m); return true;";
    expect(pruefe(`${RECHT}\n${VERSAND}`, nochOkIgnoriert, MELDBAR)).not.toEqual([]);
    // Die Sperre steht nur unter einer Nebenbedingung: rot.
    const nochOkBedingt = "if (m.pruefen) { if (!meldbar(m)) { return false; } } return true;";
    expect(pruefe(`${RECHT}\n${VERSAND}`, nochOkBedingt, MELDBAR)).not.toEqual([]);
    // Vor der Sperre wird schon WAHR zurückgegeben: rot.
    const nochOkVorab =
      "if (m.alt) { return true; } if (!meldbar(m)) { return false; } return true;";
    expect(pruefe(`${RECHT}\n${VERSAND}`, nochOkVorab, MELDBAR)).not.toEqual([]);
    // Die Entscheidung wird verneint weitergegeben (`return !darfSehen`): rot mit Datei und Zeile.
    expect(pruefe(`${RECHT}\n${VERSAND}`, NOCH_OK, "return !darfSehen(B, ko);")).toEqual([
      `${datei}:1 — meldbar bricht nicht mit einem Falschwert ab, wenn darfSehen verweigert.`,
    ]);
    // `||` statt `&&` lässt eine Verweigerung durch: rot.
    const oderDurch = "return ko.oeffentlich || darfSehen(B, ko);";
    expect(pruefe(`${RECHT}\n${VERSAND}`, NOCH_OK, oderDurch)).not.toEqual([]);
  });
});

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
