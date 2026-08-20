// AUFTRAG-mega45 Block A/D — „Warum weiss Klarwerk das?" als Leseweg.
//
// GET /api/kos/:id/provenance — die Herkunftskette EINES Wissensobjekts. Rein lesend, additiv,
// hinter einem Betriebsschalter mit Vorgabe AUS.
//
// HIER, IN DER KOMPOSITIONSWURZEL, FAELLT DIE RECHTEENTSCHEIDUNG (A3) — und nur hier kann sie
// fallen: `services/conflicts` kennt `knowledge-object` nicht (Modulgrenze), also kann dort
// niemand wissen, wie vertraulich die Gegenseite eines Konflikts ist. Genau wie die Versions-
// Autoritaet (`IsKoVersionCurrent`) wird die Sichtbarkeit deshalb hier aufgeloest und dem
// Projektionsmodul als DATUM gereicht.
//
// DIE SICHTBARKEITSREGEL, an die sich dieser Weg bindet, ist NICHT neu erfunden — aber sie heisst
// heute anders als zu mega45: das Praedikat `darfSehen` (services/app/src/sichtbarkeit.ts:67-77).
// Es traegt die SCRUM-506-Regel `can(role,"ko.validate")` (sichtbarkeit.ts:71) UND seit Pedis
// Variante A die Autor-Ausnahme (sichtbarkeit.ts:76). Eine eigene Kopie der Regel steht hier nicht
// mehr; die Entscheidung faellt an genau einer Stelle (sichtbarkeit.ts:1-24).
//
// WAS DIESE ROUTE HEUTE TUT — nachgemessen am 20.08.2026 (JOB 1170 D1). Das ist der Stand, der
// gilt; die historische Fassung steht darunter und ist als solche gekennzeichnet:
//
//   · Sie schuetzt ihr ZENTRUM. Ein Leser ohne Sichtbarkeit auf das angefragte Objekt bekommt
//     404 statt der Projektion — `:105`, `if (!ko || !darfSehen(user, ko))`. Am Draht gepinnt in
//     tests/security/job1170-herkunft-zentrum-vertraulich.test.ts.
//   · Sie schuetzt die GEGENSEITE eines Konflikts unveraendert — `:130`,
//     `gegenKo && darfSehen(user, gegenKo)`, fail-closed: ein nicht aufloesbares Gegenstueck
//     gilt als unsichtbar.
//   · Sie ist damit NICHT mehr strenger als der uebrige Lesepfad, sondern gleich streng.
//     `GET /api/kos/:id` faehrt dieselbe Entscheidung ueber `sichtbaresKoOder404`
//     (ko-routes.ts:440-447, Aufruf :489) und antwortet ebenfalls 404; `GET /api/conflicts`
//     faehrt sie ueber `sichtbarePaare` und `feldFreigabe` (conflicts-routes.ts:40-45).
//
// Die beiden dateiinternen Zeilennummern tragen ihr Codezitat mit sich: eine spaetere
// Verschiebung macht den Verweis ungenau, aber nicht unauffindbar. Genau daran ist die alte
// Fassung gescheitert.
//
// HISTORISCH — damit niemand den alten Satz vermisst oder ihn zweimal widerlegt: bis
// AUFTRAG-mega74 (30.07.2026) stand hier „diese Projektion schliesst keine bestehende Luecke" und
// „`GET /api/kos/:id` und `GET /api/conflicts` liefern heute JEDEM Inhaber von `ko.read` auch
// vertrauliche Objekte". Beide Saetze waren ab mega74 Block B falsch. Der Bau hat das damals
// 56 Zeilen weiter unten richtiggestellt (s. Block F an der Sperre) und die alte Fassung hier
// stehen lassen — zwei Wahrheiten in einer Datei, gefunden in JOB 1167 D1, geschlossen in
// JOB 1170 D1. Ein Kommentar, der die Lage falsch beschreibt, ist gefaehrlicher als gar keiner:
// er haelt den naechsten Auftrag davon ab, eine bereits scharfe Route anzusehen.
import type { FastifyPluginAsync } from "fastify";
import type { ConflictService } from "../../../conflicts";
import type { KoService } from "../../../knowledge-object";
import type { ModelRunService } from "../../../model-runs";
import {
  type ProvenanceGegenseite,
  type ProvenanceInput,
  type ProvenanceKonfliktIn,
  projectProvenance,
} from "../../../provenance";
import { schalterAn } from "../feature-flags";
import { type Guards, sendError } from "../http";
import { darfSehen } from "../sichtbarkeit";

