import * as WordVorschau from "../../../apps/web/src/components/KlaraPathTeaser";
// biome-ignore lint/complexity/useLiteralKeys: BEN-Gegenprobe verlangt genau den Klammerzugriff.
const WordHilfe = WordVorschau["KlaraPathTeaser"];
export function DritteFlaeche() {
  return <WordHilfe surface="capture" />;
}
