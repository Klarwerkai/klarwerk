import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import {
  AuthError,
  type AuthService,
  type OidcRoleConfig,
  type PublicUser,
  type Role,
  mapOidcRole,
} from "../../../auth";

// ================================================================================================
// R-0556 / R-0571 · AUTOMATISCHE NUTZERPFLEGE AUS DEM UNTERNEHMENSVERZEICHNIS (SCIM 2.0, RFC 7644).
// ================================================================================================
//
// Tritt jemand ein, aus oder wechselt die Abteilung, schickt das Verzeichnis (Entra ID, Okta, …)
// das hierher — ohne Handgriff in Klara:
//   · Eintritt  → `POST /scim/v2/Users` legt das Konto an (Anmeldung danach über den Firmen-Login).
//   · Austritt  → `active: false` (PATCH/PUT) oder `DELETE` SPERRT das Konto sofort: Sitzungen
//                 werden beendet, `authenticate` lässt kein gesperrtes Konto mehr herein. Gelöscht
//                 wird nicht — Eigentum und Prüfspuren bleiben unverändert an ihrem Platz (die
//                 Eigentumsübergabe ist eine offene Produktentscheidung, s. `AuthService`).
//   · Wechsel   → die Gruppen (SCIM-Attribut `roles`, so überträgt Entra App-Rollen) bestimmen die
//                 Klara-Rolle über dieselben Gruppennamen wie der Firmen-Login (`OIDC_GROUP_*`)
//                 und — R-0571 — die Prüfzuständigkeiten je Space (`KLARWERK_PRUEFZUSTAENDIGKEIT`).
//
// ZUGANG: ein eigener Verzeichnisschlüssel (`KLARWERK_SCIM_TOKEN`, mindestens 32 Zeichen) als
// Bearer. Ohne ihn werden diese Routen gar nicht registriert (`build-app.ts`). Der Vergleich läuft
// über die Prüfsummen in konstanter Zeit. Der Routenwächter führt diese Schutzart als
// `verzeichnis` (`tests/security/routeGuardAudit.ts`) — sie ist nicht „öffentlich".

const SCHEMA_USER = "urn:ietf:params:scim:schemas:core:2.0:User";
const SCHEMA_LISTE = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
const SCHEMA_FEHLER = "urn:ietf:params:scim:api:messages:2.0:Error";
const SCHEMA_PATCH = "urn:ietf:params:scim:api:messages:2.0:PatchOp";
const SCHEMA_DIENST = "urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig";
const SCIM_INHALT = "application/scim+json; charset=utf-8";
export const SCIM_SCHLUESSEL_MIN = 32;

/** Der Schlüssel aus der Umgebung — oder `undefined`, wenn er fehlt oder zu kurz ist. */
export function scimSchluessel(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const wert = env.KLARWERK_SCIM_TOKEN?.trim();
  return wert && wert.length >= SCIM_SCHLUESSEL_MIN ? wert : undefined;
}

/**
 * R-0571: `KLARWERK_PRUEFZUSTAENDIGKEIT` — „Gruppe=space-a,space-b;Andere Gruppe=space-c".
 * Wer im Verzeichnis in der Gruppe steht, ist für die Prüfung von Wissen in diesen Spaces
 * zuständig. Unlesbare Einträge fallen weg; der Startbericht nennt den Wert, nicht seinen Inhalt.
 */
export function lesePruefzustaendigkeit(
  roh: string | undefined,
): ReadonlyMap<string, readonly string[]> {
  const zuordnung = new Map<string, string[]>();
  for (const eintrag of (roh ?? "").split(";")) {
    const trenner = eintrag.indexOf("=");
    if (trenner <= 0) {
      continue;
    }
    const gruppe = eintrag.slice(0, trenner).trim();
    const spaces = eintrag
      .slice(trenner + 1)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (gruppe && spaces.length > 0) {
      zuordnung.set(gruppe, [...(zuordnung.get(gruppe) ?? []), ...spaces]);
    }
  }
  return zuordnung;
}

