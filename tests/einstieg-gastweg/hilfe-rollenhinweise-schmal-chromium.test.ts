// ================================================================================================
// JOB 4358 · K4 — AM HANDY BLEIBT LESBAR, WELCHE ROLLE EIN SCHRITT VERLANGT.
// ================================================================================================
//
// WAS HIER GEMESSEN WIRD UND WARUM IM ECHTEN BROWSER: Die Einstiegsführung der Hilfeseite stellt je
// Zeile den Schritttext (`min-w-0 flex-1`) neben eine Auskunft (`shrink-0`) — den Weg hinein oder
// den Rollenhinweis („Ab Rolle …"). Ob diese Auskunft bei 320 px noch im Fenster steht, entscheidet
// kein Quelltext, sondern der Umbruch im Browser. jsdom rechnet keine Breiten aus; eine Zusage über
// die schmale Fläche ist dort nicht prüfbar, sondern nur behauptbar.
//
// DIE BÜHNE IST DIE VORHANDENE H3-BÜHNE (`tests/design/h3-blatt-buehne.ts`, nur importiert): die
// ECHTE gebaute Anwendung aus `apps/web/dist` in Chromium, jeder `/api/*`-Aufruf an die ECHTE
// Fastify-App. Kein Nachbau, keine gescriptete Antwort.
//
// WIE DIE ROLLE ENTSTEHT — UND WARUM SIE NICHT GESETZT WIRD: Die Bühne meldet das erste Konto an,
// und das erste Konto ist der Erstadministrator (`services/auth`, `h3-blatt-buehne.ts:223-240`).
// Einem Administrator steht jeder Schritt offen — dann gäbe es gar keinen Rollenhinweis zu messen.
// Gewählt wird deshalb DERSELBE Weg, den ein Administrator im Betrieb geht: Einstellungen → Konten
// → „Ansicht als Rolle" → „Betrachter" (`pages/AdminKontenDetails.tsx:877-955`). Die Sitzung bleibt
// dabei echt und bestätigt (`isSessionRole`), nur die ANSICHT ist die einer Betrachterin — genau die
// Lage, für die die vier Rollenhinweise gedacht sind. Nichts wird an der Bühne verstellt.
//
// GEMESSEN WIRD SICHTBARKEIT, NICHT ANWESENHEIT (Lehre 9 aus JOB 4295/4305): je Element
// `checkVisibility({checkOpacity, checkVisibilityCSS})`, sein `innerText` und sein Rechteck. Drei
// Kalibrierungen zeigen, dass die Messung diese drei Ausfälle auch WIRKLICH sieht (K5).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALL_ITEMS, ROLE_RANK, type Role } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { PILOT_CHECKLIST } from "../../apps/web/src/lib/pilotChecklist";
import { type Buehne, ORIGIN, buehneAufbauen, fn } from "../design/h3-blatt-buehne";

const SPRACHEN = ["de", "en", "nl"] as const;
const FENSTER = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
] as const;

/** Die Rolle, deren Ansicht gemessen wird — sie hat die meisten Rollenhinweise vor sich. */
const ANSICHT: Role = "viewer";

let buehne: Buehne | null = null;
let aufbaufehler: string | null = null;

const t = (sprache: string, key: string, opts?: Record<string, unknown>): string =>
  opts === undefined ? i18n.getFixedT(sprache)(key) : i18n.getFixedT(sprache)(key, opts);

function seite(): Buehne["seite"] {
  expect(aufbaufehler, "die Bühne kam nicht hoch").toBeNull();
  return (buehne as Buehne).seite;
}

const lies = <T>(quelle: string, arg?: unknown): Promise<T> => seite().evaluate<T>(fn(quelle), arg);

const warte = (quelle: string, arg?: unknown): Promise<unknown> =>
  seite().waitForFunction(fn(quelle), arg, { timeout: 30_000 });

/** Ein Klick IN der Seite — die H3-Bühne reicht kein Zeigegerät heraus, und hier braucht es keins. */
async function klick(selektor: string): Promise<void> {
  const getroffen = await lies<boolean>(
    "(s) => { const el = document.querySelector(s); if (!el) { return false; } el.click(); return true; }",
    selektor,
  );
  expect(getroffen, `Element nicht gefunden: ${selektor}`).toBe(true);
}

