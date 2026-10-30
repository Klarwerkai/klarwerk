import type { FastifyInstance } from "fastify";
import type { Draft } from "../../apps/web/src/api/types";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { Sitzung, type Strecke, ersteinrichtung, mussGelingen } from "../gast-nutzerweg/strecke";

export const EMAIL = "admin@mobile-spaete-eingabe.test";
export const ALT_LINK =
  '<p><a href="https://example.test/handbuch?kapitel=2">Hand<br><br>buch</a></p>';
export const ALT_BILD = '<p><img src="https://example.test/pumpe.png" alt="Pumpe"></p>';
export const ALT_BODY = `<p>Unveränderter Altabsatz.</p>${ALT_LINK}${ALT_BILD}`;
export const FOTO =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";

function signal<T>() {
  let erfuellen: ((wert: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    erfuellen = resolve;
  });
  return { promise, resolve: (wert: T) => erfuellen?.(wert) };
}

export async function mobileWelt(vorListen: (app: FastifyInstance) => Promise<void>) {
  const app = buildApp(assembleServices(inMemoryRepos()));
  const alleFreigaben = new Set<() => void>();
  const schreibungen: { methode: string; draft: Draft; eingabe: Record<string, unknown> }[] = [];
  const lage = { ablehnen: false };
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
  app.addHook("onSend", async (request, reply, payload) => {
    if (
      (request.method === "POST" || request.method === "PUT") &&
      /^\/api\/drafts(?:\/[^/?]+)?$/u.test(request.url) &&
      reply.statusCode >= 200 &&
      reply.statusCode < 300
    ) {
      const draft = JSON.parse(String(payload)) as Draft;
      schreibungen.push({
        methode: request.method,
        draft,
        eingabe: request.body as Record<string, unknown>,
      });
      const halt = sperre;
      if (halt?.methode === request.method) {
        sperre = undefined;
        halt.erreicht.resolve(draft);
        // onSend folgt dem echten Capture-Service: persisted, aber die Antwort ist noch unterwegs.
        await halt.weiter.promise;
      }
    }
    return payload;
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
        return mussGelingen(
          "Echten Entwurfsbestand lesen",
          await admin.sende("GET", "/api/drafts"),
        ).json as Draft[];
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
