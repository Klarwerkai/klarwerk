// ================================================================================================
// JOB 4146 · WIKI-DISKUSSION — DIE GEMEINSAME HÜLLE DER ROUTENFÄLLE
// ================================================================================================
//
// WARUM EINE HÜLLE UND NICHT VIER ABSCHRIFTEN: D3, der Zugriffsfall (Vertrag Fall 4) und der
// Idempotenzfall (Vertrag Fall 5) messen DASSELBE Tor an derselben Route. Vier eigene Aufbauten
// wären vier Gelegenheiten, den Aufbau auseinanderlaufen zu lassen — und dann misst einer der Fälle
// etwas anderes als er behauptet. Bauform übernommen aus `tests/word-rueckweg/route-accountregel.ts`
// (echtes Login, echte Rollen über `POST /api/users`, echter PUT); nichts ist nachgebaut.
import { expect } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

export type App = ReturnType<typeof buildApp>;
export type Antwort = Awaited<ReturnType<App["inject"]>>;
export type Kopf = Record<string, string>;

/** Der Beitrag, wie ihn die Route zurückgibt — die neuen Felder sind OPTIONAL wie am Draht. */
export interface Beitrag {
  id: string;
  author: string;
  text: string;
  at: string;
  replyTo?: string;
  koVersion?: number;
  clientKey?: string;
  resolution?: { state: "erledigt" | "offen"; by: string; at: string };
}

export interface Objektstand {
  id: string;
  version: number;
  status: string;
  trust: number;
  confidence: number;
  comments?: Beitrag[];
  ownership?: unknown;
}

export async function flaeche(): Promise<{ app: App; admin: Kopf }> {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@klarwerk.test", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@klarwerk.test", password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return { app, admin: { authorization: `Bearer ${(login.json() as { token: string }).token}` } };
}

/** Ein zweites Konto über den Weg des Produkts — eine von Hand gesetzte Rolle gäbe es nie so. */
export async function konto(app: App, admin: Kopf, rolle: string, email: string): Promise<Kopf> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: { name: `Konto ${rolle}`, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

export async function anlegen(
  app: App,
  headers: Kopf,
  vertraulich = false,
  titel = "Ventil X schließt bei Überdruck",
): Promise<Objektstand> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality: vertraulich ? "vertraulich" : "intern",
      title: titel,
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  return angelegt.json() as Objektstand;
}

export function put(
  app: App,
  headers: Kopf,
  id: string,
  payload: Record<string, unknown>,
): Promise<Antwort> {
  return app.inject({ method: "PUT", url: `/api/kos/${id}`, headers, payload });
}

export async function lesen(app: App, headers: Kopf, id: string): Promise<Objektstand> {
  const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers });
  expect(res.statusCode).toBe(200);
  return res.json() as Objektstand;
}

export function beitraege(stand: Objektstand): Beitrag[] {
  return stand.comments ?? [];
}