export interface VerzeichnisRoutesDeps {
  auth: AuthService;
  schluessel: string;
  /** Gruppennamen → Rolle, dieselben wie am Firmen-Login. */
  rollen: Omit<OidcRoleConfig, "roleClaim">;
}

interface ScimEingabe {
  email?: string | undefined;
  name?: string | undefined;
  aktiv?: boolean | undefined;
  gruppen?: string[] | undefined;
}

class ScimFehler extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly scimType?: string,
  ) {
    super(message);
    this.name = "ScimFehler";
  }
}

/**
 * Das SCIM-Fehlerformat (RFC 7644 §3.12) — dazu das Feld `error`, das jede Klarwerk-Antwort trägt.
 * SCIM-Anbieter übergehen unbekannte Felder; Protokoll und Abnahme lesen daran, WER abgewiesen hat.
 */
function sendeFehler(reply: FastifyReply, status: number, detail: string, scimType?: string): void {
  reply
    .code(status)
    .header("content-type", SCIM_INHALT)
    .send({
      schemas: [SCHEMA_FEHLER],
      status: String(status),
      detail,
      ...(scimType ? { scimType } : {}),
      error: status === 401 ? "SCIM_UNAUTHORIZED" : `SCIM_${status}`,
    });
}

function pruefsumme(wert: string): Buffer {
  return createHash("sha256").update(wert).digest();
}

function alsScim(u: PublicUser): Record<string, unknown> {
  return {
    schemas: [SCHEMA_USER],
    id: u.id,
    userName: u.email,
    displayName: u.name,
    name: { formatted: u.name },
    emails: [{ value: u.email, primary: true, type: "work" }],
    active: u.approved,
    roles: (u.verzeichnisGruppen ?? []).map((value) => ({ value })),
    meta: { resourceType: "User", created: u.createdAt, location: `/scim/v2/Users/${u.id}` },
  };
}

function text(wert: unknown): string | undefined {
  return typeof wert === "string" && wert.trim() !== "" ? wert.trim() : undefined;
}

/** SCIM-Anbieter schicken Wahrheitswerte auch als "True"/"False" (Entra). */
function wahrheit(wert: unknown): boolean | undefined {
  if (typeof wert === "boolean") {
    return wert;
  }
  if (typeof wert === "string") {
    const klein = wert.trim().toLowerCase();
    if (klein === "true" || klein === "false") {
      return klein === "true";
    }
  }
  throw new ScimFehler(400, "active must be a boolean", "invalidValue");
}

function gruppenAus(wert: unknown): string[] {
  const liste = Array.isArray(wert) ? wert : [wert];
  const gruppen: string[] = [];
  for (const eintrag of liste) {
    const g =
      typeof eintrag === "object" && eintrag !== null
        ? text((eintrag as { value?: unknown }).value)
        : text(eintrag);
    if (g && !gruppen.includes(g)) {
      gruppen.push(g);
    }
  }
  return gruppen;
}

function emailAus(objekt: Record<string, unknown>): string | undefined {
  const name = text(objekt.userName);
  if (name) {
    return name;
  }
  const emails = Array.isArray(objekt.emails) ? (objekt.emails as Record<string, unknown>[]) : [];
  const primaer = emails.find((e) => e?.primary === true) ?? emails[0];
  return primaer ? text(primaer.value) : undefined;
}

function nameAus(objekt: Record<string, unknown>): string | undefined {
  const direkt = text(objekt.displayName);
  if (direkt) {
    return direkt;
  }
  const name = (typeof objekt.name === "object" && objekt.name !== null ? objekt.name : {}) as {
    formatted?: unknown;
    givenName?: unknown;
    familyName?: unknown;
  };
  const zusammen = [text(name.givenName), text(name.familyName)].filter(Boolean).join(" ");
  return text(name.formatted) ?? (zusammen || undefined);
}

