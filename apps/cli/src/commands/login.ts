/**
 * @module @recurrsive/cli/commands/login
 *
 * `recurrsive login` — Authenticate with the Recurrsive server.
 *
 * Prompts for username and password, authenticates against the server's
 * `/api/v1/auth/login` endpoint, and stores the JWT token in
 * `~/.recurrsive/config` for subsequent CLI calls.
 *
 * @packageDocumentation
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import type { Command } from 'commander';
import { API_BASE_URL } from '../config.js';
import {
  banner,
  header,
  success,
  error,
  info,
  bold,
  cyan,
  dim,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Prompt the user for input (optionally hiding the input for passwords). */
function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (hidden && process.stdin.isTTY) {
      // Mute output for password entry
      process.stdout.write(question);
      let input = '';
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf-8');

      const onData = (ch: string) => {
        if (ch === '\n' || ch === '\r' || ch === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          rl.close();
          process.stdout.write('\n');
          resolve(input);
        } else if (ch === '\u007F' || ch === '\b') {
          // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (ch === '\u0003') {
          // Ctrl-C
          process.exit(1);
        } else {
          input += ch;
          process.stdout.write('*');
        }
      };

      process.stdin.on('data', onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

/** Save the auth token to ~/.recurrsive/config. */
function saveToken(token: string, server: string): void {
  const configDir = join(homedir(), '.recurrsive');
  const configPath = join(configDir, 'config');

  // Read existing config if present
  let config: Record<string, unknown> = {};
  try {
    if (existsSync(configPath)) {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    }
  } catch {
    // Start fresh
  }

  // Update token and server
  config['token'] = token;
  config['server'] = server;

  // Ensure directory exists
  mkdirSync(configDir, { recursive: true });

  // Write config
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', {
    mode: 0o600, // Owner read/write only
  });
}

/** Remove the auth token from ~/.recurrsive/config. */
function removeToken(): void {
  const configPath = join(homedir(), '.recurrsive', 'config');

  try {
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      delete config.token;
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', {
        mode: 0o600,
      });
    }
  } catch {
    // Nothing to remove
  }
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

