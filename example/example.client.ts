type Type1 = {
  title: string;
  features: Type1;
}[];

export type SomeOf<T> = T[keyof T];

type GetV1UserRetrieveInput = {
  /** a numeric string containing the id of the user */
  id: string;
};

type GetV1UserRetrievePositiveVariant0 = {
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

export interface GetV1UserRetrievePositiveResponseVariants {
  200: GetV1UserRetrievePositiveVariant0;
}

type GetV1UserRetrievePositiveResponse =
  SomeOf<GetV1UserRetrievePositiveResponseVariants>;

type GetV1UserRetrieveNegativeVariant0 = {
  status: "error";
  error: {
    message: string;
  };
};

export interface GetV1UserRetrieveNegativeResponseVariants {
  400: GetV1UserRetrieveNegativeVariant0;
}

type GetV1UserRetrieveNegativeResponse =
  SomeOf<GetV1UserRetrieveNegativeResponseVariants>;

type GetV1UserRetrieveResponse =
  | GetV1UserRetrievePositiveResponse
  | GetV1UserRetrieveNegativeResponse;

type DeleteV1UserIdRemoveInput = {
  /** numeric string */
  id: string;
};

type DeleteV1UserIdRemovePositiveVariant0 = undefined;

export interface DeleteV1UserIdRemovePositiveResponseVariants {
  204: DeleteV1UserIdRemovePositiveVariant0;
}

type DeleteV1UserIdRemovePositiveResponse =
  SomeOf<DeleteV1UserIdRemovePositiveResponseVariants>;

type DeleteV1UserIdRemoveNegativeVariant0 = undefined;

export interface DeleteV1UserIdRemoveNegativeResponseVariants {
  404: DeleteV1UserIdRemoveNegativeVariant0;
}

type DeleteV1UserIdRemoveNegativeResponse =
  SomeOf<DeleteV1UserIdRemoveNegativeResponseVariants>;

type DeleteV1UserIdRemoveResponse =
  | DeleteV1UserIdRemovePositiveResponse
  | DeleteV1UserIdRemoveNegativeResponse;

type PatchV1UserIdInput = {
  key: string;
  id: string;
  name: string;
  birthday: string;
};

type PatchV1UserIdPositiveVariant0 = {
  status: "success";
  data: {
    name: string;
    createdAt: string;
  };
};

export interface PatchV1UserIdPositiveResponseVariants {
  200: PatchV1UserIdPositiveVariant0;
}

type PatchV1UserIdPositiveResponse =
  SomeOf<PatchV1UserIdPositiveResponseVariants>;

type PatchV1UserIdNegativeVariant0 = {
  status: "error";
  error: {
    message: string;
  };
};

export interface PatchV1UserIdNegativeResponseVariants {
  400: PatchV1UserIdNegativeVariant0;
}

type PatchV1UserIdNegativeResponse =
  SomeOf<PatchV1UserIdNegativeResponseVariants>;

type PatchV1UserIdResponse =
  | PatchV1UserIdPositiveResponse
  | PatchV1UserIdNegativeResponse;

type PostV1UserCreateInput = {
  name: string;
};

type PostV1UserCreatePositiveVariant0 = {
  status: "created";
  data: {
    id: number;
  };
};

export interface PostV1UserCreatePositiveResponseVariants {
  201: PostV1UserCreatePositiveVariant0;
  202: PostV1UserCreatePositiveVariant0;
}

type PostV1UserCreatePositiveResponse =
  SomeOf<PostV1UserCreatePositiveResponseVariants>;

type PostV1UserCreateNegativeVariant0 = {
  status: "exists";
  id: number;
};

type PostV1UserCreateNegativeVariant1 = {
  status: "error";
  reason: string;
};

export interface PostV1UserCreateNegativeResponseVariants {
  409: PostV1UserCreateNegativeVariant0;
  400: PostV1UserCreateNegativeVariant1;
  500: PostV1UserCreateNegativeVariant1;
}

type PostV1UserCreateNegativeResponse =
  SomeOf<PostV1UserCreateNegativeResponseVariants>;

type PostV1UserCreateResponse =
  | PostV1UserCreatePositiveResponse
  | PostV1UserCreateNegativeResponse;

type GetV1UserListInput = {};

type GetV1UserListPositiveVariant0 = {
  name: string;
}[];

export interface GetV1UserListPositiveResponseVariants {
  200: GetV1UserListPositiveVariant0;
}

type GetV1UserListPositiveResponse =
  SomeOf<GetV1UserListPositiveResponseVariants>;

type GetV1UserListNegativeVariant0 = string;

export interface GetV1UserListNegativeResponseVariants {
  400: GetV1UserListNegativeVariant0;
}

type GetV1UserListNegativeResponse =
  SomeOf<GetV1UserListNegativeResponseVariants>;

type GetV1UserListResponse =
  | GetV1UserListPositiveResponse
  | GetV1UserListNegativeResponse;

type GetV1AvatarSendInput = {
  userId: string;
};

type GetV1AvatarSendPositiveVariant0 = string;

export interface GetV1AvatarSendPositiveResponseVariants {
  200: GetV1AvatarSendPositiveVariant0;
}

type GetV1AvatarSendPositiveResponse =
  SomeOf<GetV1AvatarSendPositiveResponseVariants>;

type GetV1AvatarSendNegativeVariant0 = string;

export interface GetV1AvatarSendNegativeResponseVariants {
  400: GetV1AvatarSendNegativeVariant0;
}

type GetV1AvatarSendNegativeResponse =
  SomeOf<GetV1AvatarSendNegativeResponseVariants>;

type GetV1AvatarSendResponse =
  | GetV1AvatarSendPositiveResponse
  | GetV1AvatarSendNegativeResponse;

type GetV1AvatarStreamInput = {
  userId: string;
};

type GetV1AvatarStreamPositiveVariant0 = Buffer;

export interface GetV1AvatarStreamPositiveResponseVariants {
  200: GetV1AvatarStreamPositiveVariant0;
}

type GetV1AvatarStreamPositiveResponse =
  SomeOf<GetV1AvatarStreamPositiveResponseVariants>;

type GetV1AvatarStreamNegativeVariant0 = string;

export interface GetV1AvatarStreamNegativeResponseVariants {
  400: GetV1AvatarStreamNegativeVariant0;
}

type GetV1AvatarStreamNegativeResponse =
  SomeOf<GetV1AvatarStreamNegativeResponseVariants>;

type GetV1AvatarStreamResponse =
  | GetV1AvatarStreamPositiveResponse
  | GetV1AvatarStreamNegativeResponse;

type PostV1AvatarUploadInput = {
  avatar: any;
};

type PostV1AvatarUploadPositiveVariant0 = {
  status: "success";
  data: {
    name: string;
    size: number;
    mime: string;
    hash: string;
    otherInputs: Record<string, any>;
  };
};

export interface PostV1AvatarUploadPositiveResponseVariants {
  200: PostV1AvatarUploadPositiveVariant0;
}

type PostV1AvatarUploadPositiveResponse =
  SomeOf<PostV1AvatarUploadPositiveResponseVariants>;

type PostV1AvatarUploadNegativeVariant0 = {
  status: "error";
  error: {
    message: string;
  };
};

export interface PostV1AvatarUploadNegativeResponseVariants {
  400: PostV1AvatarUploadNegativeVariant0;
}

type PostV1AvatarUploadNegativeResponse =
  SomeOf<PostV1AvatarUploadNegativeResponseVariants>;

type PostV1AvatarUploadResponse =
  | PostV1AvatarUploadPositiveResponse
  | PostV1AvatarUploadNegativeResponse;

type PostV1AvatarRawInput = Buffer;

type PostV1AvatarRawPositiveVariant0 = {
  status: "success";
  data: {
    length: number;
  };
};

export interface PostV1AvatarRawPositiveResponseVariants {
  200: PostV1AvatarRawPositiveVariant0;
}

type PostV1AvatarRawPositiveResponse =
  SomeOf<PostV1AvatarRawPositiveResponseVariants>;

type PostV1AvatarRawNegativeVariant0 = {
  status: "error";
  error: {
    message: string;
  };
};

export interface PostV1AvatarRawNegativeResponseVariants {
  400: PostV1AvatarRawNegativeVariant0;
}

type PostV1AvatarRawNegativeResponse =
  SomeOf<PostV1AvatarRawNegativeResponseVariants>;

type PostV1AvatarRawResponse =
  | PostV1AvatarRawPositiveResponse
  | PostV1AvatarRawNegativeResponse;

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
