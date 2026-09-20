// ================================================================================================
// JOB 4362 · DER MENÜWEG ZUR GESAMTANWEISUNG GEHT AUCH OHNE MAUS — GEMESSEN IM ECHTEN CHROMIUM.
// ================================================================================================
//
// DIE LÜCKE, GEGEN DIE DIESE DATEI STEHT, hat JOB 4309 selbst benannt (4309 R1, REST Punkt 2): der
// Menüweg zur Gesamtanweisung war ausschliesslich per KLICK belegt. Ein Mensch, der nur die
// Tastatur benutzt, hatte dafür keinen Nachweis — und ein Weg, der nur mit der Maus geht, ist für
// ihn kein Weg.
//
// WAS DIESE DATEI LEISTET, UND ZWAR DAUERHAFT IM TOR: sie fährt den Weg ab `/start` in DREI
// Sprachen, in je einem frischen Browserprofil, ohne einen einzigen Mausklick — Tab, sichtbarer
// Fokus, Enter. Sie braucht dafür KEINE Datenbank: die echte Fastify-Instanz läuft mit den
// Speicherfassungen (`starteStrecke(mitFlaeche())`), liefert die GEBAUTE Fläche aus und horcht auf
// einem echten Port. Damit läuft sie in der Browser-Gruppe des Tors mit und nicht nur dort, wo
// jemand eine PostgreSQL bereitgestellt hat (so wie der Schwesterlauf aus JOB 4323).
//
// KEIN ÜBERSPRUNG, NIRGENDS. In dieser Datei steht kein `ctx.skip()`. Fehlt `apps/web/dist`, wird
// der Lauf ROT mit Handlungsanweisung (`starteChromium`, `browserweg.ts:421-433`) — im Tor läuft
// `./tools/build` davor (`tools/check:9`). Ein stiller Übersprung sähe aus wie ein bestandener Lauf.
//
// DIE ROLLE IST DIE ECHTE: der Menüpunkt verlangt `minRole: "experte"` (`navigation.ts:205`), und
// dieser Lauf meldet sich als der Administrator der Ersteinrichtung an — der Weg, den ein Betreiber
// wirklich geht. Eine Betrachterin sähe den Punkt nicht, und das ist die Rechtelage und nicht ein
// Mangel dieses Weges; sie steht seit JOB 4309 in `a1-tuer-in-der-gebauten-app.test.ts`.
//
// WAS HIER NICHT GEMESSEN WIRD und deshalb nirgends behauptet: andere Browser, der Word-Add-in-Host,
// Bildschirmleser, echte PostgreSQL, ein echter Prozesswechsel (JOB 4323) und die Bedienung der
// Gesamtanweisungsseite selbst. Dieser Nachweis endet an ihrer Schwelle.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Sprache } from "../../services/auth/src/meldungen";
import {
  type Browser,
  type Kontext,
  type Seite,
  fn,
  mitFlaeche,
  starteChromium,
  warte,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT, type Strecke, ersteinrichtung, starteStrecke } from "../gast-nutzerweg/strecke";
import { meldeAnMitTastatur, stelleFlaecheBereit } from "../gesamtanweisung-nutzerweg/weg";
import {
  ARIA_STAND,
  BEREICHE,
  EINTRAG,
  FLAECHENSPRACHE,
  FLAECHE_STEHT_AUF,
  GESAMTANWEISUNG_PFAD,
  IM_DOKUMENT,
  MARKE,
  type Menuebefund,
  SPRACHEN,
  type Sollwerte,
  ZAHNRAD,
  escapeSchliesstUndGibtFokusZurueck,
  keinVersteckterTabstopp,
  klappeBereicheAuf,
  menuetext,
  menuewegOhneMaus,
  nachbarpunkteBleibenErreichbar,
  oeffneZahnrad,
  profilFuer,
  sollwerte,
} from "./weg";

const ADMIN = "tastaturweg-admin@gesamtanweisung-4362.test";

let strecke: Strecke | undefined;
let browser: Browser | undefined;

beforeAll(async () => {
  // Ein fehlendes `apps/web/dist` ist ein AUFBAUFEHLER und kein Grund zum Überspringen:
  // `stelleFlaecheBereit` baut die Fläche oder scheitert laut. Im Tor läuft `./tools/build`
  // davor (`tools/check:9`), dann meldet der Aufruf „war schon da" und kostet nichts.
  process.stderr.write(`${MARKE}: gebaute Fläche — ${stelleFlaecheBereit()}\n`);
  browser = await starteChromium();
  strecke = await starteStrecke(mitFlaeche());
  await ersteinrichtung(strecke, ADMIN);
}, 900_000);

afterAll(async () => {
  await browser?.close();
  await strecke?.schliessen();
}, 60_000);

