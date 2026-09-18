// @vitest-environment jsdom
// ================================================================================================
// JOB 4335 RUNDE 4 — IN WELCHER REIHENFOLGE SPEICHERN ZWEI VERSCHACHTELTE WACHEN?
// ================================================================================================
//
// DER BEFUND (BEN, Runde 3, Korrekturpflicht 1). Seit Runde 2 führt `app/NavGuardContext.tsx` ein
// Verzeichnis angemeldeter Wachen statt eines Platzes, und `saveAndGo` ruft alle in der Reihenfolge
// „von aussen nach innen". Die Reihenfolge kam aber aus der EINFÜGEREIHENFOLGE der Map — und die
// verschiebt sich: jede Anmeldung läuft in einem Effekt, der bei jedem Render seines Bauteils neu
// läuft, und sein Aufräumer meldet zuerst ab. `delete` + `set` schiebt den Eintrag ans Ende. Ein
// Render, den NUR das innere Bauteil macht, stellte es damit vor das äussere. BENs Sonde hat genau
// das gemessen: `expected ['Arbeitsraum','Blatt'] to deeply equal ['Blatt','Arbeitsraum']`
// (Cloud-Lauf `eaf7aa00a5747669c72f4073`).
//
// WARUM DIE REIHENFOLGE ÜBERHAUPT ZÄHLT: beide Wachen einer Fläche können denselben gespeicherten
// Entwurf schreiben. Wer zuletzt schreibt, gewinnt. Ist die Reihenfolge eine Frage des
// Renderverlaufs, ist auch der Endstand eine — und niemand könnte sagen, welcher Stand im Bestand
// landet. Deshalb steht sie ab JOB 4335 R4 fest: die Position gehört der KENNUNG (`useId`), nicht
// ihrem letzten Eintrag, und gespeichert wird in fallender Ordnungszahl — von aussen nach innen.
//
// WAS DIESE DATEI MISST, und zwar am ECHTEN `NavGuardProvider` mit zwei ECHT verschachtelten
// Anmeldern (kein Nachbau des Anbieters, keine Attrappe des Wächters):
//   R1  Ausgangsmount          → Blatt vor Arbeitsraum
//   R2  nur der INNERE rendert → Blatt vor Arbeitsraum   (der Fall, den BEN gemessen hat)
//   R3  nur der ÄUSSERE rendert → Blatt vor Arbeitsraum
//   R4  beide rendern zusammen  → Blatt vor Arbeitsraum
//   R5  der Innere wird ausgehängt und wieder eingehängt → Blatt vor Arbeitsraum
//   R6  ZWEI gleichzeitig schmutzige Wachen, der zweite Schreiber scheitert → die Reihenfolge steht,
//       es wird NICHT gewechselt, der Dialog bleibt offen mit Grund, und der Wiederholungsdruck
//       schreibt genau die noch fehlende Wache (HINWEIS R4, Pflicht 4).
//
// Die Namen „Blatt" und „Arbeitsraum" stehen hier für aussen und innen — dieselbe Verschachtelung
// wie auf `/erfassen` (`pages/Capture.tsx:7239` rendert `Blatt`, das den Arbeitsraum hereinreicht).
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { act, createElement, useEffect, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import {
  NavGuardProvider,
  NavGuardSaveError,
  WACHE_ARBEITSRAUM,
  WACHE_FLAECHE,
  useNavGuard,
} from "../../apps/web/src/app/NavGuardContext";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Was in diesem Fall wirklich gespeichert wurde, in der Reihenfolge der Ausführung. */
let gespeichert: string[] = [];
/** Je Wache: ist sie schmutzig, und scheitert ihr Speichern? */
const lage: Record<string, { schmutzig: boolean; scheitert: boolean }> = {};

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i += 1) {
    await new Promise((auf) => setTimeout(auf, 0));
  }
};

