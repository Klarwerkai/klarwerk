// ================================================================================================
// JOB 3023 — DIESELBE SACHE ZWEIMAL IN EINER NUTZLAST ERZEUGT EIN OBJEKT, NICHT ZWEI.
// ================================================================================================
//
// Der Vergleich lief bis HEAD 7cf92ce gegen einen `Set`, der die bereits importierten Schluessel
// mitfuehrte (`service.ts:1430`) — aber wieder nur zeichengleich. Eine Sicherung, die denselben
// Eintrag zweimal in leicht abweichender Schreibweise enthaelt, legte ihn zweimal an. Der Bestand
// war danach schon beim ERSTEN Einspielen doppelt.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const ZUGANG = { name: "Admin", email: "laufintern@x.de", password: "secret123" };

interface Uebersprungen {
  titel: string;
  grund: string;
  koId: string | null;
  aehnlichkeit?: number;
}

async function leereApp() {
  const app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  return { app, headers: { authorization: `Bearer ${login.json().token}` } };
}

describe("JOB 3023 · B — der Vergleich laeuft auch gegen den eigenen Lauf", () => {
  it("B1 · zweimal dieselbe Sache in EINER Nutzlast → ein Objekt", async () => {
    const { app, headers } = await leereApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/library/import",
      headers,
      payload: {
        items: [
          {
            title: "Filter wechseln",
            statement: "Den Filter der Anlage 3 jaehrlich wechseln.",
            type: "best_practice",
            category: "Wartung",
          },
          {
            title: "FILTER WECHSELN",
            statement: "Den Filter der Anlage 3 jaehrlich wechseln!",
            type: "best_practice",
            category: "Wartung",
          },
        ],
      },
    });

    expect(res.statusCode, res.body).toBe(200);
    const body = res.json() as {
      imported: number;
      skipped: number;
      uebersprungen: Uebersprungen[];
    };
    expect(body.imported).toBe(1);
    expect(body.skipped).toBe(1);
    expect(body.uebersprungen).toHaveLength(1);
    expect(body.uebersprungen[0]?.grund).toBe("aehnlich");

    const liste = await app.inject({ method: "GET", url: "/api/kos", headers });
    const kos = liste.json() as { id: string }[];
    expect(
      kos,
      "Aus zwei Schreibweisen derselben Sache wird genau ein Wissensobjekt.",
    ).toHaveLength(1);
    expect(
      body.uebersprungen[0]?.koId,
      "Der Treffer ist das im selben Lauf erzeugte Objekt — nicht `null`.",
    ).toBe(kos[0]?.id);
  });
});
