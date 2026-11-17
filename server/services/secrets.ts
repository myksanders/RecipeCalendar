import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

// Secrets the server needs (just the Anthropic API key for now), kept in a
// file only the Mac's user can read. The key is never sent to the browser.
// An ANTHROPIC_API_KEY environment variable wins over the file.

export function createSecretStore(file: string | null) {
  function read(): Record<string, string> {
    if (!file || !existsSync(file)) return {};
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      return {};
    }
  }

  return {
    anthropicKey(): string | undefined {
      return process.env.ANTHROPIC_API_KEY || read().anthropicKey || undefined;
    },
    status() {
      return { configured: !!(process.env.ANTHROPIC_API_KEY || read().anthropicKey), fromEnvironment: !!process.env.ANTHROPIC_API_KEY };
    },
    setAnthropicKey(key: string) {
      if (!file) throw new Error('No place to store the key');
      const data = read();
      if (key) data.anthropicKey = key;
      else delete data.anthropicKey;
      writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
      chmodSync(file, 0o600);
    },
  };
}

export type SecretStore = ReturnType<typeof createSecretStore>;
