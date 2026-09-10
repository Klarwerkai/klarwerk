// ================================================================================================
// JOB 3512 · DIE CHROME-LEISTE TRÄGT DIE FIRMEN-CI — GEMESSEN AN DER GEMOUNTETEN LEISTE.
// ================================================================================================
//
// Geladen wird das ECHTE Paket: `panel.html`, `i18n.js`, `panel.js` und der echte `worker.js`
// dahinter (`tests/klara-browser/panel-dom.ts`). Der Prüfstand ist derselbe, den die Leiste seit
// JOB 3278 benutzt — kein Nachbau, keine zweite Auffassung davon, was die Leiste ist.
//
// WARUM DER WORKER MITLÄUFT UND NICHT ATTRAPPIERT IST: die Leiste hat baulich KEINEN Netzzugang
// (`tests/klara-browser/package.test.ts` verbietet `fetch(` in `panel.js`). Der Markenstand kommt
// deshalb über dieselbe Nachrichtenstrecke wie alles andere. Genau diese Strecke soll gemessen
// werden — ein attrappierter Worker hätte sie wegdefiniert.
import { afterEach, describe, expect, it } from "vitest";
import { harness } from "../klara-browser/harness";
import { mount, schliesseFenster } from "../klara-browser/panel-dom";

afterEach(schliesseFenster);

const BRANDING = "https://app.klarwerk.ai/api/branding";

interface Stand {
  profil: "advisor" | null;
  aktiv: boolean;
  version: number;
  marke: { name: string; farben: { primaer: string; schrift: string }; logo: string } | null;
}

const ADVISOR = {
  name: "Advisor",
  farben: { primaer: "#0578b7", schrift: "#161417" },
  logo: "/marke/advisor/adv-logo.svg",
};

const AN = (version: number): Stand => ({
  profil: "advisor",
  aktiv: true,
  version,
  marke: ADVISOR,
});
const AUS = (version: number): Stand => ({ profil: null, aktiv: false, version, marke: null });

/** Die fünf Stellen, an denen die Firmen-CI in der Leiste wirkt — und sonst keine. */
const MARKEN_TOKEN = ["--brand", "--brand-deep", "--brand-text", "--ink", "--shadow-primary"];
/** Die Zustandsflächen der Leiste. Sie tragen Bedeutung, keine Marke (Auftrag L2). */
const SIGNAL_TOKEN = [
  "--pos-bg",
  "--pos-text",
  "--warn-bg",
  "--warn-text",
  "--crit-bg",
  "--crit-text",
];

/**
 * Die Bahn für einen Fall: der Worker, dessen `GET /api/branding` eine Folge abarbeitet.
 *
 * Ein `null`-Eintrag heisst „Abruf scheitert", `"haengt"` heisst „der Abruf bleibt offen" — er
 * endet erst, wenn der Fall `loesen()` ruft. Damit wird der Augenblick messbar, in dem ein Abruf
 * unterwegs ist (P9). Gelöst wird am Ende JEDES solchen Falls, sonst hinge `settle()` daran.
 */
function bahn(folge: (Stand | null | "haengt")[]) {
  const abrufe: string[] = [];
  const rest = [...folge];
  const halt: { weiter: (() => void) | null } = { weiter: null };
  const h = harness(async (url, options) => {
    if (String(url) === BRANDING) {
      abrufe.push(String(url));
      const naechste = rest.length > 1 ? rest.shift() : rest[0];
      if (naechste === "haengt") {
        await new Promise<void>((weiter) => {
          halt.weiter = weiter;
        });
        throw new TypeError("kein Netz");
      }
      if (naechste === null || naechste === undefined) {
        throw new TypeError("kein Netz");
      }
      return Response.json(naechste);
    }
    if (String(url).endsWith("/login")) {
      return Response.json({
        token: "fixture-session-secret",
        user: { id: "person-a", email: "a@example.test" },
      });
    }
    return Response.json(null, { status: options?.method === "POST" ? 201 : 200 });
  });
  return {
    h,
    abrufe,
    loesen: () => {
      halt.weiter?.();
      halt.weiter = null;
    },
  };
}

/** Die JSDOM-Teile, die dieser Prüfstand anfasst — schmal statt geborgt (Vertrag panel-dom.ts). */
interface Wurzelstil {
  getPropertyValue(name: string): string;
  // Nur P14 fasst diese beiden an — dort werden sie umgelenkt, um zu MESSEN, ob die Leiste bei
  // unverändertem Stand überhaupt noch schreibt.
  setProperty(name: string, wert: string): void;
  removeProperty(name: string): void;
}
interface Marken {
  documentElement: { style: Wurzelstil };
  dispatchEvent(ereignis: unknown): boolean;
}
type Sicht = Awaited<ReturnType<typeof mount>>;

