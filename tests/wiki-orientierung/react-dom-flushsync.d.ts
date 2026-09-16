// JOB 4145 R5 · DIE EINE SIGNATUR, DIE Y1 BRAUCHT: `flushSync`.
//
// Y1 misst den ERSTEN Bildaufbau der Lesefläche und braucht dafür `flushSync` — die Begründung, und
// warum `act` dort gerade nicht taugt, steht im Kopf des Falls. Die gemounteten Tests importieren
// React bewusst RELATIV aus `apps/web/node_modules` (Muster seit WP-D8b); das Paket selbst liefert
// keine Typen, und `tsconfig.tests-tsx.json` bildet nur `react`, `react/jsx-runtime` und
// `react-dom/client` auf die `@types` ab. Ohne diese Zeilen meldet `tools/build`:
// „TS7016: Could not find a declaration file for module '../../apps/web/node_modules/react-dom'"
// (gemessen, Cloud-Lauf a67b509aded8f16fcb21d77d).
//
// DIESELBE LÖSUNG WIE IM HAUS, NUR AN EINEM ANDEREN ORT: für `react-dom/server` steht die gebrauchte
// Signatur seit JOB 3103 ausdrücklich in `tests/types/mounted-react.d.ts` — „kein paths-Eintrag im
// Root, deshalb die eine gebrauchte Signatur ausdrücklich, statt export *". Dort gehört sie auf
// Dauer auch hin; `tests/types/` ist aber KEIN Zielpfad von JOB 4145, und ein Diff ausserhalb der
// Zielpfade ist ungeprüfter Code. Der Umzug dieser drei Zeilen ist eine Zeile Arbeit, sobald ein
// Auftrag die Datei öffnet.
declare module "*apps/web/node_modules/react-dom" {
  export function flushSync(fn: () => void): void;
}
