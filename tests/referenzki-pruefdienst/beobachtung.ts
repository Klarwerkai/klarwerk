// ================================================================================================
// produkt:20261009:referenzki-pruefdienst (REF-02, K10) — DIE ECHTE MODELLBEOBACHTUNG, EINMAL GEBAUT.
// ================================================================================================
//
// Gemeinsam genutzt vom regulären Prüfablauf (`modellbeobachtung.test.ts`) und vom Handaufruf
// (`scripts/referenzki/beobachtung.ts`). Dieselben sieben fiktiven Fälle (`faelle.ts`) gegen ein
// ECHTES Prüfmodell über den echten Reasoner (Freigaben, Chokepoint, Laufbuch) und den echten
// Prüfdienst. Je Fall ein Modellaufruf; der Prüferausfall entsteht an einem echten, gestarteten
// Aufruf mit einem Zeitlimit von 1 ms (das Abbruchsignal erreicht den Transport).
//
// Die Anbieter entstehen AUSSCHLIESSLICH über die bestehenden Fabriken aus der übergebenen Umgebung
// — kein Schlüssel wird gelesen, gespeichert oder ausgegeben; der Schlüsselbund wird bewusst nicht
// befragt. Der Bericht trägt Kennungen, Zustände, Begründungen des Prüfers und Messwerte.
import {
  type AufloesbaresObjekt,
  type FundstellenLeser,
  type ReferenzPruefErgebnis,
  ReferenzPruefdienst,
} from "../../services/ask";
import { InMemoryModelRunRepo, kostenEinesLaufs, lesePreisliste } from "../../services/model-runs";
import {
  InMemoryReasonerPolicyRepo,
  ModelProvider,
  Reasoner,
  type ReasonerReferenzWahl,
  type ReferenzRolle,
  createCappedCloudClientFromEnv,
  createCappedLocalClientFromEnv,
} from "../../services/reasoner";
import { PRUEF_FAELLE, type PruefFall, belegDes } from "./faelle";

type Umgebung = Record<string, string | undefined>;

/** Die Antwortrolle der Fixturen — sie sind keine Modellantworten. */
export const FIXTUR_ROLLE: ReferenzRolle = {
  anbieter: "fixtur",
  modell: "fixtur-antwort",
  stufe: "cloud",
};

/** Kein Schlüsselbund: nur die Umgebung des Prüfablaufs zählt. */
const KEIN_SCHLUESSELBUND = (): undefined => undefined;
const NICHT_SPEICHERN = (): boolean => false;

/**
 * Welche erlaubten Optionen in DIESER Umgebung eingerichtet sind — mit dem geheimnisfreien Grund
 * der Fabrik (Variablennamen, nie Werte), wenn nicht. Das ist der Beleg einer fehlenden Voraussetzung.
 */
export function anbieterLage(
  env: Umgebung,
): Record<ReasonerReferenzWahl, { eingerichtet: boolean; grund: string | null }> {
  const cloud = createCappedCloudClientFromEnv(env, KEIN_SCHLUESSELBUND, NICHT_SPEICHERN);
  const lokal = createCappedLocalClientFromEnv(env);
  return {
    openai: { eingerichtet: !!cloud.openai, grund: cloud.gruende.openai ?? null },
    anthropic: { eingerichtet: !!cloud.anthropic, grund: cloud.gruende.anthropic ?? null },
    local: {
      eingerichtet: !!lokal,
      grund: lokal ? null : "KLARWERK_LOCAL_LLM_URL und KLARWERK_LOCAL_LLM_MODEL fehlen.",
    },
  };
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

export type Beobachtungsbericht = Awaited<ReturnType<typeof beobachte>>;

/** Die sieben Fälle gegen die gewählte, eingerichtete Option — der vollständige Bericht. */
export async function beobachte(wahl: ReasonerReferenzWahl, env: Umgebung) {
  const cloud = createCappedCloudClientFromEnv(env, KEIN_SCHLUESSELBUND, NICHT_SPEICHERN);
  const lokal = createCappedLocalClientFromEnv(env);
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
  // Nur die Grundfreigabe für öffentliche KI — die Fälle sind fiktiv und nicht vertraulich. Die
  // gewählte Option ist aktiv: `deterministic` wäre die administrative Abschaltung (D5).
  await reasoner.setTaskConfig({
    global: wahl,
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
  // Der abgebrochene Aufruf des Prüferausfalls schreibt seinen Lauf erst nach dem Abbruch.
  await new Promise((r) => setTimeout(r, 200));
  // Kosten mit DERSELBEN Preisliste des Betreibers wie im Produkt (`KLARWERK_KI_PREISLISTE`);
  // ohne Preisliste steht `null` — es wird kein Preis erfunden.
  const preisliste = lesePreisliste(env.KLARWERK_KI_PREISLISTE).preisliste;
  const laeufe = (await runs.recent(100)).map((l) => ({
    task: l.task,
    status: l.status,
    provider: l.provider,
    model: l.model ?? null,
    startedAt: l.startedAt,
    finishedAt: l.finishedAt,
    dauerMs: Date.parse(l.finishedAt) - Date.parse(l.startedAt),
    verbrauch: l.verbrauch ?? null,
    kosten: kostenEinesLaufs(l, preisliste) ?? null,
  }));
  const pruefLaeufe = laeufe.filter((l) => l.task === "referenz");
  return {
    auftrag: "produkt:20261009:referenzki-pruefdienst",
    art: "echte_modellbeobachtung",
    hinweis:
      "Sieben fiktive Beispiele mit einem Modell zu einem Zeitpunkt — keine allgemeine Fehlerfreiheit.",
    zeitpunkt: new Date().toISOString(),
    gewaehlteOption: wahl,
    preislisteVorhanden: preisliste !== null,
    modellaufrufeNachweis: {
      pruefLaeufe: pruefLaeufe.length,
      mitModell: pruefLaeufe.filter((l) => l.model !== null).length,
      erfolgreich: pruefLaeufe.filter((l) => l.status === "success").length,
      modelle: [...new Set(pruefLaeufe.flatMap((l) => (l.model ? [l.model] : [])))],
    },
    ergebnisse,
    laufprotokoll: laeufe,
  };
}
