import type { AuthService } from "../../auth";
import { type KnowledgeObject, type KoService, ownershipOf } from "../../knowledge-object";
import { importProviderKey } from "../../library-analytics";
import type { SessionUser } from "./http";
import type { GeleseneFristenQuelle } from "./klara-fristen-dienst";
import type { FristQuellart, FristenQuelle } from "./klara-fristen-erkennung";
import { fristHash } from "./klara-fristen-erkennung";
import type { KlaraGespraechRepo } from "./klara-gespraech";
import type { KlaraNotizRepo, NotizSchreibbedingung } from "./klara-notiz";
import { darfSehen, sqlSichtbarkeitFuer } from "./sichtbarkeit";
import { type SpacesRepo, lesbareSpaces } from "./spaces";

export interface FristenQuellenDeps {
  auth: Pick<AuthService, "kontoLesen">;
  ko: Pick<KoService, "get">;
  notizen: KlaraNotizRepo;
  gespraeche: KlaraGespraechRepo;
  spaces: Pick<SpacesRepo, "aktuelle">;
  jetzt?: () => number;
}

/** Nur der gespeicherte Importanker, kein aus URL, Text oder Titel erratener Kopiebezug. */
function importbezug(
  ko: KnowledgeObject,
): Pick<FristenQuelle, "importbeleg" | "importIdentitaetUnklar"> {
  const anker = (ko.sources ?? []).filter(
    (s) => s.externalId !== undefined || s.sourceRecordId !== undefined,
  );
  if (!ko.importedVia && anker.length === 0) return {};
  const s = anker[0];
  if (
    anker.length !== 1 ||
    !s ||
    !s.provider?.trim() ||
    !s.externalId?.trim() ||
    !Number.isSafeInteger(s.sourceVersion) ||
    Number(s.sourceVersion) < 0 ||
    s.attachmentOf ||
    s.sourceRemovedAt
  )
    return { importIdentitaetUnklar: true };
  return {
    importbeleg: {
      provider: importProviderKey(s.provider),
      externalId: s.externalId,
      sourceVersion: Number(s.sourceVersion),
      ...(s.sourceRecordId ? { sourceRecordId: s.sourceRecordId } : {}),
    },
  };
}

/** Verwendet denselben Konten-, Space- und Quellenrechtebestand wie die angemeldeten Routen. */
export class KlaraFristenQuellen {
  private readonly jetzt: () => number;
  constructor(private readonly deps: FristenQuellenDeps) {
    this.jetzt = deps.jetzt ?? Date.now;
  }

  async nutzer(kontoId: string): Promise<SessionUser | null> {
    const konto = await this.deps.auth.kontoLesen(kontoId);
    if (
      !konto?.approved ||
      (konto.accessExpiresAt && !(Date.parse(konto.accessExpiresAt) > this.jetzt()))
    )
      return null;
    return {
      id: konto.id,
      role: konto.role,
      ...(konto.freigabe ? { freigabe: konto.freigabe } : {}),
      spaceLesbar: lesbareSpaces(await this.deps.spaces.aktuelle(), kontoId),
    };
  }

