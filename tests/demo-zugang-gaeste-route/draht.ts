// ================================================================================================
// DIE EINE VERDRAHTUNG DER ROUTEN-FÄLLE — HTTP-Schicht über dem Kreis aus `demo-zugang-gaeste`.
// ================================================================================================
//
// JOB 3755 hat diese Verdrahtung in `befristung-ueber-die-schnittstelle.test.ts` aufgebaut, als sie
// nur eine Datei trug. JOB 3780 stellt eine zweite Datei daneben (die Formprüfung von `role`,
// `approve`, `password` an demselben Endpunkt) — und damit gilt hier dasselbe Argument, das
// `tests/demo-zugang-gaeste/aufbau.ts:7` für die Dienst-Fälle aufschreibt: Läge die Verdrahtung
// zweimal da, könnten zwei Dateien später still gegen verschiedene Fastify-Aufbauten messen, und
// zwei Aussagen über DENSELBEN Endpunkt wären nicht mehr vergleichbar.
//
// KEIN DRITTER KREIS. Uhr, Ablagen und Prüfprotokoll kommen unverändert aus
// `tests/demo-zugang-gaeste/aufbau` — dieses Modul setzt ausschließlich den Draht darüber.
//
// DER AUFRÄUM-HAKEN WIRD HIER NICHT REGISTRIERT, sondern nur bereitgestellt. Ein `afterEach` im
// Rumpf eines gemeinsamen Moduls hinge an der Sammelreihenfolge der Dateien (wer importiert zuerst)
// und schlösse im schlechten Fall die Instanzen einer FREMDEN Datei. Jede Testdatei ruft
// `schliesseOffeneDraehte` in ihrem eigenen `afterEach`.
import Fastify, { type FastifyInstance, type LightMyRequestResponse } from "fastify";
import { expect } from "vitest";
import { authRoutes } from "../../services/auth/src/routes";
import type { PublicUser } from "../../services/auth/src/types";
import { GAST_PASSWORT, type Kreis, baueKreis } from "../demo-zugang-gaeste/aufbau";

export interface Draht {
  k: Kreis;
  app: FastifyInstance;
}

const offen: FastifyInstance[] = [];

/** Schließt die in diesem Fall geöffneten Fastify-Instanzen. Aufruf gehört in jedes `afterEach`. */
export async function schliesseOffeneDraehte(): Promise<void> {
  for (const app of offen.splice(0)) {
    await app.close();
  }
}

export async function baueDraht(): Promise<Draht> {
  const k = baueKreis();
  const app = Fastify();
  await app.register(authRoutes(k.service));
  await app.ready();
  offen.push(app);
  return { k, app };
}

export function anmelden(app: FastifyInstance, email: string): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: GAST_PASSWORT },
  });
}

/** Die Anmeldung, die gelingen MUSS — sonst misst der Fall darunter nichts. */
export async function token(app: FastifyInstance, email: string): Promise<string> {
  const antwort = await anmelden(app, email);
  if (antwort.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${antwort.statusCode} ${antwort.body}`);
  }
  return antwort.json().token as string;
}

export function verwalte(
  app: FastifyInstance,
  sitzung: string,
  id: string,
  body: Record<string, unknown>,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "PUT",
    url: `/api/users/${id}`,
    headers: { authorization: `Bearer ${sitzung}` },
    payload: body,
  });
}

/** Der Stand, den ein Mensch in der Nutzerliste sieht — nicht der aus der Antwort von eben. */
export async function ausDerListe(
  app: FastifyInstance,
  sitzung: string,
  id: string,
): Promise<PublicUser | undefined> {
  const antwort = await app.inject({
    method: "GET",
    url: "/api/users",
    headers: { authorization: `Bearer ${sitzung}` },
  });
  expect(antwort.statusCode, `GET /api/users: ${antwort.body}`).toBe(200);
  return (antwort.json() as PublicUser[]).find((u) => u.id === id);
}

export function ich(app: FastifyInstance, sitzung: string): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${sitzung}` },
  });
}
