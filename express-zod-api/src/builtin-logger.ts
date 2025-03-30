import ansis from "ansis";
import path from "node:path";
import { inspect } from "node:util";
import { performance } from "node:perf_hooks";
import { FlatObject, isProduction } from "./common-helpers";
import {
  AbstractLogger,
  formatDuration,
  isHidden,
  Severity,
  styles,
} from "./logger-helpers";
import { Worker } from "node:worker_threads";

interface Context extends FlatObject {
  requestId?: string;
}

export interface BuiltinLoggerConfig {
  /**
   * @desc The minimal severity to log or "silent" to disable logging
   * @example "debug" also enables pretty output for inspected entities
   * */
  level: "silent" | "warn" | "info" | "debug";
  /** @desc Enables colors on printed severity and inspected entities */
  color: boolean;
  /**
   * @desc Control how deeply entities should be inspected
   * @example null
   * @example Infinity
   * */
  depth: number | null;
  /**
   * @desc Context: the metadata applicable for each logged entry, used by .child() method
   * @see childLoggerProvider
   * */
  ctx: Context;
  /** @desc Enables asynchronous logging in a dedicated worker thread */
  async: boolean;
}

interface ProfilerOptions {
  message: string;
  /** @default "debug" */
  severity?: Severity | ((ms: number) => Severity);
  /** @default formatDuration - adaptive units and limited fraction */
  formatter?: (ms: number) => string | number;
}

/** @desc Built-in console logger with optional colorful inspections */
export class BuiltinLogger implements AbstractLogger {
  protected readonly config: BuiltinLoggerConfig;
  protected static worker?: Worker;

  /** @example new BuiltinLogger({ level: "debug", color: true, depth: 4 }) */
  public constructor({
    color = ansis.isSupported(),
    level = isProduction() ? "warn" : "debug",
    async = false, // @todo make it isProduction() in v23
    depth = 2,
    ctx = {},
  }: Partial<BuiltinLoggerConfig> = {}) {
    this.config = { color, level, depth, ctx, async };
    BuiltinLogger.worker ??= this.config.async
      ? new Worker(
          // eslint-disable-next-line no-restricted-syntax -- replaced by TSUP
          path.resolve(__dirname, `worker.${process.env.TSUP_EXT || "js"}`), // __dirname enabled by tsup shims
          { workerData: { interval: 500 } },
        )
      : undefined;
  }

  protected format(subject: unknown) {
    const { depth, color: colors, level } = this.config;
    return inspect(subject, {
      depth,
      colors,
      breakLength: level === "debug" ? 80 : Infinity,
      compact: level === "debug" ? 3 : true,
    });
  }

  protected print(method: Severity, message: string, meta?: unknown) {
    const {
      level,
      ctx: { requestId, ...ctx },
      color: hasColor,
      async: isAsync,
    } = this.config;
    if (level === "silent" || isHidden(method, level)) return;
    const output: string[] = [new Date().toISOString()];
    if (requestId) output.push(hasColor ? styles.ctx(requestId) : requestId);
    output.push(
      hasColor ? `${styles[method](method)}:` : `${method}:`,
      message,
    );
    if (meta !== undefined) output.push(this.format(meta));
    if (Object.keys(ctx).length > 0) output.push(this.format(ctx));
    const fn =
      isAsync && BuiltinLogger.worker
        ? BuiltinLogger.worker.postMessage.bind(BuiltinLogger.worker)
        : console.log;
    fn(output.join(" "));
  }

  public debug(message: string, meta?: unknown) {
    this.print("debug", message, meta);
  }

  public info(message: string, meta?: unknown) {
    this.print("info", message, meta);
  }

  public warn(message: string, meta?: unknown) {
    this.print("warn", message, meta);
  }

  public error(message: string, meta?: unknown) {
    this.print("error", message, meta);
  }

  public child(ctx: Context) {
    return new BuiltinLogger({ ...this.config, ctx });
  }

  /**
   * @desc The argument used for instance created by .child() method
   * @see ChildLoggerProvider
   * */
  public get ctx() {
    return this.config.ctx;
  }

  /** @desc Measures the duration until you invoke the returned callback */
  public profile(message: string): () => void;
  public profile(options: ProfilerOptions): () => void;
  public profile(subject: string | ProfilerOptions) {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      const {
        message,
        severity = "debug",
        formatter = formatDuration,
      } = typeof subject === "object" ? subject : { message: subject };
      this.print(
        typeof severity === "function" ? severity(duration) : severity,
        message,
        formatter(duration),
      );
    };
  }
}
