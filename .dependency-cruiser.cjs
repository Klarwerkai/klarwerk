/**
 * Architekturregeln (NDepend-Pendant). Verstöße brechen den Build.
 * Kernregel: Module dürfen nicht in die Interna anderer Module greifen —
 * nur deren öffentliche index.ts ist erlaubt.
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Keine zyklischen Abhängigkeiten.",
      from: {},
      to: { circular: true },
    },
    {
      name: "module-boundaries",
      severity: "error",
      comment: "Cross-Modul-Imports nur über die öffentliche index.ts des Zielmoduls.",
      from: { path: "^services/([^/]+)/.+" },
      to: {
        path: "^services/([^/]+)/.+",
        pathNot: [
          "^services/$1/.+", // gleicher Modulpfad erlaubt
          "^services/[^/]+/index\\.ts$", // öffentliche API erlaubt
        ],
      },
    },
    {
      name: "no-orphans",
      severity: "warn",
      from: { orphan: true, pathNot: ["\\.d\\.ts$", "index\\.ts$", "server\\.ts$"] },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    // Typ-Importe mitverfolgen, damit Modulgrenzen auch für `import type` gelten.
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require"] },
  },
};
