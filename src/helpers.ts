import * as z from 'zod';

export type ObjectSchema<T extends z.ZodRawShape> = z.ZodObject<T, "passthrough" | "strict" | "strip">;
export type Unshape<T> = T extends z.ZodRawShape ? z.infer<ObjectSchema<T>> : T;
export type JoinUnshaped<A, B> = Unshape<A> & Unshape<B>;
