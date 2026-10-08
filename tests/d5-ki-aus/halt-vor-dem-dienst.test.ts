// ================================================================================================
// D5 · KI AUS — EINE FRAGE, DIE VOR DEM DIENST WARTET, BLEIBT NACH AUS/EIN ENTWERTET (K3/K5).
// ================================================================================================
//
// Bens Befund B1 (Lauf 5 Runde 1): Die Abschalt-Epoche wurde erst beim Einstieg in den AskService
// gelesen — NACH dem asynchronen Klara-Einwilligungstor (`ka4Freigabe`). Stand eine alte Frage dort,
// während der Administrator ab- und wieder einschaltete, übernahm sie die NEUE Epoche, las Bestand
// und lieferte mit Quelle aus — an `POST /api/ask` wie an `POST /api/reasoner` (Aufgabe `ask`).
//
// Hier wird genau das hergestellt: echte App, echte vorbereitete Klara-Sitzung, eigene synthetische
// Quelle. Verzögert wird ausschliesslich die RÜCKGABE der echten Einwilligungsprüfung — ihre
// Entscheidung bleibt unangetastet. Gezählt wird mit denselben unabhängigen Grenzzählern wie in
// `abschaltung-am-frageweg.test.ts` (Ablagen unterhalb der Dienste, Antwortweg, Modelldraht).
//
// Je Eingang:
//   · Kontrolle — angehalten ohne Umschalten: die Frage antwortet mit Quelle (der Halt selbst
//     sperrt also nichts, und die Zähler zählen).
//   · Aus       — angehalten, abgeschaltet: 503, keine Quelle, null Zugriffe.
//   · Aus/Ein   — angehalten, ab- UND wieder eingeschaltet: 503, keine Quelle, null Zugriffe.
//   · Gegenprobe — wie Aus/Ein, aber ohne die Prüfung vor dem Dienst (`diensteinstieg`): dann wird
//     wieder gelesen. Genau diese Prüfung trägt den Fall.
import type { InjectOptions } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AppServices, buildServices } from "../../services/app/src/build-app";
import { KlaraSessionService } from "../../services/app/src/services/klara-session-service";
import {
  type Aufbau,
  FRAGE,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  eintragMitOriginal,
  neuesKonto,
} from "../klara-quellen-nutzerweg/kette";
import {
  ALLE_GRENZEN,
  type Grenzen,
  differenz,
  frageAnfragenMarkieren,
  grenzenZaehlen,
  sperreEntfernen,
  zugriffsbefund,
} from "./zaehler";

adapterUmgebungSetzen();

// R-0700: die Einwilligungsprüfung einer Klara-Frage steht seit dem eigenen Ausführungszugang dort
// und nicht mehr am allgemeinen Frageweg — der Haltepunkt „vor dem Dienst" liegt also an Klaras Tür.
const KLARA_TUER = "/api/klara/sessions/:sessionId/execute";
const EINGAENGE = [KLARA_TUER, "/api/reasoner"] as const;
type Eingang = (typeof EINGAENGE)[number];
type Umschalten = "keins" | "aus" | "aus-ein";

let aufraeumen: (() => Promise<void>)[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const schritt of aufraeumen.reverse()) {
    await schritt();
  }
  aufraeumen = [];
});

interface Lage {
  aufbau: Aufbau;
  dienste: AppServices;
  grenzen: Grenzen;
  koId: string;
  anfrage: InjectOptions;
}

async function lageAufbauen(eingang: Eingang, marke: string): Promise<Lage> {
  const draht = drahtAufbauen();
  let gebaut: AppServices | undefined;
  const aufbau = await appAufbauen(
    false,
    () => {
      gebaut = buildServices();
      return gebaut;
    },
    frageAnfragenMarkieren,
  );
  if (!gebaut) {
    throw new Error("D5: die Dienste wurden nicht gebaut.");
  }
  const dienste = gebaut;
  draht.setzeApp(aufbau.app);
  const grenzen = grenzenZaehlen(dienste, draht);
  aufraeumen.push(async () => {
    grenzen.abbauen();
    await aufbau.app.close();
    draht.abbauen();
  });
  const quelle = await eintragMitOriginal(aufbau.app, aufbau.admin);
  const leser = await neuesKonto(aufbau.app, `d5-halt-${marke}`, aufbau.admin);
  const instanz = `d5-halt-${marke}`;
  const sitzung = await aufbau.app.inject({
    method: "POST",
    url: "/api/klara/sessions",
    headers: leser.kopf,
    payload: {
      addinInstanceId: instanz,
      documentDescriptor: { kind: "saved", hostDocumentId: `d5-halt-dokument-${marke}` },
    },
  });
  expect(sitzung.statusCode, sitzung.body).toBe(201);
  const s = sitzung.json() as { sessionId: string; documentContextId: string };
  const anfrage: InjectOptions = {
    method: "POST",
    url: eingang === KLARA_TUER ? `/api/klara/sessions/${s.sessionId}/execute` : eingang,
    headers: {
      ...leser.kopf,
      "x-klara-session": s.sessionId,
      "x-klara-instance": instanz,
      "x-klara-document": s.documentContextId,
    },
    payload:
      eingang === KLARA_TUER
        ? { question: FRAGE, locale: "de" }
        : { task: "ask", text: FRAGE, locale: "de" },
  };
  return { aufbau, dienste, grenzen, koId: quelle.koId, anfrage };
}

