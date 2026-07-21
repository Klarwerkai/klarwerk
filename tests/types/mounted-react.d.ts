// Teil C3: Typ-Shim für die gemounteten React-Tests. Sie importieren react/react-dom BEWUSST
// relativ aus apps/web/node_modules (kein react im Root — etabliertes Muster seit WP-D8b); das
// react-Paket selbst liefert keine Typen (@types/react liegt daneben). Diese Wildcard-Deklarationen
// mappen die Pfad-Importe auf die echten @types (via paths in tsconfig.tests-tsx.json) — NUR für
// den Typecheck; zur Laufzeit löst Vitest die Pfade normal auf.
declare module "*apps/web/node_modules/react" {
  // @types/react exportiert CommonJS-artig (export =) — export * würde die benannten Mitglieder
  // (act/createElement/useState …) verlieren; das Re-Export-Muster muss daher export = sein.
  import * as React from "react";
  export = React;
}
declare module "*apps/web/node_modules/react-dom/client" {
  export * from "react-dom/client";
}