/** Register the `login` and `logout` commands on the program. */
export function registerLoginCommand(program: Command): void {
  // ── login ────────────────────────────────────────────────────────────
  program
    .command('login')
    .description('Authenticate with the Recurrsive server')
    .option('-u, --username <username>', 'Username')
    .option('-s, --server <url>', 'Server URL', API_BASE_URL)
    .action(async (opts: { username?: string; server: string }) => {
      banner();
      header('Login');

      const server = opts.server;
      info(`Server: ${cyan(server)}`);
      console.log('');

      // Prompt for credentials
      const username = opts.username ?? await prompt(`  ${bold('Username')}: `);
      const password = await prompt(`  ${bold('Password')}: `, true);
      console.log('');

      if (!username || !password) {
        error('Username and password are required.');
        process.exit(1);
      }

      // Authenticate
      console.log(dim('  Authenticating...'));
      try {
        const res = await fetch(`${server}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        if (!res.ok) {
          const body = await res.text();
          let message = body;
          try {
            const parsed = JSON.parse(body) as { error?: string; message?: string };
            message = parsed.message ?? parsed.error ?? body;
          } catch {
            // Non-JSON body — use as-is.
          }
          error(`Authentication failed: ${message}`);
          process.exit(1);
        }

        // Server wraps the payload in a { data } envelope.
        const body = (await res.json()) as {
          data?: { token?: string; user?: { role?: string; username?: string } };
        };
        const token = body.data?.token;
        const user = body.data?.user;

        if (!token) {
          error('Server did not return an authentication token.');
          process.exit(1);
        }

        saveToken(token, server);

        const role = user?.role ? ` (${user.role})` : '';
        success(`Logged in as ${bold(user?.username ?? username)}${role}`);
        console.log(dim(`  Token saved to ~/.recurrsive/config`));
      } catch (err) {
        error(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
        console.log(dim(`  Is the server running at ${server}?`));
        process.exit(1);
      }
    });

  // ── setup ────────────────────────────────────────────────────────────
  // First-run bootstrap: creates the first admin user via POST /api/v1/setup,
  // which only succeeds when the server has zero users. Additional users are
  // created by an admin via invites (see the dashboard / invites API).
  program
    .command('setup')
    .description('Create the first admin user (first-run bootstrap) and log in')
    .option('-u, --username <username>', 'Admin username')
    .option('-e, --email <email>', 'Admin email')
    .option('-s, --server <url>', 'Server URL', API_BASE_URL)
    .action(
      async (opts: { username?: string; email?: string; server: string }) => {
        banner();
        header('First-Run Setup');

        const server = opts.server;
        info(`Server: ${cyan(server)}`);
        console.log('');

        // Confirm setup is actually required before prompting.
        try {
          const statusRes = await fetch(`${server}/api/v1/setup/status`);
          if (statusRes.ok) {
            const body = (await statusRes.json()) as {
              data?: { setupRequired?: boolean; hasUsers?: boolean };
            };
            if (body.data?.setupRequired === false) {
              error(
                'Setup has already been completed — this server already has users.',
              );
              console.log(
                dim(
                  '  Use `recurrsive login` to authenticate. Additional users are invite-based (admin-managed).',
                ),
              );
              process.exit(1);
            }
          }
        } catch (err) {
          error(
            `Could not reach the server at ${server}: ${err instanceof Error ? err.message : String(err)}`,
          );
          console.log(dim(`  Is the server running?`));
          process.exit(1);
        }

        const username =
          opts.username ?? (await prompt(`  ${bold('Admin username')}: `));
        const email = opts.email ?? (await prompt(`  ${bold('Admin email')}: `));
        const password = await prompt(`  ${bold('Password')} (min 8 chars): `, true);
        const confirm = await prompt(`  ${bold('Confirm password')}: `, true);
        console.log('');

        if (!username || !email || !password) {
          error('Username, email, and password are all required.');
          process.exit(1);
        }
        if (password.length < 8) {
          error('Password must be at least 8 characters.');
          process.exit(1);
        }
        if (password !== confirm) {
          error('Passwords do not match.');
          process.exit(1);
        }

        console.log(dim('  Creating admin user...'));
        try {
          const res = await fetch(`${server}/api/v1/setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }),
          });

          if (!res.ok) {
            const raw = await res.text();
            let message = raw;
            try {
              const parsed = JSON.parse(raw) as { error?: string; message?: string };
              message = parsed.message ?? parsed.error ?? raw;
            } catch {
              // Non-JSON body — use as-is.
            }
            if (res.status === 409) {
              error(`Setup already completed: ${message}`);
              console.log(dim('  Use `recurrsive login` instead.'));
            } else {
              error(`Setup failed: ${message}`);
            }
            process.exit(1);
          }

          const body = (await res.json()) as {
            data?: { token?: string; user?: { username?: string; role?: string } };
          };
          const token = body.data?.token;
          if (!token) {
            error('Server did not return an authentication token after setup.');
            process.exit(1);
          }

          saveToken(token, server);
          success(
            `Admin user ${bold(body.data?.user?.username ?? username)} created and logged in.`,
          );
          console.log(dim(`  Token saved to ~/.recurrsive/config`));
          console.log('');
          info(
            'Additional users are invite-based — an admin creates them via the dashboard or the invites API.',
          );
        } catch (err) {
          error(
            `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
          );
          process.exit(1);
        }
      },
    );

  // ── logout ───────────────────────────────────────────────────────────
  program
    .command('logout')
    .description('Revoke the current token server-side and remove saved credentials')
    .option('-s, --server <url>', 'Server URL', API_BASE_URL)
    .action(async (opts: { server: string }) => {
      banner();
      header('Logout');

      // Read the saved token so we can revoke it server-side.
      const configPath = join(homedir(), '.recurrsive', 'config');
      let token: string | undefined;
      try {
        if (existsSync(configPath)) {
          const config = JSON.parse(readFileSync(configPath, 'utf-8'));
          token = config.token;
        }
      } catch {
        // No readable config.
      }
      token ??= process.env['RECURRSIVE_TOKEN'];

      if (token) {
        try {
          await fetch(`${opts.server}/api/v1/auth/logout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          // Whether or not revocation succeeds, we remove the local token.
        } catch {
          // Server unreachable — still clear local credentials below.
        }
      }

      removeToken();
      success('Logged out. Token revoked and removed from ~/.recurrsive/config');
    });

  // ── whoami ───────────────────────────────────────────────────────────
  program
    .command('whoami')
    .description('Show the currently authenticated user')
    .option('-s, --server <url>', 'Server URL', API_BASE_URL)
    .action(async (opts: { server: string }) => {
      banner();
      header('Current User');

      // Check for token
      const configPath = join(homedir(), '.recurrsive', 'config');
      let token: string | undefined;
      try {
        if (existsSync(configPath)) {
          const config = JSON.parse(readFileSync(configPath, 'utf-8'));
          token = config.token;
        }
      } catch {
        // No config
      }

      if (!token) {
        token = process.env['RECURRSIVE_TOKEN'];
      }

      if (!token) {
        error('Not logged in. Run `recurrsive login` first.');
        process.exit(1);
      }

      try {
        const res = await fetch(`${opts.server}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          error('Token is invalid or expired. Run `recurrsive login` to re-authenticate.');
          process.exit(1);
        }

        // Server wraps the payload in a { data } envelope.
        const body = (await res.json()) as {
          data?: { username?: string; role?: string; email?: string };
        };
        const user = body.data;
        success(`Logged in as ${bold(user?.username ?? 'unknown')}`);
        if (user?.role) {
          info(`  Role: ${user.role}`);
        }
        if (user?.email) {
          info(`  Email: ${user.email}`);
        }
        console.log(dim(`  Server: ${opts.server}`));
      } catch (err) {
        error(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
