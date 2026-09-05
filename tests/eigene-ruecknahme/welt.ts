// ================================================================================================
// JOB 3071 — DER GEMEINSAME PRÜFSTAND DER EIGENEN RÜCKNAHME.
// ================================================================================================
//
// Alle Fälle dieses Ordners brauchen dieselbe Lage: eine gebaute App mit ECHTER Verdrahtung
// (buildServices → buildApp, also inklusive des Ports aus der Kompositionswurzel), eine Admin-
// Kennung, eine freigegebene AUTORIN und eine zweite Expertin für die Gegenseite. Der Aufbau steht
// hier und nicht je Datei, damit kein Fall versehentlich an einer anderen Verdrahtung misst als
// sein Nachbar.
//
// WARUM DIE KOs ÜBER DIE HTTP-ROUTE ENTSTEHEN und nicht über `services.ko.create`: nur so trägt
// `author` wirklich die Kennung des angemeldeten Menschen, und nur so misst der Kernfall die
// Reihenfolgefalle (§2.4 des Auftrags) am echten Weg — beim Nachlauf der Löschroute liegt das
// Objekt bereits im Papierkorb.
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { OverlapEntry } from "../../services/conflicts";

export type App = ReturnType<typeof buildApp>;
export type Services = ReturnType<typeof buildServices>;

export interface Konto {
  id: string;
  headers: Record<string, string>;
}

async function anmelden(app: App, email: string, password: string): Promise<Konto> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  const headers = { authorization: `Bearer ${res.json().token as string}` };
  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
  return { headers, id: me.json().id as string };
}

async function registrieren(
  app: App,
  services: Services,
  admin: Konto | undefined,
  name: string,
  email: string,
): Promise<Konto> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name, email, password: "secret123" },
  });
  const id = res.json().id as string;
  // Selbstregistrierung startet unfreigegeben (auth/src/service.ts:177) — der Admin gibt frei.
  if (admin) {
    await services.auth.approveUser(id, admin.id);
  }
  return anmelden(app, email, "secret123");
}

export interface Welt {
  services: Services;
  app: App;
  admin: Konto;
  autorin: Konto;
  fremde: Konto;
}

export async function welt(): Promise<Welt> {
  const services = buildServices();
  const app = buildApp(services);
  // Das erste Konto wird Admin (Bootstrap), alle weiteren sind Experten und brauchen die Freigabe.
  const admin = await registrieren(app, services, undefined, "Admin", "admin@x.de");
  const autorin = await registrieren(app, services, admin, "Nora Autorin", "nora@x.de");
  const fremde = await registrieren(app, services, admin, "Frida Fremde", "frida@x.de");
  return { services, app, admin, autorin, fremde };
}

/** Legt ein Wissensobjekt über die echte Route an — Autor ist der angemeldete Mensch. */
export async function koAnlegen(app: App, konto: Konto, titel: string, satz: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: konto.headers,
    payload: { title: titel, statement: satz, type: "best_practice", category: "Anlage 1" },
  });
  if (res.statusCode >= 300) {
    throw new Error(`KO-Anlage fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return res.json().id as string;
}

/** Ein OFFENER Überschneidungsbefund über genau diesem Paar (deterministisch, kein Modell). */
export async function befund(services: Services, koA: string, koB: string): Promise<OverlapEntry> {
  return services.overlaps.createAuto(
    {
      koA,
      koB,
      relation: "identisch",
      aspects: [{ beschreibung: "gleiche Anweisung", zitatA: "entlüften", zitatB: "entlüften" }],
      eigenanteilA: "",
      eigenanteilB: "",
      recommendation: "zusammenfuehren",
    },
    { trigger: "manual", method: "deterministic", lexicalScore: 0.95 },
    "system",
  );
}

/** Die Belege genau EINES Befunds, nach Aktion gefiltert. */
export async function belege(services: Services, action: string, target: string) {
  return (await services.audit.list({ action })).filter((e) => e.target === target);
}
