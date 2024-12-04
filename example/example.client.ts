type Type1 = {
  title: string;
  features: Type1;
}[];

type GetV1UserRetrieveInput = {
  /** a numeric string containing the id of the user */
  id: string;
};

type GetV1UserRetrievePositiveResponse = {
  status: "success";
  data: {
    id: number;
    name: string;
    features: {
      title: string;
      features: Type1;
    }[];
  };
};

type GetV1UserRetrieveNegativeResponse = {
  status: "error";
  error: {
    message: string;
  };
};

type GetV1UserRetrieveResponse =
  | GetV1UserRetrievePositiveResponse
  | GetV1UserRetrieveNegativeResponse;

type DeleteV1UserIdRemoveInput = {
  /** numeric string */
  id: string;
};

type DeleteV1UserIdRemovePositiveResponse = undefined;

type DeleteV1UserIdRemoveNegativeResponse = undefined;

type DeleteV1UserIdRemoveResponse =
  | DeleteV1UserIdRemovePositiveResponse
  | DeleteV1UserIdRemoveNegativeResponse;

type PatchV1UserIdInput = {
  key: string;
  id: string;
  name: string;
  birthday: string;
};

type PatchV1UserIdPositiveResponse = {
  status: "success";
  data: {
    name: string;
    createdAt: string;
  };
};

type PatchV1UserIdNegativeResponse = {
  status: "error";
  error: {
    message: string;
  };
};

type PatchV1UserIdResponse =
  | PatchV1UserIdPositiveResponse
  | PatchV1UserIdNegativeResponse;

type PostV1UserCreateInput = {
  name: string;
};

type PostV1UserCreatePositiveResponse = {
  status: "created";
  data: {
    id: number;
  };
};

type PostV1UserCreateNegativeResponse =
  | {
      status: "exists";
      id: number;
    }
  | {
      status: "error";
      reason: string;
    };

type PostV1UserCreateResponse =
  | PostV1UserCreatePositiveResponse
  | PostV1UserCreateNegativeResponse;

type GetV1UserListInput = {};

type GetV1UserListPositiveResponse = {
  name: string;
}[];

type GetV1UserListNegativeResponse = string;

type GetV1UserListResponse =
  | GetV1UserListPositiveResponse
  | GetV1UserListNegativeResponse;

type GetV1AvatarSendInput = {
  userId: string;
};

type GetV1AvatarSendPositiveResponse = string;

type GetV1AvatarSendNegativeResponse = string;

type GetV1AvatarSendResponse =
  | GetV1AvatarSendPositiveResponse
  | GetV1AvatarSendNegativeResponse;

type GetV1AvatarStreamInput = {
  userId: string;
};

type GetV1AvatarStreamPositiveResponse = Buffer;

type GetV1AvatarStreamNegativeResponse = string;

type GetV1AvatarStreamResponse =
  | GetV1AvatarStreamPositiveResponse
  | GetV1AvatarStreamNegativeResponse;

type PostV1AvatarUploadInput = {
  avatar: any;
};

type PostV1AvatarUploadPositiveResponse = {
  status: "success";
  data: {
    name: string;
    size: number;
    mime: string;
    hash: string;
    otherInputs: Record<string, any>;
  };
};

type PostV1AvatarUploadNegativeResponse = {
  status: "error";
  error: {
    message: string;
  };
};

type PostV1AvatarUploadResponse =
  | PostV1AvatarUploadPositiveResponse
  | PostV1AvatarUploadNegativeResponse;

type PostV1AvatarRawInput = Buffer;

type PostV1AvatarRawPositiveResponse = {
  status: "success";
  data: {
    length: number;
  };
};

type PostV1AvatarRawNegativeResponse = {
  status: "error";
  error: {
    message: string;
  };
};

type PostV1AvatarRawResponse =
  | PostV1AvatarRawPositiveResponse
  | PostV1AvatarRawNegativeResponse;

type GetV1EventsTimeInput = {};

type GetV1EventsTimePositiveResponse = {
  data: {};
  event?: string | undefined;
  id?: string | undefined;
  retry?: number | undefined;
};

type GetV1EventsTimeNegativeResponse = string;

type GetV1EventsTimeResponse =
  | GetV1EventsTimePositiveResponse
  | GetV1EventsTimeNegativeResponse;

export type Path =
  | "/v1/user/retrieve"
  | "/v1/user/:id/remove"
  | "/v1/user/:id"
  | "/v1/user/create"
  | "/v1/user/list"
  | "/v1/avatar/send"
  | "/v1/avatar/stream"
  | "/v1/avatar/upload"
  | "/v1/avatar/raw"
  | "/v1/events/time";

export type Method = "get" | "post" | "put" | "delete" | "patch";

