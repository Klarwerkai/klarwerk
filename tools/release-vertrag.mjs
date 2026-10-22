// Ein Pflichtvertrag für lokale Freigabe und CI. Keine pauschale Bestandsausnahme.
export const releaseVertrag = {
  version: 2,
  maxSeconds: 600,
  ciJob: "pflicht",
  stages: [
    { name: "roottyp", command: ["./node_modules/.bin/tsc", "--noEmit", "-p", "tsconfig.json"] },
    {
      name: "webtyp",
      command: ["./node_modules/.bin/tsc", "--noEmit", "-p", "apps/web/tsconfig.json"],
    },
    { name: "lint", command: ["bash", "tools/lint", "--reporter=json", "--max-diagnostics=none"] },
    {
      name: "architecture",
      command: [
        "./node_modules/.bin/depcruise",
        "--config",
        ".dependency-cruiser.cjs",
        "--output-type",
        "json",
        "services",
      ],
    },
    { name: "geheimnis-scan", command: ["bash", "tools/geheimnis-scan.sh"] },
    { name: "test", command: ["./node_modules/.bin/vitest", "run"] },
  ],
  causalTests: [
    "tests/releaseweg/lieferweg.test.ts",
    "tests/releaseweg/vitest-pflicht.test.ts",
    "tests/releaseweg/p3-transport.test.ts",
    "tests/releaseweg/ausnahmen.test.ts",
    "tests/tor-vertrag/pruefvertrag.test.ts",
    "tests/pg-laufbeleg/melder.test.ts",
    "tests/app/ci-check-contract.test.ts",
    "tests/app/job1080-ci-workflow-abgleich.test.ts",
    "tests/deploy-liefernachweis/live-update-liefernachweis.test.ts",
    "tests/kundenbetrieb-betriebsmodelle/abbild-bauen.test.ts",
    "tests/live-check-suchwoerter/begruendung-nennt-die-gebaute-kette.test.ts",
    "tests/bibliothek-historie-vermerk/vermerk-uebersetzung.test.ts",
    "tests/live-check-postgres-prefilter/toter-kandidatenweg.test.ts",
    "tests/entwurf-verlassen/quellenarchiv.test.ts",
  ],
  deferredTests: [
    {
      path: "tests/tor-inventar/lastgrenze-wrapper.test.ts",
      owner: "Root",
      due: "2026-10-23T18:00:00Z",
      reason:
        "Gemischte Volltor-Laufzeitmessung M und echte Vierfork-Kalibrierung K1. Geänderte Zählsemantik wird von den echten synthetischen Ein-Worker-Wrapperfällen geprüft; kein Ganzdatei-Positivclaim.",
      coveredBy: "tests/releaseweg/vitest-pflicht.test.ts",
    },
  ],
  deferred: [
    { name: "Volltor und Browserdiagnosen", owner: "Root", withinHours: 24 },
    {
      name: "Voller PG-Integrationsjob: strenge nachgelagerte Diagnose, kein pauschaler Shipblocker",
      owner: "Root",
      withinHours: 24,
    },
  ],
  exceptionFile: "tools/release-ausnahmen.json",
};
