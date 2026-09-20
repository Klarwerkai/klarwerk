// ================================================================================================
// JOB 4362 · K4 — DIE KALIBRIERUNG: VIER VERSTELLUNGEN, DIE DEN NACHWEIS NAMENTLICH ROT MACHEN.
// ================================================================================================
//
// WOZU DIESE DATEI DA IST. Ein Tastaturnachweis, der eine zerstörte Tastaturbedienbarkeit nicht
// sieht, ist keiner — und das ist im Haus gemessen und nicht vermutet: JOB 4223 R1 behauptete einen
// Tastaturweg und öffnete den Knopf in Wahrheit mit einem `click()`; BEN nahm den Knopf mit
// `tabIndex={-1}` aus der Reihe, und der Fall blieb GRÜN. Seitdem gilt: jede Zusage wird durch ihre
// eigene Zerstörung kalibriert.
//
// DIE ERSTEN DREI VERSTELLUNGEN SIND GENAU DIE DREI ZUSAGEN DES AUFTRAGS (Abnahmekriterium 4),
// DIE VIERTE IST DIE LEHRE AUS DEM TOR-ROT DER RUNDE 1:
//
//   V1  DER PUNKT LIEGT NICHT MEHR IN DER TAB-REIHENFOLGE (`tabindex="-1"` am Menüpunkt)
//       → Station 3 muss mit „nur mit der Maus" scheitern.
//   V2  DER FOKUSRING IST AUSGEBLENDET (kein `outline`, kein `box-shadow`, nirgends)
//       → Station 1 muss mit „zeigt keinen sichtbaren Fokus" scheitern.
//   V3  DAS UNTERMENÜ SAGT SEIN AUFKLAPPEN NICHT AN (`aria-expanded` bleibt „false")
//       → Station 2 muss am fehlenden `aria-expanded=true` scheitern.
//   V4  DIE ÜBERSCHRIFT DER SEITE STEHT IM DOKUMENT UND WIRD NICHT GEZEICHNET (`display: none`)
//       → Station 4 muss AM WARTEN scheitern und das auch sagen. Das ist die Lage, die das Tor der
//         Runde 1 rot gemacht hat: während die nachgeladene Route lud, erfüllte die verborgene
//         Überschrift der Startseite ein Warten, das nur auf Anwesenheit prüfte.
//
//         WAS V4 PRÜFT, IST DESHALB NICHT „rot statt grün", sondern WO DAS ROT HERKOMMT. Gemessen
//         (Gegenprobe G4, Arbeitsprüfung a2ba1a13efe0493a98b9784f586ad76f): mit der alten Bedingung
//         scheitert der Fall erst in der Zusicherung darunter, mit der Meldung „die Überschrift der
//         Seite lautet in „de" nicht „Gesamtanweisungen"" — einem Satz über den INHALT, während in
//         Wahrheit die Route fehlte. Genau diese Verwechslung kostete eine Runde plus Tor plus
//         Prüfung; V4 hält sie fest.
//   V5  DER ZEUGE: ohne jede Verstellung trägt der Weg.
//
// SIE WERDEN IM BROWSER ANGEBRACHT UND NICHT IM PRODUKT — und das ist der Punkt, an dem diese
// Kalibrierung mehr ist als ein Protokollvermerk: sie läuft JEDES MAL mit, im Tor, ohne Schalter
// und ohne Übersprung. Eine Kalibrierung, die nur einmal von Hand gefahren wurde, belegt den Stand
// von damals; diese belegt den Stand von heute. Kein `ctx.skip()` steht in dieser Datei.
//
// V1, V3 UND V4 HÄNGEN AN EINEM `MutationObserver` und nicht an einem einmaligen `setAttribute`: React
// baut das Menü bei jedem Zustandswechsel neu und schriebe das Attribut sofort zurück. Der
// Beobachter setzt nur, was noch nicht gesetzt ist — sonst löste seine eigene Änderung ihn erneut
// aus, und die Seite stünde in einer Schleife.
//
// DIE RÜCKNAHME IST EIGENS GEMESSEN: nach jedem roten Fall wird die Verstellung abgenommen, die
// Seite frisch geladen und DERSELBE Weg gefahren — er muss dann GRÜN sein. Ohne diesen zweiten
// Teil bewiese ein roter Fall nur, dass irgendetwas kaputt ist, und nicht, dass GENAU diese
// Verstellung ihn rot gemacht hat.
//
// DIE VERSTELLUNGEN FASSEN DAS PRODUKT NICHT AN. Nichts in `apps/web/src` wird hier geändert; die
// Skripte laufen im Dokument eines Wegwerf-Browserprofils und sterben mit ihm.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Browser,
  type Kontext,
  type Seite,
  fn,
  mitFlaeche,
  starteChromium,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT, type Strecke, ersteinrichtung, starteStrecke } from "../gast-nutzerweg/strecke";
