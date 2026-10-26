// Kontrollierter Portbeleg: kein Import des Produkteinstiegs, keine Ports, keine Datenbank.
import { registriereServerSignale, serverLifecycle } from "../../services/app/src/server-lifecycle";
const halten = setInterval(() => {}, 1000);
let fertig!: () => void;
const arbeit = new Promise<void>((resolve) => {
  fertig = resolve;
});
const lifecycle = serverLifecycle({
  closeApp: async () => {
    process.stdout.write("HTTP_ENDE\n");
    fertig();
  },
  workerIdle: async () => {
    process.stdout.write("WORKER_ENDE\n");
  },
  closePool: async () => {
    process.stdout.write("POOL_ENDE\n");
    clearInterval(halten);
    abmelden();
  },
});
lifecycle.takt({
  stop: () => {
    process.stdout.write("TAKT_AUS\n");
  },
});
lifecycle.verfolge(
  arbeit.then(() => {
    process.stdout.write("ARBEIT_ENDE\n");
  }),
);
const abmelden = registriereServerSignale(process, lifecycle.beende, () => {
  process.exitCode = 1;
  clearInterval(halten);
});
process.stdout.write("BEREIT\n");
