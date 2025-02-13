import { z } from "zod";
import { defaultEndpointsFactory, DependsOnMethod } from "../src";

const endpoint = defaultEndpointsFactory.build({
  output: z.object({}),
  handler: vi.fn(),
});

const methodDepending = new DependsOnMethod({ get: endpoint });

describe.each([methodDepending, endpoint])("Routable mixin %#", (subject) => {
  describe(".deprecated()", () => {
    test("should deprecate the entity", () => {
      expect(subject.isDeprecated).toBe(false);
      const copy = subject.deprecated();
      expect(copy.isDeprecated).toBe(true);
    });
  });

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