import { meldeAnMitTastatur, stelleFlaecheBereit } from "../gesamtanweisung-nutzerweg/weg";
import {
  BEREICHE,
  EINTRAG,
  HAUPTUEBERSCHRIFT,
  MARKE,
  type Sollwerte,
  ZAHNRAD,
  klappeBereicheAuf,
  menuewegOhneMaus,
  oeffneZahnrad,
  profilFuer,
  seiteMussStehen,
  sollwerte,
  waehleGesamtanweisungen,
} from "./weg";

const ADMIN = "kalibrierung-admin@gesamtanweisung-4362.test";

/**
 * Die Frist der ROTEN Läufe.
 *
 * Kurz, weil ein roter Fall hier durch ZEITABLAUF entsteht (das erwartete Ereignis tritt nie ein)
 * und die Hausfrist von 30 s ihn dreimal um eine halbe Minute verlängerte. Es ist dieselbe
 * Funktion mit demselben Weg — nur ihre Geduld ist kürzer. Die GRÜNEN Läufe darunter fahren die
 * volle Hausfrist; wäre die kurze Frist die Ursache des Rots, wäre auch der grüne Lauf rot.
 */
const KURZ = 8_000;

// ------------------------------------------------------------------------------------------------
// DIE VERSTELLUNGEN — je ein Skript zum Anbringen und eines zum Abnehmen.
// ------------------------------------------------------------------------------------------------

/** V1 · Der Menüpunkt fällt aus der Tab-Reihenfolge, sobald er erscheint. */
const AUS_DER_TABREIHE = `(sel) => {
  const setze = () => {
    for (const e of document.querySelectorAll(sel)) {
      if (e.getAttribute("tabindex") !== "-1") { e.setAttribute("tabindex", "-1"); }
    }
  };
  setze();
  const beob = new MutationObserver(setze);
  beob.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  window.__kal4362Tab = beob;
  return true;
}`;

const TABREIHE_ZURUECK = `(sel) => {
  const beob = window.__kal4362Tab;
  if (beob) { beob.disconnect(); window.__kal4362Tab = undefined; }
  for (const e of document.querySelectorAll(sel)) { e.removeAttribute("tabindex"); }
  return document.querySelectorAll(sel + "[tabindex]").length;
}`;

/** V2 · Kein Fokusring, nirgends — weder Umriss noch Schatten. */
const FOKUSRING_AUS = `() => {
  const stil = document.createElement("style");
  stil.id = "kal4362-fokusring-aus";
  stil.textContent = "*, *:focus, *:focus-visible { outline: none !important; box-shadow: none !important; }";
  document.head.appendChild(stil);
  return !!document.getElementById("kal4362-fokusring-aus");
}`;

const FOKUSRING_ZURUECK = `() => {
  const stil = document.getElementById("kal4362-fokusring-aus");
  if (stil && stil.parentNode) { stil.parentNode.removeChild(stil); }
  return !document.getElementById("kal4362-fokusring-aus");
}`;

