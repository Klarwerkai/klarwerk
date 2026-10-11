// produkt:20261010:assistenz-name-avatar — DIE MIMIK ÜBER DEM MOTIV DER FIGUR.
//
// Eine Ebene im Koordinatensystem des Basisbilds (`viewBox` 1254 × 1254, deckungsgleich mit dem
// quadratischen Bild in der quadratischen Figur): je Auge ein Lid in der Farbe rund um das Auge und
// eine Mund- bzw. Schnabelöffnung. Ruhend ist beides unsichtbar (`scaleY(0)`) — das Motiv sieht aus
// wie geliefert. Was im jeweiligen Zustand geschieht, steht in `index.css` am Attribut
// `data-zustand` dieser Ebene:
//   bereit      gelegentliches Blinzeln                warten     ruhiges, etwas häufigeres Blinzeln
//   nachdenken  leicht gesenkte Lider, langsamer Wechsel     zuhoeren   offene Augen, kein Lidschlag
//   sprechen    Mund/Schnabel öffnet und schließt sich, solange die Ausgabe spielt
//   ratlos      ungleich gesenkte Lider (fragender Blick)   freude     zusammengezogene Augen
//   fehler      ruhig gesenkter, bedauernder Blick          pause      halb geschlossene Ruhelider
// Bei reduzierter Bewegung bleibt nur der statische Ausdruck (Lidstellung), ohne Lidschlag und ohne
// Mundbewegung; der Zustand steht ohnehin als Text an der Figur.
//
// Motive ohne Gesicht (sachliche Objekte, Ersatzgrafik) bekommen keine Ebene (`mimikGesicht`).
import { MIMIK_RASTER, mimikGesicht } from "../../lib/assistenzMimik";
import type { AssistenzZustand } from "./ausdruck";

/** Lider etwas größer als das Auge, damit Umriss und Wimpern beim Schließen bedeckt sind. */
const LIDRAND = 1.14;

export function AvatarMimik({
  motivId,
  zustand,
  bewegungReduziert,
}: {
  motivId: string | null | undefined;
  zustand: AssistenzZustand;
  /** Die Bewegungseinstellung des Kontos: reduziert → nur statischer Ausdruck. */
  bewegungReduziert: boolean;
}): JSX.Element | null {
  const g = mimikGesicht(motivId);
  if (!g) {
    return null;
  }
  const [links, rechts] = g.augen;
  return (
    <svg
      viewBox={`0 0 ${MIMIK_RASTER} ${MIMIK_RASTER}`}
      aria-hidden="true"
      focusable="false"
      data-testid="klara-mimik"
      data-mimik={motivId ?? ""}
      data-zustand={zustand}
      data-bewegung={bewegungReduziert ? "reduziert" : "standard"}
      data-mund={g.mund.art}
      className="klara-mimik pointer-events-none absolute inset-0 h-full w-full"
    >
      <ellipse
        className="klara-mimik-lid klara-mimik-lid-l"
        cx={links.x}
        cy={links.y}
        rx={links.rx * LIDRAND}
        ry={links.ry * LIDRAND}
        fill={g.lid}
      />
      <ellipse
        className="klara-mimik-lid klara-mimik-lid-r"
        cx={rechts.x}
        cy={rechts.y}
        rx={rechts.rx * LIDRAND}
        ry={rechts.ry * LIDRAND}
        fill={g.lid}
      />
      <ellipse
        className="klara-mimik-mund"
        cx={g.mund.x}
        cy={g.mund.y}
        rx={g.mund.rx}
        ry={g.mund.ry}
        fill={g.mund.farbe}
      />
    </svg>
  );
}
