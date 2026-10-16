import { createApp } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db.js";
import { migrate } from "./migrate.js";
import { seedDatabase } from "./seed/seed.js";
import { refreshSampleDates } from "./seed/refresh.js";

async function main() {
  await migrate((m) => console.log(`[migrate] ${m}`));

  // Demo convenience: an empty database gets the sample catalogue, and the sample calendar is
  // re-anchored to today so a live demo never shows only past events.
  if (process.env.AUTO_SEED !== "false") {
    const seeded = await seedDatabase({ log: (m) => console.log(`[seed] ${m}`) });
    if (!seeded) {
      const shifted = await refreshSampleDates();
      if (shifted) console.log(`[seed] shifted sample dates by ${shifted} day(s)`);
    }
  }

  const app = createApp();
  const server = app.listen(config.PORT, () => console.log(`EventBoard API listening on :${config.PORT}`));

  const shutdown = () => {
    server.close(() => pool.end().finally(() => process.exit(0)));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
