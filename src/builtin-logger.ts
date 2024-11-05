import { Ansis, blue, cyanBright, green, hex, red } from "ansis";
import { inspect } from "node:util";
import { performance } from "node:perf_hooks";
import { FlatObject, isProduction } from "./common-helpers";
import {
  AbstractLogger,
  isHidden,
  makeNumberFormat,
  Severity,
} from "./logger-helpers";

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
  protected readonly picoFormat = makeNumberFormat("nanosecond", 3);
  protected readonly nanoFormat = makeNumberFormat("nanosecond");
  protected readonly microFormat = makeNumberFormat("microsecond");
  protected readonly milliFormat = makeNumberFormat("millisecond");
  protected readonly secondsFormat = makeNumberFormat("second", 2);
  protected readonly minutesFormat = makeNumberFormat("minute", 2);
  protected readonly config: BuiltinLoggerConfig;
  protected readonly styles: Record<Severity, Ansis> = {
    debug: blue,
    info: green,
    warn: hex("#FFA500"),
    error: red,
  };

  /** @example new BuiltinLogger({ level: "debug", color: true, depth: 4 }) */
  public constructor(config: Partial<BuiltinLoggerConfig> = {}) {
    const {
      color = new Ansis().isSupported(),
      level = isProduction() ? "warn" : "debug",
      depth = 2,
      ctx = {},
    } = config;
    this.config = { color, level, depth, ctx };
  }

  protected prettyPrint(subject: unknown) {
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
    } = this.config;
    if (level === "silent" || isHidden(method, level)) return;
    const output: string[] = [new Date().toISOString()];
    if (requestId) output.push(hasColor ? cyanBright(requestId) : requestId);
    output.push(
      hasColor ? `${this.styles[method](method)}:` : `${method}:`,
      message,
    );
    if (meta !== undefined) output.push(this.prettyPrint(meta));
    if (Object.keys(ctx).length > 0) output.push(this.prettyPrint(ctx));
    console.log(output.join(" "));
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

  protected formatDuration = (ms: number) => {
    if (ms < 1e-6) return this.picoFormat.format(ms / 1e-6);
    if (ms < 1e-3) return this.nanoFormat.format(ms / 1e-6);
    if (ms < 1) return this.microFormat.format(ms / 1e-3);
    if (ms < 1e3) return this.milliFormat.format(ms);
    if (ms < 6e4) return this.secondsFormat.format(ms / 1e3);
    return this.minutesFormat.format(ms / 6e4);
  };

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
        formatter = this.formatDuration.bind(this),
      } = typeof subject === "object" ? subject : { message: subject };
      this.print(
        typeof severity === "function" ? severity(duration) : severity,
        message,
        formatter(duration),
      );
    };
  }
}