/** V3 · Das Untermenü klappt auf, sagt es aber nicht an. */
const ARIA_STUMM = `(sel) => {
  const setze = () => {
    for (const e of document.querySelectorAll(sel)) {
      if (e.getAttribute("aria-expanded") !== "false") { e.setAttribute("aria-expanded", "false"); }
    }
  };
  setze();
  const beob = new MutationObserver(setze);
  beob.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  window.__kal4362Aria = beob;
  return true;
}`;

const ARIA_ZURUECK = `(sel) => {
  const beob = window.__kal4362Aria;
  if (beob) { beob.disconnect(); window.__kal4362Aria = undefined; }
  return document.querySelector(sel)?.getAttribute("aria-expanded") ?? "(kein Attribut)";
}`;

/**
 * V4 · DIE ÜBERSCHRIFT DES SEITENHAUPTBEREICHS STEHT DA UND WIRD NICHT GEZEICHNET.
 *
 * DIESER FALL IST DIE KALIBRIERUNG DES TOR-ROTS AUS RUNDE 1 und der wichtigste dieser Datei. Der
 * Nachweis wartete damals auf die blosse ANWESENHEIT von `main h1` — und während die nachgeladene
 * Route noch lud (`routes.tsx:226`), erfüllte die mit `display: none` stehengebliebene Überschrift
 * der STARTSEITE dieses Warten sofort. Genau diese Lage stellt die Verstellung her: das Element ist
 * im Dokument, es wird nicht gezeichnet.
 *
 * Erwartet wird deshalb nicht irgendein Rot, sondern das Rot AUS DEM WARTEN — mit dem Satz über die
 * fehlende gezeichnete Überschrift. Fällt der Nachweis auf die Anwesenheitsprüfung zurück, kommt
 * das Rot aus der Zusicherung darunter und behauptet etwas über den INHALT; dieser Fall wird dann
 * rot und benennt den Rückfall (gemessen als Gegenprobe G4).
 *
 * `display: none` und nicht `opacity: 0`: beide lässt die Bedingung scheitern (`checkVisibility`
 * prüft mit `checkOpacity`), aber `display: none` ist die Lage, die im Tor wirklich eingetreten ist.
 */
const UEBERSCHRIFT_AUS = `(sel) => {
  const setze = () => {
    for (const e of document.querySelectorAll(sel)) {
      if (e.style.display !== "none") { e.style.display = "none"; }
    }
  };
  setze();
  const beob = new MutationObserver(setze);
  beob.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  window.__kal4362Kopf = beob;
  return true;
}`;

const UEBERSCHRIFT_ZURUECK = `(sel) => {
  const beob = window.__kal4362Kopf;
  if (beob) { beob.disconnect(); window.__kal4362Kopf = undefined; }
  for (const e of document.querySelectorAll(sel)) { e.style.removeProperty("display"); }
  return [...document.querySelectorAll(sel)].filter((e) => e.style.display === "none").length;
}`;

let strecke: Strecke | undefined;
let browser: Browser | undefined;

beforeAll(async () => {
  process.stderr.write(`${MARKE} K4: gebaute Fläche — ${stelleFlaecheBereit()}\n`);
  browser = await starteChromium();
  strecke = await starteStrecke(mitFlaeche());
  await ersteinrichtung(strecke, ADMIN);
}, 900_000);

afterAll(async () => {
  await browser?.close();
  await strecke?.schliessen();
}, 60_000);

/** Ein angemeldetes deutsches Profil auf `/start` — die Bühne jeder Verstellung. */
async function buehne(): Promise<{
  kontext: Kontext;
  seite: Seite;
  soll: Sollwerte;
  neuLaden: () => Promise<void>;
}> {
  if (!browser || !strecke) {
    throw new Error(`${MARKE}: Browser oder Strecke fehlen — der Aufbau ist nicht durchgelaufen.`);
  }
  const basis = strecke.basis;
  const { kontext, seite } = await profilFuer(browser, "de");
  await meldeAnMitTastatur(seite, basis, ADMIN, PASSWORT);
  const neuLaden = async (): Promise<void> => {
    await seite.goto(`${basis}/start`, { waitUntil: "domcontentloaded" });
  };
  await neuLaden();
  return { kontext, seite, soll: sollwerte("de"), neuLaden };
}

