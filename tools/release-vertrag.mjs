// Ein Pflichtvertrag für lokale Freigabe und CI. Keine pauschale Bestandsausnahme.
export const releaseVertrag = {
  version: 1,
  maxSeconds: 600,
  ciJob: "pflicht",
  stages: [
    { name: "roottyp", command: ["./node_modules/.bin/tsc", "--noEmit", "-p", "tsconfig.json"] },
    {
      name: "webtyp",
      command: ["./node_modules/.bin/tsc", "--noEmit", "-p", "apps/web/tsconfig.json"],
    },
    { name: "lint", command: ["bash", "tools/lint"] },
    {
      name: "architecture",
      command: ["./node_modules/.bin/depcruise", "--config", ".dependency-cruiser.cjs", "services"],
    },
    { name: "geheimnis-scan", command: ["bash", "tools/geheimnis-scan.sh"] },
    { name: "test", command: ["./node_modules/.bin/vitest", "run"] },
  ],
  causalTests: [
    "tests/releaseweg/lieferweg.test.ts",
    "tests/releaseweg/vitest-pflicht.test.ts",
    "tests/releaseweg/p3-transport.test.ts",
    "tests/tor-vertrag/pruefvertrag.test.ts",
    "tests/pg-laufbeleg/melder.test.ts",
  ],
  deferred: [
    { name: "Volltor und Browserdiagnosen", owner: "Root", withinHours: 24 },
    { name: "Bestandsrotfälle 1.2", owner: "Root", withinHours: 24 },
  ],
  exceptions: [],
};
