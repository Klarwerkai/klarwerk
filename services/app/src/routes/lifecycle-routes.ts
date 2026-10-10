import type { FastifyPluginAsync } from "fastify";
import {
  type KnowledgeObject,
  normalizeAsset,
  responsibleKindOf,
  responsibleOf,
} from "../../../knowledge-object";
import type { LifecycleService, RevalidierungsGrund } from "../../../lifecycle";
import { type Guards, sendError } from "../http";
import { type KoSichtbarkeitsZugang, sichtbareEintraege } from "../sichtbarkeit";
import type { Wissensuebergabe } from "../wissensuebergabe";

// Lebenszyklus & Lernpfade (§ FR-LIF). Re-Validierung/Autor-Übergabe laufen über den KO-Dispatcher.
//
// ================================================================================================
// AUFTRAG-JOB2017 (G7) — DIESER LESEWEG SETZTE NICHTS DURCH.
// ================================================================================================
//
// DER BEFUND: `GET /api/lifecycle/couplings/:koId` prüfte `ko.read` und reichte danach die
// gekoppelten Anlagen JEDES Wissensobjekts heraus — die Kennung wählt der Aufrufer. Wer die
// Kennung eines vertraulichen Objekts kennt (aus einem Konflikt, einer Benachrichtigung oder
// durch Raten), bekam seine Kopplungen, ohne das Objekt je öffnen zu dürfen. Der Hauptlesepfad
// `GET /api/kos/:id` hätte demselben Menschen ein 404 gegeben (`ko-routes.ts:440-447`).
//
// WARUM `sichtbareEintraege` UND KEINE EIGENE PRÜFUNG: die Regel wohnt in `../sichtbarkeit`, und
// die Datei warnt ausdrücklich davor, sie ein zweites Mal auszulegen (dort :243f). `sichtbareEintraege`
// ist die vorhandene Form für „diese Kennung(en), für diesen Menschen" — sie ist zusätzlich
// fail-closed: ein untauglicher Zugang liefert die leere Liste, also 404, nicht das alte Ergebnis.
//
// WARUM 404 UND NICHT 403: wörtlich die Begründung aus `ko-routes.ts:436-439` — bei einem
// vertraulichen Objekt ist schon die Existenz eine Auskunft. Deshalb dieselbe Meldung, Wort für Wort.
//
// `kos` IST PFLICHTPARAMETER, nicht optional (AUFTRAG-mega76 BLOCK A): ein Schutz, den der
// Aufrufer weglassen kann, ist keiner. Einziger Aufrufer ist die Kompositionswurzel.
/**
 * R-1662 (Prüfpunkt 6 „alte Revalidierungsfälle"): der Lesezugang zu den Belegen `ko.revalidated`
 * im Prüfprotokoll — als PORT, nicht als Dienstimport (dieselbe Überlegung wie `OverlapLesezugang`
 * in conflicts-routes.ts). Fehlt er, wird die Route gar nicht registriert: 404, nie eine leere Liste,
 * die „nie bestätigt" behaupten würde.
 */
export interface RevalidierungsBeleg {
  at: string;
  target: string;
  payload: Record<string, unknown>;
}
export interface RevalidierungsBelege {
  list(filter: { action: string; target: string }): Promise<readonly RevalidierungsBeleg[]>;
}

/** Eine frühere Bestätigung „stimmt noch" — nur Kennung, Zeitpunkt und bestätigte Fassung. */
export interface RevalidierungBestaetigt {
  koId: string;
  am: string;
  version: number | null;
}

/** So viele Objekte nimmt `GET /api/lifecycle/revalidiert` je Anfrage (die Quellen EINER Antwort). */
const REVALIDIERT_HOECHSTENS_OBJEKTE = 50;

/** Höchstlänge eines Änderungsbelegs (`aenderung`) — eine Kennung, kein Fließtext. */
const AENDERUNG_HOECHSTENS_ZEICHEN = 200;

/**
 * produkt:20261010:aenderungsfolgen-sichtbar: was die Folgeprüfungsübersicht über die offenen Fälle
 * hinaus braucht — das Objekt selbst (Titel, Fassung, Status, Verantwortung) und die Namen der
 * Personen. Als PORT: fehlt er, wird die Route nicht registriert (404), nie eine leere Liste.
 */
export interface FolgepruefungsQuellen {
  ko: { get(id: string): Promise<KnowledgeObject | undefined> };
  personen: { listUsers(): Promise<readonly { id: string; name: string }[]> };
}

