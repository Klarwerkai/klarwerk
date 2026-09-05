// @vitest-environment node
// ================================================================================================
// JOB 3084 (Q6) — DER HOOK OHNE `window`: KEIN ABSTURZ, UND KEINE ERFUNDENE NETZTRENNUNG.
// ================================================================================================
//
// DIE PRÜFLÜCKE, gegen die diese Datei steht (Auftrag §8.6): `useNetzOnline` kann in einer Umgebung
// ohne DOM gerufen werden — beim Serverrendern und in jedem Test, der nicht in jsdom läuft. Dort
// gibt es kein `window`, an dem sich ein Onlinezustand ablesen ließe.
//
// WAS DANN GELTEN MUSS, und warum: „offline" wäre in dieser Lage keine Messung, sondern eine
// Erfindung — und ausgerechnet die teurere, denn sie ließe die Auskunft grundlos verstummen. Der
// dritte Parameter von `useSyncExternalStore` (`ohneFenster` in `lib/netzzustand.ts`) antwortet
// deshalb `true`: „über das Netz dieses Geräts ist nichts bekannt, also wird die Aussage nicht an
// ihm aufgehängt" — die Lage entsteht dann wie vor diesem Auftrag allein aus den vier
// Query-Skalaren.
//
// GEMESSEN WIRD DAS AM ECHTEN SERVERRENDERN, nicht behauptet: `renderToStaticMarkup` nimmt in React
// 18 wirklich den `getServerSnapshot`-Zweig. Ein Mount in jsdom könnte diesen Zweig nie erreichen.
import { describe, expect, it } from "vitest";
import { createElement } from "../../apps/web/node_modules/react";
// `react-dom/server` hat in diesem Prüfstand keinen Typ-Shim: `tests/types/mounted-react.d.ts`
// deckt `react` und `react-dom/client` ab, und diese Datei liegt außerhalb der Zielpfade dieses
// Auftrags. Die Zeile ist deshalb ausdrücklich als Typloch markiert statt still umgangen — und die
// Markierung wird von selbst rot, sobald jemand den Shim ergänzt.
// @ts-expect-error — kein Typ-Shim für `react-dom/server` (s. Kommentar darüber)
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { useNetzOnline } from "../../apps/web/src/lib/netzzustand";

function Probe(): JSX.Element {
  return createElement("span", null, useNetzOnline() ? "online" : "offline");
}

describe("JOB 3084 · useNetzOnline() ohne Fenster", () => {
  it("H-1 · KALIBRIERUNG: diese Datei läuft wirklich ohne DOM", () => {
    // Ohne diesen Fall wäre H-2 auch dann grün, wenn die Datei versehentlich in jsdom liefe — dann
    // hätte sie den `getServerSnapshot`-Zweig nie berührt und gar nichts gemessen.
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });

  it("H-2 · das Serverrendern stürzt nicht ab und nimmt „online“ als Vorgabe", () => {
    const markup: string = (renderToStaticMarkup as (el: unknown) => string)(
      createElement(Probe, null),
    );
    expect(markup).toBe("<span>online</span>");
  });
});
