// ================================================================================================
// JOB 4015 — DIE EINE BÜHNE DER ROLLENABNAHME: DIE VOLLSTÄNDIGE APP, EIN KONTO JE ROLLE.
// ================================================================================================
//
// Pedis Zeile („ein Gast hat begrenzte Rechte — keine Freigabe an einen Gast ohne Abnahme") ist
// eine Aussage über ALLE Türen der App, nicht über eine. Deshalb baut diese Bühne die VOLLSTÄNDIGE
// App über `buildApp` — dieselbe Kompositionswurzel, die der Server fährt —, und nicht eine
// Fastify-Instanz mit einer handverlesenen Routengruppe darin. Eine Bühne mit ausgewählten Routen
// könnte über die nicht ausgewählten nichts sagen, und genau das ist die Lücke, die dieser Auftrag
// schliesst.
//
// SCHALTER WERDEN AN DER BÜHNE GESETZT (`SCHALTER`), und das ist keine Bequemlichkeit: mehrere
// Routengruppen registriert `build-app.ts` nur bei aktivem Schalter (`checkTextRoutes` und
// `addinStaticRoutes` hinter `KLARWERK_ADDON_API`, `confluenceImportRoutes`/`importRunRoutes` hinter
// `KLARWERK_CONFLUENCE_IMPORT`, `sharepointImportRoutes` hinter `KLARWERK_SHAREPOINT_IMPORT`,
// `provenanceRoutes` hinter `KLARWERK_PROVENANCE_ENABLED`). Ohne sie
// wären diese Gruppen in der Abnahme gar nicht vorhanden — und „nicht registriert" sähe von aussen
// genauso aus wie „gesperrt". Die Schalter werden nach jedem Fall wortgetreu zurückgestellt.
//
// DIE KONTEN ENTSTEHEN AM DIENST, DIE ANMELDUNG AM DRAHT. Das Anlegen über `AuthService` umgeht den
// Selbstregistrierungs-Schalter (WP-VIP2-GATE), der mit der Rollenfrage nichts zu tun hat; die
// SITZUNG aber kommt über `POST /api/auth/login`, weil genau dieser Token später durch das Rechtetor
// läuft. Scheitert die Anmeldung, bricht `anmelden` ab — eine Bühne, die stillschweigend einen
// leeren Token zurückgäbe, würde jede Zeile der Abnahmetabelle als „401" messen und dabei grün
// aussehen (Auftrag §8.6).
import type { FastifyInstance } from "fastify";
import {
  type AppRepos,
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import type { PublicUser, Role } from "../../services/auth";
import { type Routenmitschrift, schreibeRouterentscheidungMit } from "./registrierte-routen";

/** Die vier Rollen des Rollenmodells (`services/auth/src/types.ts:1`), in ihrer Reihenfolge. */
export const ROLLEN = [
  "viewer",
  "experte",
  "controller",
  "admin",
] as const satisfies readonly Role[];
export type Rolle = (typeof ROLLEN)[number];

/** Wer an eine Tür klopft: eine der vier Rollen — oder niemand. */
export const AKTEURE = ["anonym", ...ROLLEN] as const;
export type Akteur = (typeof AKTEURE)[number];

const PASSWORT = "Rollenabnahme-2026!";

/**
 * Die Schalter, die über die ANWESENHEIT einer Routengruppe entscheiden. Werte wie im Betrieb
 * (`feature-flags.ts`: `"1"`/`"true"` schaltet an).
 */
const SCHALTER: Record<string, string> = {
  KLARWERK_ADDON_API: "1",
  KLARWERK_CONFLUENCE_IMPORT: "1",
  // JOB 4086: die zwei SharePoint-Import-Routen entstehen nur mit diesem Schalter. Ohne ihn sähe
  // „nicht registriert" in der Abnahme genauso aus wie „gesperrt" — derselbe Grund wie oben.
  // Zugangsdaten werden BEWUSST nicht gesetzt: die Abnahme misst das Rechtetor, nicht die Quelle,
  // und ohne Adapter antwortet die Route vor jedem Effekt.
  KLARWERK_SHAREPOINT_IMPORT: "1",
  KLARWERK_PROVENANCE_ENABLED: "1",
  // Kein Schalter über einer GRUPPE, sondern über einer einzelnen Route — und gemessen an dieser
  // Bühne: `GET /api/analytics/expertise` prüft den Schalter VOR dem Rechtetor
  // (`library-routes.ts:905-908`) und antwortet ohne ihn allen fünf Akteuren gleich mit 404. Das ist
  // fachlich richtig (eine abgeschaltete Fläche gibt es nicht) und für eine ROLLENabnahme wertlos:
  // die Zeile misst dann die Abwesenheit der Route, nicht die Wirkung des Tors. Mit dem Schalter
  // misst sie das einzige Recht (`ko.assign`), das sonst in keiner Zeile der Tabelle vorkäme.
  KLARWERK_EXPERT_MATCHING: "1",
};

export interface Buehne {
  app: FastifyInstance;
  services: AppServices;
  repos: AppRepos;
  /** Das Konto je Rolle — `konto.viewer.id` ist die Kennung, die in der Ablage steht. */
  konto: Record<Rolle, PublicUser>;
  /** Der über `POST /api/auth/login` geholte Sitzungstoken je Rolle. */
  sitzung: Record<Rolle, string>;
  /**
   * Welche REGISTRIERTE Route der Router für eine Messung gewählt hat (JOB 4061, Runde 2).
   *
   * Der Hook dahinter kann nur VOR `app.ready()` gesetzt werden, deshalb hängt er hier und nicht im
   * Testfall. Ohne ihn wäre „die Zeile misst die Tür, die sie benennt" eine Behauptung — mit ihm ist
   * es eine Auskunft des Routers.
   */
  mitschrift: Routenmitschrift;
}

const offen: Array<{ app: FastifyInstance; vorher: Record<string, string | undefined> }> = [];

/** Schliesst die Instanzen dieses Falls und stellt die Schalter zurück. Gehört in jedes `afterEach`. */
export async function schliesseBuehnen(): Promise<void> {
  for (const eintrag of offen.splice(0)) {
    await eintrag.app.close();
    for (const [name, wert] of Object.entries(eintrag.vorher)) {
      if (wert === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = wert;
      }
    }
  }
}

/** Die Anmeldung, die gelingen MUSS — sonst misst die Abnahme darunter nichts. */
export async function anmelden(app: FastifyInstance, email: string): Promise<string> {
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
 * Baut die vollständige App und legt je Rolle ein freigegebenes, angemeldetes Konto an.
 *
 * Das ERSTE Konto einer leeren Instanz wird von `AuthService.register` zum freigegebenen Admin
 * (`services/auth/src/service.ts:225`); alle weiteren entstehen als nicht freigegebene `experte` und
 * werden von diesem Admin freigegeben und auf ihre Rolle gesetzt. Genau so entsteht ein Konto auch
 * im Betrieb — es gibt keinen zweiten Weg, und ein direkt in die Ablage geschriebenes Konto würde
 * die Abnahme gegen einen Zustand fahren, den das Produkt selbst nie herstellt.
 */
export async function baueBuehne(): Promise<Buehne> {
  const vorher: Record<string, string | undefined> = {};
  for (const [name, wert] of Object.entries(SCHALTER)) {
    vorher[name] = process.env[name];
    process.env[name] = wert;
  }
  const repos = inMemoryRepos();
  const services = assembleServices(repos);
  const app = buildApp(services);
  // VOR `ready()`: Fastify nimmt danach keinen Hook mehr an. Der Mitschreiber liest ausschliesslich
  // `request.routeOptions.url` mit, reicht die Nutzlast unverändert weiter und läuft synchron —
  // Begründung im Kopf von `registrierte-routen.ts`.
  const mitschrift = schreibeRouterentscheidungMit(app);
  await app.ready();
  offen.push({ app, vorher });

  const admin = await services.auth.register({
    name: "Abnahme Admin",
    email: "admin@abnahme.de",
    password: PASSWORT,
  });
  const konto = { admin } as Record<Rolle, PublicUser>;
  for (const rolle of ROLLEN) {
    if (rolle === "admin") {
      continue;
    }
    const frisch = await services.auth.register({
      name: `Abnahme ${rolle}`,
      email: `${rolle}@abnahme.de`,
      password: PASSWORT,
    });
    await services.auth.approveUser(frisch.id, admin.id);
    konto[rolle] = await services.auth.changeRole(frisch.id, rolle, admin.id);
  }

  const sitzung = {} as Record<Rolle, string>;
  for (const rolle of ROLLEN) {
    sitzung[rolle] = await anmelden(app, konto[rolle].email);
  }
  return { app, services, repos, konto, sitzung, mitschrift };
}

/** Die Kopfzeilen eines Akteurs: ein Bearer-Token — oder gar nichts. */
export function kopfFuer(buehne: Buehne, akteur: Akteur): Record<string, string> {
  return akteur === "anonym" ? {} : { authorization: `Bearer ${buehne.sitzung[akteur]}` };
}
