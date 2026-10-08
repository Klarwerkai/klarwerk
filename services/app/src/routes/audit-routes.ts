import type { FastifyPluginAsync } from "fastify";
import type { AuditEntry, AuditFilter, AuditService } from "../../../audit";
import type { Guards, SessionUser } from "../http";
import { LESEVARIANTEN_LADE_AKTION, LESEVARIANTEN_LADE_PROTOKOLLFELDER } from "../lesevarianten";
import { type SichtbarkeitsFakten, darfSehen } from "../sichtbarkeit";

/** Wer die Befunde (Konflikte, Überschneidungen) eines Objekts kennt — nur deren Kennungen. */
export interface BefundKennungen {
  idsForKo(koId: string): Promise<string[]>;
}

/**
 * Die Sichtbarkeitsfakten des ganzen Bestands, Papierkorb eingeschlossen — Kennung, führender
 * Space, Stufe, Autor (`KoService.sichtbarkeitsfaktenAller`). Das Protokoll nennt Objekte auch
 * nach dem Löschen; entschieden wird mit derselben Regel wie überall (`darfSehen`).
 */
export interface AuditLeseQuelle {
  sichtbarkeitsfaktenAller(): Promise<readonly ({ id: string } & SichtbarkeitsFakten)[]>;
}

// ================================================================================================
// aufnahme:20260922:gesamt-leserechte (Ben, Nacharbeit 13/14) — DAS PROTOKOLL NACH LESERECHT.
// ================================================================================================
//
// `ko.validate` ersetzt kein Space-Leserecht. Das Protokoll nennt Objekte als Ziel (`ko.created`,
// `ko.space-changed` …) und in der Nutzlast (`koIds`, Titel …). Ein Eintrag, der IRGENDWO die
// Kennung eines Objekts trägt, das der Leser nicht sehen darf, wird ihm deshalb nicht ausgegeben —
// in der Liste, im Export und in den Befund-Kennungen eines Objekts. Ein unsichtbares Objekt ist
// damit hier, was es überall ist: unbekannt.
//
// Alteinträge `lesevarianten.load` mit Bestandsbilanz zählen auch Objekte, die sie nicht nennen;
// sie gehen nur an einen Leser, der den ganzen Bestand sehen darf.
//
// DER EXPORT (R-0613) ist eine nachrechenbare Kette — Einträge, Kopf, Prüfbericht. Eine Kette mit
// Lücken oder geänderter Nutzlast wäre das nicht mehr. Deshalb ZWEI Formen, technisch getrennt:
//   · `klarwerk-audit-export` — die unveränderte Kette, NUR wenn diesem Leser nichts ausgeblendet
//     wird. Sie bleibt mit `verifyChain` außerhalb prüfbar.
//   · `klarwerk-audit-ansicht` — sonst: die für ihn sichtbaren Einträge OHNE Kettenfelder (`hash`,
//     `prevHash`, `hashVersion`), ohne Kopf und ohne Prüfbericht; sie gibt sich nicht als Kette aus.
//     Ihr Abruf wird als `audit.view-exported` protokolliert, nicht als Kettenexport.
// Ohne Lesequelle ist nichts entscheidbar: dann gilt fail-closed jeder Eintrag als verborgen.

/** Die Kennungen aller Objekte, die dieser Leser NICHT sehen darf — oder `null` (nicht entscheidbar). */
async function verborgeneObjekte(
  user: SessionUser,
  quelle: AuditLeseQuelle | undefined,
): Promise<ReadonlySet<string> | null> {
  if (!quelle) {
    return null;
  }
  const verborgen = new Set<string>();
  for (const fakten of await quelle.sichtbarkeitsfaktenAller()) {
    if (!darfSehen(user, fakten)) {
      verborgen.add(fakten.id);
    }
  }
  return verborgen;
}

// Eine Kennung kann auch EINGEBETTET stehen — `eventId` „ko.created:<id>", ein Pfad „/kos/<id>".
const KENNUNG_IM_TEXT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function nenntEine(wert: unknown, kennungen: ReadonlySet<string>): boolean {
  if (typeof wert === "string") {
    return (
      kennungen.has(wert) || (wert.match(KENNUNG_IM_TEXT) ?? []).some((id) => kennungen.has(id))
    );
  }
  if (Array.isArray(wert)) {
    return wert.some((w) => nenntEine(w, kennungen));
  }
  if (wert !== null && typeof wert === "object") {
    return Object.values(wert as Record<string, unknown>).some((w) => nenntEine(w, kennungen));
  }
  return false;
}

function istAlteLadebilanz(e: AuditEntry): boolean {
  return (
    e.action === LESEVARIANTEN_LADE_AKTION &&
    !Object.keys(e.payload).every((k) => LESEVARIANTEN_LADE_PROTOKOLLFELDER.includes(k))
  );
}

