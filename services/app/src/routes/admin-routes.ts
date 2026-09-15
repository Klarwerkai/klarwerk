import type { Dirent } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyPluginAsync } from "fastify";
import type { AuditService } from "../../../audit";
import { type ExampleLoadServices, examplePackage, loadExamplePackage } from "../example-packages";
// JOB 3277: der paketbezogene Weg (wählen · laden · zurücksetzen · entfernen) — additiv neben
// WP-B6, siehe Kopf von example-packages/demo-pakete.ts.
import {
  type DemoPackageServices,
  demoPackage,
  demoPaketUebersicht,
  demoPaketVorschau,
  entferneDemoPaket,
  ladeDemoPaket,
} from "../example-packages/demo-pakete";
import { type FactoryReset, factoryResetUnavailable } from "../factory-reset";
// AUFTRAG-mega64 Block A: der Betriebsschalter für das Demodaten-Laden — dieselbe eine Wahrheit,
// aus der auch GET /api/features antwortet (mega46 F).
import { schalterAn } from "../feature-flags";
import type { Guards } from "../http";
import { type DemoSeedServices, purgeDemoSeed, seedDemoForAdmin } from "../seed-demo";
// SCRUM-501 (nacht24): Demo-/Simulationskorpus DE/EN/NL — NICHT automatisch, nur über diesen
// Admin-Weg (bzw. tools/seed-sim-corpus); Entfernen über den bestehenden Demo-Purge (demoSeed).
import { loadSimCorpus } from "../sim-corpus";

// ==================================================================================================
// JOB 4025 · KUNDENBETRIEB-BACKUP TEIL 2 — DIE SICHERUNG BEKOMMT EINE AUSKUNFT.
// ==================================================================================================
//
// Ein Beta-Kunde betreibt KLARWERK auf eigener Infrastruktur. Sein Backup läuft per Cron oder von
// Hand über `scripts/backup/backup.sh` — und bis hierher konnte NIEMAND in der Anwendung nachsehen,
// ob es je gelaufen ist. Drei Messungen am Stand `b0315de` belegten die Lücke: keine Route, kein
// Client-Endpunkt, keine Zeile im Reiter „System".
//
// DIESE ROUTE ERFINDET KEINEN ZWEITEN VERTRAG, sie LIEST den, den `backup.sh` schreibt:
//
//   :34-36  `WURZEL="$(cd "$(dirname "$0")/../.." && pwd)"` · `DEST="${1:-${BACKUP_DIR:-$WURZEL/backups}}"`
//   :39-40  `STAMP="$(date -u +%Y%m%dT%H%M%SZ)"` · `OUT="$DEST/klarwerk-${STAMP}.dump"`
//   :413    `printf '%s_%02d.dump' "$BASISNAME" "$versuch"` — zwei Läufe in DERSELBEN SEKUNDE, und
//           die zweite heißt `klarwerk-<STAMP>_02.dump` (JOB 4057, seit `1.0.0-beta.1.518` LIVE).
//           Bis JOB 4109 kannte der Parser diese Form nicht: die JÜNGSTE Sicherung stand undatiert
//           ganz unten, und der Betreiber las oben ein Datum von gestern.
//   :82     Sidecar wie `shasum -a 256`: 64 Hex, ZWEI Leerzeichen, DER ENDNAME
//   :55-57  „Sidecar zuerst, Dump zuletzt" — ein `*.dump` OHNE Sidecar ist kein regulär
//           entstandenes Backup dieses Skripts
//   :62-63  Arbeitsstände heißen `*.dump.partial` und sind KEINE Sicherungen
//
// Das Skript selbst bleibt unverändert (Auftrag §10). Geschrieben wird hier nichts: kein Löschen,
// kein Auslösen, kein Herunterladen — eine reine Auskunft, und zwar ausschließlich lokal.
//
// FAIL-CLOSED (Lehre JOB 3948 R1): `beglaubigt` wird NUR wahr, wenn die Sidecar-Datei WIRKLICH
// gelesen wurde und ihre Zeile die Form trägt UND auf genau diesen Endnamen lautet. Fehlend, leer,
// unlesbar oder auf einen fremden Namen lautend heißt `false` — „unbekannt" wird nie zu „in Ordnung".
//
// UND DIE GRENZE DIESER AUSSAGE, SEIT RUNDE 6 AUSGESCHRIEBEN (Prüferbefund Runde 5): geprüft wird
// die SIDECAR, nie der Dump. Diese Route öffnet die Sicherungsdatei nicht, bildet keinen Hash und
// vergleicht nichts — eine formgerechte Sidecar mit falschem Hash ergibt `beglaubigt: true`
// (festgehalten in `tests/kundenbetrieb-sicherung/sicherungen-auskunft.test.ts`, S9).
//
// WARUM NICHT WIRKLICH VERGLICHEN: die Auskunft listet ALLE Dumps des Verzeichnisses, und ein Dump
// ist ein vollständiger Datenbankabzug. Ein Abgleich läse bei jedem Aufruf jede dieser Dateien
// vollständig — die Zeile im Reiter „System" fragt schon beim Öffnen des Reiters, die Karte frischt
// auf. Aus einer Auskunft würde damit ein Lastwerkzeug gegen die eigene Anlage. Der Abgleich gehört
// dorthin, wo eine Entscheidung an ihm hängt: in den Restore-Drill (JOB 4010). Was hier NICHT
// gemessen wird, behauptet deshalb auch die Fläche nicht — sie sagt „Prüfsummendatei vorhanden".