describe("JOB 4362 · K4 Kalibrierung: vier Verstellungen, die den Tastaturnachweis rot machen", () => {
  it("V1 — mit `tabindex=-1` am Menüpunkt scheitert Station 3 wörtlich an „nur mit der Maus“; nach Rücknahme trägt derselbe Weg", async () => {
    const { kontext, seite, soll, neuLaden } = await buehne();
    try {
      // ── OHNE VERSTELLUNG WÄRE HIER NICHTS ZU SEHEN: erst die beiden ersten Stationen fahren,
      //    damit der Punkt überhaupt entsteht. Sie sind von V1 nicht berührt.
      await seite.evaluate<boolean>(fn(AUS_DER_TABREIHE), EINTRAG);
      await oeffneZahnrad(seite, "de", KURZ);
      await klappeBereicheAuf(seite, soll.bereiche, "de", KURZ);
      // Der Punkt STEHT da, ist SICHTBAR und zeigt auf die richtige Adresse — er ist nur nicht
      // mehr ertabbar. Genau das ist die Fehlerklasse „geht, aber nur mit der Maus".
      await expect(waehleGesamtanweisungen(seite, soll.eintrag, "de", KURZ)).rejects.toThrow(
        /nur mit der Maus/,
      );

      // ── RÜCKNAHME ──────────────────────────────────────────────────────────────────────────
      const offen = await seite.evaluate<number>(fn(TABREIHE_ZURUECK), EINTRAG);
      expect(
        offen,
        `${MARKE}: nach der Rücknahme trägt der Menüpunkt noch ein tabindex-Attribut`,
      ).toBe(0);
      await neuLaden();
      const befund = await menuewegOhneMaus(seite, soll, "de");
      expect(befund.eintrag).toBeGreaterThan(0);
      expect(befund.seite.ueberschrift).toContain(soll.eintrag);
    } finally {
      await kontext.close();
    }
  }, 600_000);

  it("V2 — ohne Fokusring scheitert Station 1 wörtlich an „zeigt keinen sichtbaren Fokus“; nach Rücknahme trägt derselbe Weg", async () => {
    const { kontext, seite, soll, neuLaden } = await buehne();
    try {
      await seite.evaluate<boolean>(fn(FOKUSRING_AUS));
      // DAS ZAHNRAD IST WEITER ERTABBAR — nur SICHTBAR ist der Fokus nicht mehr. Ein Nachweis,
      // der bloss die Erreichbarkeit misst, bliebe hier grün und liesse einen Menschen im
      // Dunkeln tasten (Hauslehre 9: DOM-Anwesenheit ist kein Sehen).
      await expect(oeffneZahnrad(seite, "de", KURZ)).rejects.toThrow(
        /zeigt keinen sichtbaren Fokus/,
      );

      // ── RÜCKNAHME ──────────────────────────────────────────────────────────────────────────
      expect(
        await seite.evaluate<boolean>(fn(FOKUSRING_ZURUECK)),
        `${MARKE}: das Stilblatt der Verstellung steht nach der Rücknahme noch im Dokument`,
      ).toBe(true);
      await neuLaden();
      const befund = await menuewegOhneMaus(seite, soll, "de");
      expect(befund.zahnrad).toBeGreaterThan(0);
      expect(befund.seite.ueberschrift).toContain(soll.eintrag);
    } finally {
      await kontext.close();
    }
  }, 600_000);

  it("V3 — sagt das Untermenü sein Aufklappen nicht an, scheitert Station 2 am fehlenden aria-expanded; nach Rücknahme trägt derselbe Weg", async () => {
    const { kontext, seite, soll, neuLaden } = await buehne();
    try {
      await seite.evaluate<boolean>(fn(ARIA_STUMM), BEREICHE);
      await oeffneZahnrad(seite, "de", KURZ);
      // Das Untermenü klappt sichtbar auf — es sagt es nur nicht an. Für einen Bildschirmleser
      // bliebe es zu, und genau diese Zusage misst Station 2.
      await expect(klappeBereicheAuf(seite, soll.bereiche, "de", KURZ)).rejects.toThrow(
        /aufgeklappte Untermenü/,
      );

      // ── RÜCKNAHME ──────────────────────────────────────────────────────────────────────────
      // Nach dem Abnehmen des Beobachters steht dort noch der zuletzt erzwungene Wert; erst der
      // nächste Aufbau der Fläche schreibt ihn aus dem Zustand zurück. Deshalb wird neu geladen
      // und DANACH gemessen — die Behauptung „grün" hängt am vollen Weg, nicht am Attribut.
      expect(
        await seite.evaluate<string>(fn(ARIA_ZURUECK), BEREICHE),
        `${MARKE}: die Verstellung war gar nicht angebracht — dann misst dieser Fall nichts`,
      ).toBe("false");
      await neuLaden();
      const befund = await menuewegOhneMaus(seite, soll, "de");
      expect(befund.bereiche).toBeGreaterThan(0);
      expect(befund.seite.ueberschrift).toContain(soll.eintrag);
    } finally {
      await kontext.close();
    }
  }, 600_000);

  it("V4 — steht die Überschrift des Seitenhauptbereichs da, ohne gezeichnet zu werden, scheitert Station 4; nach Rücknahme trägt derselbe Weg", async () => {
    const { kontext, seite, soll, neuLaden } = await buehne();
    try {
      await seite.evaluate<boolean>(fn(UEBERSCHRIFT_AUS), HAUPTUEBERSCHRIFT);
      // Die Stationen 1 bis 3 sind von dieser Verstellung nicht berührt — sie MÜSSEN durchlaufen,
      // sonst käme das Rot unten von der falschen Stelle.
      await oeffneZahnrad(seite, "de", KURZ);
      await klappeBereicheAuf(seite, soll.bereiche, "de", KURZ);
      await waehleGesamtanweisungen(seite, soll.eintrag, "de", KURZ);
      // DIE ADRESSE STIMMT, die Überschrift steht im Dokument — und wird nicht gezeichnet. Das Rot
      // muss AUS DEM WARTEN kommen und die fehlende gezeichnete Überschrift benennen; eine Meldung
      // über den INHALT zeigte hier auf die falsche Ursache (Runde 1, Tor rot).
      await expect(seiteMussStehen(seite, soll.eintrag, "de", KURZ)).rejects.toThrow(
        /gezeichnete Überschrift des Seitenhauptbereichs/,
      );

      // ── RÜCKNAHME ──────────────────────────────────────────────────────────────────────────
      expect(
        await seite.evaluate<number>(fn(UEBERSCHRIFT_ZURUECK), HAUPTUEBERSCHRIFT),
        `${MARKE}: nach der Rücknahme trägt eine Überschrift noch display:none`,
      ).toBe(0);
      await neuLaden();
      const befund = await menuewegOhneMaus(seite, soll, "de");
      expect(befund.seite.ueberschrift).toContain(soll.eintrag);
    } finally {
      await kontext.close();
    }
  }, 600_000);

  it("V5 — der Zeuge: ohne jede Verstellung trägt der Weg, und das Zahnrad ist ertabbar", async () => {
    const { kontext, seite, soll } = await buehne();
    try {
      const befund = await menuewegOhneMaus(seite, soll, "de");
      expect(
        befund.zahnrad,
        `${MARKE}: das Zahnrad ${ZAHNRAD} wurde ohne Verstellung nicht per Tab erreicht`,
      ).toBeGreaterThan(0);
      expect(befund.bereiche).toBeGreaterThan(0);
      expect(befund.eintrag).toBeGreaterThan(0);
      expect(befund.seite.ueberschrift).toContain(soll.eintrag);
    } finally {
      await kontext.close();
    }
  }, 600_000);
});
