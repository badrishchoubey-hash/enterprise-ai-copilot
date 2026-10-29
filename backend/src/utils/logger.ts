type LogContext = Record<string, unknown>;

const SENSITIVE_KEY =
  /(password|secret|token|authorization|cookie|api[-_]?key|database[-_]?url|connection[-_]?string)/i;
const MAX_STRING_LENGTH = 1_000;

export function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[MAX_DEPTH]";
  if (typeof value === "string")
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…`
      : value;
  if (Array.isArray(value))
    return value.slice(0, 20).map((item) => redactForLog(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 50)
        .map(([key, item]) => [
          key,
          SENSITIVE_KEY.test(key)
            ? "[REDACTED]"
            : redactForLog(item, depth + 1),
        ]),
    );
  }
  return value;
}

const writeLog = (
  level: "info" | "error",
  event: string,
  context: LogContext = {},
): void => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(redactForLog(context) as LogContext),
  };
  (level === "error" ? console.error : console.info)(JSON.stringify(entry));
};

export const logInfo = (event: string, context?: LogContext): void =>
  writeLog("info", event, context);
export const logError = (event: string, context?: LogContext): void =>
  writeLog("error", event, context);
