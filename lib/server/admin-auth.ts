const COOKIE_NAME = 'anyfile_admin';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function encodeBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function sign(value: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not configured');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  );
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ right[i];
  return difference === 0;
}

function cookieValue(request: { headers: Record<string, string | string[] | undefined> }) {
  const cookieHeader = request.headers.cookie;
  const cookieString = Array.isArray(cookieHeader) ? cookieHeader.join(';') : cookieHeader;
  const entry = cookieString?.split(';').map((item) => item.trim())
    .find((item) => item.startsWith(`${COOKIE_NAME}=`));
  return entry?.slice(COOKIE_NAME.length + 1);
}

export async function createAdminCookie(secure: boolean) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = String(expiresAt);
  const signature = encodeBase64Url(await sign(payload));
  const secureAttribute = secure ? '; Secure' : '';
  return `${COOKIE_NAME}=${payload}.${signature}; Path=/; HttpOnly${secureAttribute}; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`;
}

export async function isAdminRequest(request: {
  headers: Record<string, string | string[] | undefined>;
}) {
  const value = cookieValue(request);
  if (!value) return false;
  const [expiresAtString, signature, ...extra] = value.split('.');
  const expiresAt = Number(expiresAtString);
  if (extra.length || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() / 1000 || !signature) {
    return false;
  }
  try {
    return constantTimeEqual(decodeBase64Url(signature), await sign(expiresAtString));
  } catch {
    return false;
  }
}

export function clearAdminCookie(secure: boolean) {
  const secureAttribute = secure ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly${secureAttribute}; SameSite=Strict; Max-Age=0`;
}

export function isSecureRequest(request: {
  headers: Record<string, string | string[] | undefined>;
}) {
  const forwardedProtocol = request.headers['x-forwarded-proto'];
  return (
    process.env.NODE_ENV === 'production' ||
    forwardedProtocol === 'https' ||
    (Array.isArray(forwardedProtocol) && forwardedProtocol.includes('https'))
  );
}

export function secureStringEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  return constantTimeEqual(leftBytes, rightBytes);
}
