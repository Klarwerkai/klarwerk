import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { repoPfad } from "../support/repoPfad";

it("J · Der tatsächliche native Abgleich liest nur die Suchbelegung derselben bestätigten Sitzung", async () => {
  const app = buildApp(assembleServices(inMemoryRepos()));
  try {
    await app.ready();
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "J Test", email: "j@native.test", password: "Fiktiv-123456" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "j@native.test", password: "Fiktiv-123456" },
    });
    const token = login.json().token as string;
    const headers = { authorization: `Bearer ${token}` };
    const belegung = {
      code: "KeyU",
      taste: "U",
      strg: false,
      alt: false,
      umschalt: true,
      meta: true,
    };
    const r = await app.inject({
      method: "PUT",
      url: "/api/me/assistenz/tastenkuerzel",
      headers,
      payload: { aktion: "suchen", belegung },
    });
    expect(r.statusCode).toBe(200);
    const quelle = readFileSync(
      repoPfad("apps/desktop/klara-begleiter/Sources/Steuerung.swift"),
      "utf8",
    );
    const skript = quelle.match(/private static let anmeldeSkript = """([\s\S]*?)"""/)?.[1];
    expect(skript).toBeTruthy();
    const abgleich = new Function("fetch", `return (async () => {${skript}})();`) as (
      f: typeof fetch,
    ) => Promise<string>;
    let sitzungsabrufe = 0;
    let modus: "normal" | "wechsel" | "offline" = "normal";
    const draht: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/sitzung")) sitzungsabrufe += 1;
      if (modus === "offline" && url.endsWith("/tastenkuerzel"))
        throw new Error("Lokale Transportgegenprobe");
      const antwort = await app.inject({ method: "GET", url, headers });
      if (modus === "wechsel" && url.endsWith("/sitzung") && sitzungsabrufe === 2) {
        const stand = antwort.json() as Record<string, unknown>;
        return new Response(JSON.stringify({ ...stand, sitzung: "andere-test-sitzung" }), {
          status: 200,
        });
      }
      return new Response(antwort.body, { status: antwort.statusCode });
    };
    expect(JSON.parse(await abgleich(draht)).suchbelegung).toEqual(belegung);
    expect(sitzungsabrufe).toBe(2);
    sitzungsabrufe = 0;
    modus = "wechsel";
    expect(await abgleich(draht)).toBe("");
    modus = "offline";
    expect(JSON.parse(await abgleich(draht)).suchbelegung).toBeNull();
    modus = "normal";
    const entfernt = await app.inject({
      method: "PUT",
      url: "/api/me/assistenz/tastenkuerzel",
      headers,
      payload: { aktion: "suchen", belegung: null },
    });
    expect(entfernt.statusCode).toBe(200);
    expect(JSON.parse(await abgleich(draht)).suchbelegung).toBeNull();
  } finally {
    await app.close();
  }
});