/** Ein Eintrag der Auskunft. Was nicht bekannt ist, steht als `null` — nie als 0 und nie als "". */
interface SicherungsEintrag {
  datei: string;
  zeitpunktUtc: string | null;
  groesseBytes: number | null;
  beglaubigt: boolean;
  pruefsumme: string | null;
  /**
   * JOB 4109 — die wievielte Sicherung DIESER SEKUNDE der Name bezeichnet.
   *
   * `1` beim Grundnamen, `NN` beim Suffixnamen `_NN`, und `null`, wenn der Name keinen gültigen
   * Stempel trägt: über eine Reihenfolge innerhalb einer Sekunde ist dann NICHTS bekannt, und
   * Unbekanntes wird nie zu „1" — dieselbe Regel, die `groesseBytes: null` schon trägt.
   *
   * Es ist ein EIGENES FELD, keine Ableitung in der Fläche: wer die Nummer dort aus dem Dateinamen
   * nachparste, legte eine zweite Auslegung derselben Namensregel an, und zwei Auslegungen driften.
   */
  folgeNummer: number | null;
}

/**
 * Die Wurzel wird aus dem MODULPFAD abgeleitet, nicht aus `process.cwd()` — dieselbe Entscheidung
 * und derselbe Grund wie in `backup.sh:27-33` (CWD-Vertrag, JOB 943): wer den Server aus einem
 * anderen Verzeichnis startet, bekäme sonst eine Auskunft über ein ganz anderes Verzeichnis und
 * glaubte, ein Backup zu haben. Vier Ebenen: `routes` → `src` → `app` → `services` → Wurzel.
 */
const REPO_WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

/** Dieselbe Auflösung wie `backup.sh:34-36`; eine leere Variable gilt wie eine ungesetzte (`${VAR:-…}`). */
function sicherungsVerzeichnis(): string {
  const gesetzt = process.env.BACKUP_DIR;
  return gesetzt !== undefined && gesetzt !== ""
    ? resolve(gesetzt)
    : resolve(join(REPO_WURZEL, "backups"));
}

