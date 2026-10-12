// ================================================================================================
// produkt:20261011:peter-p09 · P09-AC06 — AUSSENAKTIONEN OHNE REPLAY-DOPPELWIRKUNG.
// ================================================================================================
//
// Peters Entscheidung 45: „Keine wiederholte Mail, Freigabe oder Friständerung durch Replay."
// Die einzige Außenaktion, die die Instanz selbsttätig auslöst und deren Ausführung sie in der
// Datenbank führt, ist die Wissensereignis-Meldung (R-0710). Gemessen am echten Melder mit den echten
// Diensten (`buildServices()`); eingesetzt ist nur der Zusteller.
//
// DER WIEDERHERGESTELLTE STAND wird mit den echten Wegen hergestellt — so, wie ihn eine Sicherung
// festhält, die VOR zwei Zustellungen gezogen wurde:
//   A  validiert, erkannt UND zugestellt              → vor der Sicherung abgeschlossen
//   B  validiert und erkannt, erster Versuch scheitert → nach der Sicherung zugestellt (fehlt der Kette)
//   C  validiert, noch nicht erkannt                   → nach der Sicherung erkannt und zugestellt
//
//   R1  GEGENPROBE ohne Grenze: der Melder schickt B und C ein zweites Mal — die Doppelwirkung ist real.
//   R2  Mit Grenze: keine Wiederholung; B ist als abgebrochen geschlossen, C steht namentlich als
//       unterdrückt in der Grenze; ein Ereignis NACH der Grenze geht genau einmal hinaus.
//   R3  Ein zweiter Start desselben Wiederanlaufs setzt nichts doppelt.
import { describe, expect, it } from "vitest";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import {
  AKTION_ABGEBROCHEN,
  AKTION_WIEDERANLAUF_GRENZE,
  GRUND_WIEDERANLAUF,
  KENNUNG_HEADER,
  type WebhookZiel,
  WissensereignisMelder,
  type WissensereignisQuellen,
  setzeWiederanlaufGrenze,
} from "../../services/app/src/wissensereignisse";

const ZIEL: WebhookZiel = {
  id: "werkzeug",
  url: "https://werkzeug.example/hook",
  ereignisse: ["wissen.validiert"],
  geheimnis: "geheimnis-0123456789abcdef0123456789abcdef",
};

function quellenVon(services: AppServices): WissensereignisQuellen {
  return {
    wissensobjekte: () => services.ko.list({}),
    revalidierungFaellig: () => services.lifecycle.pendingRevalidation(),
    offeneWidersprueche: () => services.conflicts.unresolved(),
    wissensobjekt: (id) => services.ko.get(id),
  };
}

function melder(services: AppServices, status: () => number) {
  const gesendet: string[] = [];
  const m = new WissensereignisMelder({
    quellen: quellenVon(services),
    audit: services.audit,
    ziele: [ZIEL],
    zusteller: async (anfrage) => {
      gesendet.push(anfrage.headers[KENNUNG_HEADER] ?? "");
      return { status: status() };
    },
  });
  return { m, gesendet };
}

async function validiert(services: AppServices, titel: string): Promise<string> {
  const ko = await services.ko.create({
    title: titel,
    statement: `${titel} (fiktiv).`,
    type: "best_practice",
    category: "Wartung",
    author: "anna",
  } as never);
  await services.validation.adminValidate(ko.id, "admin");
  return ko.id;
}

/** Der Stand, den die Sicherung festhält — mit den echten Wegen erzeugt. */
async function wiederhergestellterStand() {
  const services = buildServices();
  await buildApp(services).ready();
  const vorher = melder(services, () => 204);
  await vorher.m.lauf(); // Grundstand
  const a = await validiert(services, "Ventil A");
  await vorher.m.lauf(); // A erkannt und zugestellt
  const b = await validiert(services, "Ventil B");
  const scheitert = melder(services, () => 503);
  await scheitert.m.lauf(); // B erkannt, erster Versuch scheitert — ohne Abschluss
  const c = await validiert(services, "Ventil C");
  // Hier wird gesichert. Was danach geschah (B zugestellt, C erkannt und zugestellt), fehlt.
  return {
    services,
    kennung: {
      a: `wissen.validiert:${a}:1`,
      b: `wissen.validiert:${b}:1`,
      c: `wissen.validiert:${c}:1`,
    },
  };
}

