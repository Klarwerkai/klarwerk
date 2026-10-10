// ================================================================================================
// INTERNER CHAT — GESPRÄCHE, NACHRICHTEN, ERWÄHNUNGEN, WISSENSÜBERNAHME (`../chat.ts`).
// ================================================================================================
//
// RECHTE NACH DEN BESTEHENDEN REGELN, KEINE EIGENE AUSLEGUNG:
//   · Jede Tür verlangt `ko.read` (alle Rollen); die Wissensübernahme zusätzlich `ko.create` — es
//     entsteht ein Entwurf, und Entwürfe legt an, wer erfassen darf.
//   · Ein Direkt-/Gruppengespräch liest nur, wer darin steht. Ein Spacegespräch liest, wer die
//     Inhalte des Space lesen darf (`darfSpaceInhalteLesen`, dieselbe Regel wie die Space-Liste).
//     Ein Artikelgespräch liest, wer den Artikel sehen darf (`darfSehen` aus `../sichtbarkeit`).
//     Beides wird bei JEDEM Abruf neu entschieden.
//   · Verweise, Ausschnitte und Anhänge in Nachrichten werden je lesender Person gegen `darfSehen`
//     gehalten. Was sie (nicht mehr) sehen darf, erscheint als „nicht verfügbar" — ohne Titel,
//     ohne Text, ohne Dateiname.
//
// EIN UNSICHTBARES GESPRÄCH ODER EINE UNSICHTBARE NACHRICHT IST 404, NICHT 403.
import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import type { AuthService, PublicUser } from "../../../auth";
import type { DraftPayload } from "../../../capture";
import {
  type Confidentiality,
  type KnowledgeObject,
  type KoService,
  normalizeConfidentiality,
} from "../../../knowledge-object";
import {
  CHAT_GRENZEN,
  type ChatAusschnitt,
  ChatFehler,
  type ChatNachricht,
  type ChatRepo,
  type Gespraech,
  type GespraechEingabe,
  type NachrichtEingabe,
  direktSchluessel,
  gleicheSendung,
  pruefeGespraechEingabe,
  pruefeNachrichtEingabe,
  sichtbarkeitVon,
} from "../chat";
import { type Guards, type SessionUser, sendError } from "../http";
import { darfSehen } from "../sichtbarkeit";
import {
  type SpaceFassung,
  type SpacesRepo,
  darfSpaceInhalteLesen,
  lesbareSpaces,
} from "../spaces";

export interface ChatRouteDienste {
  chat: ChatRepo;
  ko: KoService;
  auth: AuthService;
  spaces: SpacesRepo;
  /** Der bestehende Entwurfsweg (`CaptureService`). */
  entwuerfe: {
    createDraft(payload: DraftPayload, author: string): Promise<{ id: string }>;
  };
  audit?: AuditService;
  /** Uhr für Zeitstempel — in Tests stellbar. */
  jetzt?: () => Date;
}

function nichtGefunden(reply: FastifyReply, was: string): void {
  reply.code(404).send({ error: "NOT_FOUND", message: `${was} nicht gefunden.` });
}

function chatFehler(reply: FastifyReply, e: unknown): void {
  if (e instanceof ChatFehler) {
    reply.code(e.code === "CHAT_KONFLIKT" ? 409 : 400).send({ error: e.code, message: e.message });
    return;
  }
  sendError(reply, e);
}