/**
 * EINE WACHE, wie sie das Produkt anmeldet: in einem Effekt, dessen Abhängigkeit sich bei jedem
 * Render ändert (`{}` ist jedes Mal ein neues Objekt — genau die Lage bei `Blatt.tsx:1543` und
 * `Capture.tsx:3454`, wo die Mutationsobjekte in der Liste stehen). Der Aufräumer meldet ab. Damit
 * durchläuft jeder Render dieses Bauteils dieselbe Ab- und Neuanmeldung wie im Betrieb.
 */
function Wache({
  name,
  reihe,
  kinder,
}: { name: string; reihe?: number; kinder?: JSX.Element }): JSX.Element {
  const { setGuard } = useNavGuard();
  const marke = {};
  useEffect(() => {
    setGuard({
      ...(reihe === undefined ? {} : { reihe }),
      isDirty: () => lage[name]?.schmutzig === true,
      save: async () => {
        gespeichert.push(name);
        if (lage[name]?.scheitert === true) {
          throw new NavGuardSaveError(`${name} konnte nicht sichern`);
        }
      },
    });
    return () => setGuard(null);
    // `marke` ist die Abhängigkeit, die sich bei jedem Render ändert — sie bildet die
    // Mutationsobjekte der echten Anmelder nach.
  }, [setGuard, name, reihe, marke]);
  return kinder ?? createElement("span", { "data-testid": `wache-${name}` }, name);
}

/** Der Auslöser: er leitet einen Wechsel durch die Wache, wie jeder Menü- und Kachelklick. */
function Ausgang(): JSX.Element {
  const { guard } = useNavGuard();
  return createElement(
    "button",
    {
      type: "button",
      "data-testid": "ausgang",
      onClick: () => guard(() => gespeichert.push("GEWECHSELT")),
    },
    "hinaus",
  );
}

/**
 * Der Baum: `Blatt` (aussen) rendert `Arbeitsraum` (innen) als Kind — dieselbe Verschachtelung wie
 * auf der Erfassen-Fläche. Die zwei Zähler erlauben, je EINE der beiden Hälften allein neu rendern
 * zu lassen; genau daran zerbrach die Reihenfolge vor dieser Runde.
 */
let rendereBlatt: (() => void) | null = null;
let rendereArbeitsraum: (() => void) | null = null;
let haengeArbeitsraumAus: ((aus: boolean) => void) | null = null;

function Buehne(): JSX.Element {
  return createElement(
    MemoryRouter,
    { initialEntries: ["/erfassen"] },
    createElement(NavGuardProvider, null, createElement(BlattHaelfte), createElement(Ausgang)),
  );
}

/**
 * Melden die beiden Wachen dieser Bühne ihre REIHE an? R1–R4 und R6 sagen bewusst NICHTS — sie
 * messen damit den Rückfall (Ordnungszahl der Kennung) und sind zugleich BENs Sonde aus Runde 3,
 * Zeile für Zeile. R5 meldet sie an, wie es Blatt und Arbeitsraum im Produkt tun.
 */
let mitReihe = false;

function BlattHaelfte(): JSX.Element {
  const [, setZaehler] = useState(0);
  const [ausgehaengt, setAusgehaengt] = useState(false);
  rendereBlatt = () => setZaehler((n) => n + 1);
  haengeArbeitsraumAus = setAusgehaengt;
  return createElement(Wache, {
    name: "Blatt",
    ...(mitReihe ? { reihe: WACHE_FLAECHE } : {}),
    kinder: ausgehaengt
      ? createElement("span", null, "ohne Arbeitsraum")
      : createElement(InnenHaelfte),
  });
}

function InnenHaelfte(): JSX.Element {
  const [, setZaehler] = useState(0);
  rendereArbeitsraum = () => setZaehler((n) => n + 1);
  return createElement(Wache, {
    name: "Arbeitsraum",
    ...(mitReihe ? { reihe: WACHE_ARBEITSRAUM } : {}),
  });
}

