// ================================================================================================
// AW-16 · K8 — EIN TERMIN OHNE AUFTRAG LÖST NICHTS AUS (produkt:20261010:klara-eigener-kalender).
// ================================================================================================
//
// „Ein Termin ohne Auftrag löst weder Modellarbeit noch Einladung, externe Nachricht, Verlängerung
// oder Systemänderung aus." Zwei Messungen, weil eine allein zu wenig sagt:
//   1. AM LAUFENDEN DIENST: Anlegen, Öffnen, Ändern, Sichtwahl, Folgen, Aktion und Löschen an der
//      echten App, während jeder KI-tragende Dienst (Reasoner, Zuruf-Modell, externe Suche,
//      Modelllauf-Protokoll), der Mailversand, die Wissensobjekte und das globale `fetch` mitzählen.
//      Erwartet: null Aufrufe.
//   2. AM QUELLTEXT: Fachkern, Routen, Webdraht und Seite importieren nichts, was ein Modell, einen
//      Versand oder einen fremden Ursprung erreichen könnte.
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

describe("K8 · am laufenden Dienst: kein Modell, kein Versand, keine Änderung am Bestand", () => {
  it("der ganze Kalenderweg lässt KI, Mail, Wissensobjekte und fetch unberührt", async () => {
    const services = buildServices();
    const aufrufe: string[] = [];
    const beobachtet: (keyof AppServices)[] = [
      "reasoner",
      "zurufModell",
      "externalSearch",
      "modelRuns",
      "mailer",
    ];
    const bestandVorher = (await services.ko.list()).length;
    const umhuellt = { ...services } as Record<string, unknown>;
    for (const name of beobachtet) {
      const dienst = services[name];
      if (dienst && typeof dienst === "object") {
        umhuellt[name] = zaehlend(dienst, name, aufrufe);
      }
    }
    const app = buildApp(umhuellt as unknown as AppServices);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Ada Admin", email: "a@kalender-k8.test", password: "geheim12345" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@kalender-k8.test", password: "geheim12345" },
    });
    const headers = { authorization: `Bearer ${login.json().token}` };

    // Ab hier zählt alles. Was Anmeldung und Aufbau taten, gehört nicht zum Kalender.
    aufrufe.length = 0;
    const netz = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("kein Netz im Test"));

    const angelegt = await app.inject({
      method: "POST",
      url: "/api/me/kalender/eintraege",
      headers,
      payload: {
        art: "frist",
        titel: "Zertifikat Z-8 läuft ab",
        ganztaegig: true,
        beginn: "2026-11-30",
        zeitzone: "Europe/Berlin",
      },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const e = angelegt.json().eintrag;
    // Ohne Auftrag gibt es keinen Lauf und kein Ergebnis — nichts, was ausgeführt würde.
    expect(e).toMatchObject({ auftrag: null, lauf: null, ergebnis: null, serie: null });

    const url = `/api/me/kalender/eintraege/${e.id}`;
    const schritte = [
      await app.inject({ method: "GET", url, headers }),
      await app.inject({ method: "GET", url: "/api/me/kalender", headers }),
      await app.inject({
        method: "PUT",
        url,
        headers,
        payload: { fassung: 1, titel: "Zertifikat Z-8 läuft ab (Prüfung)" },
      }),
      await app.inject({
        method: "PUT",
        url: "/api/me/kalender/einstellungen",
        headers,
        payload: { sichtmodus: "beide" },
      }),
      await app.inject({
        method: "POST",
        url: `${url}/folgen`,
        headers,
        payload: { aktion: "anzeige_entfernen" },
      }),
      await app.inject({
        method: "POST",
        url: `${url}/aktionen`,
        headers,
        payload: { aktion: "anzeige_entfernen", bestaetigt: true },
      }),
      await app.inject({ method: "DELETE", url, headers }),
    ];
    expect(schritte.map((s) => s.statusCode)).toEqual([200, 200, 200, 200, 200, 200, 200]);

    expect(aufrufe).toEqual([]);
    expect(netz).not.toHaveBeenCalled();
    // Keine Systemänderung am Wissensbestand.
    expect((await services.ko.list()).length).toBe(bestandVorher);
  });
});

describe("K8 · am Quelltext: kein Weg zu Modell, Versand oder fremdem Ursprung", () => {
  const VERBOTEN =
    /reasoner|embedding|external-search|model-runs|anthropic|openai|ollama|llm|mail|notify|smtp|outlook|graph|ical|webhook|teams-routes/i;

  function importe(relativ: string): string[] {
    const text = readFileSync(repoPfad(relativ), "utf8");
    return [...text.matchAll(/^import[^;]*?from\s+"([^"]+)";/gms)].map((m) => m[1] as string);
  }

  it("der Fachkern importiert nur pg-Typ, Sitzungs- und Teamtyp", () => {
    expect(importe("services/app/src/eigener-kalender.ts").sort()).toEqual(
      ["./http", "./teams", "node:crypto", "pg"].sort(),
    );
  });

  for (const datei of [
    "services/app/src/routes/eigener-kalender-routes.ts",
    "apps/web/src/api/eigenerKalender.ts",
    "apps/web/src/lib/kalenderZeit.ts",
    "apps/web/src/pages/EigenerKalender.tsx",
  ]) {
    it(`${datei} importiert kein Modell- oder Versandmodul`, () => {
      const liste = importe(datei);
      expect(liste.filter((quelle) => VERBOTEN.test(quelle))).toEqual([]);
      const text = readFileSync(repoPfad(datei), "utf8");
      expect(text).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|https?:\/\//);
    });
  }
});
