import {z} from 'zod';

export class RoutingError extends Error {
}

export class DependsOnMethodError extends RoutingError {
}

export class OpenAPIError extends Error {
}

export const errorDescriptionSchema = z.object({
  message: z.string(),
  fields: z.record(
    z.array(z.object({
      message: z.string(),
      internalPath: z.array(z.string().or(z.number().int().nonnegative()))
    }))
  ).optional(),
});