describe("P09-AC06 · Replay-Grenze der Wissensereignis-Meldungen", () => {
  it("R1 · GEGENPROBE: ohne Grenze gehen B und C nach dem Restore ein zweites Mal hinaus", async () => {
    const { services, kennung } = await wiederhergestellterStand();
    const nachRestore = melder(services, () => 204);
    await nachRestore.m.lauf();
    expect(nachRestore.gesendet.sort()).toEqual([kennung.b, kennung.c].sort());
    expect(nachRestore.gesendet).not.toContain(kennung.a);
  });

  it("R2 · mit Grenze: keine Wiederholung, Lücken namentlich benannt, Neues genau einmal", async () => {
    const { services, kennung } = await wiederhergestellterStand();
    const grenze = await setzeWiederanlaufGrenze({
      quellen: quellenVon(services),
      audit: services.audit,
      wiederanlauf: "probe-r2",
    });
    expect(grenze.neuGesetzt).toBe(true);
    // Nur die abonnierte Ereignisart zählt hier; andere Befunde hätten ohnehin kein Ziel.
    const validierte = (liste: string[]) => liste.filter((k) => k.startsWith("wissen.validiert:"));
    expect(validierte(grenze.unterdrueckt)).toEqual([kennung.c]);
    expect(grenze.geschlossen).toEqual([{ ziel: ZIEL.id, kennung: kennung.b }]);
    expect(grenze.kennungen).toEqual(expect.arrayContaining([kennung.a, kennung.b, kennung.c]));
    // Der letzte bestätigte Ausführungspunkt ist die Zustellung von A.
    expect(grenze.letzteBestaetigteZustellung).toEqual(expect.any(String));
    const abgebrochen = await services.audit.list({ action: AKTION_ABGEBROCHEN });
    expect(abgebrochen.map((e) => e.payload)).toEqual([
      expect.objectContaining({ kennung: kennung.b, grund: GRUND_WIEDERANLAUF }),
    ]);

    const nachRestore = melder(services, () => 204);
    const lauf = await nachRestore.m.lauf();
    expect(lauf).toMatchObject({ erkannt: 0, zugestellt: 0, ausstehend: 0 });
    expect(nachRestore.gesendet).toEqual([]);

    // Nach der Grenze ist der Melder wieder ganz normal: ein neues Ereignis geht genau einmal hinaus.
    const d = await validiert(services, "Ventil D");
    await nachRestore.m.lauf();
    await nachRestore.m.lauf();
    expect(nachRestore.gesendet).toEqual([`wissen.validiert:${d}:1`]);
  });

  it("R3 · ein zweiter Start desselben Wiederanlaufs setzt nichts doppelt", async () => {
    const { services, kennung } = await wiederhergestellterStand();
    const quellen = quellenVon(services);
    const deps = { quellen, audit: services.audit, wiederanlauf: "probe-r3" };
    const erste = await setzeWiederanlaufGrenze(deps);
    const zweite = await setzeWiederanlaufGrenze(deps);
    expect(zweite.neuGesetzt).toBe(false);
    expect(zweite.unterdrueckt).toEqual(erste.unterdrueckt);
    expect(zweite.geschlossen).toEqual([{ ziel: ZIEL.id, kennung: kennung.b }]);
    expect(await services.audit.list({ action: AKTION_WIEDERANLAUF_GRENZE })).toHaveLength(1);
    expect(await services.audit.list({ action: AKTION_ABGEBROCHEN })).toHaveLength(1);
  });
});