export interface Input {
  "get /v1/user/retrieve": GetV1UserRetrieveInput;
  "delete /v1/user/:id/remove": DeleteV1UserIdRemoveInput;
  "patch /v1/user/:id": PatchV1UserIdInput;
  "post /v1/user/create": PostV1UserCreateInput;
  "get /v1/user/list": GetV1UserListInput;
  "get /v1/avatar/send": GetV1AvatarSendInput;
  "get /v1/avatar/stream": GetV1AvatarStreamInput;
  "post /v1/avatar/upload": PostV1AvatarUploadInput;
  "post /v1/avatar/raw": PostV1AvatarRawInput;
  "get /v1/events/time": GetV1EventsTimeInput;
}

export interface PositiveResponse {
  "get /v1/user/retrieve": GetV1UserRetrievePositiveResponse;
  "delete /v1/user/:id/remove": DeleteV1UserIdRemovePositiveResponse;
  "patch /v1/user/:id": PatchV1UserIdPositiveResponse;
  "post /v1/user/create": PostV1UserCreatePositiveResponse;
  "get /v1/user/list": GetV1UserListPositiveResponse;
  "get /v1/avatar/send": GetV1AvatarSendPositiveResponse;
  "get /v1/avatar/stream": GetV1AvatarStreamPositiveResponse;
  "post /v1/avatar/upload": PostV1AvatarUploadPositiveResponse;
  "post /v1/avatar/raw": PostV1AvatarRawPositiveResponse;
  "get /v1/events/time": GetV1EventsTimePositiveResponse;
}

export interface NegativeResponse {
  "get /v1/user/retrieve": GetV1UserRetrieveNegativeResponse;
  "delete /v1/user/:id/remove": DeleteV1UserIdRemoveNegativeResponse;
  "patch /v1/user/:id": PatchV1UserIdNegativeResponse;
  "post /v1/user/create": PostV1UserCreateNegativeResponse;
  "get /v1/user/list": GetV1UserListNegativeResponse;
  "get /v1/avatar/send": GetV1AvatarSendNegativeResponse;
  "get /v1/avatar/stream": GetV1AvatarStreamNegativeResponse;
  "post /v1/avatar/upload": PostV1AvatarUploadNegativeResponse;
  "post /v1/avatar/raw": PostV1AvatarRawNegativeResponse;
  "get /v1/events/time": GetV1EventsTimeNegativeResponse;
}

export interface Response {
  "get /v1/user/retrieve": GetV1UserRetrieveResponse;
  "delete /v1/user/:id/remove": DeleteV1UserIdRemoveResponse;
  "patch /v1/user/:id": PatchV1UserIdResponse;
  "post /v1/user/create": PostV1UserCreateResponse;
  "get /v1/user/list": GetV1UserListResponse;
  "get /v1/avatar/send": GetV1AvatarSendResponse;
  "get /v1/avatar/stream": GetV1AvatarStreamResponse;
  "post /v1/avatar/upload": PostV1AvatarUploadResponse;
  "post /v1/avatar/raw": PostV1AvatarRawResponse;
  "get /v1/events/time": GetV1EventsTimeResponse;
}

export type MethodPath = keyof Input;

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
  "get /v1/events/time": [],
};

export type Implementation = (
  method: Method,
  path: string,
  params: Record<string, any>,
) => Promise<any>;

export class ExpressZodAPIClient {
  constructor(protected readonly implementation: Implementation) {}
  /** @deprecated use the overload with 2 arguments instead */
  public provide<M extends Method, P extends Path>(
    method: M,
    path: P,
    params: `${M} ${P}` extends keyof Input
      ? Input[`${M} ${P}`]
      : Record<string, any>,
  ): Promise<
    `${M} ${P}` extends keyof Response ? Response[`${M} ${P}`] : unknown
  >;
  public provide<K extends MethodPath>(
    request: K,
    params: Input[K],
  ): Promise<Response[K]>;
  public provide(
    ...args:
      | [string, string, Record<string, any>]
      | [string, Record<string, any>]
  ) {
    const [method, path, params] = (
      args.length === 2 ? [...args[0].split(/ (.+)/, 2), args[1]] : args
    ) as [Method, Path, Record<string, any>];
    return this.implementation(
      method,
      Object.keys(params).reduce(
        (acc, key) => acc.replace(`:${key}`, params[key]),
        path,
      ),
      Object.keys(params).reduce(
        (acc, key) =>
          Object.assign(
            acc,
            !path.includes(`:${key}`) && { [key]: params[key] },
          ),
        {},
      ),
    );
  }
}

/** @deprecated will be removed in v22 */
export type Provider = ExpressZodAPIClient["provide"];

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
client.provide("get /v1/user/retrieve", { id: "10" });
*/
