import { neon } from '@neondatabase/serverless';

export interface AnalyticsEvent {
  event_id: string;
  event: string;
  category: string;
  operation: string;
  platform: string;
  app_version: string;
  timestamp: number;
  quantity?: number;
}

export function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }
  return neon(connectionString);
}

export async function ensureAnalyticsSchema() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id BIGSERIAL PRIMARY KEY,
      client_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      event TEXT NOT NULL,
      category TEXT NOT NULL,
      operation TEXT NOT NULL,
      platform TEXT NOT NULL,
      app_version TEXT NOT NULL,
      quantity SMALLINT NOT NULL DEFAULT 1,
      occurred_at TIMESTAMPTZ NOT NULL,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (client_id, event_id)
    )
  `;
  await sql`ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS quantity SMALLINT NOT NULL DEFAULT 1`;
  await sql`CREATE INDEX IF NOT EXISTS analytics_events_occurred_at_idx ON analytics_events (occurred_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS analytics_events_operation_idx ON analytics_events (event, operation)`;
  return sql;
}
