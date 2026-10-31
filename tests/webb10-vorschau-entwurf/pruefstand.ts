import type { Page, Route } from "playwright-core";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { mitFlaeche } from "../gast-nutzerweg/browserweg";
import { Sitzung, type Strecke, ersteinrichtung, mussGelingen } from "../gast-nutzerweg/strecke";

export const EMAIL = "admin@webb10-fiktiv.test";
export const TITEL = "WEBB10 fiktives Ventil";
export const AUSSAGE = "Fiktiver WEBB10 Prüftext: Das Ventil bleibt vor der Prüfung geschlossen.";
export const FRAGE = "Warum bleibt das fiktive Ventil vor der Prüfung geschlossen?";
export const NEU = "Meine spätere fiktive Frage bleibt erhalten.";

function signal() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

export async function pruefwelt() {
  const services = assembleServices(inMemoryRepos());
  const app = buildApp(services);
  const auswahlDa = signal();
  const auswahlWeiter = signal();
  const frageDa = signal();
  const frageWeiter = signal();
  const offen = new Set<Promise<void>>();
  const fragen: { question?: string; seitenbezug?: unknown }[] = [];
  const lesungen: { status: number; gehalten: boolean; vertraulich: boolean }[] = [];
  const lage = { halten: false, frageStatus: null as number | null };
  let seite: Page | undefined;
  const quelle = (url: URL) => url.pathname === `/api/kos/${koId}`;
  const frage = (url: URL) => url.pathname === "/api/ask";
  let koId = "";
  async function verfolgen(lauf: () => Promise<void>) {
    const p = lauf();
    offen.add(p);
    try {
      await p;
    } finally {
      offen.delete(p);
    }
  }
  try {
    await mitFlaeche().vorListen(app);
    const basis = await app.listen({ host: "127.0.0.1", port: 0 });
    const strecke: Strecke = {
      app,
      basis,
      profil: (name, sprache) => new Sitzung(basis, name, sprache),
      schliessen: () => app.close(),
    };
    const { sitzung: admin, admin: konto } = await ersteinrichtung(strecke, EMAIL);
    mussGelingen("Hinweis bestätigen", await admin.sende("POST", "/api/auth/notice"));
    const ko = mussGelingen(
      "Eigene fiktive Quelle anlegen",
      await admin.sende("POST", "/api/kos", {
        title: TITEL,
        statement: AUSSAGE,
        type: "best_practice",
        category: "WEBB10 fiktiv",
        confidentiality: "intern",
      }),
      201,
    ).json as { id: string };
    koId = ko.id;
    await services.aiCheckWorker?.idle();
    return {
      basis,
      koId,
      kontoId: konto.id,
      fragen,
      lesungen,
      lage,
      auswahlErreicht: auswahlDa.promise,
      frageErreicht: frageDa.promise,
      halteAuswahl: () => {
        lage.halten = true;
      },
      auswahlFreigeben: () => auswahlWeiter.resolve(),
      frageFreigeben: () => frageWeiter.resolve(),
      async vertraulich() {
        const r = mussGelingen(
          "Eigene Quelle vertraulich setzen",
          await admin.sende("PUT", `/api/kos/${koId}`, {
            action: "confidentiality",
            level: "vertraulich",
          }),
        );
        return { status: r.status, level: (r.json as { confidentiality: string }).confidentiality };
      },
      async gespeicherteFragen() {
        const r = mussGelingen(
          "Eigenes Gespräch lesen",
          await admin.sende("GET", "/api/me/klara/gespraech"),
        );
        const g = (r.json as { gespraech: { nachrichten: { von: string; text: string }[] } | null })
          .gespraech;
        return g?.nachrichten.filter((n) => n.von === "du").map((n) => n.text) ?? [];
      },
      async steuern(p: Page) {
        seite = p;
        await p.route(quelle, (route: Route) =>
          verfolgen(async () => {
            if (route.request().method() !== "GET") {
              await route.continue();
              return;
            }
            const gehalten = lage.halten;
            if (gehalten) {
              lage.halten = false;
              auswahlDa.resolve();
              await auswahlWeiter.promise;
            }
            const echt = await route.fetch();
            try {
              const json = (await echt.json()) as { confidentiality?: string };
              lesungen.push({
                status: echt.status(),
                gehalten,
                vertraulich: json.confidentiality === "vertraulich",
              });
              await route.fulfill({ response: echt });
            } finally {
              await echt.dispose();
            }
          }),
        );
        await p.route(frage, (route: Route) =>
          verfolgen(async () => {
            if (route.request().method() !== "POST") {
              await route.continue();
              return;
            }
            const body = route.request().postDataJSON() as {
              question?: string;
              seitenbezug?: unknown;
            };
            fragen.push({
              ...(body.question === undefined ? {} : { question: body.question }),
              seitenbezug: body.seitenbezug,
            });
            frageDa.resolve();
            await frageWeiter.promise;
            // Nur angehalten: die unveränderte Anfrage erreicht den echten lokalen Frageweg.
            const echt = await route.fetch();
            try {
              lage.frageStatus = echt.status();
              await route.fulfill({ response: echt });
            } finally {
              await echt.dispose();
            }
          }),
        );
      },
      async fertig() {
        auswahlWeiter.resolve();
        frageWeiter.resolve();
        await seite?.unroute(quelle);
        await seite?.unroute(frage);
        await Promise.all([...offen]);
      },
      schliessen: () => app.close(),
    };
  } catch (error) {
    auswahlWeiter.resolve();
    frageWeiter.resolve();
    await app.close();
    throw error;
  }
}
export type Pruefwelt = Awaited<ReturnType<typeof pruefwelt>>;
