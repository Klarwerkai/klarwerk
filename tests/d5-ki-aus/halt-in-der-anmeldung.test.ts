// ================================================================================================
// D5 · KI AUS — EINE FRAGE, DIE IN DER ANMELDUNG WARTET, BLEIBT NACH AUS/EIN ENTWERTET (K3/K5).
// ================================================================================================
//
// Bens Befund B2 (Lauf 5 Runde 2): Bei `KLARWERK_ADDON_API=1` authentifiziert der globale
// onRequest-Hook der Add-on-API (`buildApp`) auch gewöhnliche Sitzungsanfragen an `/api/ask` — und
// zwar VOR dem Routen-Hook, der bis dahin die Abschalt-Epoche festhielt. Eine dort wartende alte Frage
// übernahm nach Aus/Ein die neue Epoche, las Bestand, erreichte den Modelltransport und lieferte
// mit Quelle aus. Seit Runde 3 hält der ERSTE globale onRequest-Hook die Epoche fest.
//
// Hergestellt wird der Fall wie in `halt-vor-dem-dienst.test.ts`: echte App, eigene synthetische
// Quelle, dieselben unabhängigen Grenzzähler. Verzögert wird ausschliesslich die RÜCKGABE der ersten
// echten, erfolgreichen Authentifizierung dieser Anfrage — ihr Ergebnis bleibt unangetastet. Mit
// Add-on-API ist das der globale Anmelde-Hook, ohne sie der Sitzungs-Guard der Route.
//
// Je Eingang (`/api/ask` als Sitzungsfrage, `/api/reasoner` Aufgabe `ask`) und je Add-on-Schalter:
//   · Kontrolle — angehalten ohne Umschalten: antwortet mit Quelle, die Zähler zählen.
//   · Aus/Ein   — angehalten, ab- und wieder eingeschaltet: 503, keine Quelle, null Zugriffe; eine
//     danach NEU gestellte Frage trägt wieder.
//   · Gegenprobe — wie Aus/Ein, ohne die Prüfung vor dem Dienst (`diensteinstieg`): es wird gelesen.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AppServices, buildServices } from "../../services/app/src/build-app";
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

const EINGAENGE = ["/api/ask", "/api/reasoner"] as const;
type Eingang = (typeof EINGAENGE)[number];

let aufraeumen: (() => Promise<void> | void)[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
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
  kopf: Record<string, string>;
}

async function lageAufbauen(addon: boolean, marke: string): Promise<Lage> {
  // Der Schalter wird beim Bau der App gelesen (`addonApiEnabled` in `buildApp`).
  vi.stubEnv("KLARWERK_ADDON_API", addon ? "1" : "0");
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
  const leser = await neuesKonto(aufbau.app, `d5-anmeldung-${marke}`, aufbau.admin);
  return { aufbau, dienste, grenzen, koId: quelle.koId, kopf: leser.kopf };
}

function frage(lage: Lage, eingang: Eingang) {
  return lage.aufbau.app.inject({
    method: "POST",
    url: eingang,
    headers: lage.kopf,
    payload:
      eingang === "/api/ask"
        ? { question: FRAGE, locale: "de" }
        : { task: "ask", text: FRAGE, locale: "de" },
  });
}

/** Hält die Rückgabe der NÄCHSTEN (echten, erfolgreichen) Authentifizierung an. */
function anmeldungAnhalten(dienste: AppServices): { erreicht: Promise<void>; los: () => void } {
  const auth = dienste.auth;
  const echt = auth.authenticate.bind(auth);
  let los: () => void = () => undefined;
  let angekommen: () => void = () => undefined;
  const frei = new Promise<void>((r) => {
    los = r;
  });
  const erreicht = new Promise<void>((r) => {
    angekommen = r;
  });
  let erster = true;
  vi.spyOn(auth, "authenticate").mockImplementation(async (...args) => {
    const halten = erster;
    erster = false;
    const ergebnis = await echt(...args);
    if (halten) {
      expect(ergebnis, "die angehaltene Anmeldung muss echt gelingen").toBeTruthy();
      angekommen();
      await frei;
    }
    return ergebnis;
  });
  aufraeumen.push(() => los());
  return { erreicht, los: () => los() };
}

async function kiSchalten(lage: Lage, wahl: "deterministic" | "auto") {
  const r = await lage.aufbau.app.inject({
    method: "PUT",
    url: "/api/reasoner/config",
    headers: lage.aufbau.admin.kopf,
    payload: { global: wahl },
  });
  expect(r.statusCode, r.body).toBe(200);
  expect(lage.dienste.reasoner.kiAbschaltung().abgeschaltet).toBe(wahl === "deterministic");
}

async function haltefall(
  eingang: Eingang,
  addon: boolean,
  umschalten: boolean,
  marke: string,
  gegenprobe = false,
) {
  const lage = await lageAufbauen(addon, marke);
  // Ausgangspunkt (K1): dieselbe Frage trägt vorher, mit Quelle, und die Zähler zählen dabei.
  const vorher = lage.grenzen.stand();
  const basis = await frage(lage, eingang);
  expect(basis.statusCode, basis.body).toBe(200);
  expect(basis.body).toContain(lage.koId);
  expect(zugriffsbefund(differenz(vorher, lage.grenzen.stand()), ALLE_GRENZEN)).not.toBe("");

  if (gegenprobe) {
    const rueckbau = sperreEntfernen(lage.dienste, new Set(["diensteinstieg"]));
    aufraeumen.push(() => rueckbau());
  }
  const halt = anmeldungAnhalten(lage.dienste);
  const alt = frage(lage, eingang);
  await halt.erreicht;
  if (umschalten) {
    await kiSchalten(lage, "deterministic");
    await kiSchalten(lage, "auto");
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

describe("D5 · eine in der Anmeldung angehaltene Frage — Bens B2", () => {
  for (const addon of [true, false]) {
    for (const eingang of EINGAENGE) {
      const name = `${eingang} · Add-on-API ${addon ? "an" : "aus"}`;
      const marke = `${eingang === "/api/ask" ? "ask" : "rsn"}-${addon ? "an" : "aus"}`;

      it(`${name} · Kontrolle: angehalten ohne Umschalten → antwortet mit Quelle`, async () => {
        const { antwort, zugriffe, lage } = await haltefall(eingang, addon, false, `${marke}-k`);
        expect(antwort.statusCode, antwort.body).toBe(200);
        expect(antwort.body).toContain(lage.koId);
        expect(zugriffe).not.toBe("");
      });

      it(`${name} · angehalten, KI aus und wieder ein → 503 ohne Kundeninhalt, null Zugriffe`, async () => {
        const { antwort, zugriffe, lage } = await haltefall(eingang, addon, true, `${marke}-ae`);
        expect(antwort.statusCode, antwort.body).toBe(503);
        expect(antwort.body).toContain("KI_ABGESCHALTET");
        expect(antwort.body).not.toContain(lage.koId);
        expect(zugriffe, "nach bestätigter Sperre gelesen oder übertragen").toBe("");
        // Nur NEUE Fragen laufen wieder (K5).
        const neu = await frage(lage, eingang);
        expect(neu.statusCode, neu.body).toBe(200);
        expect(neu.body).toContain(lage.koId);
      });

      it(`${name} · GEGENPROBE: ohne die Prüfung vor dem Dienst liest die alte Frage wieder`, async () => {
        const { zugriffe } = await haltefall(eingang, addon, true, `${marke}-g`, true);
        expect(zugriffe, "ohne `diensteinstieg` muss der Zähler anschlagen").not.toBe("");
      });
    }
  }
});