function escapeHtml(roh: string): string {
  return roh
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Was eine Wissensübernahme an Stufe vorschlägt: nie weniger als die Herkunft. */
function stufeFuerUebernahme(
  g: Gespraech,
  space: SpaceFassung | undefined,
  ko: KnowledgeObject | undefined,
): Confidentiality {
  if (g.art === "direkt" || g.art === "gruppe") {
    return "vertraulich";
  }
  if (g.art === "space") {
    return space?.zugang === "alle" ? "intern" : "vertraulich";
  }
  return normalizeConfidentiality(ko?.confidentiality);
}

export function chatRoutes(dienste: ChatRouteDienste, guards: Guards): FastifyPluginAsync {
  const jetzt = dienste.jetzt ?? (() => new Date());
  // Zwei gleichzeitige Übernahmen derselben Nachricht durch dieselbe Person legen EINEN Entwurf an.
  const laufendeUebernahmen = new Map<string, Promise<{ entwurfId: string; neu: boolean }>>();

  async function chatKonten(): Promise<PublicUser[]> {
    return (await dienste.auth.listUsers()).filter((u) => u.approved);
  }

  /** Die Sicht eines beliebigen Kontos — so, wie `makeGuards` sie für dessen Anfrage bilden würde. */
  function chatSitzungVon(u: PublicUser, spaces: readonly SpaceFassung[]): SessionUser {
    return { id: u.id, role: u.role, spaceLesbar: lesbareSpaces(spaces, u.id) };
  }

  /** Liest ein Wissensobjekt höchstens einmal je Anfrage. */
  function koLader(): (id: string) => Promise<KnowledgeObject | undefined> {
    const geladen = new Map<string, Promise<KnowledgeObject | undefined>>();
    return (id: string) => {
      let p = geladen.get(id);
      if (!p) {
        p = dienste.ko.get(id).catch(() => undefined);
        geladen.set(id, p);
      }
      return p;
    };
  }

  /** Darf diese Sicht das Wissensobjekt JETZT sehen? Fehlt es, ist die Antwort nein. */
  async function koFuer(
    sicht: SessionUser,
    koId: string,
    laden: (id: string) => Promise<KnowledgeObject | undefined>,
  ): Promise<KnowledgeObject | undefined> {
    const ko = await laden(koId);
    if (ko && darfSehen(sicht, ko)) {
      return ko;
    }
    return undefined;
  }

  /** Darf diese Sicht das Gespräch lesen — jetzt, nach Teilnahme, Space- oder Artikelrecht? */
  async function chatLeserecht(
    sicht: SessionUser,
    g: Gespraech,
    spaces: readonly SpaceFassung[],
    laden: (id: string) => Promise<KnowledgeObject | undefined>,
  ): Promise<boolean> {
    if (g.art === "direkt" || g.art === "gruppe") {
      return g.teilnehmer.includes(sicht.id);
    }
    if (g.art === "space") {
      const space = spaces.find((s) => s.id === g.spaceId);
      return space !== undefined && darfSpaceInhalteLesen(space, sicht.id);
    }
    if (typeof g.koId !== "string") {
      return false;
    }
    return (await koFuer(sicht, g.koId, laden)) !== undefined;
  }

  interface Anfragekontext {
    user: SessionUser;
    spaces: SpaceFassung[];
    namen: Map<string, string>;
    laden: (id: string) => Promise<KnowledgeObject | undefined>;
  }

  async function kontextFuer(user: SessionUser): Promise<Anfragekontext> {
    const [spaces, alle] = await Promise.all([dienste.spaces.aktuelle(), chatKonten()]);
    return { user, spaces, namen: new Map(alle.map((u) => [u.id, u.name])), laden: koLader() };
  }

  /** Liest das Gespräch, wenn diese Person es jetzt lesen darf — sonst `undefined` (→ 404). */
  async function lesbaresGespraech(k: Anfragekontext, id: string): Promise<Gespraech | undefined> {
    const g = await dienste.chat.gespraech(id);
    if (g && (await chatLeserecht(k.user, g, k.spaces, k.laden))) {
      return g;
    }
    return undefined;
  }

  async function gespraechSicht(k: Anfragekontext, g: Gespraech) {
    let titel = g.titel;
    let artikel: {
      koId: string;
      titel: string;
      fassung: number;
      anhaenge: { id: string; name: string }[];
    } | null = null;
    let space: { id: string; name: string } | null = null;
    if (g.art === "direkt") {
      const andere = g.teilnehmer.find((id) => id !== k.user.id) ?? k.user.id;
      titel = k.namen.get(andere) ?? andere;
    } else if (g.art === "space") {
      const s = k.spaces.find((x) => x.id === g.spaceId);
      if (s) {
        space = { id: s.id, name: s.name };
        titel = s.name;
      }
    } else if (g.art === "artikel" && typeof g.koId === "string") {
      const ko = await koFuer(k.user, g.koId, k.laden);
      if (ko) {
        // Die Anhänge, die in diesem Gespräch mitgeschickt werden dürfen: die des Artikels selbst,
        // die im Object-Store liegen (der Abruf prüft dort dieselbe Regel).
        const anhaenge = ko.attachments
          .filter((a) => typeof a.objectId === "string")
          .map((a) => ({ id: a.id, name: a.name }));
        artikel = { koId: ko.id, titel: ko.title, fassung: ko.version, anhaenge };
        titel = ko.title;
      }
    }
    return {
      id: g.id,
      art: g.art,
      sichtbarkeit: sichtbarkeitVon(g.art),
      titel,
      teilnehmer: g.teilnehmer.map((id) => ({ id, name: k.namen.get(id) ?? null })),
      space,
      artikel,
      angelegtAm: g.angelegtAm,
    };
  }

  async function ausschnittSicht(k: Anfragekontext, a: ChatAusschnitt) {
    if (a.fiktiv) {
      return {
        sichtbar: true as const,
        text: a.text,
        fiktiv: true,
        quelle: a.quelle,
        koId: null,
        fassung: null,
        pfad: a.pfad ?? null,
      };
    }
    if (typeof a.koId !== "string") {
      return { sichtbar: false as const };
    }
    const ko = await koFuer(k.user, a.koId, k.laden);
    if (!ko) {
      return { sichtbar: false as const };
    }
    return {
      sichtbar: true as const,
      text: a.text,
      fiktiv: false,
      quelle: a.quelle,
      koId: ko.id,
      fassung: a.fassung ?? null,
      pfad: null,
    };
  }

  async function nachrichtSicht(k: Anfragekontext, n: ChatNachricht) {
    const verweise = [];
    for (const koId of n.verweise) {
      const ko = await koFuer(k.user, koId, k.laden);
      if (ko) {
        verweise.push({
          sichtbar: true as const,
          koId: ko.id,
          titel: ko.title,
          fassung: ko.version,
          vorschau: ko.statement.slice(0, 200),
        });
      } else {
        verweise.push({ sichtbar: false as const });
      }
    }
    const anhaenge = [];
    for (const verweis of n.anhaenge) {
      const ko = await koFuer(k.user, verweis.koId, k.laden);
      const anhang = ko?.attachments.find((x) => x.id === verweis.anhangId);
      if (ko && anhang && typeof anhang.objectId === "string") {
        anhaenge.push({
          sichtbar: true as const,
          koId: ko.id,
          anhangId: anhang.id,
          name: anhang.name,
          mime: anhang.mime,
          groesse: anhang.size ?? null,
          // Der Abruf selbst prüft die Trägerregel noch einmal (`object-routes.ts`).
          url: `/api/objects/${encodeURIComponent(anhang.objectId)}/raw`,
        });
      } else {
        anhaenge.push({ sichtbar: false as const });
      }
    }
    let ausschnitt = null;
    if (n.ausschnitt) {
      ausschnitt = await ausschnittSicht(k, n.ausschnitt);
    }
    const eigene = n.uebernahmen.find((u) => u.von === k.user.id);
    return {
      id: n.id,
      gespraechId: n.gespraechId,
      von: n.von,
      vonName: k.namen.get(n.von) ?? null,
      eigene: n.von === k.user.id,
      text: n.text,
      am: n.am,
      sendeKennung: n.von === k.user.id ? n.sendeKennung : null,
      erwaehnungen: n.erwaehnungen.map((id) => ({ id, name: k.namen.get(id) ?? null })),
      verweise,
      anhaenge,
      ausschnitt,
      ausKlara: n.ausKlara === true,
      eigeneUebernahme: eigene ? { entwurfId: eigene.entwurfId, am: eigene.am } : null,
    };
  }

  /**
   * Prüft die Rechte einer Sendung: Erwähnte müssen das Gespräch lesen können, Verweise,
   * Ausschnitt und Anhänge muss der Absender JETZT sehen dürfen. Liefert einen Fehler oder `null`.
   */
  async function sendungsfehler(
    k: Anfragekontext,
    g: Gespraech,
    e: NachrichtEingabe,
  ): Promise<{ code: string; message: string } | null> {
    if (e.erwaehnungen.length > 0) {
      const alle = await chatKonten();
      for (const id of e.erwaehnungen) {
        const konto = alle.find((u) => u.id === id);
        const kannLesen =
          konto !== undefined &&
          (await chatLeserecht(chatSitzungVon(konto, k.spaces), g, k.spaces, k.laden));
        if (!kannLesen) {
          return {
            code: "ERWAEHNUNG_OHNE_ZUGANG",
            message: "Erwähnt werden kann nur, wer dieses Gespräch lesen darf.",
          };
        }
      }
    }
    for (const koId of e.verweise) {
      if (!(await koFuer(k.user, koId, k.laden))) {
        return {
          code: "VERWEIS_UNBEKANNT",
          message: "Ein verwiesener Artikel ist nicht verfügbar.",
        };
      }
    }
    for (const a of e.anhaenge) {
      const ko = await koFuer(k.user, a.koId, k.laden);
      const anhang = ko?.attachments.find((x) => x.id === a.anhangId);
      if (!anhang || typeof anhang.objectId !== "string") {
        return { code: "ANHANG_UNBEKANNT", message: "Ein Anhang ist nicht verfügbar." };
      }
    }
    if (e.ausschnitt && typeof e.ausschnitt.koId === "string") {
      if (!(await koFuer(k.user, e.ausschnitt.koId, k.laden))) {
        return {
          code: "VERWEIS_UNBEKANNT",
          message: "Der Artikel des Ausschnitts ist nicht verfügbar.",
        };
      }
    }
    return null;
  }

  async function wissenUebernehmen(
    k: Anfragekontext,
    g: Gespraech,
    n: ChatNachricht,
  ): Promise<{ entwurfId: string; neu: boolean }> {
    const bisher = n.uebernahmen.find((u) => u.von === k.user.id);
    if (bisher) {
      return { entwurfId: bisher.entwurfId, neu: false };
    }
    const space = g.art === "space" ? k.spaces.find((s) => s.id === g.spaceId) : undefined;
    let ko: KnowledgeObject | undefined;
    if (g.art === "artikel" && typeof g.koId === "string") {
      ko = await koFuer(k.user, g.koId, k.laden);
    }
    const ausschnitt = n.ausschnitt ? await ausschnittSicht(k, n.ausschnitt) : null;
    const erste = n.text.split("\n")[0]?.trim() ?? "";
    const titel = (erste || n.text).slice(0, 120);
    const art = sichtbarkeitVon(g.art) === "persoenlich" ? "persönliche" : "geteilte";
    const von = k.namen.get(n.von) ?? n.von;
    const absaetze = n.text
      .split(/\n{2,}/)
      .map((absatz) => `<p>${escapeHtml(absatz).replace(/\n/g, "<br>")}</p>`)
      .join("");
    let zitat = "";
    if (ausschnitt?.sichtbar) {
      const zitatText = escapeHtml(ausschnitt.text);
      const zitatQuelle = escapeHtml(ausschnitt.quelle);
      zitat = `<blockquote><p>${zitatText}</p><p>${zitatQuelle}</p></blockquote>`;
    }
    const vonHtml = escapeHtml(von);
    const amHtml = escapeHtml(n.am.slice(0, 10));
    const herkunft = `<p>Aus dem internen Chat übernommen: ${art} Nachricht von ${vonHtml} vom ${amHtml}.</p>`;
    const entwurf = await dienste.entwuerfe.createDraft(
      {
        title: titel,
        statement: n.text.slice(0, 2_000),
        bodyHtml: `${absaetze}${zitat}${herkunft}`,
        confidentiality: stufeFuerUebernahme(g, space, ko),
        tags: ["chat"],
      },
      k.user.id,
    );
    await dienste.chat.vermerkeUebernahme(n.id, {
      von: k.user.id,
      entwurfId: entwurf.id,
      am: jetzt().toISOString(),
    });
    await dienste.audit?.record({
      actor: k.user.id,
      action: "chat.wissen_uebernommen",
      target: n.id,
      payload: { gespraech: g.id, art: g.art, entwurf: entwurf.id },
    });
    return { entwurfId: entwurf.id, neu: true };
  }

  return async (app) => {
    // Die Konten, die als Empfänger, Gruppenmitglieder oder Erwähnte wählbar sind — Kennung, Name,
    // Rolle; keine Mailadressen.
    app.get("/api/chat/konten", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send({
        ich: user.id,
        konten: (await chatKonten())
          .map((u) => ({ id: u.id, name: u.name, role: u.role }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      });
    });

    // Die Gespräche, die diese Person JETZT lesen darf — mit letzter Nachricht und Anzahl. Dazu die
    // Spaces, in denen sie ein Spacegespräch beginnen kann.
    app.get("/api/chat/gespraeche", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const k = await kontextFuer(user);
      const lesbar: Gespraech[] = [];
      for (const g of await dienste.chat.gespraecheFuer(user.id)) {
        if (await chatLeserecht(user, g, k.spaces, k.laden)) {
          lesbar.push(g);
        }
      }
      const ueberblick = await dienste.chat.ueberblick(lesbar.map((g) => g.id));
      const liste = [];
      for (const g of lesbar) {
        const stand = ueberblick.get(g.id);
        liste.push({
          ...(await gespraechSicht(k, g)),
          anzahl: stand?.anzahl ?? 0,
          letzte: stand
            ? {
                vonName: k.namen.get(stand.letzte.von) ?? null,
                text: stand.letzte.text.slice(0, 140),
                am: stand.letzte.am,
              }
            : null,
        });
      }
      liste.sort((a, b) =>
        (b.letzte?.am ?? b.angelegtAm).localeCompare(a.letzte?.am ?? a.angelegtAm),
      );
      reply.code(200).send({
        gespraeche: liste,
        spaces: k.spaces
          .filter((s) => darfSpaceInhalteLesen(s, user.id))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((s) => ({ id: s.id, name: s.name })),
      });
    });

    // Ein Gespräch beginnen — oder das bestehende Direkt-, Space- bzw. Artikelgespräch öffnen.
    app.post<{ Body: unknown }>("/api/chat/gespraeche", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      let eingabe: GespraechEingabe;
      try {
        eingabe = pruefeGespraechEingabe(request.body, user.id);
      } catch (e) {
        chatFehler(reply, e);
        return;
      }
      const k = await kontextFuer(user);
      let schluessel: string | undefined;
      if (eingabe.art === "direkt" || eingabe.art === "gruppe") {
        const vorhanden = new Set((await chatKonten()).map((u) => u.id));
        if (eingabe.teilnehmer.some((id) => !vorhanden.has(id))) {
          reply.code(400).send({
            error: "CHAT_UNGUELTIG",
            message: "Eine teilnehmende Person ist kein bestehendes Konto.",
          });
          return;
        }
        if (eingabe.art === "direkt") {
          schluessel = direktSchluessel(eingabe.teilnehmer[0] ?? "", eingabe.teilnehmer[1] ?? "");
        }
      } else if (eingabe.art === "space") {
        const space = k.spaces.find((s) => s.id === eingabe.spaceId);
        if (!space || !darfSpaceInhalteLesen(space, user.id)) {
          nichtGefunden(reply, "Space");
          return;
        }
        schluessel = `space:${space.id}`;
      } else {
        const ko = await koFuer(user, eingabe.koId ?? "", k.laden);
        if (!ko) {
          nichtGefunden(reply, "Wissensobjekt");
          return;
        }
        schluessel = `artikel:${ko.id}`;
      }
      const neu: Gespraech = {
        id: randomUUID(),
        art: eingabe.art,
        titel: eingabe.titel,
        teilnehmer: eingabe.teilnehmer,
        ...(eingabe.spaceId ? { spaceId: eingabe.spaceId } : {}),
        ...(eingabe.koId ? { koId: eingabe.koId } : {}),
        angelegtVon: user.id,
        angelegtAm: jetzt().toISOString(),
        ...(schluessel ? { schluessel } : {}),
      };
      try {
        const ergebnis = await dienste.chat.legeGespraech(neu);
        reply.code(ergebnis.neu ? 201 : 200).send(await gespraechSicht(k, ergebnis.gespraech));
      } catch (e) {
        chatFehler(reply, e);
      }
    });

    // Ein Gespräch mit seinem Verlauf — jede Nachricht so, wie DIESE Person sie sehen darf.
    app.get<{ Params: { id: string }; Querystring: { vor?: string } }>(
      "/api/chat/gespraeche/:id",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const k = await kontextFuer(user);
        const g = await lesbaresGespraech(k, request.params.id);
        if (!g) {
          nichtGefunden(reply, "Gespräch");
          return;
        }
        // Nacharbeit 3 (Ben, K2/K3): der frühere Verlauf ist seitenweise nachladbar. `vor` nennt
        // die älteste schon gezeigte Nachricht; sie muss zu DIESEM Gespräch gehören. Das Leserecht
        // ist oben für jede Seite neu entschieden — ein Entzug wirkt auch auf das Nachladen.
        let vor: ChatNachricht | undefined;
        const vorId = request.query.vor;
        if (typeof vorId === "string" && vorId.length > 0) {
          vor = await dienste.chat.nachricht(vorId);
          if (!vor || vor.gespraechId !== g.id) {
            nichtGefunden(reply, "Nachricht");
            return;
          }
        }
        const grenze = CHAT_GRENZEN.nachrichtenJeAbruf;
        // Eine Nachricht mehr lesen, als gezeigt wird: so steht fest, ob es noch Älteres gibt.
        const geladen = await dienste.chat.nachrichten(g.id, grenze + 1, vor);
        const aelterVorhanden = geladen.length > grenze;
        const verlauf = aelterVorhanden ? geladen.slice(1) : geladen;
        const nachrichten = [];
        for (const n of verlauf) {
          nachrichten.push(await nachrichtSicht(k, n));
        }
        const gespraech = await gespraechSicht(k, g);
        reply.code(200).send({ gespraech, nachrichten, aelterVorhanden });
      },
    );

    // Nacharbeit 3 (Ben, K3): eine einzelne Nachricht mit ihrem Gespräch — der Weg einer Erwähnung
    // zu ihrer Zielnachricht, unabhängig davon, wie viele neuere Nachrichten seither kamen. Dieselbe
    // Leseregel wie der Verlauf; unsichtbar ist 404.
    app.get<{ Params: { id: string } }>("/api/chat/nachrichten/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const n = await dienste.chat.nachricht(request.params.id);
      const k = await kontextFuer(user);
      const g = n ? await lesbaresGespraech(k, n.gespraechId) : undefined;
      if (!n || !g) {
        nichtGefunden(reply, "Nachricht");
        return;
      }
      const nachricht = await nachrichtSicht(k, n);
      reply.code(200).send({ gespraech: await gespraechSicht(k, g), nachricht });
    });

    // Nacharbeit 6 (Ben, K4): schon angezeigte ältere Nachrichten JETZT neu ansehen. Die Seite
    // schickt die Kennungen, die sie zeigt; zurück kommt jede so, wie DIESE Person sie heute sehen
    // darf (Verweise, Ausschnitte, Anhänge neu gegen `darfSehen`). Was nicht (mehr) zu diesem
    // Gespräch gehört, fehlt; ist das Gespräch selbst nicht mehr lesbar, 404.
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/chat/gespraeche/:id/auffrischen",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const roh = (request.body as { ids?: unknown } | null)?.ids;
        if (
          !Array.isArray(roh) ||
          roh.length > CHAT_GRENZEN.nachrichtenJeAbruf ||
          roh.some((x) => typeof x !== "string" || x.length === 0 || x.length > 80)
        ) {
          reply.code(400).send({
            error: "CHAT_UNGUELTIG",
            message: `Erwartet werden höchstens ${CHAT_GRENZEN.nachrichtenJeAbruf} Nachrichtenkennungen.`,
          });
          return;
        }
        const k = await kontextFuer(user);
        const g = await lesbaresGespraech(k, request.params.id);
        if (!g) {
          nichtGefunden(reply, "Gespräch");
          return;
        }
        const gefunden = await dienste.chat.nachrichtenMitKennungen(g.id, roh as string[]);
        const nachrichten = [];
        for (const n of gefunden) {
          nachrichten.push(await nachrichtSicht(k, n));
        }
        reply.code(200).send({ nachrichten });
      },
    );

    // Senden. Dieselbe Sendekennung ein zweites Mal legt NICHTS Neues an (200 statt 201).
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/chat/gespraeche/:id/nachrichten",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const k = await kontextFuer(user);
        const g = await lesbaresGespraech(k, request.params.id);
        if (!g) {
          nichtGefunden(reply, "Gespräch");
          return;
        }
        let eingabe: NachrichtEingabe;
        try {
          eingabe = pruefeNachrichtEingabe(request.body);
        } catch (e) {
          chatFehler(reply, e);
          return;
        }
        const problem = await sendungsfehler(k, g, eingabe);
        if (problem) {
          reply.code(400).send({ error: problem.code, message: problem.message });
          return;
        }
        const nachricht: ChatNachricht = {
          id: randomUUID(),
          gespraechId: g.id,
          von: user.id,
          text: eingabe.text,
          am: jetzt().toISOString(),
          sendeKennung: eingabe.sendeKennung,
          erwaehnungen: eingabe.erwaehnungen,
          verweise: eingabe.verweise,
          anhaenge: eingabe.anhaenge,
          ...(eingabe.ausschnitt ? { ausschnitt: eingabe.ausschnitt } : {}),
          ...(eingabe.ausKlara ? { ausKlara: true as const } : {}),
          uebernahmen: [],
        };
        try {
          const ergebnis = await dienste.chat.legeNachricht(nachricht);
          if (!ergebnis.neu && !gleicheSendung(ergebnis.nachricht, eingabe)) {
            reply.code(409).send({
              error: "SENDEKENNUNG_BELEGT",
              message: "Diese Sendekennung gehört zu einer anderen Nachricht.",
            });
            return;
          }
          const antwort = await nachrichtSicht(k, ergebnis.nachricht);
          reply.code(ergebnis.neu ? 201 : 200).send({ nachricht: antwort, neu: ergebnis.neu });
        } catch (e) {
          chatFehler(reply, e);
        }
      },
    );

    // Eine hilfreiche Nachricht gezielt in Wissen übernehmen: es entsteht ein PERSÖNLICHER Entwurf
    // der übernehmenden Person (sie verantwortet ihn), mit Herkunftsvermerk und einer Stufe, die nie
    // offener ist als die Herkunft. Eine zweite Übernahme durch dieselbe Person öffnet denselben.
    app.post<{ Params: { id: string } }>(
      "/api/chat/nachrichten/:id/wissen",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const n = await dienste.chat.nachricht(request.params.id);
        const k = await kontextFuer(user);
        const g = n ? await lesbaresGespraech(k, n.gespraechId) : undefined;
        if (!n || !g) {
          nichtGefunden(reply, "Nachricht");
          return;
        }
        const schluessel = `${n.id}|${user.id}`;
        let lauf = laufendeUebernahmen.get(schluessel);
        if (!lauf) {
          lauf = wissenUebernehmen(k, g, n);
          laufendeUebernahmen.set(schluessel, lauf);
          const aufraeumen = (): void => {
            laufendeUebernahmen.delete(schluessel);
          };
          lauf.then(aufraeumen, aufraeumen);
        }
        try {
          const ergebnis = await lauf;
          reply.code(ergebnis.neu ? 201 : 200).send({
            entwurfId: ergebnis.entwurfId,
            neu: ergebnis.neu,
            herkunft: sichtbarkeitVon(g.art),
          });
        } catch (e) {
          sendError(reply, e);
        }
      },
    );

    // Die Erwähnungen dieser Person — nur aus Gesprächen, die sie JETZT noch lesen darf. Jede führt
    // genau zu ihrer Nachricht in ihrem Gespräch.
    app.get("/api/chat/erwaehnungen", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const k = await kontextFuer(user);
      const raus = [];
      const erwaehnt = await dienste.chat.erwaehnungenVon(
        user.id,
        CHAT_GRENZEN.erwaehnungenJeAbruf,
      );
      for (const n of erwaehnt) {
        const g = await lesbaresGespraech(k, n.gespraechId);
        if (!g) {
          continue;
        }
        const sicht = await gespraechSicht(k, g);
        raus.push({
          nachrichtId: n.id,
          gespraechId: g.id,
          gespraechTitel: sicht.titel,
          art: g.art,
          vonName: k.namen.get(n.von) ?? null,
          am: n.am,
          auszug: n.text.slice(0, 140),
        });
      }
      reply.code(200).send({ erwaehnungen: raus });
    });
  };
}