/** Die Mindestrolle eines Schrittes — aus derselben Quelle, über die der Router entscheidet. */
function mindestrolle(ziel: string): Role {
  const eintrag = ALL_ITEMS.find((nav) => nav.path === ziel);
  if (!eintrag) {
    throw new Error(`Route ohne Navigationseintrag: ${ziel}`);
  }
  return eintrag.minRole;
}

/** Die Rollenhinweise, die eine Betrachterin sehen MUSS — gerechnet, nicht abgeschrieben. */
function erwarteteHinweise(sprache: string): string[] {
  return PILOT_CHECKLIST.filter(
    (item) => ROLE_RANK[mindestrolle(item.to)] > ROLE_RANK[ANSICHT],
  ).map((item) =>
    t(sprache, "pilot.access.locked", {
      rolle: t(sprache, `role.name.${mindestrolle(item.to)}`),
    }),
  );
}

function erwarteteZusammenfassung(sprache: string): string {
  const offen = PILOT_CHECKLIST.filter(
    (item) => ROLE_RANK[ANSICHT] >= ROLE_RANK[mindestrolle(item.to)],
  ).length;
  return t(sprache, "pilot.access.summary", {
    rolle: t(sprache, `role.name.${ANSICHT}`),
    offen,
    gesamt: PILOT_CHECKLIST.length,
  });
}

interface Messwert {
  text: string;
  sichtbar: boolean;
  breite: number;
  scroll: number;
  links: number;
  rechts: number;
  hoehe: number;
}

interface Messung {
  fenster: number;
  dokument: number;
  zusammenfassung: Messwert | null;
  hinweise: Messwert[];
}

// ------------------------------------------------------------------------------------------------
// DIE MESSUNG IN DER SEITE. Gefunden wird am INHALT (der Satz, der dort stehen soll) und nicht an
// einer Testmarke: so misst dieser Fall dieselbe Zeile, die ein Mensch liest, und er wird rot, wenn
// sie gar nicht mehr da ist — statt still eine Marke ohne Text zu bestätigen.
// ------------------------------------------------------------------------------------------------
const MESSEN = `(arg) => {
  const mass = (el) => {
    const r = el.getBoundingClientRect();
    return {
      text: (el.innerText || "").replace(/\\s+/g, " ").trim(),
      sichtbar: el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
      breite: el.clientWidth,
      scroll: el.scrollWidth,
      links: Math.round(r.left * 10) / 10,
      rechts: Math.round(r.right * 10) / 10,
      hoehe: Math.round(r.height * 10) / 10,
    };
  };
  const listen = [...document.querySelectorAll("ol")].filter((ol) =>
    (ol.textContent || "").includes(arg.anker),
  );
  if (listen.length !== 1) {
    return { fenster: window.innerWidth, dokument: document.documentElement.scrollWidth,
      zusammenfassung: null, hinweise: [], listen: listen.length };
  }
  const liste = listen[0];
  const karte = liste.parentElement;
  const satz = [...karte.querySelectorAll("p")].find(
    (p) => (p.textContent || "").replace(/\\s+/g, " ").trim() === arg.satz,
  );
  const hinweise = [];
  for (const li of liste.querySelectorAll("li")) {
    for (const span of li.querySelectorAll("span")) {
      const text = (span.textContent || "").replace(/\\s+/g, " ").trim();
      if (arg.hinweise.includes(text)) {
        hinweise.push(mass(span));
        break;
      }
    }
  }
  return {
    fenster: window.innerWidth,
    dokument: document.documentElement.scrollWidth,
    zusammenfassung: satz ? mass(satz) : null,
    hinweise,
    listen: listen.length,
  };
}`;

async function messen(sprache: string): Promise<Messung> {
  return lies<Messung>(MESSEN, {
    anker: t(sprache, PILOT_CHECKLIST[0]?.labelKey ?? ""),
    satz: erwarteteZusammenfassung(sprache),
    hinweise: erwarteteHinweise(sprache),
  });
}