/**
 * Hält die NÄCHSTE Einwilligungsprüfung nach ihrer echten Entscheidung an. `erreicht` erfüllt sich,
 * sobald die Anfrage dort steht; `los()` gibt sie frei.
 */
function einwilligungAnhalten(): { erreicht: Promise<void>; los: () => void } {
  const echt = KlaraSessionService.prototype.pruefeExterneAusfuehrung;
  let los: () => void = () => undefined;
  let angekommen: () => void = () => undefined;
  const frei = new Promise<void>((r) => {
    los = r;
  });
  const erreicht = new Promise<void>((r) => {
    angekommen = r;
  });
  vi.spyOn(KlaraSessionService.prototype, "pruefeExterneAusfuehrung").mockImplementation(
    async function (this: KlaraSessionService, ...args) {
      const entscheidung = await echt.apply(this, args);
      angekommen();
      await frei;
      return entscheidung;
    },
  );
  aufraeumen.push(async () => los());
  return { erreicht, los: () => los() };
}

async function haltefall(
  eingang: Eingang,
  umschalten: Umschalten,
  marke: string,
  gegenprobe = false,
) {
  const lage = await lageAufbauen(eingang, marke);
  const { app, admin } = lage.aufbau;
  // Ausgangspunkt (K1): dieselbe Frage trägt vorher, mit Quelle, und die Zähler zählen dabei.
  const vorher = lage.grenzen.stand();
  const basis = await app.inject(lage.anfrage);
  expect(basis.statusCode, basis.body).toBe(200);
  expect(basis.body).toContain(lage.koId);
  expect(zugriffsbefund(differenz(vorher, lage.grenzen.stand()), ALLE_GRENZEN)).not.toBe("");

  if (gegenprobe) {
    const rueckbau = sperreEntfernen(lage.dienste, new Set(["diensteinstieg"]));
    aufraeumen.push(async () => rueckbau());
  }
  const halt = einwilligungAnhalten();
  const alt = app.inject(lage.anfrage);
  await halt.erreicht;
  if (umschalten !== "keins") {
    const aus = await app.inject({
      method: "PUT",
      url: "/api/reasoner/config",
      headers: admin.kopf,
      payload: { global: "deterministic" },
    });
    expect(aus.statusCode, aus.body).toBe(200);
    expect(lage.dienste.reasoner.kiAbschaltung().abgeschaltet).toBe(true);
  }
  if (umschalten === "aus-ein") {
    const an = await app.inject({
      method: "PUT",
      url: "/api/reasoner/config",
      headers: admin.kopf,
      payload: { global: "auto" },
    });
    expect(an.statusCode, an.body).toBe(200);
    expect(lage.dienste.reasoner.kiAbschaltung().abgeschaltet).toBe(false);
  }
  const nachSperre = lage.grenzen.stand();
  halt.los();
  const antwort = await alt;
  return {
    antwort,
    zugriffe: zugriffsbefund(differenz(nachSperre, lage.grenzen.stand()), ALLE_GRENZEN),
    lage,
  };
}

describe("D5 · eine vor dem Dienst angehaltene Frage (Einwilligungsprüfung) — Bens B1", () => {
  for (const eingang of EINGAENGE) {
    const kurz = eingang === KLARA_TUER ? "ask" : "rsn";

    it(`${eingang} · Kontrolle: angehalten ohne Umschalten → antwortet mit Quelle, Zähler zählen`, async () => {
      const { antwort, zugriffe, lage } = await haltefall(eingang, "keins", `${kurz}-k`);
      expect(antwort.statusCode, antwort.body).toBe(200);
      expect(antwort.body).toContain(lage.koId);
      expect(zugriffe).not.toBe("");
    });

    for (const umschalten of ["aus", "aus-ein"] as const) {
      it(`${eingang} · angehalten, dann KI ${umschalten === "aus" ? "aus" : "aus und wieder ein"} → 503 ohne Kundeninhalt, null Zugriffe`, async () => {
        const { antwort, zugriffe, lage } = await haltefall(
          eingang,
          umschalten,
          `${kurz}-${umschalten}`,
        );
        expect(antwort.statusCode, antwort.body).toBe(503);
        expect(antwort.body).toContain("KI_ABGESCHALTET");
        expect(antwort.body).not.toContain(lage.koId);
        expect(zugriffe, "nach bestätigter Sperre gelesen oder übertragen").toBe("");
        // Wiedereinschalten stellt NUR den neuen Frageweg her: dieselbe Anfrage, frisch gestellt,
        // trägt wieder (K5) — die alte hat nichts nachgeholt.
        if (umschalten === "aus-ein") {
          const neu = await lage.aufbau.app.inject(lage.anfrage);
          expect(neu.statusCode, neu.body).toBe(200);
          expect(neu.body).toContain(lage.koId);
        }
      });
    }

    it(`${eingang} · GEGENPROBE: ohne die Prüfung vor dem Dienst liest die alte Frage nach Aus/Ein wieder`, async () => {
      const { zugriffe } = await haltefall(eingang, "aus-ein", `${kurz}-g`, true);
      expect(zugriffe, "ohne `diensteinstieg` muss der Zähler anschlagen").not.toBe("");
    });
  }
});
