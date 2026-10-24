import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  beurteile,
  erhebeDatei,
  modalAbgleich,
  quelleAus,
  weitergereichteBefunde,
} from "../../tools/modalgrenze";

const DATEI = "apps/web/src/tutorial/seiten/definitionen.ts";
const TYPEN = "apps/web/src/tutorial/typen.ts";
const definitionen = readFileSync(
  new URL("../../apps/web/src/tutorial/seiten/definitionen.ts", import.meta.url),
  "utf8",
);
const typen = readFileSync(
  new URL("../../apps/web/src/tutorial/typen.ts", import.meta.url),
  "utf8",
);

function befund(quelle: string, vertrag = typen) {
  const quellen = new Map([
    [DATEI, quelleAus(DATEI, quelle)],
    [TYPEN, quelleAus(TYPEN, vertrag)],
  ]);
  const leser = (datei: string) => quellen.get(datei);
  const erhoben = [...quellen.values()].map((q) => erhebeDatei(q, leser));
  return {
    kandidaten: erhoben.flatMap((e) => e.kandidaten),
    rot: [
      ...erhoben.flatMap((e) => e.quelle.leseFehler),
      ...erhoben.flatMap(modalAbgleich),
      ...weitergereichteBefunde(erhoben, leser),
      ...beurteile(erhoben).rot,
    ],
  };
}

describe("Tutorial-Demo · ausdrücklicher Propsvertrag im Modalwächter", () => {
  it("liest den echten Vertrag und hält die entsprechende untypisierte Fixture rot", () => {
    const gebunden = befund(definitionen);
    expect(gebunden.rot).toEqual([]);
    expect(gebunden.kandidaten).toEqual([]);

    // Nur Quellfixture: kein zweiter Produktlauf und kein Ausführen der Demo.
    const ohneTyp = definitionen.replace(
      "Demo: (props: TutorialDemoProps) =>",
      "Demo: (props) =>",
    );
    expect(ohneTyp).not.toBe(definitionen);
    expect(befund(ohneTyp).rot).toEqual([
      `${DATEI}:31 — gespreizte Props „{ ...props, seite }“ in eine nicht lesbare Komponente: ihre Rolle kommt aus dem Parameter einer namenlosen Funktion, deren Aufrufer dieser Sammler nicht findet`,
    ]);
  });

  it("stellt eine über denselben Propsvertrag weitergereichte dialog-role nicht frei", () => {
    const mitRolle = typen.replace(
      "export interface TutorialDemoProps {",
      'export interface TutorialDemoProps {\n  role: "dialog";',
    );
    expect(mitRolle).not.toBe(typen);
    const dialog = befund(definitionen, mitRolle);
    expect(dialog.kandidaten).toEqual([{ datei: DATEI, zeile: 31, art: "role-dialog" }]);
    expect(dialog.rot).toEqual([
      expect.stringContaining(`${DATEI}:31 — role-dialog: mögliche modale Fläche ohne die Modalgrenze`),
    ]);
  });
});
