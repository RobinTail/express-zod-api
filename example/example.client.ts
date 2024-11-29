type Type1 = {
  title: string;
  features: Type1;
}[];

type GetV1UserRetrieveInput = {
  /** a numeric string containing the id of the user */
  id: string;
};

type GetV1UserRetrieveResponse =
  | {
      status: "success";
      data: {
        id: number;
        name: string;
        features: {
          title: string;
          features: Type1;
        }[];
      };
    }
  | {
      status: "error";
      error: {
        message: string;
      };
    };

type DeleteV1UserIdRemoveInput = {
  /** numeric string */
  id: string;
};

type DeleteV1UserIdRemoveResponse = undefined;

type PatchV1UserIdInput = {
  key: string;
  id: string;
  name: string;
  birthday: string;
};

type PatchV1UserIdResponse =
  | {
      status: "success";
      data: {
        name: string;
        createdAt: string;
      };
    }
  | {
      status: "error";
      error: {
        message: string;
      };
    };

type PostV1UserCreateInput = {
  name: string;
};

type PostV1UserCreateResponse =
  | {
      status: "created";
      data: {
        id: number;
      };
    }
  | (
      | {
          status: "exists";
          id: number;
        }
      | {
          status: "error";
          reason: string;
        }
    );

type GetV1UserListInput = {};

type GetV1UserListResponse =
  | {
      name: string;
    }[]
  | string;

type GetV1AvatarSendInput = {
  userId: string;
};

type GetV1AvatarSendResponse = string;

type GetV1AvatarStreamInput = {
  userId: string;
};

type GetV1AvatarStreamResponse = Buffer | string;

type PostV1AvatarUploadInput = {
  avatar: any;
};

type PostV1AvatarUploadResponse =
  | {
      status: "success";
      data: {
        name: string;
        size: number;
        mime: string;
        hash: string;
        otherInputs: Record<string, any>;
      };
    }
  | {
      status: "error";
      error: {
        message: string;
      };
    };

type PostV1AvatarRawInput = Buffer;

type PostV1AvatarRawResponse =
  | {
      status: "success";
      data: {
        length: number;
      };
    }
  | {
      status: "error";
      error: {
        message: string;
      };
    };

export type Path =
  | "/v1/user/retrieve"
  | "/v1/user/:id/remove"
  | "/v1/user/:id"
  | "/v1/user/create"
  | "/v1/user/list"
  | "/v1/avatar/send"
  | "/v1/avatar/stream"
  | "/v1/avatar/upload"
  | "/v1/avatar/raw";

export type Method = "get" | "post" | "put" | "delete" | "patch";

export type MethodPath = `${Method} ${Path}`;

export interface Input extends Record<MethodPath, any> {
  "get /v1/user/retrieve": GetV1UserRetrieveInput;
  "delete /v1/user/:id/remove": DeleteV1UserIdRemoveInput;
  "patch /v1/user/:id": PatchV1UserIdInput;
  "post /v1/user/create": PostV1UserCreateInput;
  "get /v1/user/list": GetV1UserListInput;
  "get /v1/avatar/send": GetV1AvatarSendInput;
  "get /v1/avatar/stream": GetV1AvatarStreamInput;
  "post /v1/avatar/upload": PostV1AvatarUploadInput;
  "post /v1/avatar/raw": PostV1AvatarRawInput;
}

export interface Response extends Record<MethodPath, any> {
  "get /v1/user/retrieve": GetV1UserRetrieveResponse;
  "delete /v1/user/:id/remove": DeleteV1UserIdRemoveResponse;
  "patch /v1/user/:id": PatchV1UserIdResponse;
  "post /v1/user/create": PostV1UserCreateResponse;
  "get /v1/user/list": GetV1UserListResponse;
  "get /v1/avatar/send": GetV1AvatarSendResponse;
  "get /v1/avatar/stream": GetV1AvatarStreamResponse;
  "post /v1/avatar/upload": PostV1AvatarUploadResponse;
  "post /v1/avatar/raw": PostV1AvatarRawResponse;
}

export const jsonEndpoints = {
  "get /v1/user/retrieve": true,
  "patch /v1/user/:id": true,
  "post /v1/user/create": true,
  "get /v1/user/list": true,
  "post /v1/avatar/upload": true,
  "post /v1/avatar/raw": true,
};

export const endpointTags = {
  "get /v1/user/retrieve": ["users"],
  "delete /v1/user/:id/remove": ["users"],
  "patch /v1/user/:id": ["users"],
  "post /v1/user/create": ["users"],
  "get /v1/user/list": ["users"],
  "get /v1/avatar/send": ["files", "users"],
  "get /v1/avatar/stream": ["users", "files"],
  "post /v1/avatar/upload": ["files"],
  "post /v1/avatar/raw": ["files"],
};

export type Provider = <M extends Method, P extends Path>(
  method: M,
  path: P,
  params: Input[`${M} ${P}`],
) => Promise<Response[`${M} ${P}`]>;

export type Implementation = (
  method: Method,
  path: string,
  params: Record<string, any>,
) => Promise<any>;

export class ExpressZodAPIClient {
  constructor(protected readonly implementation: Implementation) {}
  public readonly provide: Provider = async (method, path, params) =>
    this.implementation(
      method,
      Object.keys(params).reduce(
        (acc, key) => acc.replace(`:${key}`, params[key]),
        path,
      ),
      Object.keys(params).reduce(
        (acc, key) =>
          path.indexOf(`:${key}`) >= 0 ? acc : { ...acc, [key]: params[key] },
        {},
      ),
    );
}

// Usage example:
/*
export const exampleImplementation: Implementation = async (
  method,
  path,
  params,
) => {
  const hasBody = !["get", "delete"].includes(method);
  const searchParams = hasBody ? "" : `?${new URLSearchParams(params)}`;
  const response = await fetch(`https://example.com${path}${searchParams}`, {
    method: method.toUpperCase(),
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(params) : undefined,
  });
  const contentType = response.headers.get("content-type");
  if (!contentType) return;
  const isJSON = contentType.startsWith("application/json");
  return response[isJSON ? "json" : "text"]();
};
const client = new ExpressZodAPIClient(exampleImplementation);
client.provide("get", "/v1/user/retrieve", { id: "10" });
*/