async function mount(): Promise<void> {
  const el = document.createElement("div");
  document.body.appendChild(el);
  container = el;
  const r = createRoot(el);
  root = r;
  await act(async () => {
    r.render(createElement(Buehne));
    await flush();
  });
  await act(flush);
}

function knopf(marke: string): HTMLButtonElement {
  const el = document.querySelector(`[data-testid="${marke}"]`);
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${marke}" nicht gefunden`);
  }
  return el;
}

function dialogKnopf(text: string): HTMLButtonElement {
  const treffer = [...document.querySelectorAll("[data-navguard-dialog] button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(text),
  );
  if (!(treffer instanceof HTMLButtonElement)) {
    throw new Error(`Dialogknopf „${text}" nicht gefunden`);
  }
  return treffer;
}

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

function dialogeOffen(): number {
  return document.querySelectorAll("[data-navguard-dialog]").length;
}

/** Hinausgehen und im Dialog „Entwurf speichern und wechseln" drücken. */
async function speichernUndWechseln(): Promise<void> {
  await klick(knopf("ausgang"));
  expect(dialogeOffen(), "die Wache hat gar nicht gefragt").toBe(1);
  await klick(dialogKnopf(i18n.t("nav.guard.save")));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  gespeichert = [];
  lage.Blatt = { schmutzig: true, scheitert: false };
  lage.Arbeitsraum = { schmutzig: true, scheitert: false };
  rendereBlatt = null;
  rendereArbeitsraum = null;
  haengeArbeitsraumAus = null;
  mitReihe = false;
});

afterEach(() => {
  if (root) {
    const r = root;
    act(() => r.unmount());
  }
  container?.remove();
  root = null;
  container = null;
});

/** Einen der beiden Zähler allein hochzählen — ein Render NUR dieser Hälfte. */
async function rendere(welche: "blatt" | "arbeitsraum" | "beide"): Promise<void> {
  await act(async () => {
    if (welche === "arbeitsraum" || welche === "beide") {
      rendereArbeitsraum?.();
    }
    if (welche === "blatt" || welche === "beide") {
      rendereBlatt?.();
    }
    await flush();
  });
  await act(flush);
}

const SOLL = ["Blatt", "Arbeitsraum", "GEWECHSELT"];

