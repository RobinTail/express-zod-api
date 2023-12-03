import { ZodError } from "zod";
import { DocumentationError, RoutingError } from "./index";
import {
  IOSchemaError,
  InputValidationError,
  MissingPeerError,
  OutputValidationError,
  ResultHandlerError,
} from "./errors";

describe("Errors", () => {
  describe("RoutingError", () => {
    test("should be an instance of Error", () => {
      expect(new RoutingError("test")).toBeInstanceOf(Error);
    });

    test("should have the name matching its class", () => {
      expect(new RoutingError("test").name).toBe("RoutingError");
    });
  });

  describe("DocumentationError", () => {
    const params = {
      message: "test",
      path: "/v1/testPath",
      method: "get" as const,
      isResponse: true,
    };

    test("should be an instance of Error", () => {
      expect(new DocumentationError(params)).toBeInstanceOf(Error);
    });

    test("should include more details into the message", () => {
      expect(new DocumentationError(params).message).toMatchSnapshot();
    });

    test("should have the name matching its class", () => {
      expect(new DocumentationError(params).name).toBe("DocumentationError");
    });
  });

  describe("IOSchemaError", () => {
    test("should be an instance of Error", () => {
      expect(new IOSchemaError("test")).toBeInstanceOf(Error);
    });

    test("should have the name matching its class", () => {
      expect(new IOSchemaError("test").name).toBe("IOSchemaError");
    });
  });

  describe("OutputValidationError", () => {
    const zodError = new ZodError([]);

    test("should be an instance of IOSchemaError and Error", () => {
      expect(new OutputValidationError(zodError)).toBeInstanceOf(IOSchemaError);
      expect(new OutputValidationError(zodError)).toBeInstanceOf(Error);
    });

    test("should have the name matching its class", () => {
      expect(new OutputValidationError(zodError).name).toBe(
        "OutputValidationError",
      );
    });

    test("should have .originalError property matching the one used for constructing", () => {
      expect(new OutputValidationError(zodError).originalError).toEqual(
        zodError,
      );
    });
  });

  describe("InputValidationError", () => {
    const zodError = new ZodError([]);

    test("should be an instance of IOSchemaError and Error", () => {
      expect(new InputValidationError(zodError)).toBeInstanceOf(IOSchemaError);
      expect(new InputValidationError(zodError)).toBeInstanceOf(Error);
    });

    test("should have the name matching its class", () => {
      expect(new InputValidationError(zodError).name).toBe(
        "InputValidationError",
      );
    });

    test("should have .originalError property matching the one used for constructing", () => {
      expect(new InputValidationError(zodError).originalError).toEqual(
        zodError,
      );
    });
  });

  describe("ResultHandlerError", () => {
    test("should be an instance of Error", () => {
      expect(new ResultHandlerError("test")).toBeInstanceOf(Error);
    });

    test("should have the name matching its class", () => {
      expect(new ResultHandlerError("test").name).toBe("ResultHandlerError");
    });

    test(".originalError should be the original error", () => {
      const error = new ResultHandlerError("test", new Error("test2"));
      expect(error.originalError).toEqual(new Error("test2"));
      const error2 = new ResultHandlerError("test");
      expect(error2.originalError).toBeUndefined();
    });
  });

  describe("MissingPeerError", () => {
    test("should be an instance of Error", () => {
      expect(new MissingPeerError("compression")).toBeInstanceOf(Error);
    });

    test("should have the name matching its class", () => {
      expect(new MissingPeerError("compression").name).toBe("MissingPeerError");
    });

    test("should have a human readable message", () => {
      expect(new MissingPeerError("compression").message).toBe(
        "Missing peer dependency: compression. Please install it to use the feature.",
      );
      expect(new MissingPeerError(["jest", "vitest"]).message).toBe(
        "Missing one of the following peer dependencies: jest | vitest. Please install it to use the feature.",
      );
    });
  });
});