/**
 * DER NAME, DEN `backup.sh` WIRKLICH SCHREIBT — beide Formen, aus EINEM Muster gelesen.
 *
 * `:39-40` `STAMP="$(date -u +%Y%m%dT%H%M%SZ)"` · `OUT="$DEST/klarwerk-${STAMP}.dump"` — der
 * Grundname. UND SEIT JOB 4057 zusätzlich `:413` `kandidat="$(printf '%s_%02d.dump' "$BASISNAME"
 * "$versuch")"`: laufen zwei Sicherungen in DERSELBEN SEKUNDE, weicht die zweite auf
 * `klarwerk-<STAMP>_02.dump` aus, die dritte auf `_03` — „die Nummer zaehlt weiter und wird nie
 * wiederverwendet" (`:419`). Genau ZWEI Ziffern, weil `%02d` genau zwei schreibt und `:389` die
 * vergebenen Nummern als `_[0-9][0-9]` wieder einsammelt.
 *
 * Die Gruppe `_NN` ist deshalb OPTIONAL und sonst nichts weiter geöffnet: `_2`, `_002`, `_ab` oder
 * Text vor/hinter dem Namen kann dieses Skript nicht erzeugen und bleibt unparsbar.
 */
const SICHERUNGSNAME = /^klarwerk-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z(?:_(\d{2}))?\.dump$/;

/** `klarwerk-20260914T093000Z.dump` → ISO-Zeitpunkt. Nicht parsebar oder kein echtes Datum → `null`. */
function zeitpunktAusName(datei: string): string | null {
  const treffer = SICHERUNGSNAME.exec(datei);
  if (!treffer) {
    return null;
  }
  const [, jahr, monat, tag, stunde, minute, sekunde] = treffer;
  const iso = `${jahr}-${monat}-${tag}T${stunde}:${minute}:${sekunde}.000Z`;
  const zeit = new Date(iso);
  // `new Date("2026-02-31T…")` liefert den 3. März. Ein Datum, das es nicht gibt, wird NICHT auf
  // einen anderen Tag gebogen — dann ist der Name eben nicht parsebar.
  return Number.isNaN(zeit.getTime()) || zeit.toISOString() !== iso ? null : iso;
}

/**
 * Die wievielte Sicherung dieser Sekunde — aus DEMSELBEN Muster wie der Zeitpunkt.
 *
 * Sie hängt ausdrücklich am Zeitpunkt: trägt der Name keinen gültigen Stempel, ist über seine Stelle
 * innerhalb einer Sekunde nichts bekannt, und `null` ist die ehrliche Antwort. Ohne Suffix ist es
 * die erste dieser Sekunde (`backup.sh:426-427`: der Grundname ist die Nummer 1).
 */
function folgeNummerAusName(datei: string): number | null {
  if (zeitpunktAusName(datei) === null) {
    return null;
  }
  const treffer = SICHERUNGSNAME.exec(datei);
  const suffix = treffer?.[7];
  // Dezimal lesen, wie `backup.sh:392` es mit `$((10#$nummer))` tut — `_08` darf nicht oktal werden.
  return suffix === undefined ? 1 : Number.parseInt(suffix, 10);
}

/** Die Prüfsumme aus der Sidecar — nur, wenn Form UND Endname stimmen. Sonst `null` (fail-closed). */
async function pruefsummeAus(ort: string, datei: string): Promise<string | null> {
  let roh: string;
  try {
    roh = await readFile(join(ort, `${datei}.sha256`), "utf8");
  } catch {
    return null;
  }
  // `backup.sh:82` schreibt GENAU eine Zeile: 64 Hex, zwei Leerzeichen, der Endname.
  const zeile = roh.split("\n")[0] ?? "";
  const treffer = /^([0-9a-fA-F]{64}) {2}(.+)$/.exec(zeile);
  if (!treffer || treffer[2] !== datei) {
    return null;
  }
  return (treffer[1] ?? "").toLowerCase();
}

/** Ein Verzeichniseintrag wird zum Befund — was nicht lesbar ist, bleibt `null`. */
async function befundFuer(ort: string, datei: string): Promise<SicherungsEintrag> {
  let groesseBytes: number | null = null;
  try {
    groesseBytes = (await stat(join(ort, datei))).size;
  } catch {
    // Ein Verweis ins Leere oder eine Datei, die zwischen Auflistung und Messung verschwand: eine
    // `0` wäre hier eine Behauptung über etwas, das niemand gelesen hat.
    groesseBytes = null;
  }
  const pruefsumme = await pruefsummeAus(ort, datei);
  return {
    datei,
    zeitpunktUtc: zeitpunktAusName(datei),
    groesseBytes,
    beglaubigt: pruefsumme !== null,
    pruefsumme,
    folgeNummer: folgeNummerAusName(datei),
  };
}