/** Darf dieser Eintrag an einen Leser mit dieser Menge verborgener Objekte hinaus? */
function lesbar(e: AuditEntry, verborgen: ReadonlySet<string> | null): boolean {
  if (verborgen === null) {
    return false;
  }
  if (verborgen.size > 0 && istAlteLadebilanz(e)) {
    return false;
  }
  return ![e.target, e.eventId, e.payload].some((teil) => nenntEine(teil, verborgen));
}

// Audit-Log (§2.4 / FR-AUD). Governance-Einsicht: Controller/Admin (ko.validate-Recht).
// `quelle`: der Bestand, gegen den die Lesepolicy je Eintrag entschieden wird (s. o.).
export function auditRoutes(
  audit: AuditService,
  guards: Guards,
  befunde: readonly BefundKennungen[] = [],
  quelle?: AuditLeseQuelle,
): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: AuditFilter }>("/api/audit", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      const verborgen = await verborgeneObjekte(user, quelle);
      const eintraege = await audit.list(request.query);
      reply.code(200).send(eintraege.filter((e) => lesbar(e, verborgen)));
    });

    // SCRUM-439: aktive Integritätsprüfung der Audit-Kette (verify statt nur Aussage). Governance-
    // Einsicht wie /api/audit (ko.validate). Antwort: { ok, count } — Grundlage des Admin-Knopfs.
    app.get("/api/audit/verify", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await audit.verifyReport());
    });

    // R-0766 (Aufnahme gesamt-auditprotokoll, Lauf 2): die Kennungen der Konflikte und
    // Überschneidungen eines Objekts — offen und abgeschlossen. Die Kette am Objekt (`koAuditEvents`)
    // ordnet damit auch Altbelege zu, die das Objekt nicht selbst nennen. Nur Kennungen, die im
    // Protokoll ohnehin als Ziel stehen; deshalb dieselbe Tür wie `/api/audit`.
    // Ein Objekt, das der Leser nicht sehen darf, hat für ihn keine Befunde — wie ein unbekanntes.
    app.get<{ Params: { koId: string } }>(
      "/api/audit/ko/:koId/findings",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        const verborgen = await verborgeneObjekte(user, quelle);
        if (verborgen === null || verborgen.has(request.params.koId)) {
          reply.code(200).send({ ids: [] });
          return;
        }
        const ids = new Set<string>();
        for (const befund of befunde) {
          for (const id of await befund.idsForKo(request.params.koId)) {
            ids.add(id);
          }
        }
        reply.code(200).send({ ids: [...ids] });
      },
    );

    // R-0613: die Kette als Datei — Einträge, Prüfbericht und Kopf (letzte Sequenz + Hash) für die
    // Ablage außerhalb der Datenbank. Dieselbe Einsichtsstufe wie `/api/audit`. Der Abruf selbst wird
    // als `audit.exported` angehängt. Wem Einträge ausgeblendet werden, bekommt die Leseransicht
    // (s. Kopf dieser Datei), nie eine umgeschriebene Kette.
    //
    // FR-AUD-02: unter `/api/audit` gibt es ausschließlich GET-Wege. Ein POST/PUT/PATCH/
    // DELETE ist nirgends registriert — `tests/audit-gesamt/append-only-http.test.ts` misst das.
    app.get("/api/audit/export", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      const verborgen = await verborgeneObjekte(user, quelle);
      let eintraege = await audit.list({});
      if (eintraege.every((e) => lesbar(e, verborgen))) {
        const kette = await audit.exportChain(user.id);
        // Zwischen Prüfung und Export kann ein Eintrag hinzugekommen sein — noch einmal prüfen.
        if (kette.entries.every((e) => lesbar(e, verborgen))) {
          const stempel = kette.exportedAt.replace(/[:.]/g, "-");
          const name = `klarwerk-audit-${stempel}.json`;
          reply
            .header("content-disposition", `attachment; filename="${name}"`)
            .code(200)
            .send(kette);
          return;
        }
        eintraege = kette.entries;
      }
      const sichtbar = eintraege
        .filter((e) => lesbar(e, verborgen))
        .map(({ hash: _hash, prevHash: _prev, hashVersion: _version, ...rest }) => rest);
      const exportedAt = new Date().toISOString();
      await audit.record({
        actor: user.id,
        action: "audit.view-exported",
        target: "audit",
        payload: { count: sichtbar.length },
      });
      const name = `klarwerk-audit-ansicht-${exportedAt.replace(/[:.]/g, "-")}.json`;
      reply.header("content-disposition", `attachment; filename="${name}"`).code(200).send({
        format: "klarwerk-audit-ansicht",
        formatVersion: 1,
        exportedAt,
        kette: false,
        hinweis:
          "Leseransicht nach Leserecht: Einträge zu nicht sichtbaren Objekten fehlen; ohne Kettenfelder, nicht als Kette prüfbar.",
        count: sichtbar.length,
        entries: sichtbar,
      });
    });
  };
}
