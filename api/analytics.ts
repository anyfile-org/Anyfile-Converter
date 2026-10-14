import { ensureAnalyticsSchema, AnalyticsEvent } from '../lib/server/database';

interface Request {
  method?: string;
  body?: {
    client_id?: unknown;
    events?: unknown;
  };
}

interface Response {
  status(code: number): Response;
  json(body: unknown): void;
}

const ALLOWED_CATEGORIES = new Set(['tool', 'app', 'system']);
const ALLOWED_OPERATIONS = new Set([
  'image.jpg_to_png',
  'image.png_to_jpg',
  'image.compress',
  'image.to_webp',
  'image.to_avif',
  'image.demo_convert',
  'pdf.merge',
  'pdf.split',
  'video.extract_audio',
  'archive.create_zip',
  'archive.extract_zip',
  'button.download_latest',
  'button.github_repo',
  'button.view_releases',
  'button.web_app_open',
  'button.try_demo',
]);

function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<AnalyticsEvent> & { timestamp?: unknown };
  const timestamp = Number(event.timestamp);
  const now = Math.floor(Date.now() / 1000);

  return (
    typeof event.event === 'string' &&
    ['button_clicked', 'operation_completed'].includes(event.event) &&
    typeof event.category === 'string' &&
    ALLOWED_CATEGORIES.has(event.category) &&
    typeof event.operation === 'string' &&
    ALLOWED_OPERATIONS.has(event.operation) &&
    typeof event.platform === 'string' &&
    ['windows', 'web'].includes(event.platform) &&
    typeof event.app_version === 'string' &&
    event.app_version.length <= 32 &&
    typeof event.timestamp === 'number' &&
    (event.quantity === undefined ||
      (Number.isInteger(event.quantity) && Number(event.quantity) >= 1 && Number(event.quantity) <= 1000)) &&
    Number.isFinite(timestamp) &&
    timestamp >= now - 60 * 60 * 24 * 30 &&
    timestamp <= now + 60 * 60
  );
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const clientId = req.body?.client_id;
  const events = req.body?.events;
  if (typeof clientId !== 'string' || clientId.length < 8 || clientId.length > 128) {
    return res.status(400).json({ error: 'Missing or invalid client_id' });
  }
  if (!Array.isArray(events) || events.length === 0 || events.length > 100) {
    return res.status(400).json({ error: 'events must contain between 1 and 100 items' });
  }
  if (!events.every(isAnalyticsEvent)) {
    return res.status(400).json({ error: 'One or more analytics events are invalid' });
  }

  try {
    const sql = await ensureAnalyticsSchema();
    const rows = events.map((event) => ({
      event_id: typeof event.event_id === 'string' && event.event_id.length <= 128
        ? event.event_id
        : crypto.randomUUID(),
      event: event.event,
      category: event.category,
      operation: event.operation,
      platform: event.platform,
      app_version: event.app_version,
      quantity: event.quantity ?? 1,
      event_timestamp: event.timestamp,
    }));
    await sql`
      INSERT INTO analytics_events (
        client_id, event_id, event, category, operation, platform, app_version, quantity, occurred_at
      )
      SELECT
        ${clientId}, event_id, event, category, operation, platform, app_version, quantity,
        to_timestamp(event_timestamp)
      FROM json_to_recordset(${JSON.stringify(rows)}::json) AS event_rows(
        event_id TEXT,
        event TEXT,
        category TEXT,
        operation TEXT,
        platform TEXT,
        app_version TEXT,
        quantity SMALLINT,
        event_timestamp DOUBLE PRECISION
      )
      ON CONFLICT (client_id, event_id) DO NOTHING
    `;
    return res.status(202).json({ status: 'accepted', received_events: events.length });
  } catch (error) {
    console.error('Failed to store analytics events:', error);
    return res.status(503).json({ error: 'Analytics storage is unavailable' });
  }
}
