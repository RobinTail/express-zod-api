type Type1 = {
  title: string;
  features: Type1;
}[];

export type SomeOf<T> = T[keyof T];

type GetV1UserRetrieveInput = {
  /** a numeric string containing the id of the user */
  id: string;
};

type GetV1UserRetrievePositiveVariant1 = {
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

interface GetV1UserRetrievePositiveResponseVariants {
  200: GetV1UserRetrievePositiveVariant1;
}

type GetV1UserRetrievePositiveResponse =
  SomeOf<GetV1UserRetrievePositiveResponseVariants>;

type GetV1UserRetrieveNegativeVariant1 = {
  status: "error";
  error: {
    message: string;
  };
};

interface GetV1UserRetrieveNegativeResponseVariants {
  400: GetV1UserRetrieveNegativeVariant1;
}

type GetV1UserRetrieveNegativeResponse =
  SomeOf<GetV1UserRetrieveNegativeResponseVariants>;

type GetV1UserRetrieveEncodedResponse =
  GetV1UserRetrievePositiveResponseVariants &
    GetV1UserRetrieveNegativeResponseVariants;

type GetV1UserRetrieveResponse =
  | GetV1UserRetrievePositiveResponse
  | GetV1UserRetrieveNegativeResponse;

type DeleteV1UserIdRemoveInput = {
  /** numeric string */
  id: string;
};

type DeleteV1UserIdRemovePositiveVariant1 = undefined;

interface DeleteV1UserIdRemovePositiveResponseVariants {
  204: DeleteV1UserIdRemovePositiveVariant1;
}

type DeleteV1UserIdRemovePositiveResponse =
  SomeOf<DeleteV1UserIdRemovePositiveResponseVariants>;

type DeleteV1UserIdRemoveNegativeVariant1 = undefined;

interface DeleteV1UserIdRemoveNegativeResponseVariants {
  404: DeleteV1UserIdRemoveNegativeVariant1;
}

type DeleteV1UserIdRemoveNegativeResponse =
  SomeOf<DeleteV1UserIdRemoveNegativeResponseVariants>;

type DeleteV1UserIdRemoveEncodedResponse =
  DeleteV1UserIdRemovePositiveResponseVariants &
    DeleteV1UserIdRemoveNegativeResponseVariants;

type DeleteV1UserIdRemoveResponse =
  | DeleteV1UserIdRemovePositiveResponse
  | DeleteV1UserIdRemoveNegativeResponse;

type PatchV1UserIdInput = {
  key: string;
  id: string;
  name: string;
  birthday: string;
};

type PatchV1UserIdPositiveVariant1 = {
  status: "success";
  data: {
    name: string;
    createdAt: string;
  };
};

interface PatchV1UserIdPositiveResponseVariants {
  200: PatchV1UserIdPositiveVariant1;
}

type PatchV1UserIdPositiveResponse =
  SomeOf<PatchV1UserIdPositiveResponseVariants>;

type PatchV1UserIdNegativeVariant1 = {
  status: "error";
  error: {
    message: string;
  };
};

interface PatchV1UserIdNegativeResponseVariants {
  400: PatchV1UserIdNegativeVariant1;
}

type PatchV1UserIdNegativeResponse =
  SomeOf<PatchV1UserIdNegativeResponseVariants>;

type PatchV1UserIdEncodedResponse = PatchV1UserIdPositiveResponseVariants &
  PatchV1UserIdNegativeResponseVariants;

type PatchV1UserIdResponse =
  | PatchV1UserIdPositiveResponse
  | PatchV1UserIdNegativeResponse;

type PostV1UserCreateInput = {
  name: string;
};

type PostV1UserCreatePositiveVariant1 = {
  status: "created";
  data: {
    id: number;
  };
};

interface PostV1UserCreatePositiveResponseVariants {
  201: PostV1UserCreatePositiveVariant1;
  202: PostV1UserCreatePositiveVariant1;
}

type PostV1UserCreatePositiveResponse =
  SomeOf<PostV1UserCreatePositiveResponseVariants>;

type PostV1UserCreateNegativeVariant1 = {
  status: "exists";
  id: number;
};

type PostV1UserCreateNegativeVariant2 = {
  status: "error";
  reason: string;
};

interface PostV1UserCreateNegativeResponseVariants {
  409: PostV1UserCreateNegativeVariant1;
  400: PostV1UserCreateNegativeVariant2;
  500: PostV1UserCreateNegativeVariant2;
}

type PostV1UserCreateNegativeResponse =
  SomeOf<PostV1UserCreateNegativeResponseVariants>;

type PostV1UserCreateEncodedResponse =
  PostV1UserCreatePositiveResponseVariants &
    PostV1UserCreateNegativeResponseVariants;

type PostV1UserCreateResponse =
  | PostV1UserCreatePositiveResponse
  | PostV1UserCreateNegativeResponse;

type GetV1UserListInput = {};

type GetV1UserListPositiveVariant1 = {
  name: string;
}[];

interface GetV1UserListPositiveResponseVariants {
  200: GetV1UserListPositiveVariant1;
}

type GetV1UserListPositiveResponse =
  SomeOf<GetV1UserListPositiveResponseVariants>;

type GetV1UserListNegativeVariant1 = string;

interface GetV1UserListNegativeResponseVariants {
  400: GetV1UserListNegativeVariant1;
}

type GetV1UserListNegativeResponse =
  SomeOf<GetV1UserListNegativeResponseVariants>;

type GetV1UserListEncodedResponse = GetV1UserListPositiveResponseVariants &
  GetV1UserListNegativeResponseVariants;

type GetV1UserListResponse =
  | GetV1UserListPositiveResponse
  | GetV1UserListNegativeResponse;

type GetV1AvatarSendInput = {
  userId: string;
};

type GetV1AvatarSendPositiveVariant1 = string;

interface GetV1AvatarSendPositiveResponseVariants {
  200: GetV1AvatarSendPositiveVariant1;
}

type GetV1AvatarSendPositiveResponse =
  SomeOf<GetV1AvatarSendPositiveResponseVariants>;

type GetV1AvatarSendNegativeVariant1 = string;

interface GetV1AvatarSendNegativeResponseVariants {
  400: GetV1AvatarSendNegativeVariant1;
}

type GetV1AvatarSendNegativeResponse =
  SomeOf<GetV1AvatarSendNegativeResponseVariants>;

type GetV1AvatarSendEncodedResponse = GetV1AvatarSendPositiveResponseVariants &
  GetV1AvatarSendNegativeResponseVariants;

type GetV1AvatarSendResponse =
  | GetV1AvatarSendPositiveResponse
  | GetV1AvatarSendNegativeResponse;

type GetV1AvatarStreamInput = {
  userId: string;
};

type GetV1AvatarStreamPositiveVariant1 = Buffer;

interface GetV1AvatarStreamPositiveResponseVariants {
  200: GetV1AvatarStreamPositiveVariant1;
}

type GetV1AvatarStreamPositiveResponse =
  SomeOf<GetV1AvatarStreamPositiveResponseVariants>;

type GetV1AvatarStreamNegativeVariant1 = string;

interface GetV1AvatarStreamNegativeResponseVariants {
  400: GetV1AvatarStreamNegativeVariant1;
}

type GetV1AvatarStreamNegativeResponse =
  SomeOf<GetV1AvatarStreamNegativeResponseVariants>;

type GetV1AvatarStreamEncodedResponse =
  GetV1AvatarStreamPositiveResponseVariants &
    GetV1AvatarStreamNegativeResponseVariants;

type GetV1AvatarStreamResponse =
  | GetV1AvatarStreamPositiveResponse
  | GetV1AvatarStreamNegativeResponse;

type PostV1AvatarUploadInput = {
  avatar: any;
};

type PostV1AvatarUploadPositiveVariant1 = {
  status: "success";
  data: {
    name: string;
    size: number;
    mime: string;
    hash: string;
    otherInputs: Record<string, any>;
  };
};

interface PostV1AvatarUploadPositiveResponseVariants {
  200: PostV1AvatarUploadPositiveVariant1;
}

type PostV1AvatarUploadPositiveResponse =
  SomeOf<PostV1AvatarUploadPositiveResponseVariants>;

type PostV1AvatarUploadNegativeVariant1 = {
  status: "error";
  error: {
    message: string;
  };
};

interface PostV1AvatarUploadNegativeResponseVariants {
  400: PostV1AvatarUploadNegativeVariant1;
}

type PostV1AvatarUploadNegativeResponse =
  SomeOf<PostV1AvatarUploadNegativeResponseVariants>;

type PostV1AvatarUploadEncodedResponse =
  PostV1AvatarUploadPositiveResponseVariants &
    PostV1AvatarUploadNegativeResponseVariants;

type PostV1AvatarUploadResponse =
  | PostV1AvatarUploadPositiveResponse
  | PostV1AvatarUploadNegativeResponse;

type PostV1AvatarRawInput = Buffer;

type PostV1AvatarRawPositiveVariant1 = {
  status: "success";
  data: {
    length: number;
  };
};

interface PostV1AvatarRawPositiveResponseVariants {
  200: PostV1AvatarRawPositiveVariant1;
}

type PostV1AvatarRawPositiveResponse =
  SomeOf<PostV1AvatarRawPositiveResponseVariants>;

type PostV1AvatarRawNegativeVariant1 = {
  status: "error";
  error: {
    message: string;
  };
};

interface PostV1AvatarRawNegativeResponseVariants {
  400: PostV1AvatarRawNegativeVariant1;
}

type PostV1AvatarRawNegativeResponse =
  SomeOf<PostV1AvatarRawNegativeResponseVariants>;

type PostV1AvatarRawEncodedResponse = PostV1AvatarRawPositiveResponseVariants &
  PostV1AvatarRawNegativeResponseVariants;

type PostV1AvatarRawResponse =
  | PostV1AvatarRawPositiveResponse
  | PostV1AvatarRawNegativeResponse;

type GetV1EventsTimeInput = {
  trigger?: string | undefined;
};

type GetV1EventsTimePositiveVariant1 = {
  data: number;
  event: "time";
  id?: string | undefined;
  retry?: number | undefined;
};

interface GetV1EventsTimePositiveResponseVariants {
  200: GetV1EventsTimePositiveVariant1;
}

type GetV1EventsTimePositiveResponse =
  SomeOf<GetV1EventsTimePositiveResponseVariants>;

type GetV1EventsTimeNegativeVariant1 = string;

interface GetV1EventsTimeNegativeResponseVariants {
  400: GetV1EventsTimeNegativeVariant1;
}

type GetV1EventsTimeNegativeResponse =
  SomeOf<GetV1EventsTimeNegativeResponseVariants>;

type GetV1EventsTimeEncodedResponse = GetV1EventsTimePositiveResponseVariants &
  GetV1EventsTimeNegativeResponseVariants;

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

export interface EncodedResponse {
  "get /v1/user/retrieve": GetV1UserRetrieveEncodedResponse;
  "delete /v1/user/:id/remove": DeleteV1UserIdRemoveEncodedResponse;
  "patch /v1/user/:id": PatchV1UserIdEncodedResponse;
  "post /v1/user/create": PostV1UserCreateEncodedResponse;
  "get /v1/user/list": GetV1UserListEncodedResponse;
  "get /v1/avatar/send": GetV1AvatarSendEncodedResponse;
  "get /v1/avatar/stream": GetV1AvatarStreamEncodedResponse;
  "post /v1/avatar/upload": PostV1AvatarUploadEncodedResponse;
  "post /v1/avatar/raw": PostV1AvatarRawEncodedResponse;
  "get /v1/events/time": GetV1EventsTimeEncodedResponse;
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
  "get /v1/events/time": ["subscriptions"],
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