function dok(view: Sicht): Marken {
  return view.win.document as unknown as Marken;
}

function wurzel(view: Sicht, name: string): string {
  return dok(view).documentElement.style.getPropertyValue(name).trim();
}

function logo(view: Sicht) {
  const el = view.win.document.getElementById("marke-logo");
  expect(el, "#marke-logo fehlt in der Leiste").not.toBeNull();
  return el as NonNullable<typeof el>;
}

/** Die Uhr der LEISTE weiterstellen. `Date` lebt im jsdom-Fenster, nicht im Node-Prozess. */
function uhrVor(view: Sicht, ms: number): void {
  const w = view.win as unknown as { Date: { now(): number } };
  const stand = w.Date.now() + ms;
  w.Date = { ...w.Date, now: () => stand } as unknown as { now(): number };
}

/** Der Anlass, bei dem eine offene Leiste nachsieht. */
async function sichtbarWerden(view: Sicht, vorlaufMs = 61_000): Promise<void> {
  uhrVor(view, vorlaufMs);
  dok(view).dispatchEvent(new view.win.Event("visibilitychange"));
  await view.settle();
}

/**
 * Derselbe Anlass, aber OHNE auf die Antwort zu warten — für den Fall mit offenem Abruf (P9).
 * `settle()` kann das nicht: es wartet auf jede ausstehende Worker-Antwort und hinge an der
 * angehaltenen. `tick()` lässt nur die Ereignisschleife laufen; mehrere Durchläufe, weil die
 * Strecke Leiste → Worker → `fetch` über mehrere Microtask-Runden geht.
 */
async function anstossenOhneWarten(view: Sicht, vorlaufMs = 61_000): Promise<void> {
  uhrVor(view, vorlaufMs);
  dok(view).dispatchEvent(new view.win.Event("visibilitychange"));
  for (let i = 0; i < 10; i += 1) await view.tick();
}

