import { ServerObject, addExtension, getExtension } from "../../src/oas-common";
import * as oa from "../../src/oas-model";
import { OpenApiBuilder } from "../../src/oas-builder";

describe("OpenApiBuilder", () => {
  it("Build empty Spec", () => {
    expect(OpenApiBuilder.create().getSpec()).toEqual({
      openapi: "3.0.0",
      info: {
        title: "app",
        version: "version",
      },
      paths: {},
      components: {
        schemas: {},
        responses: {},
        parameters: {},
        examples: {},
        requestBodies: {},
        headers: {},
        securitySchemes: {},
        links: {},
        callbacks: {},
      },
      tags: [],
      servers: [],
    });
  });
  it("Build with custom object", () => {
    const obj: oa.OpenAPIObject = {
      openapi: "3.0.0",
      info: {
        title: "app1",
        version: "version2",
      },
      paths: {},
      components: {
        schemas: {},
        responses: {},
        parameters: {},
        examples: {},
        requestBodies: {},
        headers: {},
        securitySchemes: {},
        links: {},
        callbacks: {},
      },
      tags: [],
      servers: [],
    };
    expect(OpenApiBuilder.create(obj).getSpec()).toEqual(obj);
  });
  it("addTitle", () => {
    const sut = OpenApiBuilder.create().addTitle("app7").rootDoc;
    expect(sut.info.title).toBe("app7");
  });
  it("addDescription", () => {
    const sut = OpenApiBuilder.create().addDescription("desc 6").rootDoc;
    expect(sut.info.description).toBe("desc 6");
  });
  it("addOpenApiVersion valid", () => {
    const sut = OpenApiBuilder.create().addOpenApiVersion("3.2.4").rootDoc;
    expect(sut.openapi).toBe("3.2.4");
  });
  it("addOpenApiVersion invalid", () => {
    expect(
      () => OpenApiBuilder.create().addOpenApiVersion("a.b.4").rootDoc
    ).toThrow();
  });
  it("addOpenApiVersion empty", () => {
    expect(
      () => OpenApiBuilder.create().addOpenApiVersion("").rootDoc
    ).toThrow();
  });
  it("addOpenApiVersion lower than 3", () => {
    expect(
      () => OpenApiBuilder.create().addOpenApiVersion("2.5.6").rootDoc
    ).toThrow();
  });
  it("addInfo", () => {
    const info: oa.InfoObject = {
      title: "app9",
      version: "11.34.678",
    };
    const sut = OpenApiBuilder.create().addInfo(info).rootDoc;
    expect(sut.info).toEqual(info);
  });
  it("addTitle", () => {
    const sut = OpenApiBuilder.create().addTitle("t1").rootDoc;
    expect(sut.info.title).toBe("t1");
  });
  it("addDescription", () => {
    const sut = OpenApiBuilder.create().addDescription("desc 2").rootDoc;
    expect(sut.info.description).toBe("desc 2");
  });
  it("addTermsOfService", () => {
    const sut = OpenApiBuilder.create().addTermsOfService("tos 7").rootDoc;
    expect(sut.info.termsOfService).toBe("tos 7");
  });
  it("addLicense", () => {
    const sut = OpenApiBuilder.create().addLicense({
      name: "MIT",
      url: "http://mit.edu/license",
    }).rootDoc;
    expect(sut.info.license).toEqual({
      name: "MIT",
      url: "http://mit.edu/license",
    });
  });
  it("addContact", () => {
    const sut = OpenApiBuilder.create().addContact({
      name: "Alicia",
      email: "alicia@acme.com",
      url: "http://acme.com/~alicia",
    }).rootDoc;
    expect(sut.info.contact).toEqual({
      name: "Alicia",
      email: "alicia@acme.com",
      url: "http://acme.com/~alicia",
    });
  });
  it("addVersion", () => {
    const sut = OpenApiBuilder.create().addVersion("7.52.46").rootDoc;
    expect(sut.info.version).toBe("7.52.46");
  });
  it("addPath", () => {
    const path1 = {
      get: {
        responses: {
          default: {
            description: "object created",
          },
        },
      },
    };
    const doc = OpenApiBuilder.create().addPath("/path1", path1);
    expect(doc.rootDoc.paths["/path1"]).toEqual(path1);
    const path2 = {
      post: {
        responses: {
          default: {
            description: "object 2 created",
          },
        },
      },
    };
    doc.addPath("/path1", path2);
    expect(doc.rootDoc.paths["/path1"]).toEqual({ ...path1, ...path2 });
  });

  it("addSchema", () => {
    const schema1: oa.SchemaObject = {
      type: "string",
      format: "email",
    };
    const sut = OpenApiBuilder.create().addSchema("schema01", schema1).rootDoc;
    expect(sut.components?.schemas?.schema01).toEqual(schema1);
  });
  it("addSchema reference", () => {
    const schema1 = {
      $ref: "#/components/schemas/id",
    };
    const sut = OpenApiBuilder.create().addSchema("schema01", schema1).rootDoc;
    expect(sut.components?.schemas?.schema01).toEqual(schema1);
  });
  it("addResponse", () => {
    const resp00 = {
      description: "object created",
    };
    const sut = OpenApiBuilder.create().addResponse("resp00", resp00).rootDoc;
    expect(sut.components?.responses?.resp00).toEqual(resp00);
  });
  it("addResponse reference", () => {
    const resp00 = {
      $ref: "#/components/responses/reference",
    };
    const sut = OpenApiBuilder.create().addResponse("resp00", resp00).rootDoc;
    expect(sut.components?.responses?.resp00).toEqual(resp00);
  });
  it("addParameter", () => {
    const par5 = {
      name: "id",
      in: "header" as oa.ParameterLocation,
      schema: {
        $ref: "#/components/schemas/id",
      },
    };
    const sut = OpenApiBuilder.create().addParameter("par5", par5).rootDoc;
    expect(sut.components?.parameters?.par5).toEqual(par5);
  });
  it("addParameter reference", () => {
    const par5 = {
      $ref: "#/components/parameters/id",
    };
    const sut = OpenApiBuilder.create().addParameter("par5", par5).rootDoc;
    expect(sut.components?.parameters?.par5).toEqual(par5);
  });
  it("addExample", () => {
    const example4 = {
      a: "a desc",
      b: "a desc",
    };
    const sut = OpenApiBuilder.create().addExample(
      "example4",
      example4
    ).rootDoc;
    expect(sut.components?.examples?.example4).toEqual(example4);
  });
  it("addExample reference", () => {
    const example4 = {
      $ref: "#/components/examples/id",
    };
    const sut = OpenApiBuilder.create().addExample(
      "example4",
      example4
    ).rootDoc;
    expect(sut.components?.examples?.example4).toEqual(example4);
  });
  it("addRequestBody", () => {
    const reqBody9: oa.RequestBodyObject = {
      description: "Request body details",
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/User",
          },
          examples: {
            user: {
              $ref: "http://foo.bar/examples/user-example.json",
            },
          },
        },
      },
      required: false,
    };
    const sut = OpenApiBuilder.create().addRequestBody(
      "reqBody9",
      reqBody9
    ).rootDoc;
    expect(sut.components?.requestBodies?.reqBody9).toEqual(reqBody9);
  });
  it("addRequestBody reference", () => {
    const reqBody9 = {
      $ref: "#/components/requestBodies/id",
    };
    const sut = OpenApiBuilder.create().addRequestBody(
      "reqBody9",
      reqBody9
    ).rootDoc;
    expect(sut.components?.requestBodies?.reqBody9).toEqual(reqBody9);
  });
  it("addHeaders", () => {
    const h5: oa.HeaderObject = {
      description: "header 5",
    };
    const sut = OpenApiBuilder.create().addHeader("h5", h5).rootDoc;
    expect(sut.components?.headers?.h5).toEqual(h5);
  });
  it("addHeaders Reference", () => {
    const h5: oa.HeaderObject = {
      $ref: "#/components/headers/id",
    };
    const sut = OpenApiBuilder.create().addHeader("h5", h5).rootDoc;
    expect(sut.components?.headers?.h5).toEqual(h5);
  });
  it("addSecuritySchemes", () => {
    const sec7: oa.SecuritySchemeObject = {
      type: "http",
      scheme: "basic",
    };
    const sut = OpenApiBuilder.create().addSecurityScheme("sec7", sec7).rootDoc;
    expect(sut.components?.securitySchemes?.sec7).toEqual(sec7);
  });
  it("addSecuritySchemes reference", () => {
    const sec7 = {
      $ref: "#/components/securitySchemes/id",
    };
    const sut = OpenApiBuilder.create().addSecurityScheme("sec7", sec7).rootDoc;
    expect(sut.components?.securitySchemes?.sec7).toEqual(sec7);
  });
  it("addLink", () => {
    const link0: oa.LinkObject = {
      href: "/users/10101110/department",
    };
    const sut = OpenApiBuilder.create().addLink("link0", link0).rootDoc;
    expect(sut.components?.links?.link0).toEqual(link0);
  });
  it("addLink reference", () => {
    const link0 = {
      $ref: "#/components/links/id",
    };
    const sut = OpenApiBuilder.create().addLink("link0", link0).rootDoc;
    expect(sut.components?.links?.link0).toEqual(link0);
  });
  it("addCallback", () => {
    const cb1: oa.CallbackObject = {
      "$request.body#/url": {
        post: {
          requestBody: {
            description: "Callback payload",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SomePayload",
                },
              },
            },
          },
          responses: {
            "200": {
              description:
                "webhook successfully processed an no retries will be performed",
            },
          },
        },
      },
    };
    const sut = OpenApiBuilder.create().addCallback("cb1", cb1).rootDoc;
    expect(sut.components?.callbacks?.cb1).toEqual(cb1);
  });
  it("addCallback reference", () => {
    const cb1 = {
      $ref: "#/components/callbacks/id",
    };
    const sut = OpenApiBuilder.create().addCallback("cb1", cb1).rootDoc;
    expect(sut.components?.callbacks?.cb1).toEqual(cb1);
  });
  it("addTag", () => {
    const t1: oa.TagObject = {
      name: "resource",
      "x-admin": true,
      description: "my own tag",
    };
    const sut = OpenApiBuilder.create().addTag(t1).rootDoc;
    expect(sut?.tags?.[0]).toEqual(t1);
  });
  it("addExternalDocs", () => {
    const eDocs: oa.ExternalDocumentationObject = {
      url: "https://acme.com/docs",
      description: "Main doc",
    };
    const sut = OpenApiBuilder.create().addExternalDocs(eDocs).rootDoc;
    expect(sut.externalDocs).toEqual(eDocs);
  });
  it("addServer", () => {
    const s1: ServerObject = {
      url: "http://api.quixote.org",
      variables: {},
    };
    const sut = OpenApiBuilder.create().addServer(s1).rootDoc;
    expect(sut.servers?.[0]).toEqual(s1);
  });

  it("getPath", () => {
    const path1 = {
      get: {
        responses: {
          default: {
            description: "object created",
          },
        },
      },
    };
    const sut = OpenApiBuilder.create().addPath("/service7", path1).rootDoc;
    addExtension(sut.paths, "x-my-extension", 42);

    expect(oa.getPath(sut.paths, "/service7")).toEqual(path1);
    expect(oa.getPath(sut.paths, "/service56")).toBeUndefined();
  });
  it("get invalid Path", () => {
    const path1 = {
      get: {
        responses: {
          default: {
            description: "object created",
          },
        },
      },
    };
    const sut = OpenApiBuilder.create().addPath("/service7", path1).rootDoc;
    addExtension(sut.paths, "x-my-extension", 42);

    expect(oa.getPath(sut.paths, "x-path")).toBeUndefined();
  });
  it("getExtension", () => {
    const path1 = {
      get: {
        responses: {
          default: {
            description: "object created",
          },
        },
      },
    };
    const sut = OpenApiBuilder.create().addPath("/service7", path1).rootDoc;
    addExtension(sut.paths, "x-my-extension", 42);

    expect(getExtension(sut.paths, "x-my-extension")).toBe(42);
    expect(getExtension(sut.paths, "x-other")).toBeUndefined();
  });
  it("retrieve invalid extension", () => {
    const path1 = {
      get: {
        responses: {
          default: {
            description: "object created",
          },
        },
      },
    };
    const sut = OpenApiBuilder.create().addPath("/service7", path1).rootDoc;
    addExtension(sut.paths, "x-my-extension", 42);

    expect(getExtension(sut.paths, "y-other")).toBeUndefined();
  });

  describe("Serialize", () => {
    it("getSpecAsJson", () => {
      const sut = OpenApiBuilder.create()
        .addTitle("app9")
        .addVersion("5.6.7")
        .getSpecAsJson();
      expect(sut).toBe(
        `{"openapi":"3.0.0","info":{"title":"app9","version":"5.6.7"},"paths":{},"components":{"schemas":{},"responses":{},"parameters":{},"examples":{},"requestBodies":{},"headers":{},"securitySchemes":{},"links":{},"callbacks":{}},"tags":[],"servers":[]}`
      );
    });
    it("getSpecAsYaml", () => {
      const sut = OpenApiBuilder.create()
        .addTitle("app9")
        .addVersion("5.6.7")
        .getSpecAsYaml();
      expect(sut).toBe(
        "openapi: 3.0.0\ninfo:\n  title: app9\n  version: 5.6.7\npaths: {}\ncomponents:\n  schemas: {}\n  responses: {}\n  parameters: {}\n  examples: {}\n  requestBodies: {}\n  headers: {}\n  securitySchemes: {}\n  links: {}\n  callbacks: {}\ntags: []\nservers: []\n"
      );
    });
  });
});
