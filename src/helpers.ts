import * as z from 'zod';

export type Unshape<T extends z.ZodRawShape> = z.infer<z.ZodObject<T>>;
