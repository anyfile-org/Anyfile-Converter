import { isAdminRequest } from '../lib/server/admin-auth';
import { ensureAnalyticsSchema } from '../lib/server/database';

interface Request {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: { page?: string | string[] };
}

interface Response {
  status(code: number): Response;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    if (!(await isAdminRequest(req))) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sql = await ensureAnalyticsSchema();
    const requestedPage = Array.isArray(req.query?.page) ? req.query.page[0] : req.query?.page;
    const parsedPage = Number.parseInt(requestedPage ?? '1', 10);
    const page = Math.min(1_000_000, Math.max(1, Number.isSafeInteger(parsedPage) ? parsedPage : 1));
    const pageSize = 100;
    const offset = (page - 1) * pageSize;
    const [totals, buttonClicks, toolUsage, versions, recentEvents, eventCount] = await Promise.all([
      sql`
        SELECT
          COUNT(*) FILTER (WHERE event = 'button_clicked')::int AS total_button_clicks,
          COALESCE(SUM(quantity) FILTER (WHERE event = 'operation_completed'), 0)::int AS total_actions,
          COUNT(*) FILTER (WHERE operation = 'button.download_latest')::int AS downloads,
          COUNT(*) FILTER (WHERE operation = 'button.github_repo')::int AS github_visits
        FROM analytics_events
      `,
      sql`
        SELECT operation, SUM(quantity)::int AS count
        FROM analytics_events
        WHERE event = 'button_clicked'
        GROUP BY operation
        ORDER BY count DESC
      `,
      sql`
        SELECT operation, SUM(quantity)::int AS count
        FROM analytics_events
        WHERE event = 'operation_completed'
        GROUP BY operation
        ORDER BY count DESC
      `,
      sql`
        SELECT app_version AS version, COUNT(*)::int AS clients
        FROM (
          SELECT DISTINCT ON (client_id) client_id, app_version
          FROM analytics_events
          WHERE platform = 'windows'
          ORDER BY client_id, occurred_at DESC
        ) latest_client_versions
        GROUP BY app_version
        ORDER BY clients DESC, version DESC
      `,
      sql`
        SELECT id, event, category, operation, platform, app_version,
          quantity, FLOOR(EXTRACT(EPOCH FROM occurred_at))::bigint AS timestamp
        FROM analytics_events
        ORDER BY occurred_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      sql`SELECT COUNT(*)::int AS count FROM analytics_events`,
    ]);

    const versionTotal = versions.reduce((sum, item) => sum + Number(item.clients), 0);
    const total = totals[0] ?? {};
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      totals: {
        totalButtonClicks: Number(total.total_button_clicks ?? 0),
        totalActions: Number(total.total_actions ?? 0),
        downloads: Number(total.downloads ?? 0),
        githubVisits: Number(total.github_visits ?? 0),
      },
      buttonClicks: buttonClicks.map((item) => ({
        operation: item.operation,
        count: Number(item.count),
      })),
      toolUsage: toolUsage.map((item) => ({
        operation: item.operation,
        count: Number(item.count),
      })),
      versions: versions.map((item) => ({
        version: item.version,
        clients: Number(item.clients),
        percentage: versionTotal
          ? Math.round((Number(item.clients) / versionTotal) * 100)
          : 0,
      })),
      events: recentEvents.map((item) => ({
        ...item,
        id: Number(item.id),
        timestamp: Number(item.timestamp) * 1000,
      })),
      eventCount: Number(eventCount[0]?.count ?? 0),
      eventPage: page,
      eventPageSize: pageSize,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to read analytics dashboard data:', error);
    return res.status(503).json({ error: 'Analytics storage is unavailable' });
  }
}
