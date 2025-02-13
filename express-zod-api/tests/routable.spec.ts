import { z } from "zod";
import { defaultEndpointsFactory, DependsOnMethod } from "../src";

const endpoint = defaultEndpointsFactory.build({
  output: z.object({}),
  handler: vi.fn(),
});

const methodDepending = new DependsOnMethod({ get: endpoint });

describe.each([methodDepending, endpoint])("Routable mixin %#", (subject) => {
  describe(".clone()", () => {
    test("should return a copy of the entity", () => {
      expect(subject.clone()).toEqual(subject);
    });
  });

  describe(".deprecated()", () => {
    test("should deprecate the entity", () => {
      expect(subject.isDeprecated).toBe(false);
      expect(subject.deprecated().isDeprecated).toBe(true);
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
