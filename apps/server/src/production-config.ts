/** Production-only configuration assertions. */

const PLACEHOLDER_PASSWORDS = new Set([
  '',
  'password',
  'postgres',
  'recurrsive',
  'change-me',
  'change_me',
  'change-me-before-deploying',
  'replace-with-a-strong-password',
]);

const PLACEHOLDER_ENCRYPTION_KEYS = new Set([
  'recurrsive-default-encryption-key-32b',
  'change-me',
  'change_me',
  'set_in_easypanel_secret_minimum_32_characters',
]);

/**
 * Refuse to start a production process with an ephemeral or obviously
 * placeholder persistence configuration.
 */
export function assertProductionPersistenceConfig(): void {
  if (process.env['NODE_ENV'] !== 'production') return;

  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('Refusing to start in production: DATABASE_URL must be configured.');
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('Refusing to start in production: DATABASE_URL is not a valid URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('Refusing to start in production: DATABASE_URL must use PostgreSQL.');
  }

  const password = decodeURIComponent(parsed.password).trim().toLowerCase();
  if (PLACEHOLDER_PASSWORDS.has(password) || password.includes('change_me') || password.includes('set_in_easypanel')) {
    throw new Error('Refusing to start in production: DATABASE_URL contains a placeholder password.');
  }

  if ((process.env['GRAPH_PROVIDER'] ?? 'postgresql_age') !== 'postgresql_age') {
    throw new Error('Refusing to start in production: GRAPH_PROVIDER must be postgresql_age.');
  }

  const encryptionKey = process.env['SECRETS_ENCRYPTION_KEY']?.trim() ?? '';
  if (
    encryptionKey.length < 32 ||
    PLACEHOLDER_ENCRYPTION_KEYS.has(encryptionKey.toLowerCase()) ||
    encryptionKey.toLowerCase().includes('set_in_easypanel')
  ) {
    throw new Error(
      'Refusing to start in production: SECRETS_ENCRYPTION_KEY must be a unique random value of at least 32 characters.',
    );
  }

  if (encryptionKey === process.env['JWT_SECRET']) {
    throw new Error('Refusing to start in production: secret encryption and JWT signing keys must be different.');
  }
}
