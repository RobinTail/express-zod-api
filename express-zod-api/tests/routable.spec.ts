import { z } from "zod";
import { defaultEndpointsFactory, DependsOnMethod, ServeStatic } from "../src";

const endpoint = defaultEndpointsFactory.build({
  output: z.object({}),
  handler: vi.fn(),
});

const methodDepending = new DependsOnMethod({ get: endpoint });

const staticServer = new ServeStatic("assets", {
  dotfiles: "deny",
  index: false,
  redirect: false,
});

describe.each([methodDepending, endpoint, staticServer])(
  "Routable mixin %#",
  (subject) => {
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
  },
);

describe.each([methodDepending, endpoint])("Nestable mixin %#", (subject) => {
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