/**
 * Woran ein gemessenes Element scheitert — leer heisst „sichtbar, mit Text, ungekürzt, im Fenster".
 *
 * EIN PRÄDIKAT FÜR BEIDE SEITEN: die Zusagen oben (K4) und die Kalibrierungen unten (K5) fragen
 * WÖRTLICH dasselbe. Eine Kalibrierung, die eine andere Bedingung prüft als die Zusage, belegt für
 * die Zusage nichts.
 */
function verstoesse(m: Messwert, fenster: number): string[] {
  const gefunden: string[] = [];
  if (!m.sichtbar) {
    gefunden.push("nicht sichtbar");
  }
  if (m.text.length === 0) {
    gefunden.push("ohne sichtbaren Text");
  }
  if (m.hoehe <= 0) {
    gefunden.push("ohne Höhe");
  }
  if (m.scroll > m.breite) {
    gefunden.push("waagerecht abgeschnitten");
  }
  if (m.links < 0) {
    gefunden.push("ragt links aus dem Fenster");
  }
  if (m.rechts > fenster) {
    gefunden.push("ragt rechts aus dem Fenster");
  }
  return gefunden;
}

/** Ein Element der Messung prüfen: sichtbar, mit Text, ungekürzt und ganz im Fenster. */
function pruefe(wert: Messwert | null, was: string, fenster: number): void {
  expect(wert, `${was}: steht nicht auf der Fläche`).not.toBeNull();
  const m = wert as Messwert;
  expect(verstoesse(m, fenster), `${was} (gemessen: ${JSON.stringify(m)})`).toEqual([]);
}

/**
 * Sprache setzen und die Ansicht einer Betrachterin herstellen.
 *
 * DER NEUAUFBAU IST PFLICHT UND KEIN UMWEG: `i18n` liest die gespeicherte Wahl beim Auswerten des
 * Moduls (`lib/sprachwahl.ts`), also nur beim Laden der Seite. Und weil die Vorschaurolle im
 * `RoleProvider` als React-Zustand lebt, muss sie NACH jedem Laden neu gewählt werden — über
 * dieselben Knöpfe, die ein Mensch drückt.
 */
async function ansichtHerstellen(sprache: string): Promise<void> {
  await seite().setViewportSize({ width: 1280, height: 800 });
  await lies<boolean>(
    `(s) => { try { localStorage.setItem("kw.sprache", s); } catch (e) {} return true; }`,
    sprache,
  );
  await seite().goto(`${ORIGIN}/admin?bereich=konten&detail=ansichtRolle`, {
    waitUntil: "load",
    timeout: 60_000,
  });
  await warte(`() => document.querySelector('[data-testid="detail-ansicht-rolle"]') !== null`);
  const rollenname = t(sprache, `role.name.${ANSICHT}`);
  const gewaehlt = await lies<boolean>(
    `(name) => {
      const karte = document.querySelector('[data-testid="detail-ansicht-rolle"]');
      const knopf = [...karte.querySelectorAll("button[aria-pressed]")].find(
        (b) => (b.textContent || "").replace(/\\s+/g, " ").trim() === name,
      );
      if (!knopf) { return false; }
      knopf.click();
      return true;
    }`,
    rollenname,
  );
  expect(gewaehlt, `Rollenknopf „${rollenname}" (${sprache}) nicht gefunden`).toBe(true);
  // Die Vorschau wirkt: der Rollen-Guard nimmt dem Administrator die Verwaltungsfläche.
  await warte(`() => document.querySelector('[data-einst="seite"]') === null`);
  // Und von dort über den EINEN vorhandenen Weg zur Hilfe — ein erneutes Laden würde die Ansicht
  // wieder auf „Administrator" zurücksetzen.
  await klick('[data-testid="kopfband-zahnrad"]');
  await warte(`() => document.querySelector('[data-testid="zahnrad-hilfe"]') !== null`);
  await klick('[data-testid="zahnrad-hilfe"]');
  await warte(`() => document.querySelector('[data-testid="hilfe-suche"]') !== null`);
  await warte(
    `(anker) => [...document.querySelectorAll("ol")].some((ol) => (ol.textContent || "").includes(anker))`,
    t(sprache, PILOT_CHECKLIST[0]?.labelKey ?? ""),
  );
}

