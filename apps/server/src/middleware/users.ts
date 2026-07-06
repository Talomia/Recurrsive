/**
 * @module @recurrsive/server/middleware/users
 *
 * User management module for the Recurrsive API server.
 *
 * Provides CRUD operations for users stored in the SQLite-backed
 * key-value store. Passwords are hashed using the companion
 * {@link @recurrsive/server/middleware/passwords} module. All
 * public-facing functions return {@link PublicUser} objects with
 * password fields stripped.
 *
 * @packageDocumentation
 */

import { generateId, nowISO } from '@recurrsive/core';
import { store } from '../store.js';
import { hashPassword, verifyPassword } from './passwords.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Full user record stored in the database (includes password fields). */
export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  role: 'admin' | 'analyst' | 'viewer';
  displayName: string;
  createdAt: string;
  updatedAt: string;
  authMethod: 'local' | 'sso';
  ssoProvider?: string;
  status: 'active' | 'disabled' | 'pending';
}

/** Public-safe user type that excludes password fields. */
export interface PublicUser {
  id: string;
  username: string;
  email: string;
  role: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  authMethod: string;
  ssoProvider?: string;
  status: string;
}

/** Input for creating a new user. */
export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
  role?: 'admin' | 'analyst' | 'viewer';
  displayName?: string;
}

/** Input for updating an existing user. */
export interface UpdateUserInput {
  username?: string;
  email?: string;
  password?: string;
  role?: 'admin' | 'analyst' | 'viewer';
  displayName?: string;
  status?: 'active' | 'disabled' | 'pending';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Store table name for user records. */
const USERS_TABLE = 'users';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip password fields from a user record to produce a public-safe type.
 *
 * @param user - The full user record.
 * @returns A {@link PublicUser} without password hash or salt.
 */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    authMethod: user.authMethod,
    ssoProvider: user.ssoProvider,
    status: user.status,
  };
}

// ---------------------------------------------------------------------------
// CRUD Operations
// ---------------------------------------------------------------------------

/**
 * Create a new local user.
 *
 * Hashes the password and stores the user record in the `users` table.
 * Throws if the username is already taken.
 *
 * @param input - User creation input.
 * @returns The created user as a {@link PublicUser}.
 */
export async function createUser(input: CreateUserInput): Promise<PublicUser> {
  // Check for duplicate username
  const existing = findUserByUsername(input.username);
  if (existing) {
    throw new Error(`Username '${input.username}' is already taken`);
  }

  const { hash, salt } = await hashPassword(input.password);
  const now = nowISO();
  const id = generateId();

  const user: User = {
    id,
    username: input.username,
    email: input.email,
    passwordHash: hash,
    passwordSalt: salt,
    role: input.role ?? 'viewer',
    displayName: input.displayName ?? input.username,
    createdAt: now,
    updatedAt: now,
    authMethod: 'local',
    status: 'active',
  };

  store.set<User>(USERS_TABLE, id, user);
  return toPublicUser(user);
}

/**
 * Find a user by username.
 *
 * @param username - The username to search for.
 * @returns The full {@link User} record, or `undefined` if not found.
 */
export function findUserByUsername(username: string): User | undefined {
  const allUsers = store.all<User>(USERS_TABLE);
  return allUsers.find((u) => u.username === username);
}

/**
 * Find a user by ID.
 *
 * @param id - The user ID to search for.
 * @returns The full {@link User} record, or `undefined` if not found.
 */
export function findUserById(id: string): User | undefined {
  return store.get<User>(USERS_TABLE, id) ?? undefined;
}

/**
 * Authenticate a user by username and password.
 *
 * Looks up the user by username, verifies the password using scrypt,
 * and returns the public user record if authentication succeeds.
 * Only active users can authenticate.
 *
 * @param username - The username to authenticate.
 * @param password - The plaintext password to verify.
 * @returns The {@link PublicUser} on success, or `null` on failure.
 */
export async function authenticateUser(username: string, password: string): Promise<PublicUser | null> {
  // Try exact username match first, then fall back to email match
  const user = findUserByUsername(username) ?? findUserByEmail(username);
  if (!user) return null;

  // Only active users can log in
  if (user.status !== 'active') return null;

  const valid = await verifyPassword(password, user.passwordHash, user.passwordSalt);
  if (!valid) return null;

  return toPublicUser(user);
}

/**
 * List all users as public-safe records.
 *
 * @returns Array of all {@link PublicUser} records.
 */
export function listUsers(): PublicUser[] {
  const allUsers = store.all<User>(USERS_TABLE);
  return allUsers.map(toPublicUser);
}

/**
 * Update an existing user.
 *
 * If `password` is included in the updates, it will be re-hashed.
 *
 * @param id - The user ID to update.
 * @param updates - Partial user fields to update.
 * @returns The updated {@link PublicUser}, or `null` if user not found.
 */
