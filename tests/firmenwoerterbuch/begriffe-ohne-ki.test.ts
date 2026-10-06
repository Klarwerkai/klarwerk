// ================================================================================================
// FIRMENWÖRTERBUCH · K7 — DIE TERMINOLOGIEPRÜFUNG ERZEUGT KEINEN VERDECKTEN KI-AUFRUF.
// ================================================================================================
//
// Zwei Messungen, weil eine allein zu wenig sagt:
//   1. AM LAUFENDEN DIENST: Pflege, Nachschlagen und Prüfen an der echten App, während jeder
//      KI-tragende Dienst der Komposition (Reasoner, Zuruf-Modell, externe Suche, Modelllauf-
//      Protokoll) und das globale `fetch` mitzählen. Erwartet: null Aufrufe.
//   2. AM QUELLTEXT: Fachkern, Routen, Editorfläche und Word-Block importieren bzw. rufen nichts,
//      was ein Modell, einen Embedder oder einen fremden Ursprung erreichen könnte.
//
// Damit gilt die Aussage für jeden KI-Betrieb der Instanz, auch den vollständig intern
// konfigurierten: der Abgleich braucht gar kein Modell.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import { repoPfad } from "../support/repoPfad";

function zaehlend<T extends object>(ziel: T, name: string, aufrufe: string[]): T {
  return new Proxy(ziel, {
    get(objekt, schluessel) {
      const wert = Reflect.get(objekt, schluessel, objekt);
      if (typeof wert !== "function") {
        return wert;
      }
      return (...argumente: unknown[]) => {
        aufrufe.push(`${name}.${String(schluessel)}`);
        return wert.apply(objekt, argumente);
      };
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("K7 · am laufenden Dienst: kein Modell, kein Embedder, kein fremder Netzaufruf", () => {
  it("Anlegen, Ändern, Nachschlagen und Prüfen lassen alle KI-Dienste und fetch unberührt", async () => {
    const services = buildServices();
    const aufrufe: string[] = [];
    const ki: (keyof AppServices)[] = ["reasoner", "zurufModell", "externalSearch", "modelRuns"];
    const umhuellt = { ...services } as Record<string, unknown>;
    for (const name of ki) {
      const dienst = services[name];
      if (dienst && typeof dienst === "object") {
        umhuellt[name] = zaehlend(dienst, name, aufrufe);
      }
    }
    const app = buildApp(umhuellt as unknown as AppServices);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${login.json().token}` };

    // Ab hier zählt alles. Was Anmeldung und Aufbau taten, gehört nicht zur Terminologieprüfung.
    aufrufe.length = 0;
    const netz = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("kein Netz im Test"));

    const angelegt = await app.inject({
      method: "POST",
      url: "/api/begriffe",
      headers,
      payload: {
        geltungsbereich: "Qualität",
        verantwortlich: "QM",
        definition: { de: "Abweichung vom Sollzustand." },
        bezeichnungen: { de: { vorzug: "Abweichung", synonyme: [], unerwuenscht: ["Fehlerchen"] } },
      },
    });
    expect(angelegt.statusCode).toBe(201);
    const id = angelegt.json().id as string;
    const geaendert = await app.inject({
      method: "PUT",
      url: `/api/begriffe/${id}`,
      headers,
      payload: {
        version: 1,
        geltungsbereich: "Qualität",
        verantwortlich: "QM",
        definition: { de: "Abweichung vom festgelegten Sollzustand." },
        bezeichnungen: { de: { vorzug: "Abweichung", synonyme: [], unerwuenscht: ["Fehlerchen"] } },
      },
    });
    expect(geaendert.statusCode).toBe(200);
    const katalog = await app.inject({ method: "GET", url: "/api/begriffe", headers });
    expect(katalog.statusCode).toBe(200);
    const pruefung = await app.inject({
      method: "POST",
      url: "/api/begriffe/pruefen",
      headers,
      payload: { segmente: ["Ein kleines Fehlerchen im Ablauf."], kontext: "Qualität" },
    });
    expect(pruefung.statusCode).toBe(200);
    expect(pruefung.json().hinweise).toHaveLength(1);

    expect(aufrufe).toEqual([]);
    expect(netz).not.toHaveBeenCalled();
  });
});

describe("K7 · am Quelltext: kein Weg zu Modell, Embedder oder fremdem Ursprung", () => {
  const KI_MODULE = /reasoner|embedding|external-search|model-runs|anthropic|openai|ollama|llm/i;

  function importe(relativ: string): string[] {
    const text = readFileSync(repoPfad(relativ), "utf8");
    return [...text.matchAll(/^import[^;]*?from\s+"([^"]+)";/gms)].map((m) => m[1] as string);
  }

  for (const datei of [
    "services/app/src/firmenwoerterbuch.ts",
    "services/app/src/routes/begriffe-routes.ts",
    "apps/web/src/api/begriffe.ts",
    "apps/web/src/lib/begriffshinweise.ts",
    "apps/web/src/components/Begriffshinweise.tsx",
  ]) {
    it(`${datei} importiert kein KI-Modul`, () => {
      const liste = importe(datei);
      expect(liste.length).toBeGreaterThan(0);
      expect(liste.filter((quelle) => KI_MODULE.test(quelle))).toEqual([]);
    });
  }

  it("der Word-Block ruft ausschliesslich die zwei Begriffswege derselben Instanz", () => {
    const text = readFileSync(repoPfad("apps/web/public/word-addin/begriffe.js"), "utf8");
    const ziele = [...text.matchAll(/fetch\(\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(ziele.sort()).toEqual(["/api/begriffe", "/api/begriffe/pruefen"]);
    // Keine absolute Adresse, kein zweiter Netzweg.
    expect(text).not.toMatch(/https?:\/\//);
    expect(text).not.toMatch(/XMLHttpRequest|sendBeacon|WebSocket/);
  });
});
