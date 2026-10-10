// ================================================================================================
// produkt:20261009:referenzki-pruefdienst (REF-02, K10) — ECHTE MODELLBEOBACHTUNG DER SIEBEN FÄLLE.
// ================================================================================================
//
// WAS DAS IST. Die getrennte Gegenstück-Messung zur technischen Simulation
// (`tests/referenzki-pruefdienst/pruefdienst-simulation.test.ts`): dieselben sieben fiktiven Fälle
// (`tests/referenzki-pruefdienst/faelle.ts`), aber gegen ein ECHTES Prüfmodell über den echten
// Reasoner (Freigaben, Chokepoint, Laufbuch) und den echten Prüfdienst. Je Fall ein Modellaufruf;
// der Prüferausfall wird mit einem Zeitlimit von 1 ms an einem echten, gestarteten Aufruf erzeugt.
//
// WAS DAS NICHT IST. Kein Test im Tor und kein Fehlerfreiheitsnachweis: sieben Beispiele sagen
// etwas über diese sieben Beispiele mit diesem Modell an diesem Tag. Der Bericht nennt Modell,
// Zeitpunkt, Dauer und Verbrauch je Fall, damit das nachvollziehbar bleibt.
//
// AUFRUF (nur von Hand, mit eingerichtetem Anbieter in der Umgebung — Schlüssel NIE als Argument):
//   npx tsx scripts/referenzki/beobachtung.ts --pruefer anthropic --bericht <datei.json>
//   `--pruefer` ist eine der erlaubten Optionen (openai | anthropic | local). Die Antworten der Fälle
//   sind Fixturen; ihre Antwortrolle ist deshalb die feste Fixturrolle (Modell `fixtur-antwort`).
//
// Der Bericht enthält nur fiktive Inhalte, Kennungen, Zustände, Begründungen des Prüfers und
// Messwerte — keinen Schlüssel und keine Umgebungswerte.
import { writeFileSync } from "node:fs";
import {
  type AufloesbaresObjekt,
  type FundstellenLeser,
  ReferenzPruefdienst,
  type ReferenzPruefErgebnis,
} from "../../services/ask";
import { InMemoryModelRunRepo } from "../../services/model-runs";
import {
  InMemoryReasonerPolicyRepo,
  ModelProvider,
  REASONER_REFERENZ_WAHLEN,
  Reasoner,
  type ReasonerReferenzWahl,
  type ReferenzRolle,
  createCappedCloudClientFromEnv,
  createCappedLocalClientFromEnv,
} from "../../services/reasoner";
import { PRUEF_FAELLE, type PruefFall, belegDes } from "../../tests/referenzki-pruefdienst/faelle";

const FIXTUR_ROLLE: ReferenzRolle = {
  anbieter: "fixtur",
  modell: "fixtur-antwort",
  stufe: "cloud",
};

