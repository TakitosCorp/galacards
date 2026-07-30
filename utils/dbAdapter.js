import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { customAlphabet } from "nanoid";

// Configuration and constants section
const random = customAlphabet("abcdefghijklmnopqrstuvwxyz", 6);

function getTempFilename(filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  const dir = path.dirname(filename);
  return path.join(dir, `.${base}.${Date.now()}.${random()}.tmp`);
}

// Adapter section

/**
 * Lowdb adapter that writes to a unique temp file per write then renames.
 * Avoids the EPERM race condition on Windows caused by
 * antivirus/indexing locking steno's fixed-path `.tmp` file.
 *
 * Implements the lowdb adapter interface: read() + write(data).
 */
export class AtomicJSONFile {
  #filename;
  #parse;
  #stringify;

  constructor(filename) {
    this.#filename = filename;
    this.#parse = JSON.parse;
    this.#stringify = (data) => JSON.stringify(data, null, 2);
  }

  async read() {
    let data;
    try {
      data = await readFile(this.#filename, "utf-8");
    } catch (err) {
      if (err.code === "ENOENT") {
        return null;
      }
      throw err;
    }
    return this.#parse(data);
  }

  async write(data) {
    const tmpPath = getTempFilename(this.#filename);
    await writeFile(tmpPath, this.#stringify(data), "utf-8");
    await rename(tmpPath, this.#filename);
  }
}
