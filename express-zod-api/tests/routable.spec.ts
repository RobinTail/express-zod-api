import { z } from "zod";
import { defaultEndpointsFactory, DependsOnMethod } from "../src";

const endpoint = defaultEndpointsFactory.build({
  output: z.object({}),
  handler: vi.fn(),
});

// @todo add tests for Routable
describe.each([new DependsOnMethod({ get: endpoint }), endpoint])(
  "Nestable mixin %#",
  (subject) => {
    test("should have .nest() method returning Routing arrangement", () => {
      expect(subject).toHaveProperty("nest", expect.any(Function));
      expect(subject.nest({ subpath: endpoint })).toEqual({
        "": subject,
        subpath: endpoint,
      });
    });
  },
);
