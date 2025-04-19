import { z } from "zod";
import { DocumentationError, RoutingError } from "../src";
import {
  IOSchemaError,
  InputValidationError,
  MissingPeerError,
  OutputValidationError,
  ResultHandlerError,
} from "../src/errors";

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
    const error = new DocumentationError("test", {
      path: "/v1/testPath",
      method: "get",
      isResponse: true,
    });

    test("should be an instance of Error", () => {
      expect(error).toBeInstanceOf(Error);
    });

    test("should have the message as assigned", () => {
      expect(error.message).toBe("test");
    });

    test("should have the .cause property with details", () => {
      expect(error.cause).toBe(
        "Response schema of an Endpoint assigned to GET method of /v1/testPath path.",
      );
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
    (handled) => {
      const error = new ResultHandlerError(new Error("test"), handled);

      test("should be an instance of Error", () => {
        expect(error).toBeInstanceOf(Error);
      });

      test("should have the name matching its class", () => {
        expect(error.name).toBe("ResultHandlerError");
      });

      test(".cause should be the originally thrown error", () => {
        expect(error.cause).toEqual(new Error("test"));
      });

      test(".handled should be the error handled by ResultHandler", () => {
        expect(error.handled).toEqual(handled);
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