describe("JOB 3512 P · die Leiste übernimmt die Firmen-CI aus derselben Quelle", () => {
  it("P1 · aus: keine Markenvariable überschrieben, kein Logo", async () => {
    const { h, abrufe } = bahn([AUS(3)]);
    const view = await mount({ an: h, auswahl: false });
    expect(abrufe, "die Leiste hat gar nicht nachgesehen").toHaveLength(1);
    for (const token of MARKEN_TOKEN) {
      expect(wurzel(view, token), `${token} ist überschrieben, obwohl die Firmen-CI aus ist`).toBe(
        "",
      );
    }
    expect(logo(view).hidden).toBe(true);
    expect(logo(view).hasAttribute("src"), "ein leeres src wäre ein Abruf ins Leere").toBe(false);
  });

  it("P2 · an: Logo und die beiden belegten Farben stehen an ihren Stellen", async () => {
    const { h } = bahn([AN(4)]);
    const view = await mount({ an: h, auswahl: false });
    expect(wurzel(view, "--brand")).toBe("#0578b7");
    expect(wurzel(view, "--brand-text")).toBe("#046092");
    expect(wurzel(view, "--brand-deep")).toBe("#046092");
    expect(wurzel(view, "--ink")).toBe("#161417");
    expect(wurzel(view, "--shadow-primary")).toBe("0 2px 10px -2px rgba(5, 120, 183, 0.45)");
    expect(logo(view).hidden).toBe(false);
    expect(logo(view).getAttribute("alt")).toBe("Advisor ICT solutions logo");
  });

  it("P3 · das Logo ist die MITGELIEFERTE Datei, nicht die Adresse aus dem Vertrag", async () => {
    // Der Server nennt `/marke/advisor/adv-logo.svg` — das ist SEINE Adresse. Die Erweiterung ist
    // buildlos und CSP-eng; sie zeigt die Kopie, die in ihrem eigenen Paket liegt. Sonst hinge das
    // Panel zur Laufzeit an app.klarwerk.ai (Auftragsgrundlage: „keine Laufzeitabhängigkeit").
    const { h } = bahn([AN(4)]);
    const view = await mount({ an: h, auswahl: false });
    expect(logo(view).getAttribute("src")).toBe("marke/advisor/adv-logo.svg");
  });

  it("P4 · die Signalfarben bleiben unberührt", async () => {
    const { h } = bahn([AN(4)]);
    const view = await mount({ an: h, auswahl: false });
    for (const token of SIGNAL_TOKEN) {
      expect(wurzel(view, token), `${token} trägt Bedeutung, keine Marke`).toBe("");
    }
  });

  it("P5 · ausschalten stellt zeichengleich den vorherigen Zustand wieder her", async () => {
    const { h, abrufe } = bahn([AN(4), AUS(5)]);
    const view = await mount({ an: h, auswahl: false });
    expect(wurzel(view, "--brand")).toBe("#0578b7");
    await sichtbarWerden(view);
    expect(abrufe.length, "die offene Leiste hat nicht nachgesehen").toBe(2);
    for (const token of MARKEN_TOKEN) {
      expect(wurzel(view, token), `${token} blieb nach dem Ausschalten stehen`).toBe("");
    }
    expect(logo(view).hidden).toBe(true);
    expect(logo(view).hasAttribute("src")).toBe(false);
  });

  it("P6 · ein Abruffehler leert nichts und die Leiste bleibt bedienbar", async () => {
    const { h, abrufe } = bahn([AN(4), null]);
    const view = await mount({ an: h, auswahl: false });
    await sichtbarWerden(view);
    expect(abrufe.length).toBe(2);
    expect(wurzel(view, "--brand")).toBe("#0578b7");
    expect(logo(view).hidden).toBe(false);
    // Bedienbar heisst: die Anmeldung geht weiter durch, ohne dass die Marke im Weg steht.
    await view.login();
    expect(view.el("account").textContent).toContain("a@example.test");
  });

  it("P7 · scheitert schon der ERSTE Abruf, bleibt der normale Look", async () => {
    const { h, abrufe } = bahn([null]);
    const view = await mount({ an: h, auswahl: false });
    expect(abrufe.length).toBe(1);
    for (const token of MARKEN_TOKEN) {
      expect(wurzel(view, token)).toBe("");
    }
    expect(logo(view).hidden).toBe(true);
    await view.login();
    expect(view.el("account").textContent).toContain("a@example.test");
  });

  it("P8 · höchstens ein Abruf je Minute, über alle Anlässe zusammen", async () => {
    const { h, abrufe } = bahn([AN(4)]);
    const view = await mount({ an: h, auswahl: false });
    expect(abrufe.length).toBe(1);
    await sichtbarWerden(view, 1_000);
    await sichtbarWerden(view, 1_000);
    expect(abrufe.length, "die Drosselung greift nicht").toBe(1);
    await sichtbarWerden(view, 60_000);
    expect(abrufe.length).toBe(2);
  });

  it("P9 · es ist immer nur EIN Abruf offen — keine Antwort kann eine andere überholen", async () => {
    // ================================================================================================
    // DIE ABWEHR GEGEN ÜBERHOLENDE ANTWORTEN SITZT HIER — nicht am Versionszähler.
    // ================================================================================================
    // Bis Runde 1 stand hier „eine ÄLTERE Version dreht nicht zurück". Der Fall hat den Fehler
    // festgeschrieben statt ihn zu finden: er hat kein Überholen nachgestellt, sondern zwei
    // NACHEINANDER eintreffende Antworten, von denen die zweite die neuere Wahrheit war — genau
    // daran blieb die Leiste nach einem Serverneustart blau (BENs Befund, Runde 1).
    //
    // Überholen kann baulich nicht stattfinden: `markeLaeuft` lässt keinen zweiten Abruf neben einen
    // offenen. Gemessen wird das am angehaltenen Abruf.
    const { h, abrufe, loesen } = bahn([AN(9), "haengt"]);
    const view = await mount({ an: h, auswahl: false });
    expect(abrufe.length).toBe(1);
    expect(wurzel(view, "--brand")).toBe("#0578b7");
    await anstossenOhneWarten(view); // der zweite Abruf geht raus und bleibt unterwegs
    expect(abrufe.length).toBe(2);
    await anstossenOhneWarten(view, 120_000);
    await anstossenOhneWarten(view, 120_000);
    expect(abrufe.length, "ein weiterer Abruf lief neben dem offenen").toBe(2);
    // Die Leiste hängt nicht an ihm: der zuletzt bekannte Look steht, die Anmeldung geht.
    expect(wurzel(view, "--brand")).toBe("#0578b7");
    loesen();
    await view.settle();
    await view.login();
    expect(view.el("account").textContent).toContain("a@example.test");
  });

  it("P10 · die Marke fasst KEINE fremde Seite an", async () => {
    // Die Leiste färbt ausschliesslich ihr eigenes Panel. Ein Beleg zur LAUFZEIT: für den
    // Markenstand betritt der Worker keine Seite. `spuren` hält jeden Chrome-Aufruf in seiner
    // Reihenfolge fest; ohne Übernahme darf kein einziger Skripteinsatz darin stehen.
    const { h } = bahn([AN(4)]);
    const view = await mount({ an: h, auswahl: false });
    await sichtbarWerden(view);
    expect(
      view.spuren.filter((s) => s === "scripting.executeScript"),
      "die Marke hat eine fremde Seite betreten",
    ).toEqual([]);
    // Und der einzige Netzweg der Marke geht zur eigenen Instanz, nicht zu einem Dritten.
    expect(view.requests.filter((u) => !u.startsWith("https://app.klarwerk.ai/"))).toEqual([]);
  });

  it("P11 · KALIBRIERUNG: der Prüfstand sieht eine Überschreibung wirklich", async () => {
    const { h } = bahn([AN(4)]);
    const view = await mount({ an: h, auswahl: false });
    expect(MARKEN_TOKEN.filter((t) => wurzel(view, t) !== "")).toEqual(MARKEN_TOKEN);
  });

  it("P12 · nach einem SERVERNEUSTART wirkt jede weitere Schaltung — der Zähler fängt bei 0 an", async () => {
    // ================================================================================================
    // DER FALL, DEN RUNDE 1 NICHT HATTE (BENs Korrekturpflicht 1).
    // ================================================================================================
    // `version` gilt laut Vertrag (JOB 3510, Rückgabe Runde 3) nur INNERHALB eines Prozesslaufs: die
    // Wahl liegt im Speicher, nach jedem Neustart und jedem Deploy beginnt der Zähler wieder bei 0.
    // Eine Leiste, die während der Vorführung offen daneben steht, muss trotzdem jeder Schaltung
    // folgen — ohne dass jemand die Erweiterung neu installiert.
    const { h, abrufe } = bahn([AN(9), AUS(0), AN(1), AUS(2)]);
    const view = await mount({ an: h, auswahl: false });
    expect(wurzel(view, "--brand"), "der erste Stand kam nicht an").toBe("#0578b7");

    await sichtbarWerden(view); // ── Serverneustart, Wahl weg: AUS(0), KLEINER als die gesehene 9
    expect(wurzel(view, "--brand"), "nach dem Neustart blieb die Marke stehen").toBe("");
    expect(logo(view).hidden).toBe(true);

    await sichtbarWerden(view); // ── AN(1), immer noch kleiner als 9
    expect(wurzel(view, "--brand"), "das Einschalten nach dem Neustart wirkte nicht").toBe(
      "#0578b7",
    );
    expect(logo(view).hidden).toBe(false);

    await sichtbarWerden(view); // ── AUS(2)
    for (const token of MARKEN_TOKEN) {
      expect(wurzel(view, token), `${token} blieb nach dem Ausschalten stehen`).toBe("");
    }
    expect(abrufe.length).toBe(4);
  });

  it("P13 · derselbe Zählerstand mit ANDEREM Inhalt wird nicht verwechselt", async () => {
    // Die schärfere Kante desselben Befunds: „Version ungleich meiner" allein trägt nach einem
    // Neustart NICHT. Vor dem Neustart bedeutete `version 2` „an", danach bedeutet dieselbe 2
    // „aus" — ein Vergleich am Zähler sähe zweimal 2 und bliebe blau. Verglichen wird deshalb das
    // AUSSEHEN (`markeKennung`), und das kann sich nicht verwechseln.
    const { h } = bahn([AN(2), AUS(2)]);
    const view = await mount({ an: h, auswahl: false });
    expect(wurzel(view, "--brand")).toBe("#0578b7");
    await sichtbarWerden(view);
    expect(
      wurzel(view, "--brand"),
      "gleiche Version, anderer Inhalt — die Marke blieb stehen",
    ).toBe("");
    expect(logo(view).hidden).toBe(true);
  });

  it("P14 · ein Abruf, der nichts Neues bringt, fasst die Leiste nicht an", async () => {
    // Die Kehrseite von P12/P13: der Minutenblick soll unsichtbar bleiben, solange sich nichts
    // ändert. Gemessen wird, dass bei unverändertem Stand KEIN Schreibzugriff auf die Wurzel mehr
    // stattfindet — ohne diesen Fall wäre „am Aussehen vergleichen" eine Behauptung.
    const { h, abrufe } = bahn([AN(4)]);
    const view = await mount({ an: h, auswahl: false });
    expect(wurzel(view, "--brand")).toBe("#0578b7");
    const stil = dok(view).documentElement.style;
    const schreibt: string[] = [];
    const echtSetzen = stil.setProperty.bind(stil);
    const echtLoeschen = stil.removeProperty.bind(stil);
    stil.setProperty = (name: string, wert: string) => {
      schreibt.push(name);
      echtSetzen(name, wert);
    };
    stil.removeProperty = (name: string) => {
      schreibt.push(name);
      echtLoeschen(name);
    };
    try {
      await sichtbarWerden(view);
      expect(abrufe.length, "die Leiste hat gar nicht nachgesehen").toBe(2);
      expect(schreibt, "derselbe Stand wurde ein zweites Mal aufgetragen").toEqual([]);
    } finally {
      stil.setProperty = echtSetzen;
      stil.removeProperty = echtLoeschen;
    }
    expect(wurzel(view, "--brand"), "und stehen bleibt er trotzdem").toBe("#0578b7");
  });
});
