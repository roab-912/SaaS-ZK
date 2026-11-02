import { resolve, sep, basename } from 'node:path';
import { tmpdir } from 'node:os';
export function assertCompileDirectory(directory) {
  const absolute = resolve(directory);
  if (
    !absolute.startsWith(resolve(tmpdir()) + sep) ||
    !/^clair-noir-[a-zA-Z0-9]+$/.test(basename(absolute))
  )
    throw Error('Invalid compiler directory.');
  return absolute;
}
