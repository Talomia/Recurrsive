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
          error(`Authentication failed: ${body}`);
          process.exit(1);
        }

        const data = (await res.json()) as { token: string; user: { role: string } };
        saveToken(data.token, server);

        success(`Logged in as ${bold(username)} (${data.user.role})`);
        console.log(dim(`  Token saved to ~/.recurrsive/config`));
      } catch (err) {
        error(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
        console.log(dim(`  Is the server running at ${server}?`));
        process.exit(1);
      }
    });

  // ── logout ───────────────────────────────────────────────────────────
  program
    .command('logout')
    .description('Remove saved authentication credentials')
    .action(() => {
      banner();
      header('Logout');
      removeToken();
      success('Logged out. Token removed from ~/.recurrsive/config');
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

        const user = (await res.json()) as { username: string; role: string; email?: string };
        success(`Logged in as ${bold(user.username)}`);
        info(`  Role: ${user.role}`);
        if (user.email) {
          info(`  Email: ${user.email}`);
        }
        console.log(dim(`  Server: ${opts.server}`));
      } catch (err) {
        error(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
