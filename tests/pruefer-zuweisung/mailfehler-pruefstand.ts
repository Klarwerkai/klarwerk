import type { FastifyInstance } from "fastify";
import { vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import * as koRouten from "../../services/app/src/routes/ko-routes";
import { Sitzung, type Strecke, ersteinrichtung } from "../gast-nutzerweg/strecke";
import { kontoMitRolle } from "../gesamtanweisung-restpruefung/bestand";

export const EMAIL = "admin@assign-mailfehler.test";
export const ROHFEHLER = "Inhalt an zweite@example.test über https://mail.example.test/send";

export async function mailWelt(vorListen?: (app: FastifyInstance) => Promise<void>) {
  const services = buildServices();
  const lage = { mailFehlt: true };
  const teilweiseBestaetigt: string[] = [];
  const notify = vi.fn(async (_id: string, userIds: readonly string[]) => {
    // Der erste Versand kann bereits bestätigt sein, bevor ein späterer abbricht.
    if (userIds[0]) teilweiseBestaetigt.push(userIds[0]);
    if (lage.mailFehlt) throw new TypeError(ROHFEHLER);
  });
  const original = koRouten.koRoutes;
  vi.spyOn(koRouten, "koRoutes").mockImplementation((deps, guards) =>
    original({ ...deps, notifyAssignment: notify }, guards),
  );
  const app = buildApp(services);
  try {
    if (vorListen) await vorListen(app);
    const basis = await app.listen({ host: "127.0.0.1", port: 0 });
    const strecke: Strecke = {
      app,
      basis,
      profil: (name, sprache) => new Sitzung(basis, name, sprache),
      schliessen: () => app.close(),
    };
    const { sitzung: admin, admin: nutzer } = await ersteinrichtung(strecke, EMAIL);
    const pruefer = strecke.profil("pruefer");
    const konto = await kontoMitRolle(admin, pruefer, "controller", "pruefer@assign.test");
    const leser = strecke.profil("leser");
    await kontoMitRolle(admin, leser, "viewer", "leser@assign.test");
    const objekte = [];
    for (const title of ["Einzelauftrag Pumpe", "Stapelauftrag Ventil", "Stapelauftrag Filter"]) {
      objekte.push(
        await services.ko.create({
          title,
          statement: `${title}: vor dem Anfahren prüfen.`,
          type: "best_practice",
          category: "Wartung",
          confidentiality: "intern",
          author: nutzer.id,
        }),
      );
    }
    return {
      app,
      services,
      basis,
      admin,
      pruefer,
      leser,
      konto,
      objekte,
      lage,
      notify,
      teilweiseBestaetigt,
      schliessen: () => app.close(),
    };
  } catch (error) {
    await app.close();
    throw error;
  }
}
export type MailWelt = Awaited<ReturnType<typeof mailWelt>>;
