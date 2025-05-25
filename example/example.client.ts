type Type1 = {
  title: string;
  features?: Type1[] | undefined;
};

type Type2 = {
  errors: string[];
  items?: Type2[] | undefined;
  properties?: Record<string, Type2> | undefined;
};

type SomeOf<T> = T[keyof T];

/** get /v1/user/retrieve */
type GetV1UserRetrieveInput = {
  /** a numeric string containing the id of the user */
  id: string;
};

/** get /v1/user/retrieve */
type GetV1UserRetrievePositiveVariant1 = {
  status: "success";
  data: {
    id: number;
    name: string;
    features: Type1[];
  };
};

/** get /v1/user/retrieve */
interface GetV1UserRetrievePositiveResponseVariants {
  200: GetV1UserRetrievePositiveVariant1;
}

/** get /v1/user/retrieve */
type GetV1UserRetrieveNegativeVariant1 = {
  status: "error";
  error: {
    message: string;
  };
  tree?: Type2 | undefined;
};

/** get /v1/user/retrieve */
interface GetV1UserRetrieveNegativeResponseVariants {
  400: GetV1UserRetrieveNegativeVariant1;
}

/** delete /v1/user/:id/remove */
type DeleteV1UserIdRemoveInput = {
  /** numeric string */
  id: string;
};

/** delete /v1/user/:id/remove */
type DeleteV1UserIdRemovePositiveVariant1 = undefined;

/** delete /v1/user/:id/remove */
interface DeleteV1UserIdRemovePositiveResponseVariants {
  204: DeleteV1UserIdRemovePositiveVariant1;
}

/** delete /v1/user/:id/remove */
type DeleteV1UserIdRemoveNegativeVariant1 = undefined;

/** delete /v1/user/:id/remove */
interface DeleteV1UserIdRemoveNegativeResponseVariants {
  404: DeleteV1UserIdRemoveNegativeVariant1;
}

/** patch /v1/user/:id */
type PatchV1UserIdInput = {
  key: string;
  token: string;
  id: string;
  name: string;
  /** the day of birth */
  birthday: string;
};

/** patch /v1/user/:id */
type PatchV1UserIdPositiveVariant1 = {
  status: "success";
  data: {
    name: string;
    /** account creation date */
    createdAt: string;
  };
};

/** patch /v1/user/:id */
interface PatchV1UserIdPositiveResponseVariants {
  200: PatchV1UserIdPositiveVariant1;
}

/** patch /v1/user/:id */
type PatchV1UserIdNegativeVariant1 = {
  status: "error";
  error: {
    message: string;
  };
  tree?: Type2 | undefined;
};

/** patch /v1/user/:id */
interface PatchV1UserIdNegativeResponseVariants {
  400: PatchV1UserIdNegativeVariant1;
}

/** post /v1/user/create */
type PostV1UserCreateInput = {
  name: string;
};

/** post /v1/user/create */
type PostV1UserCreatePositiveVariant1 = {
  status: "created";
  data: {
    id: number;
  };
};

/** post /v1/user/create */
interface PostV1UserCreatePositiveResponseVariants {
  201: PostV1UserCreatePositiveVariant1;
  202: PostV1UserCreatePositiveVariant1;
}

/** post /v1/user/create */
type PostV1UserCreateNegativeVariant1 = {
  status: "exists";
  id: number;
};

/** post /v1/user/create */
type PostV1UserCreateNegativeVariant2 = {
  status: "error";
  reason: string;
};

/** post /v1/user/create */
interface PostV1UserCreateNegativeResponseVariants {
  409: PostV1UserCreateNegativeVariant1;
  400: PostV1UserCreateNegativeVariant2;
  500: PostV1UserCreateNegativeVariant2;
}

/** get /v1/user/list */
type GetV1UserListInput = {};

/** get /v1/user/list */
type GetV1UserListPositiveVariant1 = {
  name: string;
}[];

/** get /v1/user/list */
interface GetV1UserListPositiveResponseVariants {
  200: GetV1UserListPositiveVariant1;
}

/** get /v1/user/list */
type GetV1UserListNegativeVariant1 = string;

/** get /v1/user/list */
interface GetV1UserListNegativeResponseVariants {
  400: GetV1UserListNegativeVariant1;
}

/** get /v1/avatar/send */
type GetV1AvatarSendInput = {
  userId: string;
};

/** get /v1/avatar/send */
type GetV1AvatarSendPositiveVariant1 = string;

