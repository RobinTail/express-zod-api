import { DependsOnMethodError, OpenAPIError, RoutingError } from "../../src";
import {
  IOSchemaError,
  OutputValidationError,
  ResultHandlerError,
} from "../../src/errors";

describe("Errors", () => {
  describe("RoutingError", () => {
    test("should be an instance of Error", () => {
      expect(new RoutingError("test")).toBeInstanceOf(RoutingError);
      expect(new RoutingError("test")).toBeInstanceOf(Error);
    });
  });

  describe("OpenAPIError", () => {
    test("should be an instance of Error", () => {
      expect(new OpenAPIError("test")).toBeInstanceOf(OpenAPIError);
      expect(new OpenAPIError("test")).toBeInstanceOf(Error);
    });
  });

  describe("IOSchemaError", () => {
    test("should be an instance of Error", () => {
      expect(new IOSchemaError("test")).toBeInstanceOf(IOSchemaError);
      expect(new IOSchemaError("test")).toBeInstanceOf(Error);
    });
  });

  describe("DependsOnMethodError", () => {
    test("should be an instance of RoutingError", () => {
      expect(new DependsOnMethodError("test")).toBeInstanceOf(
        DependsOnMethodError
      );
      expect(new DependsOnMethodError("test")).toBeInstanceOf(RoutingError);
      expect(new DependsOnMethodError("test")).toBeInstanceOf(Error);
    });
  });

  describe("OutputValidationError", () => {
    test("should be an instance of IOSchemaError", () => {
      expect(new OutputValidationError("test")).toBeInstanceOf(IOSchemaError);
      expect(new OutputValidationError("test")).toBeInstanceOf(Error);
    });
  });

  describe("ResultHandlerError", () => {
    test("should be an instance of Error", () => {
      expect(new ResultHandlerError("test")).toBeInstanceOf(ResultHandlerError);
      expect(new ResultHandlerError("test")).toBeInstanceOf(Error);
    });

    test(".hasOriginalError() should depend on original error", () => {
      const error = new ResultHandlerError("test", new Error("test2"));
      expect(error.hasOriginalError()).toBeTruthy();
      const error2 = new ResultHandlerError("test");
      expect(error2.hasOriginalError()).toBeFalsy();
    });

    test(".getOriginalErrorMessage() should depend on original error", () => {
      const error = new ResultHandlerError("test", new Error("test2"));
      expect(error.getOriginalErrorMessage()).toBe("test2");
      const error2 = new ResultHandlerError("test");
      expect(error2.getOriginalErrorMessage()).toBeUndefined();
    });
  });
});
