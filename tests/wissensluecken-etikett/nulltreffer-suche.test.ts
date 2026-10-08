// ================================================================================================
// R-0773 — „DAS SYSTEM ZEIGT, WONACH GESUCHT WURDE, OHNE DASS ETWAS GEFUNDEN WURDE."
// ================================================================================================
//
// Gemessen über die echte Route `GET /api/library/search` und die Leseroute
// `GET /api/library/nulltreffer` (Bauart `tests/security/mega78-offene-luecken-zaehler.test.ts`):
//   N1 · ein nicht-leerer Begriff ohne sichtbaren Treffer wird vermerkt; dieselbe Schreibung in
//        anderer Form zählt hoch statt einen zweiten Eintrag anzulegen
//   N2 · eine leere Abfrage ist kein Nulltreffer
//   N3 · mit zusätzlichem Filter ist eine leere Liste kein Nulltreffer
//   N4 · mit Treffer kein Eintrag
//   N5 · gemessen an dem, was DER SUCHENDE sieht: ein für ihn unsichtbares Objekt ist kein Treffer
//   N6 · jede Person sieht nur ihre eigenen Nulltreffer
//   N7 · ein technischer Fehler der Suche ist kein Nulltreffer
import { describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

async function login(app: App, email: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

async function setup(marke: string) {
  const services = buildServices();
  const app = buildApp(services);
  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Anna", email: `anna@${marke}.test`, password: "geheim12345" },
  });
  expect(reg.statusCode, reg.body).toBeLessThan(300);
  const annaId =
    (reg.json() as { user?: { id: string }; id?: string }).user?.id ??
    (reg.json() as { id?: string }).id ??
    "";
  const anna = await login(app, `anna@${marke}.test`);
  const neu = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: anna,
    payload: {
      name: "Bert",
      email: `bert@${marke}.test`,
      password: "geheim12345",
      role: "experte",
    },
  });
  expect(neu.statusCode, neu.body).toBe(201);
  return { services, app, annaId, anna, bert: await login(app, `bert@${marke}.test`) };
}

async function suche(app: App, wer: Auth, query: string) {
  return app.inject({ method: "GET", url: `/api/library/search?${query}`, headers: wer });
}

async function eigene(app: App, wer: Auth): Promise<{ begriff: string; anzahl: number }[]> {
  const res = await app.inject({ method: "GET", url: "/api/library/nulltreffer", headers: wer });
  expect(res.statusCode, res.body).toBe(200);
  return res.json();
}

describe("R-0773 · erfolglose Suchen werden sichtbar", () => {
  it("N1 · ohne Treffer vermerkt; andere Schreibweise desselben Begriffs zählt hoch", async () => {
    const { app, anna } = await setup("n1");
    const erste = await suche(app, anna, "q=Kesselflansch");
    expect(erste.statusCode, erste.body).toBe(200);
    expect(erste.json(), "KALIBRIERUNG: wirklich kein Treffer").toEqual([]);
    await suche(app, anna, `q=${encodeURIComponent("KESSELFLANSCH!")}`);
    const liste = await eigene(app, anna);
    expect(liste).toHaveLength(1);
    expect(liste[0]?.anzahl).toBe(2);
    expect(liste[0]?.begriff.toLowerCase()).toContain("kesselflansch");
  });

  it("N2 · eine leere Abfrage ist kein Nulltreffer", async () => {
    const { app, anna } = await setup("n2");
    await suche(app, anna, "q=");
    await suche(app, anna, `q=${encodeURIComponent("   ")}`);
    expect(await eigene(app, anna)).toEqual([]);
  });

  it("N3 · mit zusätzlichem Filter sagt die leere Liste nichts über fehlendes Wissen", async () => {
    const { app, anna } = await setup("n3");
    const res = await suche(app, anna, "q=Kesselflansch&category=Wartung");
    expect(res.statusCode, res.body).toBe(200);
    expect(await eigene(app, anna)).toEqual([]);
  });

  it("N4 · mit Treffer kein Eintrag", async () => {
    const { services, app, annaId, anna } = await setup("n4");
    await services.ko.create({
      title: "Kesselflansch Anzugsreihenfolge",
      statement: "Ueber Kreuz in drei Durchgaengen anziehen.",
      type: "best_practice",
      category: "Wartung",
      author: annaId,
    } as never);
    const res = await suche(app, anna, "q=Kesselflansch");
    expect((res.json() as unknown[]).length, "KALIBRIERUNG: der Treffer ist da").toBeGreaterThan(0);
    expect(await eigene(app, anna)).toEqual([]);
  });

  it("N5 · gemessen am Sichtbaren: Annas vertrauliches Objekt ist für Bert kein Treffer", async () => {
    const { services, app, annaId, anna, bert } = await setup("n5");
    await services.ko.create({
      title: "Kesselflansch Sonderfreigabe",
      statement: "Nur fuer den Werkleiter.",
      type: "best_practice",
      category: "Wartung",
      author: annaId,
      confidentiality: "vertraulich",
    } as never);
    const fuerAnna = await suche(app, anna, "q=Kesselflansch");
    expect((fuerAnna.json() as unknown[]).length, "KALIBRIERUNG: Anna sieht es").toBeGreaterThan(0);
    const fuerBert = await suche(app, bert, "q=Kesselflansch");
    expect(fuerBert.json(), "KALIBRIERUNG: Bert sieht es nicht").toEqual([]);
    expect(await eigene(app, anna)).toEqual([]);
    expect((await eigene(app, bert)).map((e) => e.anzahl)).toEqual([1]);
  });

  it("N6 · jede Person sieht nur ihre eigenen Nulltreffer", async () => {
    const { app, anna, bert } = await setup("n6");
    await suche(app, anna, "q=Abscheiderspuelung");
    expect((await eigene(app, anna)).length).toBe(1);
    const fremd = await eigene(app, bert);
    expect(fremd).toEqual([]);
    expect(JSON.stringify(fremd)).not.toContain("Abscheider");
  });

  it("N7 · ein technischer Fehler der Suche wird nie als Nulltreffer gezählt", async () => {
    const { services, app, anna } = await setup("n7");
    services.library.search = async () => {
      throw new Error("Suche gestört");
    };
    const res = await suche(app, anna, "q=Kesselflansch");
    expect(res.statusCode, "KALIBRIERUNG: Suche gescheitert").toBeGreaterThanOrEqual(500);
    expect(await eigene(app, anna)).toEqual([]);
  });
});
