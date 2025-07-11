
import { defineConfig } from 'drizzle-kit';
import "dotenv/config";
export default defineConfig({
  out: './drizzle',
  schema: './src/db/message_schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
