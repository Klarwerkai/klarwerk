// ================================================================================================
// PRÜFSTATUS-ANZEIGE (R-0212, Test 1 von 2) · DER WIDERSPRUCH HÄLT ÜBER DIE SCHNITTSTELLE.
// ================================================================================================
//
// Zielzustand: „Ein Widerspruch zwischen Wissensständen wird nicht nur in der Oberfläche gezeigt,
// sondern hält auch über die Schnittstelle und auf schmalen Bildschirmen." Bis hierher meldeten
// `GET /api/kos/:id` und `GET /api/kos` den Eingang `konflikt` dauerhaft als „ungeprüft" — der
// Widerspruch existierte nur in der Konfliktliste der Oberfläche. Jetzt erheben beide Routen ihn.
//
// Dieselbe Paarregel wie `GET /api/conflicts`: ein Konflikt zählt nur, wenn der Leser BEIDE Seiten
// sehen darf. Ein gelöster Konflikt zählt nicht mehr. Scheitert die Abfrage, steht der benannte
// Grund da — nie `false`. Der schmale Bildschirm ist Test 2: `r0212-konflikt-schmal.test.tsx`.
import { describe, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";

type Auth = { authorization: string };
type Antwort = {
  id: string;
  anzeigestatus?: string;
  anzeigestatusHerkunft?: { konflikt?: string; ungeprueft: Record<string, string> };
};

async function aufbau() {
  const services = assembleServices(inMemoryRepos());
  const app = buildApp(services);
  const login = async (email: string): Promise<Auth> => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "geheim12345" },
    });
    expect(res.statusCode, res.body).toBe(200);
    return { authorization: `Bearer ${res.json().token}` };
  };
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@r0212.test", password: "geheim12345" },
  });
  const admin = await login("admin@r0212.test");
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: {
      name: "Experte",
      email: "experte@r0212.test",
      password: "geheim12345",
      role: "experte",
    },
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  const experte = await login("experte@r0212.test");
  const anlegen = async (title: string, confidentiality?: "vertraulich") =>
    (
      await services.ko.create({
        title,
        statement: `Kerntext zu ${title}.`,
        type: "best_practice",
        category: "Anlage 1",
        author: "u-autor",
        ...(confidentiality ? { confidentiality } : {}),
      })
    ).id;
  const detail = async (wer: Auth, id: string): Promise<Antwort> => {
    const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: wer });
    expect(res.statusCode, res.body).toBe(200);
    return res.json() as Antwort;
  };
  const liste = async (wer: Auth): Promise<Antwort[]> => {
    const res = await app.inject({ method: "GET", url: "/api/kos", headers: wer });
    expect(res.statusCode, res.body).toBe(200);
    return res.json() as Antwort[];
  };
  return { services, admin, experte, anlegen, detail, liste };
}

describe("R-0212 · Konflikt im Anzeigestatus von `/api/kos/:id` und `/api/kos`", () => {
  it("offener Konflikt: beide Seiten heißen `konflikt` — am Detail UND in der Liste, erhoben", async () => {
    const { services, admin, anlegen, detail, liste } = await aufbau();
    const a = await anlegen("Druck vor dem Anfahren prüfen");
    const b = await anlegen("Druck nach dem Anfahren prüfen");
    const c = await anlegen("Unbeteiligt");
    await services.conflicts.create({ koA: a, koB: b, type: "truth", description: "Widerspruch" });

    for (const id of [a, b]) {
      const voll = await detail(admin, id);
      expect(voll.anzeigestatus, `Detail ${id}`).toBe("konflikt");
      expect(voll.anzeigestatusHerkunft?.konflikt).toBe("geprueft");
    }
    const eintraege = await liste(admin);
    const status = (id: string) => eintraege.find((e) => e.id === id)?.anzeigestatus;
    expect(status(a)).toBe("konflikt");
    expect(status(b)).toBe("konflikt");
    // Gegenprobe im selben Bestand: das unbeteiligte Objekt ist erhoben UND konfliktfrei.
    expect(status(c)).toBe("offen");
    expect(eintraege.find((e) => e.id === c)?.anzeigestatusHerkunft?.konflikt).toBe("geprueft");
  });

  it("ein gelöster Konflikt zählt nicht mehr", async () => {
    const { services, admin, anlegen, detail } = await aufbau();
    const a = await anlegen("A");
    const b = await anlegen("B");
    const konflikt = await services.conflicts.create({
      koA: a,
      koB: b,
      type: "truth",
      description: "Widerspruch",
    });
    expect((await detail(admin, a)).anzeigestatus).toBe("konflikt");
    // R-0215 (Aufnahme gesamt-konfliktklassifikation): verbindlich erst eskalieren, dann entscheiden.
    await services.conflicts.escalate(konflikt.id, "u-admin");
    await services.conflicts.resolve(konflikt.id, "u-admin", "A gilt");
    expect((await detail(admin, a)).anzeigestatus).toBe("offen");
  });

  it("SICHTBARKEIT: ein Konflikt mit einem Objekt, das der Leser nicht sehen darf, verrät nichts", async () => {
    const { services, admin, experte, anlegen, detail, liste } = await aufbau();
    const offen = await anlegen("Öffentlich-intern");
    const geheim = await anlegen("Vertrauliche Gegenseite", "vertraulich");
    await services.conflicts.create({
      koA: offen,
      koB: geheim,
      type: "truth",
      description: "Widerspruch",
    });
    // Wer beide Seiten sieht, sieht den Konflikt.
    expect((await detail(admin, offen)).anzeigestatus).toBe("konflikt");
    // Wer die Gegenseite nicht sehen darf, bekommt dieselbe Antwort wie ohne Konflikt.
    const sicht = await detail(experte, offen);
    expect(sicht.anzeigestatus).toBe("offen");
    expect(sicht.anzeigestatusHerkunft?.konflikt).toBe("geprueft");
    expect((await liste(experte)).find((e) => e.id === offen)?.anzeigestatus).toBe("offen");
  });

  it("scheitert die Konfliktabfrage: benannter Grund, nie `kein Konflikt`", async () => {
    const { services, admin, anlegen, detail, liste } = await aufbau();
    const a = await anlegen("A");
    services.conflicts.unresolved = async () => {
      throw new Error("Konfliktablage nicht erreichbar");
    };
    for (const voll of [await detail(admin, a), (await liste(admin)).find((e) => e.id === a)]) {
      expect(voll?.anzeigestatusHerkunft?.konflikt).toBe("ungeprueft");
      expect(voll?.anzeigestatusHerkunft?.ungeprueft.konflikt).toContain("fehlgeschlagen");
    }
  });
});