/** Ein Anlass, wie er die Route verlässt — ohne meldende Person. */
export interface FolgepruefungsAnlass {
  grund: RevalidierungsGrund;
  am: string;
  /** Die gekoppelte Anlage/Quelle, über die der Eintrag erreicht wurde — `null` bei Anforderung. */
  assetRef: string | null;
  /** Steht die Kopplung an dieser Anlage noch? `null`, wenn der Anlass keine Anlage nennt. */
  kopplungBesteht: boolean | null;
  aenderung: string | null;
  /** Der auslösende Eintrag — NUR, wenn der Betrachter ihn sehen darf; sonst `null`. */
  ausloeser: { koId: string; title: string; version: number | null } | null;
  /** Die Fassung des betroffenen Eintrags beim Eingang des Signals. */
  koVersion: number | null;
}

/** Eine Zeile von `GET /api/lifecycle/folgepruefung`. */
export interface FolgepruefungsFall {
  koId: string;
  title: string;
  status: string;
  version: number;
  stand: number;
  seit: string | null;
  zustaendig: {
    id: string;
    name: string | null;
    vorhanden: boolean;
    art: "owner" | "author-fallback";
  };
  anlaesse: FolgepruefungsAnlass[];
}

/** Sortierschlüssel „seit" in ms; ohne (lesbaren) Beginn ans Ende. */
function seitRang(seit: string | null): number {
  const ms = seit === null ? Number.NaN : Date.parse(seit);
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

/** Ein Änderungsbeleg aus dem Rumpf: getrimmt, begrenzt, leer ist keiner. */
function aenderungAus(wert: unknown): string | undefined | null {
  if (wert === undefined || wert === null) {
    return undefined;
  }
  if (typeof wert !== "string") {
    return null;
  }
  const text = wert.normalize("NFC").replace(/\s+/g, " ").trim();
  if (text.length > AENDERUNG_HOECHSTENS_ZEICHEN) {
    return null;
  }
  return text.length > 0 ? text : undefined;
}

export function lifecycleRoutes(
  lifecycle: LifecycleService,
  guards: Guards,
  kos: KoSichtbarkeitsZugang,
  uebergabe: Wissensuebergabe,
  belege?: RevalidierungsBelege,
  folge?: FolgepruefungsQuellen,
): FastifyPluginAsync {
  return async (app) => {
    app.post<{ Body: { assetRef: string; koId: string } }>(
      "/api/lifecycle/couple",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        // R-0477 / R-0082 (aufnahme:20260922:gesamt-wissen-metadaten) — GEGEN FEHLKOPPLUNG.
        //
        // Bis hierher koppelte dieser Weg JEDE Zeichenkette an JEDE Kennung: an ein Objekt, das es
        // nicht gibt, an eines, das der Aufrufer nicht sehen darf, und eine leere oder nur anders
        // geschriebene Anlage („DP-4" neben „DP-4 "). Eine Anlagenänderung (`asset-changed`) traf
        // dann Objekte, die niemand gekoppelt haben wollte, oder verfehlte die gemeinten.
        //
        // Die Kennung durchläuft dieselbe Normalform wie das kanonische Feld am Objekt
        // (`normalizeAsset`, JOB 593) — so meinen Kopplung und Objekt dieselbe Anlage, wenn sie
        // gleich aussehen. Das Objekt passiert dasselbe Sichtbarkeitstor wie der Leseweg darunter
        // (JOB 2017), mit derselben 404-Antwort.
        const body = (request.body ?? {}) as { assetRef?: unknown; koId?: unknown };
        const assetRef = normalizeAsset(body.assetRef);
        if (assetRef === null || typeof body.koId !== "string" || body.koId.length === 0) {
          reply.code(400).send({
            error: "INVALID",
            message: "assetRef (nicht leer) und koId werden benötigt.",
          });
          return;
        }
        const sichtbar = await sichtbareEintraege(user, [{ koId: body.koId }], kos);
        if (sichtbar.length === 0) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
          return;
        }
        // Nacharbeit 4 (Ben, K1): die Kopplung IST die kanonische Anlagenzuordnung des Objekts.
        try {
          await lifecycle.couple(assetRef, body.koId, user.id);
        } catch (error) {
          sendError(reply, error);
          return;
        }
        reply.code(204).send();
      },
    );

    // Audit B1 (Pedi 02.07.): gekoppelte Anlagen eines KOs lesen — fürs KO-Detail.
    app.get<{ Params: { koId: string } }>(
      "/api/lifecycle/couplings/:koId",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        // AUFTRAG-JOB2017 (G7): dasselbe Tor wie am Hauptlesepfad, bevor irgendetwas hinausgeht.
        const sichtbar = await sichtbareEintraege(user, [{ koId: request.params.koId }], kos);
        if (sichtbar.length === 0) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
          return;
        }
        reply.code(200).send(await lifecycle.couplingsForKo(request.params.koId));
      },
    );

    // produkt:20261010:aenderungsfolgen-sichtbar — DIE ANTWORT NENNT NUR, WAS DER MELDENDE SEHEN DARF.
    //
    // Bis hierher gingen die Kennungen ALLER gekoppelten Einträge hinaus — auch vertraulicher, die
    // der Meldende nicht öffnen darf. Markiert wird weiter jeder gekoppelte Eintrag (die Folgeprüfung
    // gehört an das Objekt, nicht an den Meldenden); hinaus geht nur die sichtbare Teilmenge, ohne
    // Platzhalter und ohne Gesamtzahl. Die Anlage durchläuft dieselbe Normalform wie die Kopplung;
    // ein optionaler Änderungsbeleg (`aenderung`, z. B. „Rev. C") unterscheidet eine weitere Änderung
    // derselben Anlage von der wiederholten Meldung derselben Änderung.
    app.post<{ Body: { assetRef?: unknown; aenderung?: unknown } }>(
      "/api/lifecycle/asset-changed",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        const body = (request.body ?? {}) as { assetRef?: unknown; aenderung?: unknown };
        const assetRef = normalizeAsset(body.assetRef);
        const aenderung = aenderungAus(body.aenderung);
        if (assetRef === null || aenderung === null) {
          reply.code(400).send({
            error: "INVALID",
            message: "assetRef (nicht leer) wird benötigt; aenderung ist eine kurze Kennung.",
          });
          return;
        }
        try {
          const markiert = await lifecycle.meldeAnlagenaenderung(assetRef, user.id, aenderung);
          const sichtbar = await sichtbareEintraege(user, markiert, kos);
          reply.code(200).send(sichtbar.map((eintrag) => eintrag.koId));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    // ============================================================================================
    // produkt:20261010:aenderungsfolgen-sichtbar — DIE FOLGEPRÜFUNGSÜBERSICHT.
    // ============================================================================================
    //
    // Je offenem Fall: Titel, Status, aktuelle Fassung, der STAND (an ihn bindet sich „Noch gültig"),
    // seit wann, wer zuständig ist (Eigentum, sonst Autor — `responsibleOf`, dieselbe Regel wie die
    // Frische) und WARUM: jeder Anlass mit Grund, Anlage, Änderungsbeleg, auslösendem Eintrag und der
    // Fassung beim Eingang. Belegt ist nur, was gespeichert ist — Kopplung oder Anforderung. Eine
    // Vermutung (Ähnlichkeit o. ä.) erzeugt dieser Weg nicht, und er behauptet keine Vollständigkeit.
    //
    // RECHTE WIE `pending`: Routenrecht `ko.read`, Zeilenrecht `sichtbareEintraege` — ein Fall, dessen
    // Objekt der Betrachter nicht sehen darf, FEHLT (kein Platzhalter, keine Zahl). Ein auslösender
    // Eintrag, den er nicht sehen darf, steht als `null` da: der Anlass bleibt erklärt (Anlage,
    // Änderungsbeleg), ohne den fremden Eintrag zu nennen. Die meldende Person geht nicht hinaus.
    //
    // SCHREIBFREI: `offeneFaelle()` statt `pendingRevalidation()` — dieser Leseweg räumt nichts, setzt
    // nichts und schreibt kein Ereignis. Ein Merker ohne Objekt fällt an der Sichtbarkeit heraus.
    if (folge) {
      app.get("/api/lifecycle/folgepruefung", async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        try {
          const faelle = await sichtbareEintraege(user, await lifecycle.offeneFaelle(), kos);
          const namen = new Map(
            (await folge.personen.listUsers()).map((p) => [p.id, p.name] as const),
          );
          const ausloeserSichtbar = new Map<string, FolgepruefungsAnlass["ausloeser"]>();
          const aus: FolgepruefungsFall[] = [];
          for (const fall of faelle) {
            const ko = await folge.ko.get(fall.koId);
            if (!ko) {
              continue;
            }
            const kopplungen = await lifecycle.couplingsForKo(fall.koId);
            const anlaesse: FolgepruefungsAnlass[] = [];
            for (const a of fall.anlaesse) {
              let ausloeser: FolgepruefungsAnlass["ausloeser"] = null;
              if (a.ausgeloestVon !== undefined) {
                const version = a.ausgeloestVonVersion ?? null;
                if (a.ausgeloestVon === fall.koId) {
                  ausloeser = { koId: ko.id, title: ko.title, version };
                } else {
                  if (!ausloeserSichtbar.has(a.ausgeloestVon)) {
                    const [frei] = await sichtbareEintraege(user, [{ koId: a.ausgeloestVon }], kos);
                    const quelle = frei ? await folge.ko.get(frei.koId) : undefined;
                    ausloeserSichtbar.set(
                      a.ausgeloestVon,
                      quelle ? { koId: quelle.id, title: quelle.title, version: null } : null,
                    );
                  }
                  const bekannt = ausloeserSichtbar.get(a.ausgeloestVon) ?? null;
                  ausloeser = bekannt ? { ...bekannt, version } : null;
                }
              }
              anlaesse.push({
                // Ein Nachbarauslöser, dessen auslösenden Eintrag der Betrachter nicht sehen darf,
                // steht als das da, was er für ihn ist: eine gemeldete Änderung der gekoppelten
                // Anlage. Sonst verriete schon der Grund „nachbar", dass es einen weiteren,
                // verborgenen Eintrag an dieser Anlage gibt.
                grund: a.grund === "nachbar" && ausloeser === null ? "anlage" : a.grund,
                am: a.am,
                assetRef: a.assetRef ?? null,
                kopplungBesteht: a.assetRef === undefined ? null : kopplungen.includes(a.assetRef),
                aenderung: a.aenderung ?? null,
                ausloeser,
                koVersion: a.koVersion ?? null,
              });
            }
            const zustaendigId = responsibleOf(ko);
            const name = namen.get(zustaendigId) ?? null;
            aus.push({
              koId: ko.id,
              title: ko.title,
              status: ko.status,
              version: ko.version,
              stand: fall.stand,
              seit: fall.seit,
              zustaendig: {
                id: zustaendigId,
                name,
                vorhanden: name !== null,
                art: responsibleKindOf(ko),
              },
              anlaesse,
            });
          }
          // Ältester offener Fall zuerst; Altmerker ohne Beginn ans Ende.
          aus.sort((a, b) => {
            const x = seitRang(a.seit);
            const y = seitRang(b.seit);
            return x === y ? 0 : x < y ? -1 : 1;
          });
          reply.code(200).send(aus);
        } catch (error) {
          sendError(reply, error);
        }
      });
    }

    // ============================================================================================
    // AUFTRAG-JOB2020 (G7b) — DIE KENNUNG ALLEIN IST HIER DIE AUSKUNFT.
    // ============================================================================================
    //
    // DER BEFUND: `pendingRevalidation()` liefert `Promise<string[]>` — nackte KO-Kennungen. Der
    // Dienst „nimmt keinen Nutzer entgegen und kennt keine Sichtbarkeitsregel"; die Route reichte
    // das Ergebnis unveraendert durch. Belegt und benannt seit JOB 704 D3
    // (`tests/security/w9-lifecycle-pending-sichtbarkeit.test.ts`, Kopf): „sie ist nicht getrimmt,
    // und wer sie anzeigt, muss selbst trimmen."
    //
    // WARUM EINE KENNUNG HIER REICHT — die Vorfrage, die JOB 2017 offengelassen hat, ist gemessen:
    // `GET /api/kos` laesst ein unsichtbares Objekt aus der Liste FALLEN (`ko-routes.ts:507f`,
    // Trim bis ins SQL) — „ein Platzhalter waere wieder eine Existenzauskunft". Ein Betrachter
    // bekommt die Kennung eines vertraulichen Objekts also nirgends sonst. Sie hier auszugeben ist
    // damit KEINE Doppelung einer ohnehin offenen Zahl (anders als `openGaps`, JOB 1562 D2),
    // sondern die einzige Stelle, an der sie hinausgeht.
    //
    // DIESELBE FORM WIE DER KOPPLUNGSWEG (JOB 2017): `sichtbareEintraege` ist die vorhandene Regel
    // fuer „diese Kennungen, fuer diesen Menschen", und sie ist fail-closed — ein untauglicher
    // Zugang liefert die leere Liste, nicht die alte. Kein zweiter Weg, keine zweite Auslegung.
    //
    // KEIN 404 HIER: eine Liste ist keine Existenzfrage. Ein unsichtbarer Eintrag FEHLT einfach —
    // genau wie in `GET /api/kos`, und aus demselben Grund.
    app.get("/api/lifecycle/pending", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const faellig = await lifecycle.pendingRevalidation();
      const sichtbar = await sichtbareEintraege(
        user,
        faellig.map((koId) => ({ koId })),
        kos,
      );
      reply.code(200).send(sichtbar.map((eintrag) => eintrag.koId));
    });

    // ============================================================================================
    // R-1662 (Ben, Nacharbeit 5) — FRÜHERE REVALIDIERUNGEN ZU DEN QUELLEN EINER ANTWORT.
    // ============================================================================================
    //
    // `pending` oben kennt nur OFFENE Fälle: `confirmStillValid` löscht den Merker im selben Schritt,
    // in dem es `ko.revalidated` ins Prüfprotokoll schreibt (lifecycle/src/service.ts:118-131). Eine
    // frühere Bestätigung steht danach NUR dort. Dieser Weg liest genau diesen Beleg — und nur ihn:
    //   · Routenrecht `ko.read` und Zeilenrecht `sichtbareEintraege` wie bei `pending`: ein Objekt,
    //     das der Betrachter nicht sehen darf, fehlt in der Antwort (keine Existenzauskunft).
    //   · Feldbeschränkung: hinaus gehen Kennung, Zeitpunkt und bestätigte Fassung. Akteur, Hashes
    //     und übrige Nutzlast des Protokolls bleiben hinter dem Audit-Recht.
    if (belege) {
      app.get<{ Querystring: { ko?: string } }>(
        "/api/lifecycle/revalidiert",
        async (request, reply) => {
          const user = await guards.requirePermission("ko.read", request, reply);
          if (!user) {
            return;
          }
          try {
            const angefragt = [
              ...new Set(
                (request.query.ko ?? "")
                  .split(",")
                  .map((id) => id.trim())
                  .filter((id) => id.length > 0),
              ),
            ].slice(0, REVALIDIERT_HOECHSTENS_OBJEKTE);
            const sichtbar = await sichtbareEintraege(
              user,
              angefragt.map((koId) => ({ koId })),
              kos,
            );
            const bestaetigt: RevalidierungBestaetigt[] = [];
            for (const { koId } of sichtbar) {
              for (const beleg of await belege.list({ action: "ko.revalidated", target: koId })) {
                const version = beleg.payload.version;
                bestaetigt.push({
                  koId,
                  am: beleg.at,
                  version: typeof version === "number" ? version : null,
                });
              }
            }
            // Jüngste zuerst; bei gleichem Zeitstempel die höhere Fassung (sie ist die spätere).
            bestaetigt.sort((a, b) =>
              a.am !== b.am ? (a.am < b.am ? 1 : -1) : (b.version ?? 0) - (a.version ?? 0),
            );
            reply.code(200).send(bestaetigt);
          } catch (error) {
            sendError(reply, error);
          }
        },
      );
    }

    app.post<{ Body: { role: string; steps: { title: string }[] } }>(
      "/api/learning-paths",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        reply
          .code(201)
          .send(await lifecycle.createPath(request.body.role, request.body.steps ?? []));
      },
    );

    app.get<{ Params: { role: string } }>("/api/learning-paths/:role", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const path = await lifecycle.getPath(request.params.role);
      if (!path) {
        reply.code(404).send({ error: "NOT_FOUND", message: "Lernpfad nicht gefunden." });
        return;
      }
      reply.code(200).send(path);
    });

    app.post<{ Params: { pathId: string }; Body: { stepId: string } }>(
      "/api/learning-paths/:pathId/complete",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        try {
          reply
            .code(200)
            .send(
              await lifecycle.completeStep(request.params.pathId, user.id, request.body.stepId),
            );
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.get<{ Params: { pathId: string } }>(
      "/api/learning-paths/:pathId/progress",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        reply.code(200).send(await lifecycle.progress(request.params.pathId, user.id));
      },
    );

    // ============================================================================================
    // R-0554 / R-2128 — WISSENSÜBERGABE BEIM AUSSCHEIDEN: ERST DIE VORSCHAU, DANN DER ZUG.
    // ============================================================================================
    //
    // `users.manage` — dasselbe Recht wie die Einzelübergabe `transfer-author`: wer den Bestand
    // einer Person umhängt, handelt als Verwaltung, nicht als Fachkollege. Die Vorschau ist ein
    // POST, weil sie zwei Personenkennungen trägt, die nicht in Adresszeilen und Zugriffsprotokolle
    // gehören. Sie schreibt nichts.
    app.post<{ Body: { from?: unknown; to?: unknown } }>(
      "/api/lifecycle/handover/preview",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        try {
          reply.code(200).send(await uebergabe.vorschau(request.body?.from, request.body?.to));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.post<{ Body: { from?: unknown; to?: unknown } }>(
      "/api/lifecycle/handover",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        try {
          reply
            .code(200)
            .send(await uebergabe.uebergeben(request.body?.from, request.body?.to, user.id));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );
  };
}
