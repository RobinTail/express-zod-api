import { mergeDeepRight } from "ramda";
import { z } from "zod";
import { combinations } from "./common-helpers";

const metaSchema = z.object({
  description: z.string().optional(),
  examples: z.any().array(),
});

export interface Metadata<T extends z.ZodTypeAny> {
  description?: string;
  examples: z.input<T>[];
}

const initialData = { examples: [] } satisfies Metadata<z.ZodTypeAny>;

const reviver = ({}: string, value: string) => {
  const parsed = z
    .string()
    .datetime()
    .transform((str) => new Date(str))
    .safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  return value;
};

const validate = <T extends z.ZodTypeAny>(
  description: string | undefined,
  fallback: Metadata<T>,
): Metadata<T> => {
  if (!description) {
    return initialData;
  }
  try {
    const json = JSON.parse(description, reviver);
    metaSchema.parse(json);
    return json as Metadata<T>;
  } catch {
    return fallback;
  }
};

const unpack = <T extends z.ZodTypeAny>(subject: T): Metadata<T> =>
  validate(subject.description, {
    ...initialData,
    description: subject.description,
  });

const pack = <T extends z.ZodTypeAny>(subject: T, data: Metadata<T>) =>
  subject.describe(JSON.stringify(data)); // also makes a copy

type ExampleSetter<T extends z.ZodTypeAny> = (
  example: z.input<T>,
) => WithMeta<T>;

type WithMeta<T extends z.ZodTypeAny> = T & {
  example: ExampleSetter<T>;
};

export const withMeta = <T extends z.ZodTypeAny>(subject: T) =>
  new Proxy(pack(subject, unpack(subject)) as WithMeta<T>, {
    get: (target, prop) => {
      if (prop === "example") {
        const setter: ExampleSetter<T> = (value) => {
          const data = unpack(target);
          data.examples.push(value); // instead of concat, for handling array examples
          return withMeta(pack(target, data));
        };
        return setter;
      }
      if (prop === "describe") {
        return (description: string) => {
          const fallback = { ...unpack(target), description };
          return withMeta(pack(target, validate(description, fallback)));
        };
      }
      return Reflect.get(target, prop, target);
    },
    has: (target, prop: string) =>
      prop === "example" ? true : Reflect.has(target, prop),
  });

export const getMeta = <T extends z.ZodTypeAny, K extends keyof Metadata<T>>(
  subject: T,
  meta: K,
): Metadata<T>[K] => unpack(subject)[meta];

export const copyMeta = <A extends z.ZodTypeAny, B extends z.ZodTypeAny>(
  src: A,
  dest: B,
): WithMeta<B> => {
  const destExamples = getMeta(dest, "examples");
  const srcExamples = getMeta(src, "examples");
  const merge = ([destExample, srcExample]: [unknown, unknown]) =>
    typeof destExample === "object" && typeof srcExample === "object"
      ? mergeDeepRight({ ...destExample }, { ...srcExample })
      : srcExample; // not supposed to be called on non-object schemas
  const examples = combinations(destExamples, srcExamples, merge);
  return withMeta(pack(dest, { ...unpack(dest), examples }));
};
