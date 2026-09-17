// ================================================================================================
// JOB 4156 · A2 — JEDE NEU REGISTRIERTE TÜR STEHT IN DER ROLLENABNAHME, EHRLICH.
// ================================================================================================
//
// `tests/beta-rollenabnahme/jede-registrierte-route-ist-abgenommen.test.ts` prüft das für ALLE
// Türen der App und ist der eigentliche Wächter — er wird von diesem Auftrag NICHT angefasst und
// NICHT gelockert. Dieser Fall hier ist enger und dafür schärfer: er fragt nur nach den zehn Türen
// DIESER Gruppe, und er fragt nach ihrem INHALT, nicht nur nach ihrer Anwesenheit.
//
// WARUM DAS NICHT DOPPELT IST. Der grosse Wächter wäre auch dann grün, wenn alle zehn Zeilen
// `NUR_LESEN` trügen — er misst, dass gemessen wird, nicht WAS erwartet wird. Genau dort läge der
// teure Fehler: eine Entscheidungstür mit Leserechten sähe abgenommen aus und wäre offen. Deshalb
// hält dieser Fall die Zuordnung gegen das, was die Route WIRKLICH fordert, gelesen aus ihrem
// Quelltext — nicht gegen eine zweite abgeschriebene Liste.
//
// GEGENPROBE (gefahren, siehe RUECKGABE): eine der zehn Zeilen aus `tabelle.ts` entfernen. Dann
// wird `jede-registrierte-route-ist-abgenommen.test.ts` rot („Diese Türen sind registriert, aber
// die Abnahme sagt über sie nichts") UND der erste Fall hier.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AB_CONTROLLER,
  AB_EXPERTE,
  NUR_LESEN,
  TABELLE,
  registrierteRoute,
} from "../beta-rollenabnahme/tabelle";

const GRUPPE = "gesamtanweisungRoutes";
const QUELLE = readFileSync("services/app/src/routes/gesamtanweisung-routes.ts", "utf8");

const ZEILEN = TABELLE.filter((z) => z.gruppe === GRUPPE);

/**
 * Die Türen, wie sie im Quelltext der Route wirklich stehen — Methode, Pfad und das geforderte
 * Recht, in der Reihenfolge ihres Auftretens.
 *
 * ERHOBEN UND NICHT ABGESCHRIEBEN: eine hier aufgezählte Erwartung wäre am Tag ihrer Entstehung
 * richtig und ab der elften Tür still falsch. Gelesen wird das `app.<verb>(<pfad>` und das
 * `requirePermission("<recht>"` , das ihm als nächstes folgt.
 */
function tuerenAusDemQuelltext(): { methode: string; pfad: string; tor: string }[] {
  const muster =
    /app\.(get|post|put|delete)(?:<[^>]*>)?\(\s*\n?\s*"(\/api\/gesamtanweisungen[^"]*)"/g;
  const treffer = [...QUELLE.matchAll(muster)];
  return treffer.map((m) => {
    const abIndex = m.index ?? 0;
    const rest = QUELLE.slice(abIndex);
    const recht = /requirePermission\("([^"]+)"/.exec(rest);
    expect(recht?.[1], `kein requirePermission nach ${m[2]}`).toBeTruthy();
    return {
      methode: (m[1] ?? "").toUpperCase(),
      pfad: m[2] ?? "",
      tor: recht?.[1] ?? "",
    };
  });
}

describe("A2 · die zehn Türen der Gesamtanweisung in der Rollenabnahme", () => {
  it("jede Tür des Quelltextes hat GENAU EINE Zeile in der Tabelle", () => {
    const tueren = tuerenAusDemQuelltext();
    // Die Zahl steht hier, weil sie sonst still veraltet — und sie ist erhoben, nicht gesetzt.
    expect(tueren.length, "Türen im Quelltext der Route").toBe(10);

    const ausTabelle = ZEILEN.map((z) => `${z.methode} ${registrierteRoute(z)}`).sort();
    const ausQuelle = tueren.map((t) => `${t.methode} ${t.pfad}`).sort();
    expect(ausTabelle).toEqual(ausQuelle);
  });

  it("das in der Tabelle genannte Tor ist das, das die Route wirklich fordert", () => {
    const rechtJeTuer = new Map(
      tuerenAusDemQuelltext().map((t) => [`${t.methode} ${t.pfad}`, t.tor]),
    );
    const abweichungen = ZEILEN.filter(
      (z) => rechtJeTuer.get(`${z.methode} ${registrierteRoute(z)}`) !== z.tor,
    ).map((z) => `${z.methode} ${registrierteRoute(z)}: Tabelle sagt ${z.tor}`);
    expect(
      abweichungen,
      "Eine Zeile, die ein anderes Recht behauptet als die Route fordert, nimmt die falsche Tür ab.",
    ).toEqual([]);
  });

  it("die Erwartung passt zum Recht — Lesen offen, Einreichen ab experte, Entscheiden ab controller", () => {
    // Die EINE Stelle, an der dieser Auftrag sagt, was er für richtig hält. Sie ist kurz genug,
    // um sie zu lesen, und sie hängt an den Vorgaben aus `tabelle.ts`, nicht an eigenen Literalen.
    const erwartungJeTor = {
      "ko.read": NUR_LESEN,
      "ko.create": AB_EXPERTE,
      "ko.validate": AB_CONTROLLER,
    } as const;
    const falsch = ZEILEN.filter(
      (z) => z.erwartet !== erwartungJeTor[z.tor as keyof typeof erwartungJeTor],
    ).map((z) => `${z.methode} ${registrierteRoute(z)} (${z.tor})`);
    expect(
      falsch,
      "Diese Zeilen erwarten etwas anderes, als ihr Rechtetor hergibt — eine Abnahme, die das durchlässt, nimmt nichts ab.",
    ).toEqual([]);
  });

  it("die Entscheidungstür ist NICHT ab experte offen — der Startvertrag, als Zeile", () => {
    const entscheiden = ZEILEN.find((z) => registrierteRoute(z).endsWith("/entscheiden"));
    expect(entscheiden, "die Zeile zur Entscheidungstür fehlt").toBeTruthy();
    expect(entscheiden?.tor).toBe("ko.validate");
    expect(entscheiden?.erwartet.experte).toBe("403");
  });

  it("keine dieser Türen ist zurückgestellt — sie werden gemessen, nicht geführt", () => {
    const ohneNutzlast = ZEILEN.filter(
      (z) => (z.methode === "POST" || z.methode === "PUT") && z.payload === undefined,
    ).map((z) => `${z.methode} ${registrierteRoute(z)}`);
    expect(
      ohneNutzlast,
      "Ein schreibender Weg ohne `payload` schickt gar keinen Körper; die Messung sagt dann über die Rumpfprüfung nichts.",
    ).toEqual([]);
  });
});
