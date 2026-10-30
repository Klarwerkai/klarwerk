import type { FastifyInstance } from "fastify";
import type { APIResponse, Page } from "playwright-core";
import type { Draft } from "../../apps/web/src/api/types";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { Sitzung, type Strecke, ersteinrichtung, mussGelingen } from "../gast-nutzerweg/strecke";

export const EMAIL = "admin@mobile-spaete-eingabe.test";
export const FOTO =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";
export const ALT_LINK =
  '<p><a href="https://example.test/handbuch?kapitel=2" rel="noopener noreferrer nofollow" target="_blank">Hand<br><br>buch</a></p>';
export const ALT_BILD = `<p><img src="data:image/png;base64,${FOTO}" alt="Pumpe"></p>`;
export const ALT_BODY = `<p>Unveränderter Altabsatz.</p>${ALT_LINK}${ALT_BILD}`;

function signal<T>() {
  let erfuellen: ((wert: T) => void) | undefined;
  let ablehnen: ((grund: unknown) => void) | undefined;
  const promise = new Promise<T>((resolve, reject) => {
    erfuellen = resolve;
    ablehnen = reject;
  });
  return {
    promise,
    resolve: (wert: T) => erfuellen?.(wert),
    reject: (grund: unknown) => ablehnen?.(grund),
  };
}

function redigiert(text: string): string {
  return text
    .replace(
      /(authorization|cookie|password|passwort|secret|token)([=: ]+)[^,; ]+/giu,
      "$1$2[redigiert]",
    )
    .replace(/Bearer +[^,; ]+/giu, "Bearer [redigiert]")
    .replace(/data:image[^ "'<>]+/giu, "[Bilddaten redigiert]")
    .slice(0, 12_000);
}

const draftAntwort = (url: URL): boolean =>
  url.pathname === "/api/drafts" ||
  (url.pathname.startsWith("/api/drafts/") && !url.pathname.slice(12).includes("/"));

export async function mobileWelt(vorListen: (app: FastifyInstance) => Promise<void>) {
  const app = buildApp(assembleServices(inMemoryRepos()));
  const alleFreigaben = new Set<() => void>();
  const laeufe = new Set<Promise<void>>();
  const schreibungen: { methode: string; draft: Draft; eingabe: Record<string, unknown> }[] = [];
  const lage = { ablehnen: false };
  let steuerSeite: Page | undefined;
  let sperre:
    | {
        methode: "POST" | "PUT";
        erreicht: ReturnType<typeof signal<Draft>>;
        weiter: ReturnType<typeof signal<void>>;
      }
    | undefined;
  app.addHook("onRequest", async (request, reply) => {
    if (lage.ablehnen && request.method === "POST" && request.url === "/api/drafts") {
      lage.ablehnen = false;
      await reply.code(422).send({
        error: "FIKTIVE_ABWEISUNG",
        message: "Fiktive Ablehnung des Entwurfs.",
      });
    }
  });
  // Synchroner Beobachter: keine Antwortbarriere oder zusätzlichen async-onSend-Hops im Server.
  app.addHook("onError", (request, _reply, error, done) => {
    console.error(
      JSON.stringify({
        event: "mobile-server-error",
        methode: request.method,
        pfad: request.url.split("?")[0],
        name: error.name,
        message: redigiert(error.message),
        stack: redigiert(error.stack ?? ""),
      }),
    );
    done();
  });
  try {
    await vorListen(app);
    const basis = await app.listen({ host: "127.0.0.1", port: 0 });
    const strecke: Strecke = {
      app,
      basis,
      profil: (name, sprache) => new Sitzung(basis, name, sprache),
      schliessen: () => app.close(),
    };
    const { sitzung: admin } = await ersteinrichtung(strecke, EMAIL);
    return {
      basis,
      admin,
      lage,
      schreibungen,
      async antwortenSteuern(seite: Page) {
        steuerSeite = seite;
        await seite.route(draftAntwort, async (route) => {
          const request = route.request();
          const methode = request.method();
          if (methode !== "POST" && methode !== "PUT") {
            await route.continue();
            return;
          }
          const halt = sperre?.methode === methode ? sperre : undefined;
          if (halt) sperre = undefined;
          const lauf = (async (): Promise<void> => {
            let original: APIResponse | undefined;
            try {
              // Originale Authanfrage; echte Persistenz und echte APIResponse, keine Ersatzantwort.
              original = await route.fetch();
              const status = original.status();
              if (status >= 200 && status < 300) {
                const draft = (await original.json()) as Draft;
                schreibungen.push({ methode, draft, eingabe: request.postDataJSON() });
                if (halt) {
                  halt.erreicht.resolve(draft);
                  await halt.weiter.promise;
                }
              } else {
                const body = redigiert(await original.text());
                console.error(
                  JSON.stringify({ event: "mobile-http-error", methode, status, body }),
                );
                halt?.erreicht.reject(new Error(`Originale Draft-Antwort HTTP ${status}: ${body}`));
              }
            } catch (error) {
              const name = error instanceof Error ? error.name : "Unbekannter Fehler";
              const message = error instanceof Error ? error.message : String(error);
              const stack = error instanceof Error ? (error.stack ?? "") : "";
              console.error(
                JSON.stringify({
                  event: "mobile-route-error",
                  methode,
                  status: original?.status() ?? null,
                  name,
                  message: redigiert(message),
                  stack: redigiert(stack),
                }),
              );
              halt?.erreicht.reject(error);
            } finally {
              try {
                if (original) await route.fulfill({ response: original });
                else await route.abort();
              } finally {
                await original?.dispose();
              }
            }
          })();
          laeufe.add(lauf);
          try {
            await lauf;
          } finally {
            laeufe.delete(lauf);
          }
        });
      },
      async antwortenAbgeschlossen() {
        await steuerSeite?.unroute(draftAntwort);
        await Promise.all([...laeufe]);
      },
      anhalten(methode: "POST" | "PUT") {
        if (sperre) throw new Error("Eine Antwort wartet bereits");
        const erreicht = signal<Draft>();
        const weiter = signal<void>();
        const freigeben = () => weiter.resolve();
        alleFreigaben.add(freigeben);
        sperre = { methode, erreicht, weiter };
        return { erreicht: erreicht.promise, freigeben };
      },
      async lesen(id: string) {
        return mussGelingen(
          "Persistierten Entwurf normal lesen",
          await admin.sende("GET", `/api/drafts/${id}`),
        ).json as Draft;
      },
      async liste() {
        return mussGelingen("Echten Entwurfsbestand lesen", await admin.sende("GET", "/api/drafts"))
          .json as Draft[];
      },
      loeseAlle() {
        for (const frei of alleFreigaben) frei();
      },
      schliessen: () => app.close(),
    };
  } catch (error) {
    for (const frei of alleFreigaben) frei();
    await app.close();
    throw error;
  }
}
export type MobileWelt = Awaited<ReturnType<typeof mobileWelt>>;
