import winston from "winston";
import { SeqTransport } from "@datalust/winston-seq";
import { readFile } from "fs/promises";
import os from "os";

// Lightweight interpolation for console display only
// SEQ receives the raw template + properties for structured rendering
function interpolate(msg, meta) {
  return msg.replace(/\{(\w+)\}/g, (_, k) =>
    meta[k] !== undefined ? String(meta[k]) : `{${k}}`,
  );
}

// Short time format for console (HH:MM:SS)
function shortTime(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

// Load config
const configData = await readFile("./config/config.json", "utf-8");
const config = JSON.parse(configData);

// Winston logger instance (singleton)
const logger = winston.createLogger({
  level: config.logging?.level || "debug",
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.timestamp(),
  ),
  defaultMeta: {
    service: "galacards",
    environment: process.env.NODE_ENV || "development",
    hostname: os.hostname(),
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
  },
  transports: [
    // Console transport (always on, for local dev)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({
            timestamp,
            level,
            message,
            tag,
            service,
            environment,
            hostname,
            pid,
            nodeVersion,
            platform,
            ...meta
          }) => {
            const rendered = interpolate(message, meta);
            meta = Object.fromEntries(
              Object.entries(meta).filter(([k]) => !message.includes(`{${k}}`)),
            );
            const metaStr =
              Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
            return `${shortTime(timestamp)} [${level}] ${rendered}${metaStr}`;
          },
        ),
      ),
    }),
    // SEQ transport (conditional)
    ...(config.seq?.enabled
      ? [
          new SeqTransport({
            serverUrl: config.seq.serverUrl,
            apiKey: config.seq.apiKey || undefined,
            onError: (e) => {
              console.error("[SEQ Transport Error]", e);
            },
            handleExceptions: true,
            handleRejections: true,
          }),
        ]
      : []),
  ],
});

// Generic log function
// message supports {placeholder} syntax — e.g. "Hello {name}"
// prefix is an optional tag rendered as [prefix] on console and stored as `tag` in SEQ
// params provides values for interpolation AND becomes structured properties in SEQ
// context is additional structured metadata merged into the event
export function log(level, message, prefix = "", params = {}, context = {}) {
  const taggedMsg = prefix ? `[${prefix}] ${message}` : message;
  const enriched = prefix ? { ...context, tag: prefix } : context;
  logger.log(level, taggedMsg, { ...params, ...enriched });
}

// Level-specific functions
export function error(message, prefix = "", params = {}, context = {}) {
  log("error", message, prefix, params, context);
}

export function warn(message, prefix = "", params = {}, context = {}) {
  log("warn", message, prefix, params, context);
}

export function info(message, prefix = "", params = {}, context = {}) {
  log("info", message, prefix, params, context);
}

export function debug(message, prefix = "", params = {}, context = {}) {
  log("debug", message, prefix, params, context);
}

// Convenience: create a tagged logger that prefixes messages with [Tag]
export function createTaggedLogger(tag) {
  return {
    log: (level, message, params, context) =>
      log(level, message, tag, params, context),
    error: (message, params, context) => error(message, tag, params, context),
    warn: (message, params, context) => warn(message, tag, params, context),
    info: (message, params, context) => info(message, tag, params, context),
    debug: (message, params, context) => debug(message, tag, params, context),
  };
}

export default logger;
