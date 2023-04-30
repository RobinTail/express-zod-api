import { ZodError } from "zod";
import { DependsOnMethodError, OpenAPIError, RoutingError } from "../../src";
import {
  IOSchemaError,
  InputValidationError,
  OutputValidationError,
  ResultHandlerError,
} from "../../src/errors";

describe("Errors", () => {
  describe("RoutingError", () => {
    test("should be an instance of Error", () => {
      expect(new RoutingError("test")).toBeInstanceOf(Error);
    });

    test("should have the name matching its class", () => {
      expect(new RoutingError("test").name).toBe("RoutingError");
    });
  });

  describe("OpenAPIError", () => {
    const params = {
      message: "test",
      path: "/v1/testPath",
      method: "get" as const,
      isResponse: true,
    };

    test("should be an instance of Error", () => {
      expect(new OpenAPIError(params)).toBeInstanceOf(Error);
    });

    test("should include more details into the message", () => {
      expect(new OpenAPIError(params).message).toMatchSnapshot();
    });

    test("should have the name matching its class", () => {
      expect(new OpenAPIError(params).name).toBe("OpenAPIError");
    });

    test("should be backward compatible", () => {
      expect(new OpenAPIError(params.message).message).toBe(params.message);
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

  describe("DependsOnMethodError", () => {
    test("should be an instance of RoutingError and Error", () => {
      expect(new DependsOnMethodError("test")).toBeInstanceOf(RoutingError);
      expect(new DependsOnMethodError("test")).toBeInstanceOf(Error);
    });

    test("should have the name matching its class", () => {
      expect(new DependsOnMethodError("test").name).toBe(
        "DependsOnMethodError"
      );
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
        "OutputValidationError"
      );
    });

    test("should have .originalError property matching the one used for constructing", () => {
      expect(new OutputValidationError(zodError).originalError).toEqual(
        zodError
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
        "InputValidationError"
      );
    });

    test("should have .originalError property matching the one used for constructing", () => {
      expect(new InputValidationError(zodError).originalError).toEqual(
        zodError
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
});
