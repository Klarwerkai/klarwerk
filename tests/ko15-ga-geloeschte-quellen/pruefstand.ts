// Tatsächliche App, Sitzungskekse und HTTP-Anlage; Speicherablagen, keine PG-/Neustartzusage.
import type { FastifyInstance } from "fastify";
import { expect, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { Anweisung } from "../../services/knowledge-object/src/gesamtanweisung-types";
import { Sitzung, type Strecke, ersteinrichtung, mussGelingen } from "../gast-nutzerweg/strecke";
import { kontoMitRolle, wissenseintrag } from "../gesamtanweisung-restpruefung/bestand";

vi.mock("testcontainers", () => { throw new Error("NOPULL_INIT1STOP"); });
vi.mock("dockerode", () => { throw new Error("NOPULL_INIT1STOP"); });

export const EMAIL = "admin@ko15-ga.test";
export async function welt(vorListen?: (app: FastifyInstance) => Promise<void>) {
  const services = buildServices();
  const app = buildApp(services);
  try {
    if (vorListen) await vorListen(app);
    const basis = await app.listen({ host: "127.0.0.1", port: 0 });
    const strecke: Strecke = {
      app, basis,
      profil: (name, sprache) => new Sitzung(basis, name, sprache),
      schliessen: () => app.close(),
    };
    const { sitzung: admin, admin: nutzer } = await ersteinrichtung(strecke, EMAIL);
    const experte = strecke.profil("experte");
    await kontoMitRolle(admin, experte, "experte", "experte@ko15-ga.test");
    const quellen = [];
    for (const [titel, stufe] of [["Sichtbar A", "intern"], ["Geheim B", "vertraulich"], ["Sichtbar C", "intern"], ["Geheim D", "vertraulich"]] as const) {
      quellen.push(await wissenseintrag(admin, titel, stufe, ` Rumpf-${titel}`));
    }
    const angelegt = mussGelingen("GA anlegen", await admin.sende("POST", "/api/gesamtanweisungen", { titel: "GA vor Verlust", voraussetzungen: "Allgemeine Voraussetzung" }), 201).json as Anweisung;
    let version = angelegt.version;
    for (const [i, quelle] of quellen.entries()) {
      const antwort = mussGelingen("Baustein aufnehmen", await admin.sende("POST", `/api/gesamtanweisungen/${angelegt.id}/bausteine`, {
        version, koId: quelle.koId, koVersion: quelle.fassung,
        nachweisHash: `Nachweis-${i}`, voraussetzung: `Bedingung-${i}`,
      })).json as Anweisung;
      version = antwort.version;
    }
    const kanonisch = await services.anweisungen.get(angelegt.id);
    if (!kanonisch) throw new Error("Angelegte Anweisung fehlt");
    const bestand = async () => ({
      anweisung: await services.anweisungen.get(angelegt.id),
      historie: await Promise.all((await services.anweisungen.staende(angelegt.id)).map(async (v) => services.anweisungen.standLesen(angelegt.id, v))),
    });
    const entfernen = async (purge: boolean) => {
      for (const i of [1, 3]) {
        const id = quellen[i]!.koId;
        mussGelingen("Papierkorb", await admin.sende("DELETE", `/api/kos/${id}`), 204);
        if (purge) mussGelingen("Endlöschung", await admin.sende("DELETE", `/api/kos/trash/${id}`), 204);
        expect(await services.ko.get(id)).toBeUndefined();
      }
    };
    const ohneSpur = (text: string) => {
      for (const i of [1, 3]) for (const spur of [quellen[i]!.koId, kanonisch.bausteine[i]!.id, `Nachweis-${i}`, `Bedingung-${i}`, i === 1 ? "Geheim B" : "Geheim D"]) {
        expect(text, `Verborgene Spur ${spur}`).not.toContain(spur);
      }
    };
    return { app, services, basis, admin, nutzer, experte, quellen, kanonisch, bestand, entfernen, ohneSpur, schliessen: () => app.close() };
  } catch (error) { await app.close(); throw error; }
}
export type Welt = Awaited<ReturnType<typeof welt>>;
