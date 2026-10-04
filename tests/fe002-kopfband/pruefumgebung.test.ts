// ================================================================================================
// FE-002 · E7 — DIE PRÜFUMGEBUNG STEHT WIRKLICH (scripts/fe002-pruefumgebung.ts).
// ================================================================================================
//
// Startet die Bereitstellung, die das Prüfpaket (docs/belege/fe-002/PRUEFPAKET.md) Pedi bzw. dem
// Frontend-Berater in die Hand gibt, auf einem echten Port und geht sie über echtes HTTP ab:
// Oberfläche wird ausgeliefert, beide erzeugten Zugänge melden sich an, der Administrator hat die
// zwei ungelesenen Meldungen aus dem echten Frageweg, die Expertin trägt ihre niedrigere Rolle.
// Benötigt das gebaute `apps/web/dist` (im Tor baut `tools/build` es vorher).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Pruefumgebung, stellePruefumgebungBereit } from "../../scripts/fe002-pruefumgebung";

let umgebung: Pruefumgebung;

beforeAll(async () => {
  umgebung = await stellePruefumgebungBereit({ port: 0 });
}, 60_000);

afterAll(async () => {
  await umgebung?.schliessen();
});

async function anmelden(email: string, passwort: string): Promise<{ token: string; role: string }> {
  const r = await fetch(`${umgebung.adresse}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: passwort }),
  });
  expect(r.status, `Anmeldung ${email}`).toBe(200);
  const j = (await r.json()) as { token: string; user: { role: string } };
  return { token: j.token, role: j.user.role };
}

describe("FE-002 · E7 · Prüfumgebung", () => {
  it("liefert die Oberfläche auf /start aus", async () => {
    const r = await fetch(`${umgebung.adresse}/start`);
    expect(r.status).toBe(200);
    expect(await r.text()).toContain('<div id="root"');
  });

  it("die zur Laufzeit erzeugten Zugänge melden sich an — Administrator und Expertin", async () => {
    const [admin, experte] = umgebung.zugaenge;
    expect(admin?.passwort.length).toBeGreaterThanOrEqual(12);
    expect((await anmelden(admin?.email ?? "", admin?.passwort ?? "")).role).toBe("admin");
    expect((await anmelden(experte?.email ?? "", experte?.passwort ?? "")).role).toBe("experte");
  });

  it("der Administrator hat zwei echte ungelesene Meldungen (offene Wissenslücken)", async () => {
    const admin = umgebung.zugaenge[0];
    const { token } = await anmelden(admin?.email ?? "", admin?.passwort ?? "");
    const r = await fetch(`${umgebung.adresse}/api/notifications`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const liste = (await r.json()) as Array<{ kind: string; seen: boolean }>;
    expect(liste.filter((m) => !m.seen && m.kind === "gap")).toHaveLength(2);
    expect(umgebung.ungeleseneMeldungen).toBe(2);
  });
});
