import type { z } from "zod";
import type { Intact, Remap } from "./remap.ts";

declare module "zod/v4/core" {
  interface GlobalMeta {
    default?: unknown; // can be an actual value or a label like "Today"
    examples?: unknown[]; // see zod commit ee5615d
  }
}

/**
 * @fileoverview Zod Runtime Plugin
 * @see https://github.com/colinhacks/zod/blob/90efe7fa6135119224412c7081bd12ef0bccef26/plugin/effect/src/index.ts#L21-L31
 * @desc This code modifies and extends zod's functionality immediately when importing the plugin.
 * @desc Enables .example() and .deprecated() on all schemas (ZodType)
 * @desc Enables .label() on ZodDefault
 * @desc Enables .remap() on ZodObject
 * @desc Stores the argument supplied to .brand() on all schemas (runtime distinguishable branded types)
 * */
declare module "zod" {
  interface ZodType<
    out Output = unknown,
    out Input = unknown,
    out Internals extends z.core.$ZodTypeInternals<
      Output,
      Input
    > = z.core.$ZodTypeInternals<Output, Input>,
  > extends z.core.$ZodType<Output, Input, Internals> {
    /** @desc Shorthand for .meta({ examples }) */
    example(example: z.output<this>): this;
    deprecated(): this;
  }
  interface ZodDefault<T extends z.core.SomeType = z.core.$ZodType>
    extends z._ZodType<z.core.$ZodDefaultInternals<T>>,
      z.core.$ZodDefault<T> {
    /** @desc Shorthand for .meta({ default }) */
    label(label: string): this;
  }
  interface ZodObject<
    // @ts-expect-error -- external issue
    out Shape extends z.core.$ZodShape = z.core.$ZodLooseShape,
    out Config extends z.core.$ZodObjectConfig = z.core.$strip,
  > extends z._ZodType<z.core.$ZodObjectInternals<Shape, Config>>,
      z.core.$ZodObject<Shape, Config> {
    remap<V extends string, U extends { [P in keyof Shape]?: V }>(
      mapping: U,
    ): z.ZodPipe<
      z.ZodPipe<this, z.ZodTransform>, // internal type simplified
      z.ZodObject<Remap<Shape, U, V> & Intact<Shape, U>, Config>
    >;
    remap<U extends z.core.$ZodShape>(
      mapper: (subject: Shape) => U,
    ): z.ZodPipe<z.ZodPipe<this, z.ZodTransform>, z.ZodObject<U>>; // internal type simplified
  }
}
