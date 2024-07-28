import { Ansis, blue, cyanBright, green, hex, red } from "ansis";
import { inspect } from "node:util";
import { performance } from "node:perf_hooks";
import type { FlatObject } from "./common-helpers";
import { AbstractLogger, formatDuration, severity } from "./logger-helpers";

interface Context extends FlatObject {
  requestId?: string;
}

export interface BuiltinLoggerConfig {
  /**
   * @desc The minimal severity to log or "silent" to disable logging
   * @example "debug" also enables pretty output for inspected entities
   * */
  level: "silent" | "warn" | "info" | "debug";
  /**
   * @desc Enables colors on printed severity and inspected entities
   * @default Ansis::isSupported()
   * */
  color?: boolean;
  /**
   * @desc Control how deeply entities should be inspected
   * @default 2
   * @example null
   * @example Infinity
   * */
  depth?: number | null;
  /**
   * @desc Context: the metadata applicable for each logged entry, used by .child() method
   * @see childLoggerProvider
   * */
  ctx?: Context;
}

/** @desc Built-in console logger with optional colorful inspections */
export class BuiltinLogger implements AbstractLogger {
  protected timeOrigins: Partial<Record<string, number>> = {};
  protected hasColor: boolean;
  protected readonly styles: Record<keyof AbstractLogger, Ansis> = {
    debug: blue,
    info: green,
    warn: hex("#FFA500"),
    error: red,
  };

  /** @example new BuiltinLogger({ level: "debug", color: true, depth: 4 }) */
  public constructor(protected config: BuiltinLoggerConfig) {
    const { color: hasColor = new Ansis().isSupported() } = config;
    this.hasColor = hasColor;
  }

  protected prettyPrint(subject: unknown) {
    const { depth = 2 } = this.config;
    return inspect(subject, {
      depth,
      colors: this.hasColor,
      breakLength: this.config.level === "debug" ? 80 : Infinity,
      compact: this.config.level === "debug" ? 3 : true,
    });
  }

  protected print(
    method: keyof AbstractLogger,
    message: string,
    meta?: unknown,
  ) {
    if (
      this.config.level === "silent" ||
      severity[method] < severity[this.config.level]
    ) {
      return;
    }
    const { requestId, ...ctx } = this.config.ctx || {};
    const output: string[] = [new Date().toISOString()];
    if (requestId) {
      output.push(this.hasColor ? cyanBright(requestId) : requestId);
    }
    output.push(
      this.hasColor ? `${this.styles[method](method)}:` : `${method}:`,
      message,
    );
    if (meta !== undefined) {
      output.push(this.prettyPrint(meta));
    }
    if (Object.keys(ctx).length > 0) {
      output.push(this.prettyPrint(ctx));
    }
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

  /** @desc Measures the time between two calls of this method with same argument */
  public profile(label: string) {
    const now = performance.now();
    const start = this.timeOrigins[label];
    if (start === undefined) {
      this.timeOrigins[label] = now;
      return;
    }
    delete this.timeOrigins[label];
    this.debug(label, formatDuration(now - start));
  }
}