function zeug(): { browser: Browser; strecke: Strecke } {
  if (!browser || !strecke) {
    throw new Error(`${MARKE}: Browser oder Strecke fehlen — der Aufbau ist nicht durchgelaufen.`);
  }
  return { browser, strecke };
}

/**
 * Ein angemeldetes Profil in dieser Sprache, stehend auf `/start`.
 *
 * DIE ANMELDUNG GEHT SELBST ÜBER DIE TASTATUR (`meldeAnMitTastatur`): würde sie geklickt, hinge
 * der ganze Weg darunter an einem Mausklick — genau die Halbheit, an der JOB 4223 R1 gescheitert
 * ist. Dass die Fläche danach in der gewählten Sprache steht, wird eigens nachgemessen: ein
 * fremdsprachiger Sollwert, der auf einer deutschen Fläche geprüft würde, wäre sofort rot, aber
 * aus dem falschen Grund.
 */
async function angemeldetAufStart(
  sprache: Sprache,
): Promise<{ kontext: Kontext; seite: Seite; soll: Sollwerte }> {
  const { browser: b, strecke: s } = zeug();
  const { kontext, seite } = await profilFuer(b, sprache);
  await meldeAnMitTastatur(seite, s.basis, ADMIN, PASSWORT);
  await seite.goto(`${s.basis}/start`, { waitUntil: "domcontentloaded" });
  // GEWARTET, nicht einmal hingesehen: `i18n` setzt `<html lang>` beim Anlauf der Fläche, und ein
  // einzelner Blick darauf wäre unter Last ein Wettlauf (Runde 2, dieselbe Fehlerklasse wie bei der
  // nachgeladenen Route). Die Zusicherung danach bleibt — sie benennt beim Scheitern die gelesene
  // Sprache, während `warte` nur „nicht eingetreten" sagen könnte.
  await warte(
    seite,
    FLAECHE_STEHT_AUF,
    `die Fläche des Profils steht auf „${sprache}"`,
    sprache,
    45_000,
  );
  const stand = await seite.evaluate<string>(fn(FLAECHENSPRACHE));
  expect(
    stand,
    `${MARKE}: die Fläche steht nicht auf „${sprache}" (gelesen: „${stand}") — dann prüften die Sollwerte darunter die falsche Sprache`,
  ).toBe(sprache);
  return { kontext, seite, soll: sollwerte(sprache) };
}

