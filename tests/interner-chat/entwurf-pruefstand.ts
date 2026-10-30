import type { FastifyInstance } from "fastify";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { CHAT_GRENZEN } from "../../services/app/src/chat";
import type { Role } from "../../services/auth";
import { Sitzung, type Strecke, ersteinrichtung, mussGelingen } from "../gast-nutzerweg/strecke";
import { kontoMitRolle } from "../gesamtanweisung-restpruefung/bestand";

export const ADMIN_MAIL = "admin@webb4-chat.test";
export const LESER_MAIL = "leserin@webb4-chat.test";
export const ALTMARKE = "ALTE_NACHRICHT_WEBB4";

export async function entwurfWelt(vorListen: (app: FastifyInstance) => Promise<void>) {
  const repos = inMemoryRepos();
  const services = assembleServices(repos);
  const app = buildApp(services);
  const lage = { ausfall: true, gespraechId: "", ausfaelle: 0 };
  const sendungen: string[] = [];
  app.addHook("onRequest", async (request, reply) => {
    if (
      lage.ausfall &&
      request.method === "GET" &&
      request.url === `/api/chat/gespraeche/${lage.gespraechId}`
    ) {
      lage.ausfaelle += 1;
      await reply.code(503).send({ error: "TEMPORARILY_UNAVAILABLE", message: "Fiktiver Ausfall" });
    }
  });
  app.addHook("onResponse", async (request) => {
    if (request.method === "POST" && request.url.endsWith("/nachrichten")) {
      sendungen.push(request.url);
    }
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
    const { sitzung: admin, admin: adminKonto } = await ersteinrichtung(strecke, ADMIN_MAIL);
    const leser = strecke.profil("leserin");
    const konto = await kontoMitRolle(admin, leser, "viewer", LESER_MAIL);
    const benutzer = await repos.users.findById(konto.id);
    if (!benutzer) throw new Error("Echtes Lesekonto fehlt");
    const ko = mussGelingen(
      "Artikel anlegen",
      await admin.sende("POST", "/api/kos", {
        title: "Fiktiver Artikel WEBB4",
        statement: "Fiktiver Quellinhalt WEBB4.",
        type: "best_practice",
        category: "Prüfstand",
        confidentiality: "intern",
      }),
      201,
    ).json as { id: string };
    const objekt = mussGelingen(
      "Anhang hochladen",
      await admin.sende("POST", "/api/objects", {
        name: "fiktiver-anhang.png",
        mime: "image/png",
        data:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        kind: "image",
        purpose: "attachment",
      }),
      201,
    ).json as { id: string };
    mussGelingen(
      "Anhang binden",
      await admin.sende("PUT", `/api/kos/${ko.id}`, {
        action: "attach",
        attachment: { name: "fiktiver-anhang.png", mime: "image/png", objectId: objekt.id },
      }),
    );
    const artikel = mussGelingen("Artikel lesen", await admin.sende("GET", `/api/kos/${ko.id}`))
      .json as { version: number; attachments: { id: string; objectId?: string }[] };
    const anhang = artikel.attachments.find((a) => a.objectId === objekt.id);
    if (!anhang) throw new Error("Gespeicherter Anhang fehlt");
    const g = mussGelingen(
      "Artikelgespräch anlegen",
      await admin.sende("POST", "/api/chat/gespraeche", { art: "artikel", koId: ko.id }),
      201,
    ).json as { id: string };
    const anderes = mussGelingen(
      "Direktgespräch anlegen",
      await admin.sende("POST", "/api/chat/gespraeche", {
        art: "direkt",
        teilnehmer: [konto.id],
      }),
      201,
    ).json as { id: string };
    const alt = mussGelingen(
      "Ältere Nachricht normal senden",
      await admin.sende("POST", `/api/chat/gespraeche/${g.id}/nachrichten`, {
        text: ALTMARKE,
        sendeKennung: "webb4-alt",
        erwaehnungen: [konto.id],
        anhaenge: [{ koId: ko.id, anhangId: anhang.id }],
        ausschnitt: {
          text: "Fiktiver Quellinhalt WEBB4.",
          quelle: "Fiktiver Artikel WEBB4",
          koId: ko.id,
          fassung: artikel.version,
          fiktiv: false,
        },
      }),
      201,
    ).json as { nachricht: { id: string } };
    // Eine Seite plus ein älterer Beleg, ausschließlich echte lokale HTTP-Schreibwege.
    await new Promise((fertig) => setTimeout(fertig, 2));
    for (let i = 0; i < CHAT_GRENZEN.nachrichtenJeAbruf; i++) {
      mussGelingen(
        "Begrenzte Verlaufsseite füllen",
        await admin.sende("POST", `/api/chat/gespraeche/${g.id}/nachrichten`, {
          text: `Fiktive Verlaufszeile ${i}`,
          sendeKennung: `webb4-seite-${i}`,
          erwaehnungen: [],
          anhaenge: [],
        }),
        201,
      );
    }
    sendungen.length = 0;
    lage.gespraechId = g.id;
    return {
      basis,
      services,
      admin,
      leser,
      adminId: adminKonto.id,
      kontoId: konto.id,
      koId: ko.id,
      anhangId: anhang.id,
      gespraechId: g.id,
      anderesId: anderes.id,
      alteId: alt.nachricht.id,
      lage,
      sendungen,
      // Adversarischer InMemory-Altbestand: der echte bestehende RBAC-Guard erzeugt 403.
      // Keine erfundene HTTP-Antwort und keine Änderung der Produkt-Rechtematrix.
      sperreRolle: () => repos.users.update({ ...benutzer, role: "gast" as Role }),
      stelleRolleWiederHer: () => repos.users.update(benutzer),
      schliessen: () => app.close(),
    };
  } catch (error) {
    await app.close();
    throw error;
  }
}
export type EntwurfWelt = Awaited<ReturnType<typeof entwurfWelt>>;
