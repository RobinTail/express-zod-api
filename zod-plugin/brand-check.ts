import { z } from "zod";

interface $EZBrandCheckDef extends z.core.$ZodCheckDef {
  check: "$EZBrandCheck";
  brand?: string | number | symbol;
}

interface $EZBrandCheckInternals extends z.core.$ZodCheckInternals<unknown> {
  def: $EZBrandCheckDef;
}

export interface $EZBrandCheck extends z.core.$ZodCheck {
  _zod: $EZBrandCheckInternals;
}

/**
 * This approach was suggested to me by Colin in a PM on Twitter.
 * Refrained from storing the brand in Metadata because it should withstand refinements.
 * */
export const $EZBrandCheck = z.core.$constructor<$EZBrandCheck>(
  "$EZBrandCheck",
  (inst, def) => {
    z.core.$ZodCheck.init(inst, def);
    inst._zod.onattach.push((schema) => (schema._zod.bag.brand = def.brand));
    inst._zod.check = () => {};
  },
);
