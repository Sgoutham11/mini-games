/**
 * Auth Middleware — Telegram initData HMAC-SHA256 Validation
 */

import crypto from 'crypto';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface ParsedInitData {
  user: TelegramUser;
  query_id?: string;
  auth_date: number;
  hash: string;
  [key: string]: unknown;
}

/**
 * Validate Telegram Mini App initData using HMAC-SHA256
 * 
 * Algorithm (from Telegram docs):
 * 1. Create data_check_string by sorting key=value pairs (excluding hash) alphabetically and joining with \n
 * 2. Create secret_key = HMAC-SHA256("WebAppData", bot_token)
 * 3. Create hash = HMAC-SHA256(secret_key, data_check_string)
 * 4. Compare computed hash with the hash from initData
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string
): ParsedInitData | null {
  try {
    if (!initData || !botToken) return null;

    // Parse the URL-encoded initData
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) return null;

    // Build data-check-string: sort params alphabetically, exclude 'hash'
    const dataCheckParts: string[] = [];
    const parsed: Record<string, string> = {};

    params.forEach((value, key) => {
      parsed[key] = value;
      if (key !== 'hash') {
        dataCheckParts.push(`${key}=${value}`);
      }
    });

    dataCheckParts.sort();
    const dataCheckString = dataCheckParts.join('\n');

    // Create secret key: HMAC-SHA256("WebAppData", botToken)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Create verification hash: HMAC-SHA256(secretKey, dataCheckString)
    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Compare hashes
    if (computedHash !== hash) {
      console.warn('[Auth] Invalid initData hash');
      return null;
    }

    // Check auth_date is not too old (allow 24 hours)
    const authDate = parseInt(parsed['auth_date'] || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      console.warn('[Auth] initData expired');
      return null;
    }

    // Parse user object
    let user: TelegramUser | null = null;
    if (parsed['user']) {
      try {
        user = JSON.parse(parsed['user']);
      } catch {
        console.warn('[Auth] Failed to parse user data');
        return null;
      }
    }

    if (!user) return null;

    return {
      user,
      query_id: parsed['query_id'] || undefined,
      auth_date: authDate,
      hash,
    };
  } catch (error) {
    console.error('[Auth] Validation error:', error);
    return null;
  }
}

/**
 * Socket.IO middleware for Telegram auth
 * Extracts and validates initData from handshake auth
 */
export function createAuthMiddleware(botToken: string, devMode: boolean = false) {
  return (socket: any, next: (err?: Error) => void) => {
    const initData = socket.handshake.auth?.initData as string | undefined;
    const devPlayerId = socket.handshake.auth?.devPlayerId as string | undefined;

    // In development mode, allow connections without Telegram auth
    if (devMode && !initData) {
      console.log('[Auth] Dev mode: allowing unauthenticated connection');
      socket.data = {
        telegramUser: null,
        playerId: devPlayerId || `dev_${socket.id}`,
        authenticated: false,
      };
      return next();
    }

    if (!initData) {
      return next(new Error('Missing initData'));
    }

    const parsed = validateTelegramInitData(initData, botToken);

    if (!parsed) {
      return next(new Error('Invalid initData'));
    }

    // Attach parsed data to socket
    socket.data = {
      telegramUser: parsed.user,
      playerId: `tg_${parsed.user.id}`,
      authenticated: true,
    };

    next();
  };
}