function argument(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function leserFuer(fall: PruefFall): FundstellenLeser<AufloesbaresObjekt> {
  const objekte = new Map(
    fall.quellen.map((q) => [
      q.id,
      { id: q.id, version: q.version, originalAuthor: "autor-fiktiv", statement: q.statement },
    ]),
  );
  return {
    aktuell: async (id) => objekte.get(id),
    imPapierkorb: async () => undefined,
    fassung: async (id, v) => {
      const o = objekte.get(id);
      return o && o.version === v ? { statement: o.statement } : undefined;
    },
  };
}

function zusammenfassung(fall: PruefFall, e: ReferenzPruefErgebnis) {
  const beobachtet = e.aussagen.map((a) => a.zustand);
  return {
    kennung: fall.kennung,
    beschreibung: fall.beschreibung,
    erwartet: fall.erwartet,
    beobachtet,
    uebereinstimmung: JSON.stringify(beobachtet) === JSON.stringify(fall.erwartet),
    status: e.status,
    grund: e.grund ?? null,
    pruefer: e.rollen.pruefer,
    antwort: e.rollen.antwort,
    begruendungen: e.aussagen.map((a) => a.begruendung),
    hinweise: e.hinweise.map((h) => h.art),
    messung: e.messung,
    bindung: e.bindung,
  };
}

async function main(): Promise<void> {
  const wahl = argument("pruefer") as ReasonerReferenzWahl | undefined;
  const bericht = argument("bericht");
  if (!wahl || !(REASONER_REFERENZ_WAHLEN as readonly string[]).includes(wahl) || !bericht) {
    process.stderr.write(
      "Aufruf: npx tsx scripts/referenzki/beobachtung.ts --pruefer <openai|anthropic|local> --bericht <datei.json>\n",
    );
    process.exitCode = 2;
    return;
  }
  const cloud = createCappedCloudClientFromEnv();
  const lokal = createCappedLocalClientFromEnv();
  const runs = new InMemoryModelRunRepo();
  const reasoner = new Reasoner(
    undefined,
    undefined,
    runs,
    undefined,
    lokal ? new ModelProvider(lokal) : undefined,
    new InMemoryReasonerPolicyRepo(),
    {
      anbieter: {
        ...(cloud.openai ? { openai: new ModelProvider(cloud.openai) } : {}),
        ...(cloud.anthropic ? { anthropic: new ModelProvider(cloud.anthropic) } : {}),
      },
      gruende: cloud.gruende,
    },
  );
  // Nur die Grundfreigabe für öffentliche KI — die Fälle sind fiktiv und nicht vertraulich.
  await reasoner.setTaskConfig({
    global: "deterministic",
    perTask: {},
    kiFreigabe: { oeffentlicheKi: true },
    referenzpruefung: [wahl],
  });
  const dienst = (zeitlimitMs?: number) =>
    new ReferenzPruefdienst({
      waehlePruefer: (antwort, vertraulich) => reasoner.referenzPruefer(antwort, vertraulich),
      externErlaubt: (vertraulich) => reasoner.externeVerarbeitungErlaubt(vertraulich),
      istVertraulich: () => false,
      ...(zeitlimitMs !== undefined ? { zeitlimitMs } : {}),
    });
  const ergebnisse = [];
  for (const fall of PRUEF_FAELLE) {
    // Der Prüferausfall: ein echter, gestarteter Aufruf, der am Zeitlimit des Dienstes scheitert.
    const d = fall.kennung === "prueferausfall" ? dienst(1) : dienst();
    const e = await d.pruefe({
      beleg: belegDes(fall),
      antwortRolle: FIXTUR_ROLLE,
      akteur: "beobachtung-ref02",
      leser: leserFuer(fall),
      darfSehen: () => true,
      locale: "de",
    });
    ergebnisse.push(zusammenfassung(fall, e));
  }
  const laeufe = (await runs.recent(100)).map((l) => ({
    task: l.task,
    status: l.status,
    provider: l.provider,
    model: l.model ?? null,
    startedAt: l.startedAt,
    finishedAt: l.finishedAt,
    verbrauch: l.verbrauch ?? null,
  }));
  const inhalt = {
    auftrag: "produkt:20261009:referenzki-pruefdienst",
    art: "echte_modellbeobachtung",
    hinweis:
      "Sieben fiktive Beispiele mit einem Modell zu einem Zeitpunkt — keine allgemeine Fehlerfreiheit.",
    zeitpunkt: new Date().toISOString(),
    gewaehlteOption: wahl,
    ergebnisse,
    laufprotokoll: laeufe,
  };
  writeFileSync(bericht, `${JSON.stringify(inhalt, null, 2)}\n`, "utf8");
  process.stdout.write(
    `${ergebnisse.map((r) => `${r.kennung}: erwartet ${r.erwartet.join(",")} · beobachtet ${r.beobachtet.join(",")} (${r.grund ?? r.status})`).join("\n")}\n`,
  );
}

void main();