function leseNutzer(body: unknown): ScimEingabe {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ScimFehler(400, "Request body must be a SCIM User", "invalidSyntax");
  }
  const objekt = body as Record<string, unknown>;
  return {
    email: emailAus(objekt),
    name: nameAus(objekt),
    aktiv: objekt.active === undefined ? undefined : wahrheit(objekt.active),
    gruppen: objekt.roles === undefined ? undefined : gruppenAus(objekt.roles),
  };
}

/** RFC 7644 §3.5.2 — die Pfade, die die Pflege braucht. Unbekannte Pfade werden übergangen. */
function wendePatchAn(aktuell: PublicUser, body: unknown): ScimEingabe {
  const ops = (body as { Operations?: unknown })?.Operations;
  if (!Array.isArray(ops)) {
    throw new ScimFehler(400, "PatchOp requires Operations", "invalidSyntax");
  }
  const ergebnis: ScimEingabe = {};
  let gruppen = [...(aktuell.verzeichnisGruppen ?? [])];
  let gruppenGeaendert = false;
  for (const roh of ops) {
    const op = text((roh as { op?: unknown })?.op)?.toLowerCase();
    const pfad = text((roh as { path?: unknown })?.path);
    const wert = (roh as { value?: unknown })?.value;
    if (op !== "add" && op !== "replace" && op !== "remove") {
      throw new ScimFehler(400, "Unsupported patch operation", "invalidSyntax");
    }
    if (pfad === undefined) {
      if (op === "remove") {
        throw new ScimFehler(400, "remove requires a path", "noTarget");
      }
      const teil = leseNutzer(wert);
      Object.assign(
        ergebnis,
        Object.fromEntries(Object.entries(teil).filter(([, v]) => v !== undefined)),
      );
      if (teil.gruppen !== undefined) {
        gruppen = op === "add" ? [...new Set([...gruppen, ...teil.gruppen])] : teil.gruppen;
        gruppenGeaendert = true;
      }
      continue;
    }
    const pfadKlein = pfad.toLowerCase();
    if (pfadKlein === "active") {
      ergebnis.aktiv = op === "remove" ? false : wahrheit(wert);
    } else if (pfadKlein === "username" || pfadKlein.startsWith("emails")) {
      const liste = Array.isArray(wert) ? wert : [];
      const email = typeof wert === "string" ? text(wert) : emailAus({ emails: liste });
      if (email) {
        ergebnis.email = email;
      }
    } else if (pfadKlein === "displayname" || pfadKlein === "name.formatted") {
      const name = text(wert);
      if (name) {
        ergebnis.name = name;
      }
    } else if (pfadKlein.startsWith("roles")) {
      const werte = wert === undefined ? [] : gruppenAus(wert);
      if (op === "add") {
        gruppen = [...new Set([...gruppen, ...werte])];
      } else if (op === "replace") {
        gruppen = werte;
      } else {
        gruppen = werte.length === 0 ? [] : gruppen.filter((g) => !werte.includes(g));
      }
      gruppenGeaendert = true;
    }
  }
  if (gruppenGeaendert) {
    ergebnis.gruppen = gruppen;
  }
  return ergebnis;
}

/** Filter, die ein Verzeichnis vor dem Anlegen stellt: `userName eq "…"`. */
function leseFilter(filter: string): string {
  const passt = /^\s*(userName|emails(?:\.value)?)\s+eq\s+"((?:[^"\\]|\\.)*)"\s*$/i.exec(filter);
  if (!passt) {
    throw new ScimFehler(400, "Only 'userName eq' filters are supported", "invalidFilter");
  }
  return (passt[2] ?? "").replace(/\\(.)/g, "$1");
}

