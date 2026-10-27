/** Wie tools/build: nur das Vite-Kind erhält production; der Aufrufer bleibt unverändert. */
export function productionWebBuildEnv(parent: Readonly<NodeJS.ProcessEnv>): NodeJS.ProcessEnv {
  return { ...parent, NODE_ENV: "production" };
}
