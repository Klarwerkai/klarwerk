// ================================================================================================
// JOB 3216 · M3c — GEMEINSAMER AUFBAU FÜR DEN DOKUMENTWEG.
// ================================================================================================
//
// Gemessen wird am ECHTEN HTTP-Weg (`POST /api/check-text` über `app.inject`), nicht am Kern
// darunter: die Zusage gilt dem Menschen im Word-Fenster, und Autorisierung wie Pool fallen an der
// Route. Der Kern hat seine eigene Suite (services/app/src/check-text-detection.test.ts) — dort
// stehen die Fälle, für die ein Fake nötig ist (Adapter-Auslegung, geworfene Suche).
//
// DIE PASSAGE ist bewusst zweisätzig und länger als der Suchbegriff-Deckel (200 Zeichen): nur so
// wird die Wahl des charakteristischen Ausschnitts überhaupt wirksam, und nur so lässt sich
// `coverage: partial` von `coverage: full` unterscheiden. S1 ist der längere Satz und damit der
// Ausschnitt, mit dem gesucht wird — das ist gemessen (siehe Fall A0), nicht angenommen.
import { expect } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

export type App = ReturnType<typeof buildApp>;
export type Auth =
  | { authorization: string; cookie?: never }
  | { cookie: string; authorization?: never };

/** Der längere der beiden Sätze — der charakteristische Ausschnitt. */
export const S1 =
  "2.1 Profiles beschreibt die zulaessige Kombination aus Werkzeugsatz, Vorschubgeschwindigkeit " +
  "und Kuehlmittelmenge fuer eine einzelne Portioniereinheit.";

/** Der zweite Satz — er steht nur im vollständigen Bestandsobjekt. */
export const S2 =
  "Jedes Profil wird vor dem Chargenwechsel freigegeben und im Anlagenbuch vermerkt.";

/** Die Passage, die Pedi in Word markiert und prüfen lässt. */
export const PASSAGE = `${S1} ${S2}`;

/** Eine Aussage, die die Passage AUSDRÜCKLICH NICHT enthält — der Kern des Befunds aus M3c. */
export const KURZE_AUSSAGE =
  "Profile der Portioniereinheit werden regelmaessig ueberprueft und dokumentiert.";

const FUELLER = "Fuelltext ohne Aussagekraft zur Anlage. ".repeat(20);

/** Ein Dokumentkörper, in dem der Prüftext erst weit hinter Zeichen 500 steht. */
export function langerBody(text: string): string {
  return `<p>${FUELLER}</p><p>${text}</p>`;
}

async function loginAntwort(app: App, email: string, password: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return res;
}

export async function login(app: App, email: string, password: string): Promise<Auth> {
  const res = await loginAntwort(app, email, password);
  return { authorization: `Bearer ${res.json().token}` };
}

/** Ausschließlich das Sitzungscookie der Login-Antwort; kein Rückfall auf den Token im Rumpf. */
export async function loginCookie(
  app: App,
  email: string,
  password: string,
): Promise<{ cookie: string; authorization?: never }> {
  const res = await loginAntwort(app, email, password);
  const gesetzt = res.headers["set-cookie"];
  const kopf = Array.isArray(gesetzt) ? gesetzt[0] : gesetzt;
  const cookie = kopf?.split(";")[0]?.trim();
  if (!cookie || !/^[^=;]+=[^;]+$/.test(cookie)) {
    throw new Error("Anmeldung ohne gültiges set-cookie-Sitzungscookie; Cookie-Test abgebrochen.");
  }
  return { cookie };
}

/**
 * Ein Aufbau mit Admin und zwei Experten. Der Endpunkt hängt am Flag `KLARWERK_ADDON_API`; die
 * Suiten setzen es selbst und stellen die Umgebung danach wieder her.
 */
export async function aufbau(anmeldeweg: "bearer" | "cookie" = "bearer") {
  const anmelden = anmeldeweg === "cookie" ? loginCookie : login;
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@m3c.test", password: "geheim12345" },
  });
  const admin = await anmelden(app, "admin@m3c.test", "geheim12345");
  for (const email of ["autor@m3c.test", "fremd@m3c.test"]) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role: "experte" },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  const autor = await anmelden(app, "autor@m3c.test", "geheim12345");
  const fremd = await anmelden(app, "fremd@m3c.test", "geheim12345");
  return { app, services, admin, autor, fremd };
}

export async function eigeneKennung(app: App, headers: Auth): Promise<string> {
  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
  expect(me.statusCode, me.body).toBe(200);
  return (me.json() as { id: string }).id;
}

/** Legt ein Wissensobjekt an (Status „offen") und gibt seine Kennung zurück. */
export async function anlegen(
  app: App,
  headers: Auth,
  payload: Record<string, unknown>,
): Promise<string> {
  // JOB 3429 (Q3 c): der Schreibweg verlangt die Stufe. Vorgabe hier, vom Aufrufer überschreibbar.
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: { confidentiality: "intern", ...payload },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

/** Hebt ein Objekt auf „validiert" — derselbe Weg wie in der Bestandssuite der Route. */
export async function validieren(app: App, headers: Auth, id: string): Promise<void> {
  const res = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers,
    payload: { action: "rate", verdict: "up" },
  });
  expect(res.statusCode, res.body).toBe(200);
}

export interface Quellenfund {
  refId: string;
  koTitle: string;
  koStatus: string | null;
  koCategory: string | null;
  pruefstand: string | null;
  version: number | null;
  fundort: { kategorie: string | null; bereich: string | null; bibliothekPfad: string };
  coverage: "full" | "partial";
  gedeckteZeichen: number;
  passageZeichen: number;
  fundstelle: string;
  quelle: { label: string; url: string | null } | null;
  anhang: string | null;
}

export interface Pruefantwort {
  duplicates: Array<{ koId: string }>;
  conflicts: Array<{ koId: string }>;
  sourceHits: Quellenfund[];
  sourceHitsTruncated: boolean;
  quellenfund: { gelaufen: boolean; grund: string | null; geprueft: number };
}

/** Der Menschen-/Sitzungsweg: Cookie bzw. Bearer, genau der Weg des Word-Fensters. */
export async function pruefe(app: App, headers: Auth, text: string): Promise<Pruefantwort> {
  const res = await app.inject({
    method: "POST",
    url: "/api/check-text",
    headers,
    payload: { text },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Pruefantwort;
}

/** Der eingeschränkte Add-in-Schlüsselweg — er bleibt auf Validiertes beschränkt. */
export async function pruefeMitSchluessel(
  app: App,
  schluessel: string,
  text: string,
): Promise<Pruefantwort> {
  const res = await app.inject({
    method: "POST",
    url: "/api/check-text",
    headers: { "x-klarwerk-addon-key": schluessel },
    payload: { text },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Pruefantwort;
}
