import forge from "node-forge";
import { map, when, equals, nAry } from "ramda";
import { z } from "zod";
import { ezFileBrand } from "../src/file-schema";
import { SchemaHandler, walkSchema } from "../src/schema-walker";

const disposer = (function* () {
  let port = 8e3 + 1e2 * Number(process.env.VITEST_POOL_ID);
  while (true) yield port++;
})();

export const givePort = (test?: "example", rsvd = 8090): number =>
  test ? rsvd : when(equals(rsvd), nAry(0, givePort))(disposer.next().value);

const certAttr = [
  { name: "commonName", value: "localhost" },
  { name: "countryName", value: "DE" },
  { name: "organizationName", value: "ExpressZodAPI" },
  { shortName: "OU", value: "DEV" },
];
const certExt = [
  { name: "basicConstraints", cA: true },
  { name: "extKeyUsage", serverAuth: true, clientAuth: true },
  { name: "subjectAltName", altNames: [{ type: 2, value: "localhost" }] },
  {
    name: "keyUsage",
    keyCertSign: true,
    digitalSignature: true,
    nonRepudiation: true,
    keyEncipherment: true,
    dataEncipherment: true,
  },
];

export const signCert = () => {
  (forge as any).options.usePureJavaScript = true;
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  cert.setSubject(certAttr);
  cert.setIssuer(certAttr);
  cert.setExtensions(certExt);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return {
    cert: forge.pki.certificateToPem(cert),
    key: forge.pki.privateKeyToPem(keys.privateKey),
  };
};

export const serializeSchemaForTest = (
  subject: z.ZodTypeAny,
): Record<string, any> => {
  const onSomeUnion: SchemaHandler<object> = (
    {
      options,
    }:
      | z.ZodUnion<z.ZodUnionOptions>
      | z.ZodDiscriminatedUnion<
          string,
          z.ZodDiscriminatedUnionOption<string>[]
        >,
    { next },
  ) => ({
    options: Array.from(options.values()).map(next),
  });
  const onOptionalOrNullable: SchemaHandler<object> = (
    schema: z.ZodOptional<z.ZodTypeAny> | z.ZodNullable<z.ZodTypeAny>,
    { next },
  ) => ({
    value: next(schema.unwrap()),
  });
  const onPrimitive = () => ({});
  return walkSchema(subject, {
    rules: {
      ZodNull: onPrimitive,
      ZodNumber: onPrimitive,
      ZodString: onPrimitive,
      ZodBoolean: onPrimitive,
      ZodUnion: onSomeUnion,
      ZodDiscriminatedUnion: onSomeUnion,
      ZodOptional: onOptionalOrNullable,
      ZodNullable: onOptionalOrNullable,
      ZodIntersection: ({ _def }: z.ZodIntersection<any, any>, { next }) => ({
        left: next(_def.left),
        right: next(_def.right),
      }),
      ZodObject: ({ shape }: z.ZodObject<any>, { next }) => ({
        shape: map(next, shape),
      }),
      ZodEffects: ({ _def }: z.ZodEffects<any>, { next }) => ({
        value: next(_def.schema),
      }),
      ZodRecord: ({ keySchema, valueSchema }: z.ZodRecord, { next }) => ({
        keys: next(keySchema),
        values: next(valueSchema),
      }),
      ZodArray: ({ element }: z.ZodArray<any>, { next }) => ({
        items: next(element),
      }),
      ZodLiteral: ({ value }: z.ZodLiteral<any>) => ({ value }),
      ZodDefault: ({ _def }: z.ZodDefault<any>, { next }) => ({
        value: next(_def.innerType),
        default: _def.defaultValue(),
      }),
      ZodReadonly: (schema: z.ZodReadonly<any>, { next }) =>
        next(schema.unwrap()),
      ZodCatch: ({ _def }: z.ZodCatch<any>, { next }) => ({
        value: next(_def.innerType),
      }),
      ZodPipeline: ({ _def }: z.ZodPipeline<any, any>, { next }) => ({
        from: next(_def.in),
        to: next(_def.out),
      }),
      [ezFileBrand]: () => ({ brand: ezFileBrand }),
    },
    onEach: ({ _def }: z.ZodTypeAny) => ({ _type: _def.typeName }),
    onMissing: ({ _def }: z.ZodTypeAny) => {
      console.warn(`There is no serializer for ${_def.typeName}`);
      return {};
    },
  });
};
