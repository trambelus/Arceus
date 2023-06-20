import fs from 'fs';
import path from 'path';

/**
 * Recursively searches the given directory for index.ts files
 * @param dir The directory to search for files in
 * @returns An array of file paths to index.ts files
 */
export async function* getFilePaths(dir: string): AsyncGenerator<string> {
    const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
        const res = path.resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            yield* getFilePaths(res);
        } else if (res.endsWith('.js')) {
            yield res;
        }
    }
}