/** Eine Stilverstellung am ersten Rollenhinweis — und ihre Rücknahme. */
async function verstellen(eigenschaft: string, wert: string, sprache: string): Promise<void> {
  const getroffen = await lies<boolean>(
    `(arg) => {
      const liste = [...document.querySelectorAll("ol")].find((ol) =>
        (ol.textContent || "").includes(arg.anker),
      );
      for (const li of liste.querySelectorAll("li")) {
        for (const span of li.querySelectorAll("span")) {
          const text = (span.textContent || "").replace(/\\s+/g, " ").trim();
          if (arg.hinweise.includes(text)) {
            span.style.setProperty(arg.eigenschaft, arg.wert);
            return true;
          }
        }
      }
      return false;
    }`,
    {
      anker: t(sprache, PILOT_CHECKLIST[0]?.labelKey ?? ""),
      hinweise: erwarteteHinweise(sprache),
      eigenschaft,
      wert,
    },
  );
  expect(getroffen, `Kalibrierung: kein Rollenhinweis für ${eigenschaft} gefunden`).toBe(true);
}

describe("JOB 4358 · K4 · die Rollenhinweise der Hilfeseite bei 320 und 390 px", () => {
  beforeAll(async () => {
    buehne = await buehneAufbauen(
      "/admin?bereich=konten&detail=ansichtRolle",
      '[data-testid="detail-ansicht-rolle"]',
      {},
      { width: 1280, height: 800 },
    );
    aufbaufehler = buehne.fehler;
  }, 240_000);

  afterAll(async () => {
    await buehne?.schliessen();
  }, 60_000);

  it("die Bühne steht — echte gebaute Anwendung, echte App, ohne Seitenfehler", () => {
    expect(aufbaufehler, "die Bühne kam nicht hoch").toBeNull();
    expect((buehne as Buehne).version.length, "kein Chromium").toBeGreaterThan(0);
    expect((buehne as Buehne).seitenfehler, "die Seite hat beim Aufbau geworfen").toEqual([]);
  });

  for (const sprache of SPRACHEN) {
    it(`${sprache}: Zusammenfassungssatz und alle 4 Rollenhinweise sichtbar und im Fenster`, async () => {
      expect(erwarteteHinweise(sprache), "es gibt keine Rollenhinweise zu messen").toHaveLength(4);
      await ansichtHerstellen(sprache);
      for (const fenster of FENSTER) {
        await seite().setViewportSize({ width: fenster.width, height: fenster.height });
        const messung = await messen(sprache);
        expect(messung.fenster, "das Fenster steht nicht auf dem Maß").toBe(fenster.width);
        expect(
          messung.hinweise,
          `${sprache} @${fenster.width}: es stehen nicht alle 4 Rollenhinweise da`,
        ).toHaveLength(4);
        pruefe(
          messung.zusammenfassung,
          `${sprache} @${fenster.width}: Zusammenfassung`,
          fenster.width,
        );
        for (const [i, hinweis] of messung.hinweise.entries()) {
          pruefe(hinweis, `${sprache} @${fenster.width}: Rollenhinweis ${i + 1}`, fenster.width);
        }
        console.info(
          `JOB 4358 · K4 ${sprache} @${fenster.width}: ${JSON.stringify({
            dokument: messung.dokument,
            satz: messung.zusammenfassung?.text,
            hinweise: messung.hinweise.map((h) => [h.text, h.rechts, h.sichtbar]),
          })}`,
        );
      }
      expect((buehne as Buehne).seitenfehler, "die Seite hat geworfen").toEqual([]);
    }, 180_000);
  }

  // ==============================================================================================
  // K5 — DIE KALIBRIERUNG. Drei Ausfälle, drei Messgrössen: der Hinweis ist ausgeblendet, er ist
  // unsichtbar gestellt, oder er steht ausserhalb des Fensters. Ohne diese drei Fälle wäre jede
  // Zusage oben auch mit einer blinden Messung grün — genau der Fehler, der in JOB 4295 und 4305 je
  // eine Runde gekostet hat.
  //
  // GEFRAGT WIRD MIT DEMSELBEN PRÄDIKAT (`verstoesse`), das die Zusagen oben tragen — und die
  // erwartete Meldung steht WÖRTLICH da. Ein Fall, der nur „irgendetwas ist anders" prüft, liesse
  // offen, ob die Messung den richtigen Ausfall sieht.
  //
  // ZWEIMAL GEMESSEN STATT ANGENOMMEN — und beide Male anders als vermutet:
  //   · Lauf 77fcdedae259c592ef9574c5: `display:none` nimmt den Hinweis NICHT aus der Erhebung.
  //     Gesucht wird am `textContent`, und der bleibt.
  //   · Lauf d8566bf00dc89960a0b0413b: und sein `innerText` bleibt ebenfalls stehen — die Norm
  //     lässt `innerText` auf `textContent` zurückfallen, sobald ein Element NICHT GERENDERT wird.
  //     Das ist genau der Grund, aus dem Lehre 9 den Text als Sichtbarkeitsbeleg verwirft: was den
  //     ausgeblendeten Hinweis auffliegen lässt, sind `checkVisibility` und die Höhe, nicht sein
  //     Text. (a) verlangt deshalb wörtlich diese beiden Meldungen — und keine dritte.
  // ==============================================================================================
  it("K5: ausgeblendet, unsichtbar, aus dem Fenster geschoben — jede Verstellung wird gemessen", async () => {
    await ansichtHerstellen("de");
    await seite().setViewportSize({ width: 320, height: 568 });
    const vorher = await messen("de");
    expect(vorher.hinweise, "Ausgangslage: es stehen nicht 4 Hinweise da").toHaveLength(4);
    expect(verstoesse(vorher.hinweise[0] as Messwert, vorher.fenster)).toEqual([]);

    // (a) `display:none` — nicht mehr zu sehen und ohne jede Fläche. Sein TEXT steht weiter da
    // (s. Kopf) und taugt deshalb nicht als Beleg; die Messung fällt trotzdem auf.
    await verstellen("display", "none", "de");
    const ohne = await messen("de");
    expect(
      verstoesse(ohne.hinweise[0] as Messwert, ohne.fenster),
      "display:none blieb unbemerkt",
    ).toEqual(["nicht sichtbar", "ohne Höhe"]);
    await verstellen("display", "", "de");
    expect(
      verstoesse((await messen("de")).hinweise[0] as Messwert, vorher.fenster),
      "die Rücknahme wirkte nicht",
    ).toEqual([]);

    // (b) `visibility:hidden` — der Hinweis nimmt seinen Platz ein und ist trotzdem nicht zu sehen.
    await verstellen("visibility", "hidden", "de");
    const unsichtbar = await messen("de");
    expect(unsichtbar.hinweise, "der Hinweis ist aus der Erhebung verschwunden").toHaveLength(4);
    expect(
      verstoesse(unsichtbar.hinweise[0] as Messwert, unsichtbar.fenster),
      "visibility:hidden blieb unbemerkt — die Sichtbarkeitsmessung ist blind",
    ).toContain("nicht sichtbar");
    await verstellen("visibility", "", "de");
    expect(
      verstoesse((await messen("de")).hinweise[0] as Messwert, vorher.fenster),
      "die Rücknahme wirkte nicht",
    ).toEqual([]);

    // (c) aus dem Fenster geschoben — die Fensterprüfung sieht es.
    await verstellen("position", "relative", "de");
    await verstellen("left", "500px", "de");
    const draussen = await messen("de");
    expect(
      verstoesse(draussen.hinweise[0] as Messwert, draussen.fenster),
      "ein Hinweis ausserhalb des Fensters blieb unbemerkt",
    ).toContain("ragt rechts aus dem Fenster");
    await verstellen("left", "", "de");
    await verstellen("position", "", "de");

    // ZURÜCKGENOMMEN HEISST ZURÜCKGENOMMEN: die Ausgangslage steht wieder, vollständig.
    const nachher = await messen("de");
    expect(nachher.hinweise).toHaveLength(4);
    for (const [i, hinweis] of nachher.hinweise.entries()) {
      pruefe(hinweis, `nach der Rücknahme: Rollenhinweis ${i + 1}`, nachher.fenster);
    }
    expect(nachher.hinweise.map((h) => [h.text, h.rechts])).toEqual(
      vorher.hinweise.map((h) => [h.text, h.rechts]),
    );
  }, 180_000);
});
