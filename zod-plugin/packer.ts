import { z } from "zod";

interface $PackerDef<B extends object> extends z.core.$ZodCheckDef {
  check: "$Packer";
  bag: B;
}

interface $PackerInternals<B extends object>
  extends z.core.$ZodCheckInternals<unknown> {
  def: $PackerDef<B>;
}

interface $Packer<B extends object> extends z.core.$ZodCheck {
  _zod: $PackerInternals<B>;
}

/**
 * This approach was suggested to me by Colin in a PM on Twitter.
 * Refrained from using Metadata because the data should withstand refinements.
 * @since 1.1.0 I generalized it to accept any object instead of only brand.
 * */
export const pack = <T extends z.ZodType, B extends object>(
  subject: T,
  bag: B,
) => {
  const Cls = z.core.$constructor<$Packer<B>>("$Packer", (inst, def) => {
    z.core.$ZodCheck.init(inst, def);
    inst._zod.onattach.push((schema) => {
      Object.assign(schema._zod.bag, def.bag);
    });
    inst._zod.check = () => {};
  });
  return subject.check(new Cls({ check: "$Packer", bag })) as T & {
    _zod: { bag: B };
  };
};

export const unpack = <T extends z.core.$ZodType>(
  subject: T,
): T["_zod"]["bag"] => subject._zod.bag;
