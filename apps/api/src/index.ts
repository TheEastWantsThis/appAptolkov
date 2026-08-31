import { createApi } from "./app.js";
import { loadApiConfig } from "./config.js";

const config = loadApiConfig(process.env);
const runtime = createApi(config);
let shutdownPromise: Promise<void> | undefined;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shutdownPromise) return shutdownPromise;

  runtime.setDraining();
  runtime.app.log.info({ signal }, "Graceful shutdown started");

  shutdownPromise = (async () => {
    const forceShutdownTimer = setTimeout(() => {
      runtime.app.log.error("Graceful shutdown timed out");
      process.exitCode = 1;
    }, config.SHUTDOWN_TIMEOUT_MS);
    forceShutdownTimer.unref();

    try {
      await runtime.close();
      runtime.app.log.info("Graceful shutdown completed");
    } finally {
      clearTimeout(forceShutdownTimer);
    }
  })();

  return shutdownPromise;
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await runtime.app.listen({ host: config.API_HOST, port: config.API_PORT });
  runtime.app.log.info({ port: config.API_PORT }, "WatchRoom API is listening");
} catch (error: unknown) {
  runtime.app.log.error(
    { errorType: error instanceof Error ? error.name : "UnknownError" },
    "API startup failed",
  );
  process.exitCode = 1;
  await runtime.close();
}
