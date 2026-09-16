// ================================================================================================
// JOB 4151 · WG-PERSISTENZ — DIE PRÜFBÜHNE DIESER GRUPPE: DIE VOLLSTÄNDIGE APP, EIN KONTO JE ROLLE.
// ================================================================================================
//
// WARUM EINE EIGENE UND NICHT DIE DER ROLLENABNAHME (`tests/beta-rollenabnahme/buehne.ts`): jene
// Bühne gehört zur laufenden Arbeit von JOB 4141 und trägt deren Schalter, deren Konten und deren
// Lebensdauer-Vertrag. Sie hier mitzubenutzen hiesse, zwei Aufträge an eine Datei zu binden, die
// gerade umgebaut wird. Der AUFBAU ist bewusst derselbe — `buildApp` über `assembleServices`, die
// Konten über den echten Registrierungsweg, die Sitzung über `POST /api/auth/login` —, weil eine
// zweite Art, die App zu bauen, eine zweite Wahrheit darüber wäre, wie das Produkt aussieht.
//
// DER BESTAND WIRD HERAUSGEREICHT (`kanten`). Die Lehre aus JOB 4141 R1 (15.09. 17:17) lautet: ein
// 403 allein belegt nicht, dass nichts geschehen ist. Jede Rechteprüfung dieser Gruppe liest den
// Bestand deshalb VORHER und NACHHER und vergleicht — dafür muss sie ihn erreichen können.
import type { FastifyInstance } from "fastify";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import type { PublicUser, Role } from "../../services/auth";
import type { KantenRepo } from "../../services/knowledge-object";

export const ROLLEN = [
  "viewer",
  "experte",
  "controller",
  "admin",
] as const satisfies readonly Role[];
export type Rolle = (typeof ROLLEN)[number];

const PASSWORT = "Wissensgraph-2026!";

export interface Buehne {
  app: FastifyInstance;
  services: AppServices;
  /** Der Kantenbestand, den die App wirklich benutzt — für den Vorher/Nachher-Vergleich. */
  kanten: KantenRepo;
  konto: Record<Rolle, PublicUser>;
  sitzung: Record<Rolle, string>;
  schliesse(): Promise<void>;
}

/** Die Anmeldung, die gelingen MUSS — sonst misst alles darunter nur eine kaputte Bühne. */
async function anmelden(app: FastifyInstance, email: string): Promise<string> {
  const antwort = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: PASSWORT },
  });
  if (antwort.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${antwort.statusCode} ${antwort.body}`);
  }
  const token = (antwort.json() as { token?: unknown }).token;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error(`Anmeldung ${email} lieferte keinen Token: ${antwort.body}`);
  }
  return token;
}

/**
 * Eine frische Instanz je Aufruf. Diese Gruppe misst SCHREIBENDE Wege — eine geteilte Bühne
 * liesse jede Messung die Spuren der vorherigen sehen, und genau der Bestandsvergleich, auf dem
 * der Rechtenachweis beruht, wäre dann nichts mehr wert.
 */
export async function baueBuehne(): Promise<Buehne> {
  const services = assembleServices(inMemoryRepos());
  const app = buildApp(services);
  await app.ready();

  const admin = await services.auth.register({
    name: "Graph Admin",
    email: "admin@wissensgraph.de",
    password: PASSWORT,
  });
  const konto = { admin } as Record<Rolle, PublicUser>;
  for (const rolle of ROLLEN) {
    if (rolle === "admin") {
      continue;
    }
    const frisch = await services.auth.register({
      name: `Graph ${rolle}`,
      email: `${rolle}@wissensgraph.de`,
      password: PASSWORT,
    });
    await services.auth.approveUser(frisch.id, admin.id);
    konto[rolle] = await services.auth.changeRole(frisch.id, rolle, admin.id);
  }

  const sitzung = {} as Record<Rolle, string>;
  for (const rolle of ROLLEN) {
    sitzung[rolle] = await anmelden(app, konto[rolle].email);
  }

  return {
    app,
    services,
    kanten: services.kanten,
    konto,
    sitzung,
    schliesse: () => app.close(),
  };
}

export function kopfFuer(buehne: Buehne, rolle: Rolle): Record<string, string> {
  return { authorization: `Bearer ${buehne.sitzung[rolle]}` };
}

/** Legt ein Wissensobjekt an und gibt seine Kennung zurück. */
export async function neuesKo(
  buehne: Buehne,
  title: string,
  over: { confidentiality?: "intern" | "vertraulich"; author?: string } = {},
): Promise<string> {
  const ko = await buehne.services.ko.create({
    title,
    statement: `Aussage zu ${title}`,
    type: "best_practice",
    category: "Betrieb",
    author: over.author ?? buehne.konto.controller.id,
    tags: [],
    ...(over.confidentiality ? { confidentiality: over.confidentiality } : {}),
  });
  return ko.id;
}
