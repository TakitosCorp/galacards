import winston from "winston";
import { SeqTransport } from "@datalust/winston-seq";
import { readFile } from "fs/promises";
import os from "os";

/**
 * Lightweight interpolation for console display
 * SEQ receives timestamps for structured rendering
 */
function interpolate(msg, meta) {
  return msg.replace(/\{(\w+)\}/g, (_, k) =>
    meta[k] !== undefined ? String(meta[k]) : `{${k}}`,
  );
}

/**
 * Short time format for console (HH:MM:SS)
 */
function shortTime(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

const configData = await readFile("./config/config.json", "utf-8");
const config = JSON.parse(configData);

let seqFailureCount = 0;
let seqDisabled = false;
let seqLastErrorLog = 0;
const SEQ_MAX_FAILURES = 5;
const SEQ_ERROR_LOG_INTERVAL = 60_000;

/**
 * Handle SEQ transport errors
 * Disables transport after repeated failures to prevent spam
 */
function handleSeqError(e) {
  seqFailureCount++;
  const code = e?.cause?.code || e?.code || "UNKNOWN";

  if (code === "ECONNREFUSED" && seqFailureCount >= SEQ_MAX_FAILURES) {
    if (!seqDisabled) {
      seqDisabled = true;
      console.warn(
        `[SEQ] Server unreachable after ${SEQ_MAX_FAILURES} attempts — SEQ transport removed`,
      );
      if (seqTransport) logger.remove(seqTransport);
    }
    return;
  }

  const now = Date.now();
  if (now - seqLastErrorLog < SEQ_ERROR_LOG_INTERVAL) return;
  seqLastErrorLog = now;

  const short =
    code === "ECONNREFUSED"
      ? `connection refused (${seqFailureCount}/${SEQ_MAX_FAILURES})`
      : e?.message || String(e);
  console.error(`[SEQ Transport Error] ${short}`);
}

/**
 * Winston logger instance (singleton)
 */
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
            const filteredMeta = Object.fromEntries(
              Object.entries(meta).filter(([k]) => !message.includes(`{${k}}`)),
            );
            const metaStr =
              Object.keys(filteredMeta).length > 0
                ? ` ${JSON.stringify(filteredMeta)}`
                : "";
            return `${shortTime(timestamp)} [${level}] ${rendered}${metaStr}`;
          },
        ),
      ),
    }),
    ...(config.seq?.enabled
      ? [
          new SeqTransport({
            serverUrl: config.seq.serverUrl,
            apiKey: config.seq.apiKey || undefined,
            onError: handleSeqError,
            handleExceptions: true,
            handleRejections: true,
          }),
        ]
      : []),
  ],
});

/**
 * Generic log function
 * message: supports {placeholder} syntax for interpolation
 * prefix: optional tag rendered as [tag] in console and SEQ
 * params: values for interpolation, structured properties in SEQ
 * context: additional structured metadata merged into the event
 */
export function log(level, message, prefix = "", params = {}, context = {}) {
  const taggedMsg = prefix ? `[${prefix}] ${message}` : message;
  const enriched = prefix ? { ...context, tag: prefix } : context;
  logger.log(level, taggedMsg, { ...params, ...enriched });
}

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

/**
 * Create a tagged logger that prefixes messages automatically
 */
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