export async function updateUser(id: string, updates: Partial<UpdateUserInput>): Promise<PublicUser | null> {
  const user = findUserById(id);
  if (!user) return null;

  const now = nowISO();

  if (updates.username !== undefined) user.username = updates.username;
  if (updates.email !== undefined) user.email = updates.email;
  if (updates.role !== undefined) user.role = updates.role;
  if (updates.displayName !== undefined) user.displayName = updates.displayName;
  if (updates.status !== undefined) user.status = updates.status;

  if (updates.password) {
    const { hash, salt } = await hashPassword(updates.password);
    user.passwordHash = hash;
    user.passwordSalt = salt;
  }

  user.updatedAt = now;

  store.set<User>(USERS_TABLE, id, user);
  return toPublicUser(user);
}

/**
 * Soft-delete a user by setting their status to 'disabled'.
 *
 * @param id - The user ID to delete.
 * @returns `true` if the user was found and disabled, `false` otherwise.
 */
export function deleteUser(id: string): boolean {
  const user = findUserById(id);
  if (!user) return false;

  user.status = 'disabled';
  user.updatedAt = nowISO();
  store.set<User>(USERS_TABLE, id, user);
  return true;
}

/**
 * Count the total number of users in the store.
 *
 * @returns The number of user records.
 */
export function countUsers(): number {
  return store.count(USERS_TABLE);
}

/**
 * Find or create a user from SSO assertion data.
 *
 * Looks up existing users by SSO provider + email. If found, returns
 * the existing record. If not found and auto-provisioning is enabled,
 * creates a new user with the SSO identity.
 *
 * @param provider - The SSO provider name (e.g. 'okta', 'auth0').
 * @param email - The user's email from the SAML assertion.
 * @param firstName - First name from the assertion.
 * @param lastName - Last name from the assertion.
 * @param role - Role derived from the assertion/group mapping.
 * @param autoProvision - Whether to auto-create the user if not found.
 * @returns The {@link PublicUser} record, or `null` if not found and auto-provision is disabled.
 */
export async function findOrCreateSSOUser(
  provider: string,
  email: string,
  firstName: string,
  lastName: string,
  role: 'admin' | 'analyst' | 'viewer',
  autoProvision: boolean = true,
): Promise<PublicUser | null> {
  // Look for existing user with this SSO identity
  const allUsers = store.all<User>(USERS_TABLE);
  const existing = allUsers.find(
    (u) => u.authMethod === 'sso' && u.ssoProvider === provider && u.email === email,
  );

  if (existing) {
    // Update role if changed
    if (existing.role !== role) {
      existing.role = role;
      existing.updatedAt = nowISO();
      store.set<User>(USERS_TABLE, existing.id, existing);
    }
    return toPublicUser(existing);
  }

  if (!autoProvision) return null;

  // Auto-provision a new SSO user
  const now = nowISO();
  const id = generateId();
  const displayName = `${firstName} ${lastName}`.trim() || email;
  // Create a username from email (replace non-alphanumeric chars)
  const username = `sso-${provider}-${email.replace(/[^a-zA-Z0-9]/g, '-')}`;

  const user: User = {
    id,
    username,
    email,
    passwordHash: '',
    passwordSalt: '',
    role,
    displayName,
    createdAt: now,
    updatedAt: now,
    authMethod: 'sso',
    ssoProvider: provider,
    status: 'active',
  };

  store.set<User>(USERS_TABLE, id, user);
  return toPublicUser(user);
}

// ---------------------------------------------------------------------------
// Password Reset
// ---------------------------------------------------------------------------

/**
 * Reset a user's password by ID.
 *
 * Hashes the new password and updates the user record.
 *
 * @param id - The user ID whose password should be reset.
 * @param newPassword - The new plaintext password.
 * @returns The updated {@link PublicUser}, or `null` if user not found.
 */
export async function resetUserPassword(id: string, newPassword: string): Promise<PublicUser | null> {
  const user = findUserById(id);
  if (!user) return null;
  const { hash, salt } = await hashPassword(newPassword);
  user.passwordHash = hash;
  user.passwordSalt = salt;
  user.updatedAt = nowISO();
  store.set<User>(USERS_TABLE, id, user);
  return toPublicUser(user);
}

// ---------------------------------------------------------------------------
// Email Lookup
// ---------------------------------------------------------------------------

/**
 * Find a user by email address.
 *
 * @param email - The email to search for.
 * @returns The full {@link User} record, or `undefined` if not found.
 */
export function findUserByEmail(email: string): User | undefined {
  const allUsers = store.all<User>(USERS_TABLE);
  return allUsers.find((u) => u.email === email);
}