  async lies(
    anfordernder: SessionUser,
    art: FristQuellart,
    id: string,
  ): Promise<GeleseneFristenQuelle | null> {
    const user = await this.nutzer(anfordernder.id);
    if (!user) return null;
    const spaces = await this.deps.spaces.aktuelle();
    user.spaceLesbar = lesbareSpaces(spaces, user.id);
    const spaceVersionen = Object.fromEntries(spaces.map((s) => [s.id, s.version]));
    const trim = sqlSichtbarkeitFuer(user);
    let quelle: FristenQuelle;
    let quellBedingung: NonNullable<NotizSchreibbedingung["sql"]>;
    if (art === "wissensobjekt") {
      const ko = await this.deps.ko.get(id);
      if (!ko || !darfSehen(user, ko)) return null;
      const ownerId = ownershipOf(ko)?.owner;
      const owner = ownerId ? await this.deps.auth.kontoLesen(ownerId) : undefined;
      const verantwortlich =
        owner?.approved &&
        (!owner.accessExpiresAt || Date.parse(owner.accessExpiresAt) > this.jetzt())
          ? owner.id
          : null;
      quelle = {
        art,
        id,
        fassung: String(ko.version),
        text: ko.statement,
        belegId: `ko:${ko.id}`,
        ...importbezug(ko),
        verantwortlich,
      };
      quellBedingung = (start) => {
        const params: unknown[] = [
          id,
          String(ko.version),
          ko.statement,
          JSON.stringify(ko.ownership ?? null),
          JSON.stringify(ko.sources ?? []),
          JSON.stringify(ko.importedVia ?? null),
          ...trim.params,
        ];
        const und = [
          `EXISTS(SELECT 1 FROM kos q WHERE q.id=$${start}::text
          AND q.data->>'version'=$${start + 1}::text AND q.data->>'statement'=$${start + 2}::text
          AND COALESCE(q.data->'ownership','null'::jsonb)=$${start + 3}::jsonb
          AND COALESCE(q.data->'sources','[]'::jsonb)=$${start + 4}::jsonb
          AND COALESCE(q.data->'importedVia','null'::jsonb)=$${start + 5}::jsonb
          AND ${trim.sql("q", start + 6)} FOR SHARE)`,
        ];
        if (verantwortlich) {
          const i = start + params.length;
          params.push(verantwortlich, new Date(this.jetzt()).toISOString());
          und.push(`EXISTS(SELECT 1 FROM users WHERE id=$${i}::text AND approved
            AND (COALESCE(access_expires_at,'')='' OR access_expires_at::timestamptz > $${i + 1}::timestamptz) FOR SHARE)`);
        }
        return { und, params };
      };
    } else if (art === "notiz") {
      const n = await this.deps.notizen.hole(user.id, id);
      if (!n) return null;
      quelle = {
        art,
        id,
        fassung: String(n.fassung),
        text: n.inhalt,
        belegId: `notiz:${n.id}`,
        verantwortlich: null,
      };
      quellBedingung = (start) => ({
        und: [
          `EXISTS(SELECT 1 FROM klara_notizen WHERE id=$${start}::text AND konto_id=$${start + 1}::text
          AND fassung=$${start + 2}::int AND data->>'inhalt'=$${start + 3}::text FOR SHARE)`,
        ],
        params: [id, user.id, n.fassung, n.inhalt],
      });
    } else if (art === "gespraech") {
      // Bewusst verarbeitete EINZELNE eigene Nachricht, kein implizites Beobachten des Gesprächs.
      const teile = id.split("/");
      if (teile.length !== 2 || !teile[0] || !teile[1]) return null;
      const g = await this.deps.gespraeche.hole(user.id, teile[0]);
      const n = g?.nachrichten.find((n) => n.id === teile[1] && n.von === "du");
      if (!g || !n) return null;
      quelle = {
        art,
        id,
        fassung: fristHash(n.id, n.text, n.angelegtAm),
        text: n.text,
        belegId: `nachricht:${g.id}:${n.id}`,
        verantwortlich: null,
      };
      quellBedingung = (start) => ({
        und: [
          `EXISTS(SELECT 1 FROM klara_gespraeche WHERE id=$${start}::text AND konto_id=$${start + 1}::text
          AND data->'nachrichten' @> $${start + 2}::jsonb FOR SHARE)`,
        ],
        params: [g.id, user.id, JSON.stringify([n])],
      });
    } else {
      // Anhänge brauchen einen berechtigten Träger UND einen tatsächlich gelesenen Textnachweis.
      // Ohne diesen Leser wird weder eine Fundstelle noch ein Fristdatum behauptet.
      return null;
    }
    const bedingung: NotizSchreibbedingung = {
      sql: (start) => {
        const b = quellBedingung(start + 5);
        return {
          und: [
            `EXISTS(SELECT 1 FROM users WHERE id=$${start}::text AND approved
              AND role=$${start + 1}::text AND freigabe IS NOT DISTINCT FROM $${start + 2}::text
              AND (COALESCE(access_expires_at,'')='' OR access_expires_at::timestamptz > $${start + 3}::timestamptz) FOR SHARE)`,
            `(SELECT COALESCE(jsonb_object_agg(space_id,version),'{}'::jsonb) FROM
              (SELECT DISTINCT ON(space_id) space_id,version,data FROM spaces_fassungen ORDER BY space_id,version DESC) s
              WHERE NOT(data ? 'geloeschtAm'))=$${start + 4}::jsonb`,
            ...b.und,
          ],
          params: [
            user.id,
            user.role,
            user.freigabe ?? null,
            new Date(this.jetzt()).toISOString(),
            JSON.stringify(spaceVersionen),
            ...b.params,
          ],
        };
      },
    };
    return {
      quelle,
      bedingung,
      nochAktuell: async () => {
        const neu = await this.lies(anfordernder, art, id);
        return Boolean(neu && JSON.stringify(neu.quelle) === JSON.stringify(quelle));
      },
    };
  }
}