/** get /v1/avatar/send */
interface GetV1AvatarSendPositiveResponseVariants {
  200: GetV1AvatarSendPositiveVariant1;
}

/** get /v1/avatar/send */
type GetV1AvatarSendNegativeVariant1 = string;

/** get /v1/avatar/send */
interface GetV1AvatarSendNegativeResponseVariants {
  400: GetV1AvatarSendNegativeVariant1;
}

/** get /v1/avatar/stream */
type GetV1AvatarStreamInput = {
  userId: string;
};

/** get /v1/avatar/stream */
type GetV1AvatarStreamPositiveVariant1 = Buffer;

/** get /v1/avatar/stream */
interface GetV1AvatarStreamPositiveResponseVariants {
  200: GetV1AvatarStreamPositiveVariant1;
}

/** get /v1/avatar/stream */
type GetV1AvatarStreamNegativeVariant1 = string;

/** get /v1/avatar/stream */
interface GetV1AvatarStreamNegativeResponseVariants {
  400: GetV1AvatarStreamNegativeVariant1;
}

/** post /v1/avatar/upload */
type PostV1AvatarUploadInput = {
  avatar: any;
};

/** post /v1/avatar/upload */
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

/** post /v1/avatar/upload */
interface PostV1AvatarUploadPositiveResponseVariants {
  200: PostV1AvatarUploadPositiveVariant1;
}

/** post /v1/avatar/upload */
type PostV1AvatarUploadNegativeVariant1 = {
  status: "error";
  error: {
    message: string;
  };
  tree?: Type2 | undefined;
};

/** post /v1/avatar/upload */
interface PostV1AvatarUploadNegativeResponseVariants {
  400: PostV1AvatarUploadNegativeVariant1;
}

/** post /v1/avatar/raw */
type PostV1AvatarRawInput = Buffer;

/** post /v1/avatar/raw */
type PostV1AvatarRawPositiveVariant1 = {
  status: "success";
  data: {
    length: number;
  };
};

/** post /v1/avatar/raw */
interface PostV1AvatarRawPositiveResponseVariants {
  200: PostV1AvatarRawPositiveVariant1;
}

/** post /v1/avatar/raw */
type PostV1AvatarRawNegativeVariant1 = {
  status: "error";
  error: {
    message: string;
  };
  tree?: Type2 | undefined;
};

/** post /v1/avatar/raw */
interface PostV1AvatarRawNegativeResponseVariants {
  400: PostV1AvatarRawNegativeVariant1;
}

/** get /v1/events/stream */
type GetV1EventsStreamInput = {
  /** @deprecated for testing error response */
  trigger?: string | undefined;
};

/** get /v1/events/stream */
type GetV1EventsStreamPositiveVariant1 = {
  data: number;
  event: "time";
  id?: string | undefined;
  retry?: number | undefined;
};

/** get /v1/events/stream */
interface GetV1EventsStreamPositiveResponseVariants {
  200: GetV1EventsStreamPositiveVariant1;
}

/** get /v1/events/stream */
type GetV1EventsStreamNegativeVariant1 = string;

/** get /v1/events/stream */
interface GetV1EventsStreamNegativeResponseVariants {
  400: GetV1EventsStreamNegativeVariant1;
}

/** post /v1/forms/feedback */
type PostV1FormsFeedbackInput = {
  name: string;
  email: string;
  message: string;
};

/** post /v1/forms/feedback */
type PostV1FormsFeedbackPositiveVariant1 = {
  status: "success";
  data: {
    crc: number;
  };
};

/** post /v1/forms/feedback */
interface PostV1FormsFeedbackPositiveResponseVariants {
  200: PostV1FormsFeedbackPositiveVariant1;
}

/** post /v1/forms/feedback */
type PostV1FormsFeedbackNegativeVariant1 = {
  status: "error";
  error: {
    message: string;
  };
  tree?: Type2 | undefined;
};

/** post /v1/forms/feedback */
interface PostV1FormsFeedbackNegativeResponseVariants {
  400: PostV1FormsFeedbackNegativeVariant1;
}

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
  | "/v1/events/stream"
  | "/v1/forms/feedback";

export type Method = "get" | "post" | "put" | "delete" | "patch";

