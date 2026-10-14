import {
  createAdminCookie,
  isSecureRequest,
  secureStringEqual,
} from '../../lib/server/admin-auth';

interface Request {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: { username?: unknown; password?: unknown };
}

interface Response {
  status(code: number): Response;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  if (!expectedUsername || !expectedPassword || !sessionSecret) {
    return res.status(503).json({ error: 'Admin authentication is not configured' });
  }

  const username = typeof req.body?.username === 'string' ? req.body.username : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (
    username.length > 128 ||
    password.length > 256 ||
    !secureStringEqual(username, expectedUsername) ||
    !secureStringEqual(password, expectedPassword)
  ) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  try {
    res.setHeader('Set-Cookie', await createAdminCookie(isSecureRequest(req)));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ authenticated: true });
  } catch (error) {
    console.error('Failed to create admin session:', error);
    return res.status(503).json({ error: 'Admin authentication is unavailable' });
  }
}
