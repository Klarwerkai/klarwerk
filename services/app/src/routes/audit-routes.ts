import type { FastifyPluginAsync } from "fastify";
import type { AuditEntry, AuditFilter, AuditSeitenAnfrage, AuditService } from "../../../audit";
import { type AuditObjektSicht, type AuditObjektZugang, auditSichtFuer } from "../audit-sicht";
import type { Guards } from "../http";

/** Wer die Befunde (Konflikte, Überschneidungen) eines Objekts kennt — nur deren Kennungen. */
export interface BefundKennungen {
  idsForKo(koId: string): Promise<string[]>;
}

/** Die Abfrage des Seitenwegs, wie sie über die Adresse ankommt — alles Zeichenketten. */
interface SeitenQuery {
  actor?: string;
  action?: string;
  actions?: string;
  target?: string;
  from?: string;
  to?: string;
  before?: string;
  limit?: string;
}

/** Ein Zeitpunkt aus der Adresse als ISO-Zeichenkette in UTC — `null` heißt „unlesbar". */
function isoZeitpunkt(wert: string): string | null {
  const ms = Date.parse(wert);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** Eine positive ganze Zahl aus der Adresse — `null` heißt „unlesbar". */
function ganzzahl(wert: string): number | null {
  return /^\d{1,9}$/.test(wert) && Number(wert) > 0 ? Number(wert) : null;
}

/**
 * Die Abfrage des Seitenwegs, geprüft. Ein unlesbarer Wert wird NICHT still verworfen — sonst
 * zeigte die Fläche eine ungefilterte Liste unter einem gesetzten Filter. Er ist ein 400.
 */
function leseSeitenAnfrage(q: SeitenQuery): AuditSeitenAnfrage | string {
  const anfrage: AuditSeitenAnfrage = {};
  const text = (wert: string | undefined): string | undefined =>
    typeof wert === "string" && wert.trim() !== "" ? wert.trim() : undefined;
  const actor = text(q.actor);
  const action = text(q.action);
  const target = text(q.target);
  if (actor) {
    anfrage.actor = actor;
  }
  if (action) {
    anfrage.action = action;
  }
  if (target) {
    anfrage.target = target;
  }
  const actions = text(q.actions)
    ?.split(",")
    .map((a) => a.trim())
    .filter((a) => a !== "");
  if (actions && actions.length > 0) {
    anfrage.actions = actions;
  }
  for (const feld of ["from", "to"] as const) {
    const roh = text(q[feld]);
    if (roh !== undefined) {
      const iso = isoZeitpunkt(roh);
      if (iso === null) {
        return `Zeitpunkt „${feld}" ist nicht lesbar.`;
      }
      anfrage[feld] = iso;
    }
  }
  if (anfrage.from && anfrage.to && anfrage.from >= anfrage.to) {
    return "Der Zeitraum endet nicht nach seinem Beginn.";
  }
  for (const feld of ["before", "limit"] as const) {
    const roh = text(q[feld]);
    if (roh !== undefined) {
      const zahl = ganzzahl(roh);
      if (zahl === null) {
        return `„${feld}" ist keine positive ganze Zahl.`;
      }
      anfrage[feld] = zahl;
    }
  }
  return anfrage;
}

type Namensbeleg = Pick<AuditEntry, "seq" | "actor" | "action" | "target" | "payload">;

/**
 * Die Namensbelege auf das Nötige verkürzt: wer, welche Aktion, welches Ziel und NUR die
 * gespeicherten Namen. Die übrige Nutzlast eines fremden Eintrags gehört nicht zu dieser Seite.
 */
function namensbeleg(e: AuditEntry): Namensbeleg {
  const payload: Record<string, unknown> = {};
  if (typeof e.payload.actorName === "string") {
    payload.actorName = e.payload.actorName;
  }
  if (typeof e.payload.targetName === "string") {
    payload.targetName = e.payload.targetName;
  }
  return { seq: e.seq, actor: e.actor, action: e.action, target: e.target, payload };
}

// Audit-Log (§2.4 / FR-AUD). Governance-Einsicht: Controller/Admin (ko.validate-Recht).
//
// produkt:20261009:admin-audit-verstaendlich: `kos` ist der Objektzugang, über den die Ausgabe
// Titel und Rücklinks nur für Objekte nennt, die der Betrachter JETZT öffnen darf, und Inhaltsfelder
// fremder Objekte schwärzt (`../audit-sicht.ts`). Fehlt er, ist nichts sichtbar — enger, nie weiter.
export function auditRoutes(
  audit: AuditService,
  guards: Guards,
  befunde: readonly BefundKennungen[] = [],
  kos?: AuditObjektZugang,
): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: AuditFilter }>("/api/audit", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      const sicht = auditSichtFuer(user, kos);
      const eintraege = await audit.list(request.query);
      reply.code(200).send(await Promise.all(eintraege.map((e) => sicht.eintrag(e))));
    });

    // produkt:20261009:admin-audit-verstaendlich (ADMIN-03) — DER SEITENWEG DER VERWALTERANSICHT.
    //
    // Dieselbe Tür wie `/api/audit`. Statt der Gesamtliste eine Seite (jüngste zuerst, höchstens
    // `AUDIT_SEITE_MAX`), kombinierbar gefiltert nach Person (`actor`), Aktion (`action` oder
    // mehrere über `actions`), Ziel (`target`) und Zeitraum (`from`/`to`). Dazu, was die Fläche zum
    // Lesen braucht, ohne die Kette ein zweites Mal zu laden:
    //   · `objekte`       Titel der betroffenen Objekte — NUR die, die der Betrachter öffnen darf;
    //   · `namensbelege`  die Einträge, in denen die Kette Namen zu Kennungen dieser Seite gespeichert
    //                     hat (für gelöschte Konten), auf Kennungen und Namen verkürzt.
    app.get<{ Querystring: SeitenQuery }>("/api/audit/seite", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      const anfrage = leseSeitenAnfrage(request.query ?? {});
      if (typeof anfrage === "string") {
        reply.code(400).send({ error: "BAD_REQUEST", message: anfrage });
        return;
      }
      const sicht = auditSichtFuer(user, kos);
      const seite = await audit.page(anfrage);
      const entries = await Promise.all(seite.entries.map((e) => sicht.eintrag(e)));
      const objekte: Record<string, AuditObjektSicht> = {};
      for (const ziel of new Set(seite.entries.map((e) => e.target))) {
        const o = await sicht.objekt(ziel);
        if (o !== undefined) {
          objekte[ziel] = o;
        }
      }
      const kennungen = seite.entries.flatMap((e) => [e.actor, e.target]);
      const namensbelege = (await audit.namensbelege(kennungen)).map(namensbeleg);
      reply.code(200).send({
        entries,
        nextBefore: seite.nextBefore,
        limit: seite.limit,
        objekte,
        namensbelege,
      });
    });

    // SCRUM-439: aktive Integritätsprüfung der Audit-Kette (verify statt nur Aussage). Governance-
    // Einsicht wie /api/audit (ko.validate). Antwort: { ok, count } — Grundlage des Admin-Knopfs.
    //
    // produkt:20261009:admin-audit-verstaendlich: die Antwort trägt den ZEITPUNKT der Prüfung
    // (`checkedAt`). Die Fläche nennt einen erfolgreichen Nachweis nur mit diesem Zeitpunkt — ein
    // Ergebnis ohne Zeit ist für sie kein Nachweis.
    app.get("/api/audit/verify", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      const bericht = await audit.verifyReport();
      reply.code(200).send({ ...bericht, checkedAt: new Date().toISOString() });
    });

    // R-0766 (Aufnahme gesamt-auditprotokoll, Lauf 2): die Kennungen der Konflikte und
    // Überschneidungen eines Objekts — offen und abgeschlossen. Die Kette am Objekt (`koAuditEvents`)
    // ordnet damit auch Altbelege zu, die das Objekt nicht selbst nennen. Nur Kennungen, die im
    // Protokoll ohnehin als Ziel stehen; deshalb dieselbe Tür wie `/api/audit`.
    app.get<{ Params: { koId: string } }>(
      "/api/audit/ko/:koId/findings",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        const ids = new Set<string>();
        for (const quelle of befunde) {
          for (const id of await quelle.idsForKo(request.params.koId)) {
            ids.add(id);
          }
        }
        reply.code(200).send({ ids: [...ids] });
      },
    );

    // R-0613: die Kette als Datei — Einträge, Prüfbericht und Kopf (letzte Sequenz + Hash) für die
    // Ablage außerhalb der Datenbank. Dieselbe Einsichtsstufe wie `/api/audit`, das dieselben
    // Einträge ohnehin vollständig ausgibt. Der Abruf selbst wird als `audit.exported` angehängt.
    //
    // FR-AUD-02: unter `/api/audit` gibt es ausschließlich GET-Wege. Ein POST/PUT/PATCH/
    // DELETE ist nirgends registriert — `tests/audit-gesamt/append-only-http.test.ts` misst das.
    //
    // produkt:20261009:admin-audit-verstaendlich: auch die Datei schwärzt Inhaltsfelder zu Objekten,
    // die der Exportierende nicht öffnen darf (`geschwaerzt` je Eintrag, Anzahl im Kopf). Kopf und
    // `inspection` beschreiben weiter die VOLLSTÄNDIGE Kette; ein geschwärzter Eintrag lässt sich in
    // der Datei deshalb nicht nachrechnen, und genau das sagt sein `geschwaerzt`.
    app.get("/api/audit/export", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      const datei = await audit.exportChain(user.id);
      const sicht = auditSichtFuer(user, kos);
      const entries = await Promise.all(datei.entries.map((e) => sicht.eintrag(e)));
      const geschwaerzt = entries.filter((e) => e.geschwaerzt !== undefined).length;
      const stempel = datei.exportedAt.replace(/[:.]/g, "-");
      reply
        .header("content-disposition", `attachment; filename="klarwerk-audit-${stempel}.json"`)
        .code(200)
        .send({ ...datei, entries, geschwaerzt });
    });
  };
}
