import fs from 'fs';

export function isDocker(): boolean {
  return fs.existsSync('/.dockerenv');
}

export function resolveServiceUrl(url: string, dockerHost: string, dockerPort?: string | number): string {
  if (!isDocker()) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      parsed.hostname = dockerHost;
      if (dockerPort !== undefined) {
        parsed.port = String(dockerPort);
      }
      return parsed.toString().replace(/\/$/, '');
    }
  } catch {
    return url.replace(/localhost|127\.0\.0\.1/g, dockerHost);
  }
  return url;
}
