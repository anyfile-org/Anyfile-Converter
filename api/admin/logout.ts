import { clearAdminCookie, isSecureRequest } from '../../lib/server/admin-auth';

interface Request {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface Response {
  status(code: number): Response;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
}

export default function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  res.setHeader('Set-Cookie', clearAdminCookie(isSecureRequest(req)));
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ authenticated: false });
}