export interface Input {
  "get /v1/user/retrieve": GetV1UserRetrieveInput;
  "delete /v1/user/:id/remove": DeleteV1UserIdRemoveInput;
  "patch /v1/user/:id": PatchV1UserIdInput;
  "post /v1/user/create": PostV1UserCreateInput;
  "get /v1/user/list": GetV1UserListInput;
  /** @deprecated */
  "get /v1/avatar/send": GetV1AvatarSendInput;
  "get /v1/avatar/stream": GetV1AvatarStreamInput;
  "post /v1/avatar/upload": PostV1AvatarUploadInput;
  "post /v1/avatar/raw": PostV1AvatarRawInput;
  "get /v1/events/stream": GetV1EventsStreamInput;
  "post /v1/forms/feedback": PostV1FormsFeedbackInput;
}

export interface PositiveResponse {
  "get /v1/user/retrieve": SomeOf<GetV1UserRetrievePositiveResponseVariants>;
  "delete /v1/user/:id/remove": SomeOf<DeleteV1UserIdRemovePositiveResponseVariants>;
  "patch /v1/user/:id": SomeOf<PatchV1UserIdPositiveResponseVariants>;
  "post /v1/user/create": SomeOf<PostV1UserCreatePositiveResponseVariants>;
  "get /v1/user/list": SomeOf<GetV1UserListPositiveResponseVariants>;
  /** @deprecated */
  "get /v1/avatar/send": SomeOf<GetV1AvatarSendPositiveResponseVariants>;
  "get /v1/avatar/stream": SomeOf<GetV1AvatarStreamPositiveResponseVariants>;
  "post /v1/avatar/upload": SomeOf<PostV1AvatarUploadPositiveResponseVariants>;
  "post /v1/avatar/raw": SomeOf<PostV1AvatarRawPositiveResponseVariants>;
  "get /v1/events/stream": SomeOf<GetV1EventsStreamPositiveResponseVariants>;
  "post /v1/forms/feedback": SomeOf<PostV1FormsFeedbackPositiveResponseVariants>;
}

export interface NegativeResponse {
  "get /v1/user/retrieve": SomeOf<GetV1UserRetrieveNegativeResponseVariants>;
  "delete /v1/user/:id/remove": SomeOf<DeleteV1UserIdRemoveNegativeResponseVariants>;
  "patch /v1/user/:id": SomeOf<PatchV1UserIdNegativeResponseVariants>;
  "post /v1/user/create": SomeOf<PostV1UserCreateNegativeResponseVariants>;
  "get /v1/user/list": SomeOf<GetV1UserListNegativeResponseVariants>;
  /** @deprecated */
  "get /v1/avatar/send": SomeOf<GetV1AvatarSendNegativeResponseVariants>;
  "get /v1/avatar/stream": SomeOf<GetV1AvatarStreamNegativeResponseVariants>;
  "post /v1/avatar/upload": SomeOf<PostV1AvatarUploadNegativeResponseVariants>;
  "post /v1/avatar/raw": SomeOf<PostV1AvatarRawNegativeResponseVariants>;
  "get /v1/events/stream": SomeOf<GetV1EventsStreamNegativeResponseVariants>;
  "post /v1/forms/feedback": SomeOf<PostV1FormsFeedbackNegativeResponseVariants>;
}

export interface EncodedResponse {
  "get /v1/user/retrieve": GetV1UserRetrievePositiveResponseVariants &
    GetV1UserRetrieveNegativeResponseVariants;
  "delete /v1/user/:id/remove": DeleteV1UserIdRemovePositiveResponseVariants &
    DeleteV1UserIdRemoveNegativeResponseVariants;
  "patch /v1/user/:id": PatchV1UserIdPositiveResponseVariants &
    PatchV1UserIdNegativeResponseVariants;
  "post /v1/user/create": PostV1UserCreatePositiveResponseVariants &
    PostV1UserCreateNegativeResponseVariants;
  "get /v1/user/list": GetV1UserListPositiveResponseVariants &
    GetV1UserListNegativeResponseVariants;
  /** @deprecated */
  "get /v1/avatar/send": GetV1AvatarSendPositiveResponseVariants &
    GetV1AvatarSendNegativeResponseVariants;
  "get /v1/avatar/stream": GetV1AvatarStreamPositiveResponseVariants &
    GetV1AvatarStreamNegativeResponseVariants;
  "post /v1/avatar/upload": PostV1AvatarUploadPositiveResponseVariants &
    PostV1AvatarUploadNegativeResponseVariants;
  "post /v1/avatar/raw": PostV1AvatarRawPositiveResponseVariants &
    PostV1AvatarRawNegativeResponseVariants;
  "get /v1/events/stream": GetV1EventsStreamPositiveResponseVariants &
    GetV1EventsStreamNegativeResponseVariants;
  "post /v1/forms/feedback": PostV1FormsFeedbackPositiveResponseVariants &
    PostV1FormsFeedbackNegativeResponseVariants;
}

