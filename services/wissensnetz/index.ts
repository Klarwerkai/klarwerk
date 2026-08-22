// Oeffentliche API des Wissensnetz-Moduls — ABSICHTLICH SCHMAL.
//
// WAS HIER NICHT STEHT, IST FUER ANDERE MODULE UNERREICHBAR (`.dependency-cruiser.cjs`, Regel
// `module-boundaries`, severity "error"). Nicht hier stehen deshalb:
//
//   · `LesemodellService`  — sonst koennte ein Consumer `sicht({ sichtbar: () => true })` bauen
//   · `WissensnetzSicht`   — der Eingabetyp jeder Auswertung
//   · `sichtmetrik` und JEDE Huelle darum, gleich wie sie heisst und ob sie sync oder async ist
//
// Ein Consumer kann damit weder eine ungefilterte Sicht erzeugen noch eine vorhandene auswerten.
// Oeffentlich ist nur der ERGEBNISTYP: aus einer `Sichtmetrik` laesst sich keine Sicht
// rekonstruieren.
export { wissensnetzLuecken } from "./src/luecken-einstieg";
export type { Sichtmetrik, ThemenMetrik } from "./src/luecken";
export type { Betrachter } from "./src/policy-naht";
