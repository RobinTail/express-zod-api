import { eslintCompatPlugin, type Node, type Visitor } from "@oxlint/plugins";

interface Entry {
  selector: string;
  message: string;
}

export default eslintCompatPlugin({
  rules: {
    syntax: {
      meta: {
        type: "problem",
        docs: { description: "Prohibits certain AST" },
        schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              selector: { type: "string" },
              message: { type: "string" },
            },
            required: ["selector", "message"],
            additionalProperties: false,
          },
          uniqueItems: !0,
          minItems: 0,
        },
      },
      create: (context) =>
        context.options.reduce<Visitor>((result, _entry) => {
          if (typeof _entry !== "object" || !_entry)
            throw new Error("Invalid entry", { cause: _entry });
          const { selector, message } = _entry as unknown as Entry;
          return Object.assign(result, {
            [selector](node: Node) {
              context.report({ node, message });
            },
          });
        }, {}),
    },
  },
});
