import { buildApp } from "./build-app";

// Laufzeit-Einstiegspunkt. Start: `node services/app/src/server.ts` (nach Build).
const app = buildApp();
const port = Number(process.env.PORT ?? "3001");

app
  .listen({ port, host: "0.0.0.0" })
  .then(() => app.log.info(`KLARWERK API läuft auf :${port}`))
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
