// ================================================================================================
// JOB 3023 — DIESELBE SACHE ZWEIMAL IN EINER NUTZLAST ERZEUGT EIN OBJEKT, NICHT ZWEI.
// ================================================================================================
//
// Der Vergleich lief bis HEAD 7cf92ce gegen einen `Set`, der die bereits importierten Schluessel
// mitfuehrte (`service.ts:1430`) — aber wieder nur zeichengleich. Eine Sicherung, die denselben
// Eintrag zweimal in leicht abweichender Schreibweise enthaelt, legte ihn zweimal an. Der Bestand
// war danach schon beim ERSTEN Einspielen doppelt.
//
// Lauf gesamt-import-adoption: die Annahme stellt die Dublettenfrage am heutigen Bestand neu. Der
// Fall misst darum zusätzlich den AUSGANG beider Annahmen — die zweite legt nichts an und nennt das
// im selben Lauf erzeugte Objekt mit Kennung.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KandidatDublettenbefund } from "../../services/library-analytics";

const ZUGANG = { name: "Admin", email: "laufintern@x.de", password: "secret123" };

interface Uebersprungen {
  titel: string;
  grund: string;
  koId: string | null;
  aehnlichkeit?: number;
}

interface KandidatDto {
  id: string;
  koId: string | null;
  dublettenbefund?: KandidatDublettenbefund;
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
    // R-0143 (bens F1): der direkte Eingang reiht ein und legt NICHTS direkt an. Die Dublettenfrage
    // gegen den eigenen Lauf bleibt dieselbe — ihr Treffer ist jetzt der KANDIDAT des ersten
    // Eintrags (ein Objekt gibt es vor der Annahme nicht), und die Annahme beider ergibt EIN Objekt.
    const body = res.json() as {
      imported: number;
      skipped: number;
      uebersprungen: (Uebersprungen & { kandidatId?: string })[];
      kandidaten: { id: string }[];
    };
    expect(body.imported).toBe(0);
    expect(body.skipped).toBe(1);
    expect(body.uebersprungen).toHaveLength(1);
    expect(body.uebersprungen[0]?.grund).toBe("aehnlich");
    const [erster, zweiter] = body.kandidaten;
    expect(
      [body.uebersprungen[0]?.koId, body.uebersprungen[0]?.kandidatId],
      "Der Treffer ist der im selben Lauf eingereihte Kandidat.",
    ).toEqual([null, erster?.id]);

    const vorAnnahme = await app.inject({ method: "GET", url: "/api/kos", headers });
    expect(vorAnnahme.json() as unknown[], "Vor der Annahme entsteht kein Objekt.").toHaveLength(0);

    const angenommen: KandidatDto[] = [];
    for (const k of [erster, zweiter]) {
      const annahme = await app.inject({
        method: "PUT",
        url: `/api/library/import/candidates/${k?.id}`,
        headers,
        payload: { action: "accept" },
      });
      expect(annahme.statusCode, annahme.body).toBe(200);
      angenommen.push(annahme.json() as KandidatDto);
    }
    const liste = await app.inject({ method: "GET", url: "/api/kos", headers });
    const kos = liste.json() as { id: string }[];
    expect(kos, "Aus zwei Schreibweisen derselben Sache wird genau ein Wissensobjekt.").toHaveLength(
      1,
    );
    expect(angenommen[0]?.koId).toBe(kos[0]?.id);
    expect(angenommen[1]?.koId, "Die Annahme der Dublette legt nichts an.").toBeNull();
    expect(
      angenommen[1]?.dublettenbefund,
      "Der Treffer ist das im selben Lauf erzeugte Objekt — nicht `null`.",
    ).toMatchObject({ ergebnis: "aehnlich", treffer: { art: "wissensobjekt", koId: kos[0]?.id } });
  });
});
