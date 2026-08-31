import { rm } from "node:fs/promises";

await Promise.all([
  rm(new URL("../dist/dev-auth.js", import.meta.url), { force: true }),
  rm(new URL("../dist/dev-auth.d.ts", import.meta.url), { force: true }),
]);