export interface Response {
  "get /v1/user/retrieve":
    | PositiveResponse["get /v1/user/retrieve"]
    | NegativeResponse["get /v1/user/retrieve"];
  "delete /v1/user/:id/remove":
    | PositiveResponse["delete /v1/user/:id/remove"]
    | NegativeResponse["delete /v1/user/:id/remove"];
  "patch /v1/user/:id":
    | PositiveResponse["patch /v1/user/:id"]
    | NegativeResponse["patch /v1/user/:id"];
  "post /v1/user/create":
    | PositiveResponse["post /v1/user/create"]
    | NegativeResponse["post /v1/user/create"];
  "get /v1/user/list":
    | PositiveResponse["get /v1/user/list"]
    | NegativeResponse["get /v1/user/list"];
  /** @deprecated */
  "get /v1/avatar/send":
    | PositiveResponse["get /v1/avatar/send"]
    | NegativeResponse["get /v1/avatar/send"];
  "get /v1/avatar/stream":
    | PositiveResponse["get /v1/avatar/stream"]
    | NegativeResponse["get /v1/avatar/stream"];
  "post /v1/avatar/upload":
    | PositiveResponse["post /v1/avatar/upload"]
    | NegativeResponse["post /v1/avatar/upload"];
  "post /v1/avatar/raw":
    | PositiveResponse["post /v1/avatar/raw"]
    | NegativeResponse["post /v1/avatar/raw"];
  "get /v1/events/stream":
    | PositiveResponse["get /v1/events/stream"]
    | NegativeResponse["get /v1/events/stream"];
  "post /v1/forms/feedback":
    | PositiveResponse["post /v1/forms/feedback"]
    | NegativeResponse["post /v1/forms/feedback"];
}

export type Request = keyof Input;

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
  "get /v1/events/stream": ["subscriptions"],
  "post /v1/forms/feedback": ["forms"],
};

const parseRequest = (request: string) =>
  request.split(/ (.+)/, 2) as [Method, Path];

const substitute = (path: string, params: Record<string, any>) => {
  const rest = { ...params };
  for (const key in params) {
    path = path.replace(`:${key}`, () => {
      delete rest[key];
      return params[key];
    });
  }
  return [path, rest] as const;
};

export type Implementation<T = unknown> = (
  method: Method,
  path: string,
  params: Record<string, any>,
  ctx?: T,
) => Promise<any>;

const defaultImplementation: Implementation = async (method, path, params) => {
  const hasBody = !["get", "delete"].includes(method);
  const searchParams = hasBody ? "" : `?${new URLSearchParams(params)}`;
  const response = await fetch(
    new URL(`${path}${searchParams}`, "http://localhost:8090"),
    {
      method: method.toUpperCase(),
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(params) : undefined,
    },
  );
  const contentType = response.headers.get("content-type");
  if (!contentType) return;
  const isJSON = contentType.startsWith("application/json");
  return response[isJSON ? "json" : "text"]();
};

export class Client<T> {
  public constructor(
    protected readonly implementation: Implementation<T> = defaultImplementation,
  ) {}
  public provide<K extends Request>(
    request: K,
    params: Input[K],
    ctx?: T,
  ): Promise<Response[K]> {
    const [method, path] = parseRequest(request);
    return this.implementation(method, ...substitute(path, params), ctx);
  }
}

export class Subscription<
  K extends Extract<Request, `get ${string}`>,
  R extends Extract<PositiveResponse[K], { event: string }>,
> {
  public source: EventSource;
  public constructor(request: K, params: Input[K]) {
    const [path, rest] = substitute(parseRequest(request)[1], params);
    const searchParams = `?${new URLSearchParams(rest)}`;
    this.source = new EventSource(
      new URL(`${path}${searchParams}`, "http://localhost:8090"),
    );
  }
  public on<E extends R["event"]>(
    event: E,
    handler: (data: Extract<R, { event: E }>["data"]) => void | Promise<void>,
  ) {
    this.source.addEventListener(event, (msg) =>
      handler(JSON.parse((msg as MessageEvent).data)),
    );
    return this;
  }
}

// Usage example:
/*
const client = new Client();
client.provide("get /v1/user/retrieve", { id: "10" });
new Subscription("get /v1/events/stream", {}).on("time", (time) => {});
*/