describe("JOB 4335 · die Reihenfolge des Wachen-Verbunds steht fest", () => {
  it("R1 · Ausgangsmount: gespeichert wird von aussen nach innen", async () => {
    await mount();
    await speichernUndWechseln();
    expect(gespeichert, "die Reihenfolge stimmt am Ausgangsmount nicht").toEqual(SOLL);
  });

  // ==============================================================================================
  // R2 · DER FALL, DEN BEN GEMESSEN HAT: nur das INNERE Bauteil rendert.
  // ==============================================================================================
  // Vor dieser Runde meldete sich der Arbeitsraum dabei ab und neu an und rutschte damit ans Ende
  // der Map — die umgedrehte Liste begann danach mit ihm. Gemeldet wurde
  // `['Arbeitsraum','Blatt']` statt `['Blatt','Arbeitsraum']`.
  it("R2 · nur der Arbeitsraum rendert neu: die Reihenfolge dreht sich NICHT", async () => {
    await mount();
    await rendere("arbeitsraum");
    await speichernUndWechseln();
    expect(
      gespeichert,
      "ein Render allein im inneren Bauteil hat die Speicherreihenfolge umgedreht (Befund BEN R3)",
    ).toEqual(SOLL);
  });

  it("R3 · nur das Blatt rendert neu: die Reihenfolge steht", async () => {
    await mount();
    await rendere("blatt");
    await speichernUndWechseln();
    expect(gespeichert).toEqual(SOLL);
  });

  it("R4 · beide rendern zusammen: die Reihenfolge steht", async () => {
    await mount();
    await rendere("beide");
    await speichernUndWechseln();
    expect(gespeichert).toEqual(SOLL);
  });

  // ==============================================================================================
  // R5 · AUSHÄNGEN UND WIEDEREINHÄNGEN — die Position gehört der Kennung, nicht dem Eintrag.
  // ==============================================================================================
  // Auf `/erfassen` geschieht genau das beim Schliessen und Wiederöffnen des Arbeitsraums
  // (`Blatt.tsx:2589`: bei Ansicht „blatt" wird er gar nicht gerendert).
  //
  // HIER MELDEN BEIDE IHRE REIHE AN, wie es Blatt und Arbeitsraum im Produkt tun — und genau das
  // ist der Grund dafür: die Kennung eines Bauteils überlebt das Aushängen NICHT verlässlich
  // (gemessen in dieser Runde, Cloud-Lauf `5534a7e843cfa78da021ddcc`: mit blossem Rückfall auf die
  // Ordnungszahl speicherte danach der Arbeitsraum zuerst). Eine Reihenfolge, die im Quelltext
  // steht, kann davon nicht bewegt werden — R1–R4 messen weiter den Rückfall ohne Angabe.
  it("R5 · der Arbeitsraum wird ausgehängt und wieder eingehängt: die Reihenfolge steht", async () => {
    mitReihe = true;
    await mount();
    await act(async () => {
      haengeArbeitsraumAus?.(true);
      await flush();
    });
    await act(flush);
    await act(async () => {
      haengeArbeitsraumAus?.(false);
      await flush();
    });
    await act(flush);

    await speichernUndWechseln();
    expect(
      gespeichert,
      "nach Aushängen und Wiedereinhängen speichert der Arbeitsraum vor dem Blatt",
    ).toEqual(SOLL);
  });

  // ==============================================================================================
  // R6 · ZWEI SCHMUTZIGE WACHEN, DIE ZWEITE SCHEITERT — UND DER WIEDERHOLUNGSDRUCK.
  // ==============================================================================================
  // HINWEIS R4, Pflicht 4. Der Verbund darf beim ersten Fehler nicht wechseln; er muss den Grund
  // zeigen und beim zweiten Druck genau die noch fehlende Wache nachholen. Ohne diesen Fall wäre
  // „alle der Reihe nach" die halbe Zusage.
  it("R6 · die innere Wache scheitert: kein Wechsel, Grund im Dialog, zweiter Druck holt sie nach", async () => {
    lage.Arbeitsraum = { schmutzig: true, scheitert: true };
    await mount();

    await speichernUndWechseln();

    // Die äussere hat geschrieben, die innere ist gescheitert — und NICHT gewechselt.
    expect(gespeichert, "der Verbund ist über den Fehler hinweggegangen").toEqual([
      "Blatt",
      "Arbeitsraum",
    ]);
    expect(dialogeOffen(), "der Dialog ist trotz gescheiterter Sicherung zu").toBe(1);
    const grundfeld = document.querySelector("[data-navguard-save-error]");
    expect(grundfeld, "der Dialog nennt keinen Grund").not.toBeNull();
    expect((grundfeld?.textContent ?? "").replace(/\s+/g, " ")).toContain(
      "Arbeitsraum konnte nicht sichern",
    );

    // ---- Der zweite Druck, diesmal gelingt die innere. ---------------------------------------
    lage.Arbeitsraum = { schmutzig: true, scheitert: false };
    // Die äussere hat ihren Stand schon draussen — sie meldet sich als sauber und schreibt nicht
    // noch einmal. Genau dafür fragt der Verbund vor jedem Aufruf `isDirty()`.
    lage.Blatt = { schmutzig: false, scheitert: false };
    gespeichert = [];

    await klick(dialogKnopf(i18n.t("nav.guard.save")));

    expect(
      gespeichert,
      "der zweite Druck hat nicht genau die noch fehlende Wache geschrieben und gewechselt",
    ).toEqual(["Arbeitsraum", "GEWECHSELT"]);
    expect(dialogeOffen(), "der Dialog steht nach dem gelungenen Speichern noch").toBe(0);
  });
});
