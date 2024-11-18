import { z } from "zod";
import { defaultEndpointsFactory, DependsOnMethod } from "../../src";

const endpoint = defaultEndpointsFactory.build({
  method: "get", // @todo remove the line in v21
  output: z.object({}),
  handler: vi.fn(),
});

describe.each([new DependsOnMethod({ get: endpoint }), endpoint])(
  "Nesting mixin %#",
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