export function verzeichnisRoutes(deps: VerzeichnisRoutesDeps): FastifyPluginAsync {
  const soll = pruefsumme(`Bearer ${deps.schluessel}`);

  // Die Rolle folgt den Gruppen — aber nur, wenn das Verzeichnis Gruppen MITGESCHICKT hat.
  // Schweigt es dazu, bleibt die Rolle, wie sie ist.
  const rolleAus = (gruppen: readonly string[] | undefined): Role | undefined =>
    gruppen === undefined ? undefined : mapOidcRole(gruppen, { roleClaim: "", ...deps.rollen });

  const requireVerzeichnisSchluessel = (request: FastifyRequest, reply: FastifyReply): boolean => {
    const kopf = request.headers.authorization;
    const ist = pruefsumme(typeof kopf === "string" ? kopf.trim() : "");
    if (!timingSafeEqual(ist, soll)) {
      sendeFehler(reply, 401, "Invalid or missing directory token");
      return false;
    }
    return true;
  };

  const antworte = async (
    reply: FastifyReply,
    arbeit: () => Promise<{ status: number; rumpf?: unknown }>,
  ): Promise<void> => {
    try {
      const { status, rumpf } = await arbeit();
      if (rumpf === undefined) {
        reply.code(status).send();
        return;
      }
      reply.code(status).header("content-type", SCIM_INHALT).send(rumpf);
    } catch (fehler) {
      if (fehler instanceof ScimFehler) {
        sendeFehler(reply, fehler.status, fehler.message, fehler.scimType);
        return;
      }
      if (fehler instanceof AuthError) {
        if (fehler.code === "NOT_FOUND") {
          sendeFehler(reply, 404, "User not found");
        } else if (fehler.code === "EMAIL_TAKEN") {
          sendeFehler(reply, 409, "userName already exists", "uniqueness");
        } else {
          // LAST_ADMIN_DEMOTION: das Verzeichnis darf die Instanz nicht aussperren.
          sendeFehler(reply, 409, "Change would remove the last administrator", "mutability");
        }
        return;
      }
      throw fehler;
    }
  };

  const vorhanden = async (id: string): Promise<PublicUser> => {
    const konto = await deps.auth.kontoLesen(id);
    if (!konto) {
      throw new ScimFehler(404, "User not found");
    }
    return konto;
  };

  return async (app) => {
    if (!app.hasContentTypeParser("application/scim+json")) {
      app.addContentTypeParser(
        "application/scim+json",
        { parseAs: "string" },
        (_request, rumpf, fertig) => {
          // Ein Verzeichnis schickt `DELETE` (und manchmal `GET`) mit SCIM-Inhaltstyp, aber ohne
          // Rumpf. Ein leerer Rumpf ist deshalb „kein Rumpf" und kein JSON-Fehler — sonst endete der
          // Austritt mit 400, und das Konto bliebe offen.
          const text = String(rumpf);
          if (text.trim() === "") {
            fertig(null, undefined);
            return;
          }
          try {
            fertig(null, JSON.parse(text));
          } catch {
            fertig(Object.assign(new Error("Invalid JSON"), { statusCode: 400 }), undefined);
          }
        },
      );
    }

    app.get("/scim/v2/ServiceProviderConfig", async (request, reply) => {
      if (!requireVerzeichnisSchluessel(request, reply)) {
        return;
      }
      reply.header("content-type", SCIM_INHALT).send({
        schemas: [SCHEMA_DIENST],
        patch: { supported: true },
        bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
        filter: { supported: true, maxResults: 200 },
        changePassword: { supported: false },
        sort: { supported: false },
        etag: { supported: false },
        authenticationSchemes: [
          { type: "oauthbearertoken", name: "Bearer", description: "Directory token" },
        ],
      });
    });

    app.get<{ Querystring: { filter?: string; startIndex?: string; count?: string } }>(
      "/scim/v2/Users",
      async (request, reply) => {
        if (!requireVerzeichnisSchluessel(request, reply)) {
          return;
        }
        await antworte(reply, async () => {
          const filter = request.query.filter;
          let konten: PublicUser[];
          if (filter) {
            const konto = await deps.auth.kontoPerAdresse(leseFilter(filter));
            konten = konto ? [konto] : [];
          } else {
            konten = await deps.auth.listUsers();
          }
          const start = Math.max(1, Number(request.query.startIndex) || 1);
          const anzahl = Math.min(200, Math.max(0, Number(request.query.count ?? 100) || 0));
          const seite = konten.slice(start - 1, start - 1 + anzahl);
          return {
            status: 200,
            rumpf: {
              schemas: [SCHEMA_LISTE],
              totalResults: konten.length,
              startIndex: start,
              itemsPerPage: seite.length,
              Resources: seite.map(alsScim),
            },
          };
        });
      },
    );

    app.get<{ Params: { id: string } }>("/scim/v2/Users/:id", async (request, reply) => {
      if (!requireVerzeichnisSchluessel(request, reply)) {
        return;
      }
      await antworte(reply, async () => ({
        status: 200,
        rumpf: alsScim(await vorhanden(request.params.id)),
      }));
    });

    app.post("/scim/v2/Users", async (request, reply) => {
      if (!requireVerzeichnisSchluessel(request, reply)) {
        return;
      }
      await antworte(reply, async () => {
        const eingabe = leseNutzer(request.body);
        if (!eingabe.email) {
          throw new ScimFehler(400, "userName is required", "invalidValue");
        }
        const konto = await deps.auth.verzeichnisAnlegen({
          email: eingabe.email,
          name: eingabe.name ?? eingabe.email,
          aktiv: eingabe.aktiv ?? true,
          rolle: rolleAus(eingabe.gruppen),
          gruppen: eingabe.gruppen,
        });
        return { status: 201, rumpf: alsScim(konto) };
      });
    });

    app.put<{ Params: { id: string } }>("/scim/v2/Users/:id", async (request, reply) => {
      if (!requireVerzeichnisSchluessel(request, reply)) {
        return;
      }
      await antworte(reply, async () => {
        await vorhanden(request.params.id);
        const eingabe = leseNutzer(request.body);
        // PUT ersetzt die Ressource: fehlen die Gruppen, sind es keine.
        const gruppen = eingabe.gruppen ?? [];
        const konto = await deps.auth.verzeichnisAendern(request.params.id, {
          email: eingabe.email,
          name: eingabe.name,
          aktiv: eingabe.aktiv ?? true,
          gruppen,
          rolle: rolleAus(gruppen),
        });
        return { status: 200, rumpf: alsScim(konto) };
      });
    });

    app.patch<{ Params: { id: string } }>("/scim/v2/Users/:id", async (request, reply) => {
      if (!requireVerzeichnisSchluessel(request, reply)) {
        return;
      }
      await antworte(reply, async () => {
        const aktuell = await vorhanden(request.params.id);
        const schemas = (request.body as { schemas?: unknown })?.schemas;
        if (Array.isArray(schemas) && !schemas.includes(SCHEMA_PATCH)) {
          throw new ScimFehler(400, "PatchOp schema required", "invalidSyntax");
        }
        const aenderung = wendePatchAn(aktuell, request.body);
        const konto = await deps.auth.verzeichnisAendern(request.params.id, {
          ...aenderung,
          rolle: rolleAus(aenderung.gruppen),
        });
        return { status: 200, rumpf: alsScim(konto) };
      });
    });

    // Austritt: SPERREN, nicht löschen (s. Kopf). Für das Verzeichnis ist die Ressource damit
    // erledigt; in Klara bleibt das gesperrte Konto mit seinen Spuren stehen.
    app.delete<{ Params: { id: string } }>("/scim/v2/Users/:id", async (request, reply) => {
      if (!requireVerzeichnisSchluessel(request, reply)) {
        return;
      }
      await antworte(reply, async () => {
        await vorhanden(request.params.id);
        await deps.auth.verzeichnisAendern(request.params.id, { aktiv: false });
        return { status: 204 };
      });
    });
  };
}
