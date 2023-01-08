import { DependsOnMethodError, OpenAPIError, RoutingError } from "../../src";
import {
  IOSchemaError,
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
    test("should be an instance of Error", () => {
      expect(new OpenAPIError("test")).toBeInstanceOf(Error);
    });

    test("should have the name matching its class", () => {
      expect(new OpenAPIError("test").name).toBe("OpenAPIError");
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
    test("should be an instance of IOSchemaError and Error", () => {
      expect(new OutputValidationError("test")).toBeInstanceOf(IOSchemaError);
      expect(new OutputValidationError("test")).toBeInstanceOf(Error);
    });

    test("should have the name matching its class", () => {
      expect(new OutputValidationError("test").name).toBe(
        "OutputValidationError"
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
