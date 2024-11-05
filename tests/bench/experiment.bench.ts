import { Ansis, blue, cyanBright, green, hex, red } from "ansis";
import { inspect } from "node:util";
import { bench } from "vitest";
import { BuiltinLogger, FlatObject } from "../../src";
import { BuiltinLoggerConfig } from "../../src/builtin-logger";
import { AbstractLogger, isHidden, Severity } from "../../src/logger-helpers";

describe("Experiment for builtin logger", () => {
  interface Context extends FlatObject {
    requestId?: string;
  }

  class Master implements AbstractLogger {
    protected hasColor: boolean;
    protected readonly styles: Record<Severity, Ansis> = {
      debug: blue,
      info: green,
      warn: hex("#FFA500"),
      error: red,
    };

    /** @example new BuiltinLogger({ level: "debug", color: true, depth: 4 }) */
    public constructor(protected config: Partial<BuiltinLoggerConfig>) {
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

    protected print(method: Severity, message: string, meta?: unknown) {
      if (
        this.config.level === "silent" ||
        isHidden(method, this.config.level!)
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
  }

  const master = new Master({ level: "debug" });
  const featured = new BuiltinLogger();

  bench("master", () => {
    return void master.child({});
  });

  bench("featured", () => {
    return void featured.child({});
  });
});
