import { join } from 'node:path';

export function getDataDir() {
  return process.env.DOUDIAN_TOOL_DATA_DIR?.trim() || 'data';
}

export function appDataPath(...segments: string[]) {
  return join(getDataDir(), ...segments);
}