// SCRUM-181: admin-geschützte Aktion, um eine LEERE Instanz mit Demodaten sichtbar zu machen.
// Kein Auto-Seed, kein anonymer Zugriff. Idempotent über den Empty-Guard im Seed selbst.
// Pedi 05.07.: zusätzlich der Werksreset (Factory-Settings) — nur im Desktop/Dev-Modus verfügbar.
export function adminRoutes(
  // WP-B6: die Beispielpaket-Route braucht zusätzlich das (optionale) Audit — build-app reicht die
  // vollen AppServices, die das strukturell erfüllen; direkte Test-Aufrufer bleiben kompatibel.
  services: DemoSeedServices & { audit?: AuditService },
  guards: Guards,
  factoryReset: FactoryReset = factoryResetUnavailable,
): FastifyPluginAsync {
  return async (app) => {
    // ==========================================================================================
    // AUFTRAG-mega64 BLOCK A — DAS TOR VOR DEM EINZIGEN WEG, DER KONTEN ANLEGT.
    // ==========================================================================================
    //
    // Bis mega64 war diese Route in JEDER App registriert, mit `users.manage` als einziger Hürde,
    // und legte freigegebene Controller-/Expertenkonten mit im Quelltext festgeschriebenen
    // Kennwörtern an (Befund ben, BERICHT-ben-sammel61-mega63.md, Finding 1). Ohne gesetzten
    // Schalter EXISTIERT sie ab hier nicht — kein 403 mit erklärender Nachricht, sondern 404, wie
    // der Confluence-Import und die Herkunftskette es in build-app.ts längst vormachen.
    //
    // WARUM DAS TOR HIER STEHT UND NICHT IN build-app.ts BEI DEN ANDEREN ZWEIEN: Diese Datei führt
    // nicht nur den Lade-Weg, sondern auch den ENTFERNEN-Weg (DELETE, Demo-Purge), den lesenden
    // Stand (GET) und den Werksreset. Ein Tor um das ganze Plugin nähme dem Betrieb genau das
    // Werkzeug, mit dem er vorhandene Demodaten wieder loswird — die Sperre würde den Bestand
    // einschließen, statt die Quelle zu schließen. Gesperrt wird deshalb ausschließlich das
    // ANLEGEN.
    //
    // Der Schalter hat ausdrücklich Vorgabe AUS (Begründung am Registry-Eintrag in
    // feature-flags.ts) — er ist keine Notausschalter-Pflichtfläche, sondern eine Vorführhilfe.
    if (schalterAn("demodaten")) {
      app.post("/api/admin/demo-seed", async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        // Pedi 05.07. (Beta): `force` lädt das Demo-Set auch bei bereits erfassten Daten (erst wird
        // nur das vorhandene Demo-Set aufgeräumt, echte Daten bleiben). Ohne `force` unverändert.
        // SCRUM-487: `locale` (DE/EN/NL) steuert die Sprache der Demo-Inhalte — das Frontend sendet
        // die aktuelle UI-Sprache des ladenden Admins; unbekannt/leer → Default "de".
        const body = (request.body ?? {}) as { force?: unknown; locale?: unknown };
        const force = body.force === true;
        const locale = body.locale === "en" ? "en" : body.locale === "nl" ? "nl" : ("de" as const);
        const result = await seedDemoForAdmin(services, user.id, { force, locale });
        // Ehrliche Rückgabe: seeded vs. skipped (Instanz nicht leer) inkl. Kennzahlen.
        //
        // AUFTRAG-mega64 Block A: `einmalkennwoerter` trägt die FRISCH ERZEUGTEN Zugangsdaten der
        // neu angelegten Demo-Konten. Sie stehen NUR hier, in der Antwort auf genau diesen Aufruf —
        // nirgends im Quelltext, nirgends in einem Protokoll. Fastify protokolliert Antwortkörper
        // nicht; wer hier künftig ein `request.log.info(result)` einfügt, macht aus der Antwort
        // einen Logeintrag und hebt die ganze Maßnahme auf.
        reply.code(200).send(result);
      });
    }

    // AUFTRAG-mega14 Block H (SCRUM-437): LESENDER Status der Demodaten für die Bereitschafts-
    // Checkliste. Bis mega14 gab es zu Demodaten nur POST (laden) und DELETE (entfernen) — die
    // Oberfläche konnte gar nicht wissen, ob gerade welche geladen sind, und die Checkliste hatte
    // deshalb keine Zeile dafür.
    //
    // Dieselbe Wahrheit, die `seedDemoForAdmin` selbst benutzt (`seed-demo.ts:150`): der
    // `demoSeed`-Merker am Wissensobjekt. Kein zweiter Zähler, keine zweite Definition — und
    // ausdrücklich KEIN zweiter Lade-/Entfernen-Weg.
    app.get("/api/admin/demo-seed", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const kos = await services.ko.list();
      const count = kos.filter((k) => k.demoSeed === true).length;
      reply.code(200).send({ present: count > 0, count });
    });

    // SCRUM-501 (nacht24 Paket 7.2): Simulationskorpus DE/EN/NL laden (~30 Industrie-KOs je
    // Sprache, inkl. gewollter Cross-Sprach-Duplikate/-Konflikte). Idempotent über das
    // sim-korpus-Tag; alle Einträge tragen demoSeed → Entfernen über den Demo-Purge unten.
    app.post("/api/admin/sim-corpus", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await loadSimCorpus(services, user.id));
    });

    // Pedi 02.07.: Demodaten KOMPLETT entfernen — auch wenn Tester sie verändert haben
    // (der demoSeed-Merker überlebt Bearbeitungen). Nur Admin; ehrliche Zähler-Rückgabe.
    app.delete("/api/admin/demo-seed", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await purgeDemoSeed(services, user.id));
    });

    // WP-B6 (Pedis Wunsch für die VIP-2-Tester): EIN kuratiertes Beispielpaket laden — gezielte
    // kleine Szenarien statt Datenberg. Läuft über die bestehenden Anlege-Wege (KoService.create,
    // wie der Demo-Seed: Beispiel-KOs entstehen direkt als KO); idempotent über den
    // Beispiel-Herkunfts-Anker (zweites Laden dupliziert nichts). Ehrliche Bilanz + Audit.
    app.post<{ Body: { package?: unknown } }>(
      "/api/admin/examples/load",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        const pkg = examplePackage(String(request.body?.package ?? ""));
        if (!pkg) {
          reply.code(400).send({
            error: "UNKNOWN_PACKAGE",
            message: "Unbekanntes Beispielpaket.",
          });
          return;
        }
        const deps: ExampleLoadServices = {
          ko: services.ko,
          objects: services.objects,
          // WP-SAMMEL21-FIX (bens Fix 1): echte Konflikt-Anlage für das konflikte-Paket.
          conflicts: services.conflicts,
          ...(services.audit ? { audit: services.audit } : {}),
        };
        reply.code(200).send(await loadExamplePackage(deps, pkg, user.id));
      },
    );

    // ==========================================================================================
    // JOB 3277 — DEMOPAKETE: DER PAKETBEZOGENE WEG NEBEN DEM GESAMT-PURGE.
    // ==========================================================================================
    //
    // Vor der Vorführung wählt der Betrieb EIN Paket, liest Beschreibung und Umfang, lädt es,
    // führt vor und setzt danach GENAU DIESES Paket zurück oder entfernt es. Der bestehende
    // Gesamt-Purge (DELETE /api/admin/demo-seed) bleibt zeichengleich und nimmt das Paket weiter
    // mit (die Bausteine tragen `demoSeed`); neu ist, dass es auch EINZELN geht.
    //
    // DER SCHUTZ IST DERSELBE wie an jeder Route dieser Datei: `users.manage`. Vier Wege, vier
    // Prüfungen — keine Route ohne Guard, auch die lesende nicht (die Übersicht verrät den
    // Bestand einer Instanz).
    const demoPaketDienste = (): DemoPackageServices => ({
      ko: services.ko,
      validation: services.validation,
      conflicts: services.conflicts,
      overlaps: services.overlaps,
      ...(services.audit ? { audit: services.audit } : {}),
    });

    // LESEND: was es gibt, was es enthält, was davon gerade geladen bzw. bearbeitet ist.
    app.get("/api/admin/demo-packages", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await demoPaketUebersicht(services.ko));
    });

    // VORSCHAU: GENAU die Objekte, die der gewählte Handgriff anfassen würde — mit ihren IDs,
    // ihrer Art, ihrem Lauf und dem, was an ihnen abweicht. Sie steht VOR den beiden schreibenden
    // Handgriffen, weil ein Eingriff, dessen Umfang man erst hinterher sieht, kein Vorführwerkzeug
    // ist, sondern ein Risiko (Nachführung 08.09. 07:50).
    //
    // `aktion` IST PFLICHTBESTANDTEIL DER FRAGE, nicht eine Verzierung: Zurücksetzen stellt die
    // sechs Bausteine her, Entfernen löscht sie. Eine Vorschau ohne Aktion müsste sich für einen
    // der beiden Pläne entscheiden und wäre für den anderen falsch — in Runde 3 war sie das
    // (Bens Befund: „wird hergestellt (6)" unmittelbar vor der endgültigen Löschung). Ein
    // unbekannter Wert wird ABGEWIESEN und nicht still auf einen der beiden gedreht.
    app.get<{ Params: { id: string }; Querystring: { aktion?: string } }>(
      "/api/admin/demo-packages/:id/preview",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        const pkg = demoPackage(request.params.id);
        if (!pkg) {
          reply.code(404).send({ error: "UNKNOWN_PACKAGE", message: "Unbekanntes Demopaket." });
          return;
        }
        const aktion = request.query.aktion ?? "zuruecksetzen";
        if (aktion !== "zuruecksetzen" && aktion !== "entfernen") {
          reply.code(400).send({
            error: "UNKNOWN_ACTION",
            message: "Unbekannte Aktion — erlaubt sind zuruecksetzen und entfernen.",
          });
          return;
        }
        reply.code(200).send(await demoPaketVorschau(services.ko, pkg, aktion));
      },
    );

    // LADEN und ZURÜCKSETZEN unterscheiden sich in genau einer Entscheidung: ob ein bereits
    // vorhandener, BEARBEITETER Baustein angefasst wird. Das Laden fasst ihn nicht an (wiederholtes
    // Laden ändert nie still einen Text), das Zurücksetzen stellt den Ausgangstext wieder her.
    //
    // BEIDE ROUTEN STEHEN AUSGESCHRIEBEN DA — wörtlicher Pfad, eigene Rechteprüfung IM Rumpf —,
    // obwohl eine Schleife oder ein gemeinsamer Rumpf kürzer wäre. Der Grund ist gemessen, nicht
    // ästhetisch, und beide Sparfassungen sind daran gescheitert:
    //   · SCHLEIFE mit `/api/admin/demo-packages/:id/${pfad}`: der Lesewege-Sammler
    //     (`tests/security/mega74-lesewege-sammler.test.ts`) liest die Registrierungen aus dem
    //     Syntaxbaum und kann einen ZUSAMMENGESETZTEN Pfad nicht auflösen — beide Routen fehlten
    //     in beiden Sicherheitsregistern, also verdrahtet, aber unbeurteilt.
    //   · GEMEINSAMER RUMPF mit ausgelagerter `requirePermission`: das RBAC-Audit
    //     (`tests/security/route-guard-audit.test.ts`) liest den Rumpf der Registrierung und
    //     stufte beide Routen als ÖFFENTLICH ein. Sie waren geschützt — beweisbar war es nicht.
    // Geteilt wird deshalb, was ohne Beweislast geteilt werden kann: `ladeDemoPaket` selbst.
    app.post<{ Params: { id: string } }>(
      "/api/admin/demo-packages/:id/load",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        const pkg = demoPackage(request.params.id);
        if (!pkg) {
          reply.code(404).send({ error: "UNKNOWN_PACKAGE", message: "Unbekanntes Demopaket." });
          return;
        }
        reply.code(200).send(await ladeDemoPaket(demoPaketDienste(), pkg, user.id, "laden"));
      },
    );

    app.post<{ Params: { id: string } }>(
      "/api/admin/demo-packages/:id/reset",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        const pkg = demoPackage(request.params.id);
        if (!pkg) {
          reply.code(404).send({ error: "UNKNOWN_PACKAGE", message: "Unbekanntes Demopaket." });
          return;
        }
        reply
          .code(200)
          .send(await ladeDemoPaket(demoPaketDienste(), pkg, user.id, "zuruecksetzen"));
      },
    );

    // ENTFERNEN, paketbezogen: nur die Bausteine dieses Pakets und die Konflikte/Doppelungen, die
    // an ihnen hängen. Andere Demodaten und echte Nutzerdaten bleiben stehen.
    app.delete<{ Params: { id: string } }>(
      "/api/admin/demo-packages/:id",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        const pkg = demoPackage(request.params.id);
        if (!pkg) {
          reply.code(404).send({ error: "UNKNOWN_PACKAGE", message: "Unbekanntes Demopaket." });
          return;
        }
        reply.code(200).send(await entferneDemoPaket(demoPaketDienste(), pkg, user.id));
      },
    );

    // Pedi 05.07. (Beta): Verfügbarkeit des Werksresets. Die Oberfläche blendet den Knopf nur ein,
    // wenn er im aktuellen Betriebsmodus (Desktop/Dev-Journal) überhaupt möglich ist.
    app.get("/api/admin/factory-reset", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send({ available: factoryReset.available });
    });

    // Pedi 05.07. (Beta): Werksreset ausführen — ALLE lokalen Daten löschen und das Programm
    // beenden; der nächste Start beginnt mit der Ersteinrichtung (erster Anwender = Admin).
    // Nur im Desktop/Dev-Modus möglich (sonst 403), damit produktive Daten nie betroffen sind.
    app.post("/api/admin/factory-reset", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      if (!factoryReset.available) {
        reply.code(403).send({
          error: "FORBIDDEN",
          message:
            "Werksreset ist nur in der lokalen Desktop-Version möglich (nicht im Server-/Produktivbetrieb).",
        });
        return;
      }
      // SCRUM-450: Re-Authentifizierung. Der Werksreset löscht ALLE Daten unwiderruflich —
      // „angemeldet als Admin" allein reicht nicht, der Admin muss sein Passwort bestätigen.
      // So kann ein offener/übernommener Admin-Tab den Reset nicht ohne Passwort auslösen.
      const body = (request.body ?? {}) as { password?: unknown };
      const password = typeof body.password === "string" ? body.password : "";
      if (!password || !(await services.auth.verifyUserPassword(user.id, password))) {
        reply.code(401).send({
          error: "INVALID_PASSWORD",
          message: "Falsches Passwort. Der Werksreset wurde nicht ausgeführt.",
        });
        return;
      }
      // Erst antworten (damit die Oberfläche die Bestätigung erhält), dann Bestand löschen und
      // den Prozess beenden. Der Reset läuft bewusst NACH dem Flush der Antwort.
      reply.code(200).send({ ok: true });
      void factoryReset.run();
    });

    // ==========================================================================================
    // JOB 4025 — GET /api/admin/sicherungen: liegt hier eine Sicherung, und trägt sie ihr Zeugnis?
    // ==========================================================================================
    //
    // Bauform wörtlich wie die lesende Werksreset-Auskunft ein paar Zeilen höher: `requirePermission`
    // als erste Anweisung, bei `null` sofort zurück (dann hat der Guard bereits geantwortet — die
    // Verweigerung trägt deshalb weder `sicherungen` noch `verzeichnis`).
    //
    // DREI ZUSTÄNDE, und „unbekannt" sieht in KEINEM davon aus wie „keine":
    //   `gelesen`           Verzeichnis da und lesbar → `sicherungen: [...]`, auch leer
    //   `kein_verzeichnis`  das aufgelöste Verzeichnis existiert nicht → GAR KEIN Feld `sicherungen`
    //   `unlesbar`          existiert, war aber nicht lesbar → `grund` als KENNUNG (errno), kein Satz
    //
    // Der `grund` ist bewusst eine technische Kennung und kein Text: Sätze wohnen im Wörterbuch der
    // Oberfläche (drei Sprachen), und ein Fehlertext des Betriebssystems könnte Pfadinhalte fremder
    // Dateien tragen. Herausgereicht wird ausschließlich, was diese Route selbst gebildet hat.
    app.get("/api/admin/sicherungen", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const verzeichnis = sicherungsVerzeichnis();
      const gelesenUtc = new Date().toISOString();

      // `Dirent<string>`, nicht `Awaited<ReturnType<typeof readdir>>`: `readdir` ist überladen, und
      // die Ableitung greift dort die Puffer-Überladung — `e.name` wäre dann ein `Buffer`.
      let eintraege: Dirent<string>[];
      try {
        eintraege = await readdir(verzeichnis, { withFileTypes: true });
      } catch (fehler) {
        const code = (fehler as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
          reply.code(200).send({ zustand: "kein_verzeichnis", verzeichnis, gelesenUtc });
          return;
        }
        reply.code(200).send({
          zustand: "unlesbar",
          verzeichnis,
          gelesenUtc,
          grund: code ?? "UNBEKANNT",
        });
        return;
      }

      // `*.dump.partial` (backup.sh:62) fällt schon über die Endung heraus; Verzeichnisse und
      // Sockets sind keine Sicherungen. Ein Verweis bleibt drin — ob er trägt, sagt seine Größe.
      const namen = eintraege
        .filter((e) => (e.isFile() || e.isSymbolicLink()) && e.name.endsWith(".dump"))
        .map((e) => e.name);
      const sicherungen = await Promise.all(namen.map((n) => befundFuer(verzeichnis, n)));
      // JÜNGSTE ZUERST, in drei Schlüsseln.
      //
      // 1. `zeitpunktUtc` absteigend. Ein Name ohne Stempel trägt kein Datum und kann deshalb nicht
      //    behaupten, der jüngste zu sein — er steht hinten. Das gilt unverändert.
      // 2. `folgeNummer` ABSTEIGEND, JOB 4109: bei Sekundengleichheit ist die HÖHERE Nummer die
      //    spätere Sicherung (`backup.sh:419` „die Nummer zaehlt weiter"), also `_03` vor `_02` vor
      //    dem Grundnamen. Dieser Schlüssel ist AUSDRÜCKLICH numerisch und steht VOR dem Dateinamen:
      //    `_` und `.` sind Satzzeichen, und die ICU-Kollation von `localeCompare` ordnet Satzzeichen
      //    nicht verlässlich — überließe man ihr den Gleichstand, stünde `klarwerk-…Z_02.dump` je
      //    nach Laufzeit vor oder hinter `klarwerk-…Z.dump`.
      // 3. Der Dateiname, damit zwei Aufrufe am selben Bestand dieselbe Reihenfolge liefern.
      //
      // NICHT MEHR WAHR und deshalb hier gestrichen: die Annahme, ein Dump ohne parsbaren Stempel
      // sei kein reguläres Backup dieses Skripts. Seit JOB 4057 erzeugt `backup.sh` Suffixnamen —
      // sie sind reguläre Sicherungen und werden seit JOB 4109 als solche gelesen.
      sicherungen.sort((a, b) => {
        const za = a.zeitpunktUtc ?? "";
        const zb = b.zeitpunktUtc ?? "";
        if (za !== zb) {
          return zb > za ? 1 : -1;
        }
        // `null` heißt „unbekannt" und darf keine Stelle vor einer bekannten Nummer beanspruchen.
        const fa = a.folgeNummer ?? 0;
        const fb = b.folgeNummer ?? 0;
        return fa === fb ? b.datei.localeCompare(a.datei) : fb - fa;
      });
      reply.code(200).send({ zustand: "gelesen", verzeichnis, gelesenUtc, sicherungen });
    });
  };
}