/**
 * BLOCK D — DER SCHALTER. Vorgabe AUS.
 *
 * Anders als `KLARWERK_SLIDES_ENABLED` (das die Route registriert laesst und ehrlich 503 antwortet)
 * entscheidet dieser Schalter ueber die REGISTRIERUNG selbst: ohne ihn gibt es die Route nicht,
 * und der Knopf in der Oberflaeche wird ebenfalls nicht gerendert. Damit ist „die Seite wieder
 * verstecken" ein Schalter und kein Rueckbau — und es entsteht kein 404-Raetsel, weil niemand auf
 * eine Flaeche zeigt, die es nicht gibt.
 *
 * Pro Aufruf gelesen, damit Tests beide Zustaende im selben Lauf festhalten koennen.
 *
 * AUFTRAG-mega46 Block F: Die Auswertung selbst steht nicht mehr hier, sondern im EINEN
 * Schalter-Registry (services/app/src/feature-flags.ts) — dieselbe Regel, die jetzt auch die
 * Auskunft an die Oberflaeche gibt. Der Name bleibt, das Verhalten bleibt; nur die Wahrheit ueber
 * „ist der Schalter an" hat ab hier genau einen Ort.
 */
export function provenanceEnabled(): boolean {
  return schalterAn("herkunft");
}

/** Wie viele Modelllaeufe hoechstens auf einen Bezug zu diesem Objekt durchsucht werden. */
const MODEL_RUN_SCAN = 200;

export interface ProvenanceDeps {
  ko: KoService;
  conflicts: ConflictService;
  modelRuns: ModelRunService;
}