describe("JOB 4362 · der Menüweg zur Gesamtanweisung ohne Maus, im echten Chromium, in drei Sprachen", () => {
  for (const sprache of SPRACHEN) {
    it(`K1/K2/K3 (${sprache}) — ab /start per Tab und Enter: Zahnrad → „Bereiche" → „Gesamtanweisungen" → die Seite steht; Escape gibt den Fokus zurück`, async () => {
      const { kontext, seite, soll } = await angemeldetAufStart(sprache);
      const { strecke: s } = zeug();
      try {
        // ══ K2 · VOR DEM AUFKLAPPEN: kein versteckter Tab-Stopp. ════════════════════════════
        //
        // Zuerst, und auf einer frisch geladenen Seite: danach ist das Untermenü aufgeklappt,
        // und die Frage „liegt er VORHER in der Reihe" wäre nicht mehr stellbar.
        await oeffneZahnrad(seite, sprache);
        const vorher = await keinVersteckterTabstopp(seite, soll.eintrag, sprache);
        expect(
          vorher.imMenue.length,
          `${MARKE}: der Gang durch das geschlossene Menü (${sprache}) hat zu wenige Halte gesehen`,
        ).toBeGreaterThanOrEqual(3);

        // ══ K1 · DER GANZE WEG, auf einer frischen Seite — der Gang oben hat den Fokus verstellt.
        await seite.goto(`${s.basis}/start`, { waitUntil: "domcontentloaded" });
        const befund: Menuebefund = await menuewegOhneMaus(seite, soll, sprache);

        // Jede Station wurde per Tab erreicht — eine Null wäre ein nie gegangener Weg, und die
        // Stationen hätten vorher geworfen.
        for (const [was, schritte] of Object.entries({
          zahnrad: befund.zahnrad,
          bereiche: befund.bereiche,
          eintrag: befund.eintrag,
        })) {
          expect(
            schritte,
            `${MARKE}: „${was}" wurde in „${sprache}" nicht per Tab erreicht`,
          ).toBeGreaterThan(0);
        }
        expect(befund.href).toBe(GESAMTANWEISUNG_PFAD);
        expect(
          befund.beschriftung,
          `${MARKE}: der Menüpunkt trug in „${sprache}" nicht „${soll.eintrag}"`,
        ).toContain(soll.eintrag);
        expect(befund.seite.pfad).toBe(GESAMTANWEISUNG_PFAD);
        expect(
          befund.seite.ueberschrift,
          `${MARKE}: die Seitenüberschrift lautet in „${sprache}" nicht „${soll.eintrag}"`,
        ).toContain(soll.eintrag);

        // ══ K3 · ESCAPE — schliessen, Fokus sichtbar zurück, Nachbarn weiter erreichbar. ═════
        //
        // Auf der neuen Seite, nicht auf `/start`: so ist auch belegt, dass das Menü dort
        // ebenso bedienbar ist, wo der Weg endet.
        await oeffneZahnrad(seite, sprache);
        await escapeSchliesstUndGibtFokusZurueck(seite, sprache);

        await oeffneZahnrad(seite, sprache);
        const nachbarn = await nachbarpunkteBleibenErreichbar(
          seite,
          [
            { text: soll.seitenhilfe, selektor: '[data-testid="zahnrad-seitenhilfe"]' },
            { text: soll.bereiche, selektor: BEREICHE },
            { text: soll.schnellnavigation, selektor: '[data-testid="zahnrad-schnellnavigation"]' },
            { text: soll.hilfe, selektor: '[data-testid="zahnrad-hilfe"]' },
          ],
          sprache,
        );
        expect(
          Object.keys(nachbarn).sort(),
          `${MARKE}: nicht alle Nachbarpunkte des Menüs waren in „${sprache}" erreichbar`,
        ).toEqual([soll.seitenhilfe, soll.bereiche, soll.schnellnavigation, soll.hilfe].sort());

        // Und das Menü trägt seine Punkte SICHTBAR — nicht nur im DOM.
        const text = await menuetext(seite);
        for (const erwartet of [
          soll.seitenhilfe,
          soll.bereiche,
          soll.schnellnavigation,
          soll.hilfe,
        ]) {
          expect(
            text,
            `${MARKE}: „${erwartet}" steht in „${sprache}" nicht sichtbar im Menü (sichtbar: ${text})`,
          ).toContain(erwartet);
        }
      } finally {
        await kontext.close();
      }
    }, 600_000);
  }

  it("K2b — nach Enter auf „Bereiche“ trägt das Untermenü aria-expanded=true, und erst DANN liegt der Punkt in der Tab-Reihenfolge", async () => {
    const { kontext, seite, soll } = await angemeldetAufStart("de");
    try {
      await oeffneZahnrad(seite, "de");
      // VORHER: weder im Dokument noch als Tab-Halt im Menü.
      const vorher = await keinVersteckterTabstopp(seite, soll.eintrag, "de");
      expect(vorher.imDokument).toBe(false);
      expect(vorher.treffer).toEqual([]);

      // Der Gang oben hat den Fokus aus dem Menü getragen; der Tab-Weg beginnt deshalb wieder am
      // Dokumentanfang (`vonVorn`) — sonst hinge seine Zählung an der Vorgeschichte des Gangs.
      // Das MENÜ ist dabei unverändert offen: geschlossen hätte `mussSichtbarTragen` geworfen.
      const schritte = await klappeBereicheAuf(seite, soll.bereiche, "de", 30_000, true);
      expect(schritte, `${MARKE}: „${soll.bereiche}" wurde nicht per Tab erreicht`).toBeGreaterThan(
        0,
      );

      // NACHHER: aria-expanded=true UND der Punkt steht im Dokument. Dass er danach auch in der
      // TAB-REIHENFOLGE liegt, misst der Weg selbst (`waehleGesamtanweisungen` ertabbt ihn).
      expect(
        await seite.evaluate<string>(fn(ARIA_STAND), BEREICHE),
        `${MARKE}: „${soll.bereiche}" sagt sein Aufklappen nicht an — für einen Bildschirmleser bliebe es zu`,
      ).toBe("true");
      expect(
        await seite.evaluate<boolean>(fn(IM_DOKUMENT), EINTRAG),
        `${MARKE}: der Menüpunkt steht nach dem Aufklappen nicht im Dokument`,
      ).toBe(true);
    } finally {
      await kontext.close();
    }
  }, 600_000);

  it("K3b — das Zahnrad selbst ist der erste Tab-Halt des Weges und trägt seinen sichtbaren Fokus", async () => {
    const { kontext, seite } = await angemeldetAufStart("de");
    try {
      // `oeffneZahnrad` misst beides: Tab-Erreichbarkeit UND sichtbaren Fokus, und öffnet dann.
      const schritte = await oeffneZahnrad(seite, "de");
      expect(
        schritte,
        `${MARKE}: das Zahnrad ${ZAHNRAD} wurde nicht per Tab erreicht`,
      ).toBeGreaterThan(0);
      await escapeSchliesstUndGibtFokusZurueck(seite, "de");
    } finally {
      await kontext.close();
    }
  }, 600_000);
});
