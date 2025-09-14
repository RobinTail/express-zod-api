import { z } from "zod";
import { defaultEndpointsFactory } from "../src";
import { DependsOnMethod } from "../src/depends-on-method";

const endpoint = defaultEndpointsFactory.build({
  output: z.object({}),
  handler: vi.fn(),
});

const methodDepending = new DependsOnMethod({ get: endpoint });

describe.each([methodDepending, endpoint])("Routable mixin %#", (subject) => {
  describe(".nest()", () => {
    test("should return Routing arrangement", () => {
      expect(subject).toHaveProperty("nest", expect.any(Function));
      expect(subject.nest({ subpath: endpoint })).toEqual({
        "": subject,
        subpath: endpoint,
      });
    });
  });
});