export function provenanceRoutes(deps: ProvenanceDeps, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Params: { id: string } }>("/api/kos/:id/provenance", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        const ko = await deps.ko.get(request.params.id);
        // AUFTRAG-mega74 BLOCK F: bis mega74 war diese Route ausdrücklich als „schließt keine
        // bestehende Lücke" kommentiert (die alte Fassung steht als HISTORISCH im Kopf dieser
        // Datei) — sie schützte die GEGENSEITE eines Konflikts, ließ das ZENTRUM aber ungefiltert
        // durch, weil `GET /api/kos/:id` es ohnehin herausgab. Seit Block B gibt es das nicht
        // mehr; damit wird diese Vorbereitung hier scharf.
        //
        // JOB 1170 D1: diese Zeile ist ab jetzt am Draht gepinnt — wer `darfSehen` hier entfernt,
        // macht tests/security/job1170-herkunft-zentrum-vertraulich.test.ts rot (gemessen: genau
        // dieser eine Fall, die Nachbardateien bleiben grün).
        if (!ko || !darfSehen(user, ko)) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
          return;
        }

        const [versionen, belege, konflikteAlle, laeufe] = await Promise.all([
          deps.ko.versionsOf(ko.id),
          deps.ko.evidenceOf(ko.id),
          deps.conflicts.unresolved(),
          deps.modelRuns.recent(MODEL_RUN_SCAN),
        ]);

        // --- Die Gegenseiten aufloesen — VOR der Projektion, serverseitig ------------------------
        const eigene = konflikteAlle.filter((c) => c.koA === ko.id || c.koB === ko.id);
        const konflikte: ProvenanceKonfliktIn[] = [];
        for (const c of eigene) {
          const gegenId = c.koA === ko.id ? c.koB : c.koA;
          const gegenKo = await deps.ko.get(gegenId);
          // FAIL-CLOSED: ein nicht auffindbares Gegenstueck (geloescht, im Papierkorb, nicht
          // lesbar) gilt als UNSICHTBAR. Lieber eine Kante zu wenig als ein verratenes Objekt.
          // AUFTRAG-mega74 BLOCK F: hier stand eine EIGENE Kopie der SCRUM-506-Regel
          // (`can(user.role,"ko.validate") || !isConfidential(...)`). Sie ist durch das eine
          // Prädikat ersetzt — sonst gäbe es nach Block A wieder zwei Orte, an denen dieselbe
          // Frage beantwortet wird, und der Autor-Fall wäre hier stillschweigend anders.
          const gegenseite: ProvenanceGegenseite =
            gegenKo && darfSehen(user, gegenKo)
              ? { sichtbar: true, id: gegenKo.id, titel: gegenKo.title }
              : { sichtbar: false };
          konflikte.push({
            id: c.id,
            art: c.type,
            beschreibung: c.description,
            status: c.status,
            gegenseite,
            ...(c.origin ? { herkunft: c.origin } : {}),
            ...(c.detector
              ? {
                  erkenner: {
                    bezeichnung: c.detector.modelLabel ?? c.detector.method,
                    ...(c.detector.rationale ? { begruendung: c.detector.rationale } : {}),
                    ...(c.detector.quotes
                      ? { zitat: c.koA === ko.id ? c.detector.quotes.a : c.detector.quotes.b }
                      : {}),
                  },
                }
              : {}),
            ...(c.createdBy ? { urheber: c.createdBy } : {}),
            zeitpunkt: c.createdAt,
          });
        }

        const eingabe: ProvenanceInput = {
          ko: {
            id: ko.id,
            titel: ko.title,
            status: ko.status === "validiert" ? "validiert" : "offen",
            version: ko.version,
            maschinellGeprueft: ko.aiCheck?.status === "done",
          },
          quellen: (ko.sources ?? []).map((s) => ({
            id: s.id,
            bezeichnung: s.label,
            ...(s.provider ? { anbieter: s.provider } : {}),
            urheber: s.author,
            zeitpunkt: s.at,
          })),
          originale: (ko.attachments ?? []).map((a) => ({
            id: a.id,
            bezeichnung: a.name,
            urheber: a.author,
            zeitpunkt: a.at,
          })),
          belege: belege.map((e) => ({
            id: e.id,
            art: e.kind,
            ...(e.sourceId ? { quelleId: e.sourceId } : {}),
            ...(e.attachmentId ? { originalId: e.attachmentId } : {}),
            bezeichnung: e.label,
            // mega26 Block B: der GRUND der Verknuepfung, woertlich.
            ...(e.excerpt ? { grund: e.excerpt } : {}),
            urheber: e.createdBy,
            zeitpunkt: e.createdAt,
          })),
          versionen: versionen.map((v) => ({
            version: v.version,
            urheber: v.author,
            zeitpunkt: v.at,
            vermerk: v.note,
          })),
          konflikte,
          laeufe: laeufe
            .filter((r) => r.subject?.kind === "ko" && r.subject.id === ko.id)
            .map((r) => ({
              id: r.id,
              aufgabe: r.task,
              anbieter: r.provider,
              ...(r.model ? { modell: r.model } : {}),
              ...(r.actor ? { akteur: r.actor } : {}),
              zeitpunkt: r.startedAt,
            })),
        };

        // NUR der Graph geht hinaus. Das Pruefprotokoll (`audit`) mit der Zahl der rechtebedingten
        // Auslassungen bleibt HIER — es zu senden waere exakt der Verrat, den A3 verbietet.
        const { graph } = projectProvenance(eingabe);
        reply.code(200).send(graph);
      } catch (error) {
        sendError(reply, error);
      }
    });
  };
}
