// ================================================================================================
// VORLAGEN — Auswahl, eigene Vorlagen, persönlicher Standard, Space-Vorgaben, Nutzung, Begriffe
// (produkt:20261007:templates-default · ADMIN-08). Regeln und Ablage: `../vorlagen.ts`.
// ================================================================================================
//
// RECHTE werden je Anfrage aus den bestehenden Regeln erhoben (Rolle, Space-Lese-/Schreibrecht,
// Spaceverwaltung). Eine unsichtbare Vorlage ist 404, nicht 403 — eine Absage, die ihre Existenz
// bestätigt, wäre schon eine Auskunft. Verwaltungssichten (Nutzungsumfang über den ganzen Bestand,
// Begriffspflege) verlangen `users.manage` und nennen Titel nur, wo `darfSehen` sie erlaubt.
import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import type { AuthService } from "../../../auth";
import type { KnowledgeObject, KoService } from "../../../knowledge-object";
import { can } from "../../../rbac";
import { type Guards, type SessionUser, sendError } from "../http";
import { darfSehen, sichtbareFuer } from "../sichtbarkeit";
import {
  type SpaceFassung,
  type SpacesRepo,
  darfInSpaceSchreiben,
  darfSpaceBearbeiten,
  darfSpaceSehen,
  istArchiviert,
} from "../spaces";
import {
  type BegriffEintrag,
  type NutzungsEintrag,
  type SpaceVorgabe,
  type StandardEintrag,
  type VorlageEingabe,
  type VorlageFassung,
  type VorlagenAblage,
  type VorlagenEinreichungPort,
  VorlagenFehler,
  aenderungswirkung,
  alleVorlagen,
  ansichtenNachher,
  begriffNachher,
  begriffSchluessel,
  begriffsPlan,
  darfInGeltungAblegen,
  darfVorlageAnwenden,
  darfVorlageBearbeiten,
  darfVorlageSehen,
  istStandard,
  nutzungsUmfang,
  pruefeBegriffsAuftrag,
  pruefeBegruendung,
  pruefeSpaceVorgabe,
  pruefeVorlageEingabe,
  spaceVorgabe,
  vorlagenFassungen,
  waehleStartvorlage,
} from "../vorlagen";

export interface VorlagenRouteDienste {
  ablage: VorlagenAblage;
  spaces: SpacesRepo;
  ko: KoService;
  auth: AuthService;
  einreichung: VorlagenEinreichungPort;
  audit?: AuditService;
  jetzt?: () => Date;
}

function fehler(reply: FastifyReply, e: unknown): void {
  if (e instanceof VorlagenFehler) {
    reply.code(e.status).send({ error: e.code, message: e.message });
    return;
  }
  sendError(reply, e);
}

function nichtGefunden(reply: FastifyReply, was = "Vorlage"): void {
  reply.code(404).send({ error: "NOT_FOUND", message: `${was} nicht gefunden.` });
}

function veraltet(reply: FastifyReply, aktuelleVersion: number): void {
  reply.code(409).send({
    error: "VERSION_VERALTET",
    message: "Die Vorlage wurde inzwischen geändert. Bitte neu laden.",
    aktuelleVersion,
  });
}

