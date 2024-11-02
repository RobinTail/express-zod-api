import { z } from "zod";
import { DocumentationError, RoutingError } from "../../src";
import {
  IOSchemaError,
  InputValidationError,
  MissingPeerError,
  OutputValidationError,
  ResultHandlerError,
} from "../../src/errors";

describe("Errors", () => {
  describe("RoutingError", () => {
    const error = new RoutingError("test");

    test("should be an instance of Error", () => {
      expect(error).toBeInstanceOf(Error);
    });

    test("should have the name matching its class", () => {
      expect(error.name).toBe("RoutingError");
    });
  });

  describe("DocumentationError", () => {
    const error = new DocumentationError({
      message: "test",
      path: "/v1/testPath",
      method: "get" as const,
      isResponse: true,
    });

    test("should be an instance of Error", () => {
      expect(error).toBeInstanceOf(Error);
    });

    test("should include more details into the message", () => {
      expect(error.message).toMatchSnapshot();
    });

    test("should have the name matching its class", () => {
      expect(error.name).toBe("DocumentationError");
    });
  });

  describe("IOSchemaError", () => {
    const error = new IOSchemaError("test");

    test("should be an instance of Error", () => {
      expect(error).toBeInstanceOf(Error);
    });

    test("should have the name matching its class", () => {
      expect(error.name).toBe("IOSchemaError");
    });
  });

  describe("OutputValidationError", () => {
    const zodError = new z.ZodError([]);
    const error = new OutputValidationError(zodError);

    test("should be an instance of IOSchemaError and Error", () => {
      expect(error).toBeInstanceOf(IOSchemaError);
      expect(error).toBeInstanceOf(Error);
    });

    test("should have the name matching its class", () => {
      expect(error.name).toBe("OutputValidationError");
    });

    test("should have .cause property matching the one used for constructing", () => {
      expect(error.cause).toEqual(zodError);
    });
  });

  describe("InputValidationError", () => {
    const zodError = new z.ZodError([]);
    const error = new InputValidationError(zodError);

    test("should be an instance of IOSchemaError and Error", () => {
      expect(error).toBeInstanceOf(IOSchemaError);
      expect(error).toBeInstanceOf(Error);
    });

    test("should have the name matching its class", () => {
      expect(error.name).toBe("InputValidationError");
    });

    test("should have .cause property matching the one used for constructing", () => {
      expect(error.cause).toEqual(zodError);
    });
  });

  describe.each([new Error("test2"), undefined])(
    "ResultHandlerError",
    (cause) => {
      const error = new ResultHandlerError("test", cause);

      test("should be an instance of Error", () => {
        expect(error).toBeInstanceOf(Error);
      });

      test("should have the name matching its class", () => {
        expect(error.name).toBe("ResultHandlerError");
      });

      test(".cause should be the original error", () => {
        expect(error.cause).toEqual(cause);
      });
    },
  );

  describe("MissingPeerError", () => {
    const error = new MissingPeerError("compression");

    test("should be an instance of Error", () => {
      expect(error).toBeInstanceOf(Error);
    });

    test("should have the name matching its class", () => {
      expect(error.name).toBe("MissingPeerError");
    });

    test("should have a human readable message", () => {
      expect(error.message).toBe(
        "Missing peer dependency: compression. Please install it to use the feature.",
      );
    });
  });
});
