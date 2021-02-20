import * as z from 'zod';

export type Unshape<T> = T extends z.ZodRawShape ? z.infer<z.ZodObject<T>> : T;
export type JoinUnshaped<A, B> = Unshape<A> & Unshape<B>;