export function vorlagenRoutes(dienste: VorlagenRouteDienste, guards: Guards): FastifyPluginAsync {
  const jetzt = dienste.jetzt ?? (() => new Date());
  const { ablage } = dienste;

  async function namen(): Promise<Map<string, string>> {
    return new Map((await dienste.auth.listUsers()).map((u) => [u.id, u.name]));
  }

  async function standardVon(nutzer: string): Promise<string | null> {
    return (await ablage.fassungen<StandardEintrag>("standard", nutzer)).at(-1)?.vorlageId ?? null;
  }

  async function aktuelle(id: string): Promise<VorlageFassung | undefined> {
    return (await vorlagenFassungen(ablage, id)).at(-1);
  }

  function sicht(
    v: VorlageFassung,
    user: SessionUser,
    spaces: readonly SpaceFassung[],
    standardId: string | null,
    n: Map<string, string>,
  ) {
    return {
      ...v,
      ausgemustert: v.ausgemustert === true,
      spaceName: v.spaceId ? (spaces.find((s) => s.id === v.spaceId)?.name ?? null) : null,
      eigentuemerName: v.geltung === "standard" ? null : (n.get(v.eigentuemer) ?? null),
      darfBearbeiten: darfVorlageBearbeiten(v, user, spaces),
      darfAnwenden: darfVorlageAnwenden(v, user, spaces),
      istStandard: standardId === v.id,
    };
  }

  /** Die Spaces, in die dieser Mensch Beiträge schreiben (und Vorlagen teilen) darf. */
  function schreibbare(spaces: readonly SpaceFassung[], user: SessionUser) {
    return spaces
      .filter((s) => !istArchiviert(s) && darfInSpaceSchreiben(s, user))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ id: s.id, name: s.name }));
  }

  async function nutzungAlle(): Promise<NutzungsEintrag[]> {
    return ablage.aktuelle<NutzungsEintrag>("nutzung");
  }

  async function koKarte(): Promise<Map<string, KnowledgeObject>> {
    return new Map((await dienste.ko.list({})).map((k) => [k.id, k]));
  }

  async function standardZahl(id: string): Promise<number> {
    return (await ablage.aktuelle<StandardEintrag>("standard")).filter((s) => s.vorlageId === id)
      .length;
  }

  async function verbindlichIn(id: string, spaces: readonly SpaceFassung[]) {
    return (await ablage.aktuelle<SpaceVorgabe>("space-vorgabe"))
      .filter((v) => v.verbindlicheVorlageId === id)
      .map((v) => ({
        spaceId: v.spaceId,
        name: spaces.find((s) => s.id === v.spaceId)?.name ?? v.spaceId,
      }));
  }

  /** Eine neue Fassung ablegen und — wie bei Spaces — wieder lesen. `false` bei parallelem Schreiber. */
  async function legeVorlage(f: VorlageFassung): Promise<boolean> {
    return ablage.lege("vorlage", f.id, f);
  }

  return async (app) => {
    // Auswahl im Editor und die eigene Übersicht: alle Vorlagen, die diese Person sieht, mit ihrem
    // Recht daran, dazu der persönliche Standard und die beschreibbaren Spaces.
    app.get("/api/vorlagen", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const spaces = await dienste.spaces.aktuelle();
      const standardId = await standardVon(user.id);
      const n = await namen();
      reply.code(200).send({
        vorlagen: (await alleVorlagen(ablage))
          .filter((v) => darfVorlageSehen(v, user, spaces))
          .map((v) => sicht(v, user, spaces, standardId, n)),
        standardId,
        spaces: schreibbare(spaces, user),
        darf: {
          anlegen: can(user.role, "ko.create"),
          unternehmen: can(user.role, "users.manage"),
          verwalten: can(user.role, "users.manage"),
        },
        // Spaces, deren Vorgaben diese Person pflegt (Zuständige oder Kontoverwaltung).
        vorgabenSpaces: spaces
          .filter((s) => darfSpaceBearbeiten(s, user))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((s) => ({ id: s.id, name: s.name, archiviert: istArchiviert(s) })),
      });
    });

    // Was eine NEUE Eingabe vorfindet — Vorrangregel: verbindliche Space-Vorlage, dann persönlicher
    // Standard, dann freie Eingabe (mit Grund, wenn der Standard nicht mehr verfügbar ist).
    app.get<{ Querystring: { spaceId?: string } }>(
      "/api/vorlagen/start",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const spaces = await dienste.spaces.aktuelle();
        const spaceId = request.query.spaceId?.trim() || null;
        const space = spaceId ? spaces.find((s) => s.id === spaceId) : undefined;
        if (spaceId && (!space || !darfSpaceSehen(space, user))) {
          nichtGefunden(reply, "Space");
          return;
        }
        const vorgabe = space ? ((await spaceVorgabe(ablage, space.id)) ?? null) : null;
        const alle = await alleVorlagen(ablage);
        const wahl = waehleStartvorlage({
          spaceName: space?.name ?? null,
          vorgabe,
          standardId: await standardVon(user.id),
          alle,
          anwendbar: (v) => darfVorlageAnwenden(v, user, spaces),
        });
        const verbindlich = vorgabe?.verbindlicheVorlageId
          ? alle.find((v) => v.id === vorgabe.verbindlicheVorlageId)
          : undefined;
        reply.code(200).send({
          ...wahl,
          vorlage: wahl.vorlage ? sicht(wahl.vorlage, user, spaces, null, await namen()) : null,
          space: space ? { id: space.id, name: space.name } : null,
          vorgabe,
          // Eine verbindliche Vorlage, die NICHT mehr anwendbar ist, wird benannt statt verschwiegen.
          verbindlichNichtVerfuegbar: Boolean(
            vorgabe?.verbindlicheVorlageId &&
              (!verbindlich || !darfVorlageAnwenden(verbindlich, user, spaces)),
          ),
        });
      },
    );

    // Persönlichen Standard setzen (oder mit `null` aufheben). Nur eine anwendbare Vorlage.
    app.put<{ Body: { vorlageId?: unknown } | null }>(
      "/api/vorlagen/standard",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const roh = request.body?.vorlageId;
        const vorlageId = typeof roh === "string" && roh.trim() ? roh.trim() : null;
        if (roh !== null && roh !== undefined && vorlageId === null) {
          reply.code(400).send({ error: "BAD_REQUEST", message: "vorlageId ist Text oder null." });
          return;
        }
        if (vorlageId) {
          const spaces = await dienste.spaces.aktuelle();
          const v = await aktuelle(vorlageId);
          if (!v || !darfVorlageSehen(v, user, spaces)) {
            nichtGefunden(reply);
            return;
          }
          if (!darfVorlageAnwenden(v, user, spaces)) {
            reply.code(409).send({
              error: "VORLAGE_NICHT_ANWENDBAR",
              message: "Diese Vorlage ist ausgemustert oder in ihrem Space nicht mehr nutzbar.",
            });
            return;
          }
        }
        const bisher = await ablage.fassungen<StandardEintrag>("standard", user.id);
        const eintrag: StandardEintrag = {
          nutzer: user.id,
          vorlageId,
          version: (bisher.at(-1)?.version ?? 0) + 1,
          geaendertVon: user.id,
          geaendertAm: jetzt().toISOString(),
        };
        if (!(await ablage.lege("standard", user.id, eintrag))) {
          reply.code(409).send({ error: "VERSION_VERALTET", message: "Bitte erneut versuchen." });
          return;
        }
        await dienste.audit?.record({
          actor: user.id,
          action: "vorlage.standard-gesetzt",
          target: user.id,
          payload: { vorlageId, vorher: bisher.at(-1)?.vorlageId ?? null },
        });
        reply.code(200).send({ standardId: vorlageId });
      },
    );

    // Dieselbe Prüfung wie beim Einreichen — als Vorschau im Editor. Schreibt nichts.
    app.post<{ Body: unknown }>("/api/vorlagen/pruefung", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const b = (request.body ?? {}) as {
        vorlage?: unknown;
        bodyHtml?: unknown;
        category?: unknown;
        tags?: unknown;
      };
      const ergebnis = await dienste.einreichung.pruefe(
        b.vorlage,
        {
          bodyHtml: typeof b.bodyHtml === "string" ? b.bodyHtml : "",
          category: typeof b.category === "string" ? b.category : "",
          tags: Array.isArray(b.tags)
            ? b.tags.filter((t): t is string => typeof t === "string")
            : [],
        },
        user,
      );
      if (ergebnis.ok) {
        reply.code(200).send({ ok: true, befunde: [] });
        return;
      }
      if (ergebnis.error === "PFLICHTANGABEN_FEHLEN") {
        reply.code(200).send({ ok: false, befunde: ergebnis.befunde ?? [] });
        return;
      }
      reply.code(ergebnis.status).send({ error: ergebnis.error, message: ergebnis.message });
    });

    // Nachvollziehbare Ausgangsstruktur eines Beitrags: Vorlage und Fassung, mit der er entstand.
    app.get<{ Params: { koId: string } }>("/api/vorlagen/nutzung/:koId", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const ko = await dienste.ko.get(request.params.koId);
      if (!ko || !darfSehen(user, ko)) {
        nichtGefunden(reply, "Wissensobjekt");
        return;
      }
      const eintrag = (await ablage.fassungen<NutzungsEintrag>("nutzung", ko.id)).at(-1);
      if (!eintrag) {
        reply.code(200).send({ koId: ko.id, nutzung: null });
        return;
      }
      const fassungen = await vorlagenFassungen(ablage, eintrag.vorlageId);
      const verwendet = fassungen.find((f) => f.version === eintrag.vorlagenVersion);
      const aktuell = fassungen.at(-1);
      const spaces = await dienste.spaces.aktuelle();
      // Die Struktur nur, wenn die Person die Vorlage sehen darf — sonst Name und Fassung.
      const sichtbar = aktuell !== undefined && darfVorlageSehen(aktuell, user, spaces);
      reply.code(200).send({
        koId: ko.id,
        nutzung: {
          vorlageId: eintrag.vorlageId,
          version: eintrag.vorlagenVersion,
          name: eintrag.vorlagenName,
          am: eintrag.geaendertAm,
          aktuelleVersion: aktuell?.version ?? null,
          ausgemustert: aktuell?.ausgemustert === true,
          felder: sichtbar && verwendet ? verwendet.felder : null,
        },
      });
    });

    // ----------------------------------------------------------------------------------------------
    // ADMIN-08 · VERWALTUNG: Geltung und Nutzungsumfang von Vorlage, Kategorie und Tag.
    // ----------------------------------------------------------------------------------------------
    app.get("/api/vorlagen/verwaltung", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const spaces = await dienste.spaces.aktuelle();
      const kos = await koKarte();
      // Begriffsnamen sind Inhalt eines Beitrags: gezählt wird nur, was die Verwaltung selbst sehen
      // darf (kein Admin-Durchgriff, `sichtbarkeit.ts`); der Rest erscheint als blosse Zahl.
      const einsehbar = sichtbareFuer(user, [...kos.values()]);
      const nutzung = await nutzungAlle();
      const alle = await alleVorlagen(ablage);
      const standards = await ablage.aktuelle<StandardEintrag>("standard");
      const vorgaben = await ablage.aktuelle<SpaceVorgabe>("space-vorgabe");
      const spaceName = (id: string | null) =>
        id ? (spaces.find((s) => s.id === id)?.name ?? null) : null;
      // Persönliche Vorlagen gehören ihrer Eigentümerin: die Verwaltung sieht Zahlen, keine Inhalte.
      const geteilte = alle.filter((v) => v.geltung !== "persoenlich");
      const persoenlich = alle.filter((v) => v.geltung === "persoenlich");
      const zaehle = (art: "tag" | "kategorie") => {
        const karte = new Map<string, { name: string; jeSpace: Map<string | null, number> }>();
        for (const ko of einsehbar) {
          const werte = art === "tag" ? ko.tags : [ko.category];
          for (const w of werte) {
            if (typeof w !== "string" || !w.trim()) {
              continue;
            }
            const key = w.trim().toLocaleLowerCase("de");
            const e = karte.get(key) ?? { name: w.trim(), jeSpace: new Map() };
            const s = typeof ko.spaceId === "string" ? ko.spaceId : null;
            e.jeSpace.set(s, (e.jeSpace.get(s) ?? 0) + 1);
            karte.set(key, e);
          }
        }
        return [...karte.values()]
          .map((e) => ({
            name: e.name,
            gesamt: [...e.jeSpace.values()].reduce((a, b) => a + b, 0),
            jeSpace: [...e.jeSpace].map(([spaceId, anzahl]) => ({
              spaceId,
              name: spaceName(spaceId),
              anzahl,
            })),
            // Wo der Begriff als Space-Kategorie bzw. vorgeschlagenes Tag konfiguriert ist.
            vorgegebenIn: vorgaben
              .filter((v) =>
                (art === "tag" ? v.tags : v.kategorien).some(
                  (x) => x.toLocaleLowerCase("de") === e.name.toLocaleLowerCase("de"),
                ),
              )
              .map((v) => ({ spaceId: v.spaceId, name: spaceName(v.spaceId) })),
          }))
          .sort((a, b) => b.gesamt - a.gesamt || a.name.localeCompare(b.name));
      };
      reply.code(200).send({
        vorlagen: geteilte.map((v) => ({
          id: v.id,
          name: v.name,
          geltung: v.geltung,
          spaceId: v.spaceId ?? null,
          spaceName: spaceName(v.spaceId ?? null),
          version: v.version,
          ausgemustert: v.ausgemustert === true,
          pflichtfelder: v.felder.filter((f) => f.pflicht).map((f) => f.titel),
          nutzung: nutzungsUmfang(v.id, nutzung, kos, spaces),
          standardBei: standards.filter((s) => s.vorlageId === v.id).length,
          verbindlichIn: vorgaben
            .filter((g) => g.verbindlicheVorlageId === v.id)
            .map((g) => ({ spaceId: g.spaceId, name: spaceName(g.spaceId) })),
        })),
        persoenlich: {
          vorlagen: persoenlich.length,
          beitraege: nutzung.filter(
            (n) => kos.has(n.koId) && persoenlich.some((v) => v.id === n.vorlageId),
          ).length,
        },
        kategorien: zaehle("kategorie"),
        tags: zaehle("tag"),
        nichtEinsehbar: kos.size - einsehbar.length,
        spaceVorgaben: spaces
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((s) => ({
            spaceId: s.id,
            name: s.name,
            archiviert: istArchiviert(s),
            vorgabe: vorgaben.find((v) => v.spaceId === s.id) ?? null,
          })),
        begriffe: await ablage.aktuelle<BegriffEintrag>("begriff"),
      });
    });

    // Space-Vorgaben lesen (wer den Space sieht) und pflegen (Spacezuständige, Kontoverwaltung).
    app.get<{ Params: { spaceId: string } }>(
      "/api/vorlagen/space-vorgaben/:spaceId",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const space = (await dienste.spaces.aktuelle()).find(
          (s) => s.id === request.params.spaceId,
        );
        if (!space || !darfSpaceSehen(space, user)) {
          nichtGefunden(reply, "Space");
          return;
        }
        reply.code(200).send({
          space: { id: space.id, name: space.name },
          darfBearbeiten: darfSpaceBearbeiten(space, user),
          fassungen: await ablage.fassungen<SpaceVorgabe>("space-vorgabe", space.id),
        });
      },
    );

    app.put<{ Params: { spaceId: string }; Body: unknown }>(
      "/api/vorlagen/space-vorgaben/:spaceId",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const spaces = await dienste.spaces.aktuelle();
        const space = spaces.find((s) => s.id === request.params.spaceId);
        if (!space || !darfSpaceSehen(space, user)) {
          nichtGefunden(reply, "Space");
          return;
        }
        if (!darfSpaceBearbeiten(space, user)) {
          reply.code(403).send({
            error: "FORBIDDEN",
            message: "Space-Vorgaben ändern nur die Spacezuständigen oder die Kontoverwaltung.",
          });
          return;
        }
        if (istArchiviert(space)) {
          reply.code(409).send({
            error: "SPACE_ARCHIVIERT",
            message: "Dieser Space ist archiviert. Erst wiederaufnehmen, dann ändern.",
          });
          return;
        }
        try {
          const eingabe = pruefeSpaceVorgabe(request.body);
          if (eingabe.verbindlicheVorlageId) {
            const v = await aktuelle(eingabe.verbindlicheVorlageId);
            // Verbindlich machen lässt sich nur, was die Mitglieder dieses Space auch nutzen können:
            // Standard, unternehmensweit oder in GENAU diesem Space geteilt — und nicht ausgemustert.
            const passt =
              v !== undefined &&
              !v.ausgemustert &&
              (v.geltung === "standard" ||
                v.geltung === "unternehmen" ||
                (v.geltung === "space" && v.spaceId === space.id));
            if (!passt) {
              throw new VorlagenFehler(
                "VORGABE_UNGUELTIG",
                "Verbindlich sein kann nur eine Standard-, unternehmensweite oder in diesem Space geteilte, nicht ausgemusterte Vorlage.",
              );
            }
          }
          const bisher = await ablage.fassungen<SpaceVorgabe>("space-vorgabe", space.id);
          const gesehen = (request.body as { version?: unknown } | null)?.version ?? 0;
          const aktuell = bisher.at(-1)?.version ?? 0;
          if (gesehen !== aktuell) {
            reply.code(409).send({
              error: "VERSION_VERALTET",
              message: "Die Vorgaben wurden inzwischen geändert. Bitte neu laden.",
              aktuelleVersion: aktuell,
            });
            return;
          }
          const fassung: SpaceVorgabe = {
            ...eingabe,
            spaceId: space.id,
            version: aktuell + 1,
            geaendertVon: user.id,
            geaendertAm: jetzt().toISOString(),
          };
          if (!(await ablage.lege("space-vorgabe", space.id, fassung))) {
            reply.code(409).send({
              error: "VERSION_VERALTET",
              message: "Die Vorgaben wurden inzwischen geändert. Bitte neu laden.",
              aktuelleVersion: aktuell,
            });
            return;
          }
          await dienste.audit?.record({
            actor: user.id,
            action: "space.vorgaben-geaendert",
            target: space.id,
            payload: {
              version: fassung.version,
              verbindlicheVorlageId: fassung.verbindlicheVorlageId,
              kategorien: fassung.kategorien.length,
              pflichtKategorie: fassung.pflichtKategorie,
              mindestensTags: fassung.mindestensTags,
            },
          });
          reply.code(200).send(fassung);
        } catch (e) {
          fehler(reply, e);
        }
      },
    );

    // ----------------------------------------------------------------------------------------------
    // BEGRIFFSPFLEGE (Kontoverwaltung): Vorschau mit betroffenem Bestand je Space, dann Ausführung
    // NUR mit der Grundlage dieser Vorschau.
    // ----------------------------------------------------------------------------------------------
    async function plan(user: SessionUser, roh: unknown) {
      const spaces = await dienste.spaces.aktuelle();
      const auftrag = pruefeBegriffsAuftrag(roh, spaces);
      const p = begriffsPlan(auftrag, await dienste.ko.list({}), spaces, (ko) =>
        darfSehen(user, ko),
      );
      if (auftrag.vorgang === "zusammenfuehren" && !p.zielVorhanden) {
        throw new VorlagenFehler(
          "BEGRIFF_UNGUELTIG",
          `„${auftrag.ziel ?? ""}“ kommt im Geltungsbereich nicht vor — dann ist es ein Umbenennen, kein Zusammenführen.`,
        );
      }
      if (auftrag.vorgang === "umbenennen" && p.zielVorhanden) {
        throw new VorlagenFehler(
          "BEGRIFF_UNGUELTIG",
          `„${auftrag.ziel ?? ""}“ ist schon in Gebrauch — bitte „zusammenführen“ wählen.`,
        );
      }
      return p;
    }

    app.post<{ Body: unknown }>("/api/vorlagen/begriffe/vorschau", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(200).send(await plan(user, request.body));
      } catch (e) {
        fehler(reply, e);
      }
    });

    app.post<{ Body: { grundlage?: unknown } & Record<string, unknown> }>(
      "/api/vorlagen/begriffe/ausfuehren",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        try {
          const p = await plan(user, request.body);
          if (typeof request.body?.grundlage !== "string") {
            reply.code(400).send({
              error: "VORSCHAU_FEHLT",
              message: "Die Begriffspflege braucht die bestätigte Vorschau.",
            });
            return;
          }
          if (request.body.grundlage !== p.grundlage) {
            reply.code(409).send({
              error: "VORSCHAU_VERALTET",
              message: "Der Bestand hat sich seit der Vorschau geändert. Bitte neu prüfen.",
              vorschau: p,
            });
            return;
          }
          const a = p.auftrag;
          const geaendert: string[] = [];
          const fehlgeschlagen: { koId: string; grund: string }[] = [];
          if (a.vorgang !== "ausmustern") {
            for (const z of p.betroffen) {
              try {
                const ko = await dienste.ko.get(z.koId);
                if (!ko || ko.version !== z.version) {
                  fehlgeschlagen.push({ koId: z.koId, grund: "zwischenzeitlich_geaendert" });
                  continue;
                }
                const nach = begriffNachher(ko, a);
                if (a.art === "tag") {
                  await dienste.ko.updateTags(ko.id, nach.tags, user.id, {
                    expectedVersion: z.version,
                  });
                } else {
                  await dienste.ko.updateCategory(ko.id, nach.category, user.id, {
                    expectedVersion: z.version,
                  });
                }
                geaendert.push(z.koId);
              } catch {
                fehlgeschlagen.push({ koId: z.koId, grund: "fehler" });
              }
            }
          }
          // Gespeicherte Space-Ansichten ziehen mit — als neue Spacefassung, wie jede Spaceänderung.
          // Ein archivierter Space bleibt unverändert (er nimmt keine Änderung an) und wird gezählt.
          const ansichtenGeaendert: string[] = [];
          const ansichtenUnveraendert: string[] = [];
          if (a.vorgang !== "ausmustern") {
            for (const sid of [...new Set(p.ansichten.map((x) => x.spaceId))]) {
              const aktuellerSpace = (await dienste.spaces.fassungen(sid)).at(-1);
              if (!aktuellerSpace || istArchiviert(aktuellerSpace)) {
                ansichtenUnveraendert.push(sid);
                continue;
              }
              // Teamabgeleitete Mitglieder sind kein Teil einer gespeicherten Fassung (`spaces.ts`).
              // Die Begründung gehört zur vorigen Fassung (Archiv/Wiederaufnahme), nicht zu dieser.
              const {
                teamMitglieder: _abgeleitet,
                begruendung: _vorige,
                ...gespeichert
              } = aktuellerSpace;
              const neu: SpaceFassung = {
                ...gespeichert,
                version: aktuellerSpace.version + 1,
                geaendertVon: user.id,
                geaendertAm: jetzt().toISOString(),
                vorgang: "geaendert",
                ansichten: ansichtenNachher(aktuellerSpace.ansichten, a),
              };
              if (await dienste.spaces.lege(neu)) {
                ansichtenGeaendert.push(sid);
              } else {
                ansichtenUnveraendert.push(sid);
              }
            }
          }
          const schluessel = begriffSchluessel(a.art, a.name, a.spaceId);
          const bisher = await ablage.fassungen<BegriffEintrag>("begriff", schluessel);
          const eintrag: BegriffEintrag = {
            schluessel,
            version: (bisher.at(-1)?.version ?? 0) + 1,
            art: a.art,
            name: a.name,
            status: a.vorgang === "ausmustern" ? "ausgemustert" : "ersetzt",
            ersatz: a.ziel,
            spaceId: a.spaceId,
            vorgang: a.vorgang,
            begruendung: a.begruendung,
            geaendertVon: user.id,
            geaendertAm: jetzt().toISOString(),
          };
          await ablage.lege("begriff", schluessel, eintrag);
          const protokoll = {
            art: a.art,
            vorgang: a.vorgang,
            name: a.name,
            ziel: a.ziel,
            spaceId: a.spaceId,
            begruendung: a.begruendung,
            geaendert: geaendert.length,
            fehlgeschlagen: fehlgeschlagen.length,
            unberuehrt: p.unberuehrt,
            spaceAnsichtenGeaendert: ansichtenGeaendert,
            spaceAnsichtenUnveraendert: ansichtenUnveraendert,
          };
          await dienste.audit?.record({
            actor: user.id,
            action: `begriff.${a.vorgang}`,
            target: schluessel,
            payload: protokoll,
          });
          reply.code(200).send({
            ...protokoll,
            geaendertIds: geaendert,
            fehlgeschlagenIds: fehlgeschlagen,
            eintrag,
          });
        } catch (e) {
          fehler(reply, e);
        }
      },
    );

    // ----------------------------------------------------------------------------------------------
    // EINE VORLAGE: lesen (mit allen Fassungen), anlegen, ändern/teilen, Auswirkungen, ausmustern.
    // ----------------------------------------------------------------------------------------------
    app.get<{ Params: { id: string } }>("/api/vorlagen/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const fassungen = await vorlagenFassungen(ablage, request.params.id);
      const aktuell = fassungen.at(-1);
      const spaces = await dienste.spaces.aktuelle();
      if (!aktuell || !darfVorlageSehen(aktuell, user, spaces)) {
        nichtGefunden(reply);
        return;
      }
      const n = await namen();
      reply.code(200).send({
        vorlage: sicht(aktuell, user, spaces, await standardVon(user.id), n),
        fassungen: fassungen.map((f) => ({
          ...f,
          geaendertVonName: n.get(f.geaendertVon) ?? null,
          spaceName: f.spaceId ? (spaces.find((s) => s.id === f.spaceId)?.name ?? null) : null,
        })),
      });
    });

    app.post<{ Body: unknown }>("/api/vorlagen", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      try {
        const eingabe = pruefeVorlageEingabe(request.body);
        const spaces = await dienste.spaces.aktuelle();
        if (!darfInGeltungAblegen(eingabe.geltung, eingabe.spaceId, user, spaces)) {
          reply.code(403).send({
            error: "FORBIDDEN",
            message:
              eingabe.geltung === "unternehmen"
                ? "Unternehmensweite Vorlagen legt nur die Kontoverwaltung an."
                : "Für diesen Space fehlt das Schreibrecht.",
          });
          return;
        }
        const am = jetzt().toISOString();
        const fassung: VorlageFassung = {
          ...eingabe,
          id: randomUUID(),
          version: 1,
          eigentuemer: user.id,
          angelegtAm: am,
          geaendertVon: user.id,
          geaendertAm: am,
          vorgang: "angelegt",
        };
        await legeVorlage(fassung);
        await dienste.audit?.record({
          actor: user.id,
          action: "vorlage.angelegt",
          target: fassung.id,
          payload: { version: 1, geltung: fassung.geltung, spaceId: fassung.spaceId ?? null },
        });
        reply
          .code(201)
          .send(sicht(fassung, user, spaces, await standardVon(user.id), await namen()));
      } catch (e) {
        fehler(reply, e);
      }
    });

    async function bearbeitbar(
      id: string,
      user: SessionUser,
      reply: FastifyReply,
    ): Promise<{ aktuell: VorlageFassung; spaces: SpaceFassung[] } | undefined> {
      const spaces = await dienste.spaces.aktuelle();
      const aktuell = await aktuelle(id);
      if (!aktuell || !darfVorlageSehen(aktuell, user, spaces)) {
        nichtGefunden(reply);
        return undefined;
      }
      if (!darfVorlageBearbeiten(aktuell, user, spaces)) {
        reply.code(403).send({
          error: "FORBIDDEN",
          message: istStandard(id)
            ? "Standardvorlagen sind unveränderlich — als eigene Vorlage kopieren und anpassen."
            : "Diese Vorlage ändern nur ihre Eigentümerin, die Spacezuständigen bzw. die Kontoverwaltung.",
        });
        return undefined;
      }
      if (aktuell.ausgemustert) {
        reply.code(409).send({
          error: "VORLAGE_AUSGEMUSTERT",
          message: "Diese Vorlage ist ausgemustert und wird nicht mehr geändert.",
        });
        return undefined;
      }
      return { aktuell, spaces };
    }

    async function wirkung(
      aktuell: VorlageFassung,
      eingabe: VorlageEingabe,
      spaces: SpaceFassung[],
    ) {
      return aenderungswirkung(
        aktuell,
        eingabe,
        nutzungsUmfang(aktuell.id, await nutzungAlle(), await koKarte(), spaces),
        await standardZahl(aktuell.id),
        await verbindlichIn(aktuell.id, spaces),
      );
    }

    // Die Auswirkungen einer Änderung VOR der neuen Fassung. Schreibt nichts.
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/vorlagen/:id/vorschau",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        try {
          const lage = await bearbeitbar(request.params.id, user, reply);
          if (!lage) {
            return;
          }
          reply
            .code(200)
            .send(await wirkung(lage.aktuell, pruefeVorlageEingabe(request.body), lage.spaces));
        } catch (e) {
          fehler(reply, e);
        }
      },
    );

    // Ändern oder teilen — eine NEUE Fassung. `version` nennt die Fassung, die gesehen wurde.
    app.put<{ Params: { id: string }; Body: unknown }>(
      "/api/vorlagen/:id",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        try {
          const lage = await bearbeitbar(request.params.id, user, reply);
          if (!lage) {
            return;
          }
          const { aktuell, spaces } = lage;
          const gesehen = (request.body as { version?: unknown } | null)?.version;
          if (typeof gesehen !== "number") {
            reply.code(400).send({
              error: "VERSION_FEHLT",
              message: "Die zuletzt gesehene Fassung der Vorlage fehlt.",
            });
            return;
          }
          const eingabe = pruefeVorlageEingabe(request.body);
          const geltungWechsel =
            eingabe.geltung !== aktuell.geltung ||
            (eingabe.spaceId ?? null) !== (aktuell.spaceId ?? null);
          if (
            geltungWechsel &&
            !darfInGeltungAblegen(eingabe.geltung, eingabe.spaceId, user, spaces)
          ) {
            reply.code(403).send({
              error: "FORBIDDEN",
              message:
                eingabe.geltung === "unternehmen"
                  ? "Unternehmensweit teilt nur die Kontoverwaltung."
                  : "Für diesen Space fehlt das Schreibrecht.",
            });
            return;
          }
          const fassung: VorlageFassung = {
            ...eingabe,
            id: aktuell.id,
            version: gesehen + 1,
            eigentuemer: aktuell.eigentuemer,
            angelegtAm: aktuell.angelegtAm,
            geaendertVon: user.id,
            geaendertAm: jetzt().toISOString(),
            vorgang: geltungWechsel ? "geteilt" : "geaendert",
          };
          if (gesehen !== aktuell.version || !(await legeVorlage(fassung))) {
            veraltet(reply, aktuell.version);
            return;
          }
          const w = await wirkung(aktuell, eingabe, spaces);
          await dienste.audit?.record({
            actor: user.id,
            action: geltungWechsel ? "vorlage.geteilt" : "vorlage.geaendert",
            target: fassung.id,
            payload: {
              vorherVersion: aktuell.version,
              version: fassung.version,
              geltung: fassung.geltung,
              vorherGeltung: aktuell.geltung,
              spaceId: fassung.spaceId ?? null,
              felderNeu: w.felder.neu.length,
              felderEntfernt: w.felder.entfernt.length,
              pflichtNeu: w.felder.pflichtNeu.length,
              bestehendeBeitraege: w.nutzung.gesamt,
            },
          });
          reply.code(200).send({
            vorlage: sicht(fassung, user, spaces, await standardVon(user.id), await namen()),
            wirkung: w,
          });
        } catch (e) {
          fehler(reply, e);
        }
      },
    );

    // Ausmustern — eine neue Fassung mit Begründung. Kein Löschen: bestehende Beiträge behalten
    // ihren Bezug, ein persönlicher Standard fällt mit Begründung auf freie Eingabe zurück.
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/vorlagen/:id/ausmustern",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        try {
          const lage = await bearbeitbar(request.params.id, user, reply);
          if (!lage) {
            return;
          }
          const { aktuell, spaces } = lage;
          const body = (request.body ?? {}) as { version?: unknown; begruendung?: unknown };
          if (body.version !== aktuell.version) {
            veraltet(reply, aktuell.version);
            return;
          }
          const begruendung = pruefeBegruendung(body.begruendung);
          const fassung: VorlageFassung = {
            ...aktuell,
            version: aktuell.version + 1,
            geaendertVon: user.id,
            geaendertAm: jetzt().toISOString(),
            vorgang: "ausgemustert",
            ausgemustert: true,
            begruendung,
          };
          if (!(await legeVorlage(fassung))) {
            veraltet(reply, aktuell.version);
            return;
          }
          await dienste.audit?.record({
            actor: user.id,
            action: "vorlage.ausgemustert",
            target: fassung.id,
            payload: {
              version: fassung.version,
              begruendung,
              standardBei: await standardZahl(fassung.id),
              verbindlichIn: (await verbindlichIn(fassung.id, spaces)).map((s) => s.spaceId),
            },
          });
          reply
            .code(200)
            .send(sicht(fassung, user, spaces, await standardVon(user.id), await namen()));
        } catch (e) {
          fehler(reply, e);
        }
      },
    );
  };
}
