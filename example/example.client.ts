/** get /v1/user/retrieve */
type GetV1UserRetrieveInput = {
  /** a numeric string containing the id of the user */
  id: string;
};

type Type1 = {
  title: string;
  features?: Type1[] | undefined;
};

/** get /v1/user/retrieve */
type GetV1UserRetrievePositiveVariant1 = {
  id: number;
  name: string;
  features: Type1[];
};

/** get /v1/user/retrieve */
type GetV1UserRetrieveNegativeVariant1 = {
  message: string;
};

/** head /v1/user/retrieve */
type HeadV1UserRetrieveInput = {
  /** a numeric string containing the id of the user */
  id: string;
};

/** head /v1/user/retrieve */
type HeadV1UserRetrievePositiveVariant1 = undefined;

/** head /v1/user/retrieve */
type HeadV1UserRetrieveNegativeVariant1 = undefined;

/** delete /v1/user/:id/remove */
type DeleteV1UserIdRemoveInput = {
  /** numeric string */
  id: string;
};

/** delete /v1/user/:id/remove */
type DeleteV1UserIdRemovePositiveVariant1 = undefined;

/** delete /v1/user/:id/remove */
type DeleteV1UserIdRemoveNegativeVariant1 = undefined;

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
  name: string;
  /** account creation date */
  createdAt: string;
};

/** patch /v1/user/:id */
type PatchV1UserIdNegativeVariant1 = {
  message: string;
};

/** post /v1/user/create */
type PostV1UserCreateInput = {
  /** first name and last name */
  name: `${string} ${string}`;
};

/** post /v1/user/create */
type PostV1UserCreatePositiveVariant1 = {
  status: "created";
  data: {
    id: number;
  };
};

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

/** query /v1/user/list */
type QueryV1UserListInput = {
  roles?: ("manager" | "operator" | "admin")[] | undefined;
};

/** query /v1/user/list */
type QueryV1UserListPositiveVariant1 = {
  name: string;
  role: "manager" | "operator" | "admin";
}[];

/** query /v1/user/list */
type QueryV1UserListNegativeVariant1 = string;

/** post /v1/login */
type PostV1LoginInput = {
  username: string;
  password: string;
};

/** post /v1/login */
type PostV1LoginPositiveVariant1 = {
  message: string;
};

/** post /v1/login */
type PostV1LoginNegativeVariant1 = {
  message: string;
};

/** get /v1/avatar/send */
type GetV1AvatarSendInput = {
  userId: string;
};

/** get /v1/avatar/send */
type GetV1AvatarSendPositiveVariant1 = string;

/** get /v1/avatar/send */
type GetV1AvatarSendNegativeVariant1 = string;

/** head /v1/avatar/send */
type HeadV1AvatarSendInput = {
  userId: string;
};

/** head /v1/avatar/send */
type HeadV1AvatarSendPositiveVariant1 = undefined;

/** head /v1/avatar/send */
type HeadV1AvatarSendNegativeVariant1 = undefined;

/** get /v1/avatar/stream */
type GetV1AvatarStreamInput = {
  userId: string;
};

/** get /v1/avatar/stream */
type GetV1AvatarStreamPositiveVariant1 = Blob;

/** get /v1/avatar/stream */
type GetV1AvatarStreamNegativeVariant1 = string;

/** head /v1/avatar/stream */
type HeadV1AvatarStreamInput = {
  userId: string;
};

/** head /v1/avatar/stream */
type HeadV1AvatarStreamPositiveVariant1 = undefined;

/** head /v1/avatar/stream */
type HeadV1AvatarStreamNegativeVariant1 = undefined;

/** post /v1/avatar/upload */
type PostV1AvatarUploadInput = Omit<
  {
    session: {
      token: string;
    };
    avatar: any;
  },
  /** security cookies */
  "session"
>;

/** post /v1/avatar/upload */
type PostV1AvatarUploadPositiveVariant1 = {
  name: string;
  size: number;
  mime: string;
  hash: string;
  otherInputs: Record<string, any>;
};

/** post /v1/avatar/upload */
type PostV1AvatarUploadNegativeVariant1 = {
  message: string;
};

/** post /v1/avatar/raw */
type PostV1AvatarRawInput = Blob;

/** post /v1/avatar/raw */
type PostV1AvatarRawPositiveVariant1 = {
  length: number;
};

/** post /v1/avatar/raw */
type PostV1AvatarRawNegativeVariant1 = {
  message: string;
};

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
type GetV1EventsStreamNegativeVariant1 = string;

/** head /v1/events/stream */
type HeadV1EventsStreamInput = {
  /** @deprecated for testing error response */
  trigger?: string | undefined;
};

/** head /v1/events/stream */
type HeadV1EventsStreamPositiveVariant1 = undefined;

/** head /v1/events/stream */
type HeadV1EventsStreamNegativeVariant1 = undefined;

/** post /v1/forms/feedback */
type PostV1FormsFeedbackInput = {
  name: string;
  email: string;
  message: string;
};

/** post /v1/forms/feedback */
type PostV1FormsFeedbackPositiveVariant1 = {
  crc: number;
};

/** post /v1/forms/feedback */
type PostV1FormsFeedbackNegativeVariant1 = {
  message: string;
};

/** get /v2/users/list */
type GetV2UsersListInput = {
  /** Page size (number of users per page) */
  limit?: number | undefined;
  /** Number of users to skip */
  offset?: number | undefined;
  /** Filter by roles; omit for all */
  roles?: ("manager" | "operator" | "admin")[] | undefined;
};

/** get /v2/users/list */
type GetV2UsersListPositiveVariant1 = {
  /** Page of users */
  users: {
    name: string;
    role: "manager" | "operator" | "admin";
  }[];
  /** Total number of users */
  total: number;
  /** Page size used */
  limit: number;
  /** Offset used */
  offset: number;
};

/** get /v2/users/list */
type GetV2UsersListNegativeVariant1 = {
  message: string;
};

/** head /v2/users/list */
type HeadV2UsersListInput = {
  /** Page size (number of users per page) */
  limit?: number | undefined;
  /** Number of users to skip */
  offset?: number | undefined;
  /** Filter by roles; omit for all */
  roles?: ("manager" | "operator" | "admin")[] | undefined;
};

/** head /v2/users/list */
type HeadV2UsersListPositiveVariant1 = undefined;

/** head /v2/users/list */
type HeadV2UsersListNegativeVariant1 = undefined;

export type Path =
  | "/v1/user/retrieve"
  | "/v1/user/:id/remove"
  | "/v1/user/:id"
  | "/v1/user/create"
  | "/v1/user/list"
  | "/v1/login"
  | "/v1/avatar/send"
  | "/v1/avatar/stream"
  | "/v1/avatar/upload"
  | "/v1/avatar/raw"
  | "/v1/events/stream"
  | "/v1/forms/feedback"
  | "/v2/users/list";

export type Method = "get" | "post" | "put" | "delete" | "patch" | "query" | "head";

export interface Input {
  "get /v1/user/retrieve": GetV1UserRetrieveInput;
  "head /v1/user/retrieve": HeadV1UserRetrieveInput;
  "delete /v1/user/:id/remove": DeleteV1UserIdRemoveInput;
  "patch /v1/user/:id": PatchV1UserIdInput;
  "post /v1/user/create": PostV1UserCreateInput;
  "query /v1/user/list": QueryV1UserListInput;
  "post /v1/login": PostV1LoginInput;
  /** @deprecated */
  "get /v1/avatar/send": GetV1AvatarSendInput;
  /** @deprecated */
  "head /v1/avatar/send": HeadV1AvatarSendInput;
  "get /v1/avatar/stream": GetV1AvatarStreamInput;
  "head /v1/avatar/stream": HeadV1AvatarStreamInput;
  "post /v1/avatar/upload": PostV1AvatarUploadInput;
  "post /v1/avatar/raw": PostV1AvatarRawInput;
  "get /v1/events/stream": GetV1EventsStreamInput;
  "head /v1/events/stream": HeadV1EventsStreamInput;
  "post /v1/forms/feedback": PostV1FormsFeedbackInput;
  "get /v2/users/list": GetV2UsersListInput;
  "head /v2/users/list": HeadV2UsersListInput;
}

export interface PositiveResponse {
  "get /v1/user/retrieve": GetV1UserRetrievePositiveVariant1;
  "head /v1/user/retrieve": HeadV1UserRetrievePositiveVariant1;
  "delete /v1/user/:id/remove": DeleteV1UserIdRemovePositiveVariant1;
  "patch /v1/user/:id": PatchV1UserIdPositiveVariant1;
  "post /v1/user/create": PostV1UserCreatePositiveVariant1;
  "query /v1/user/list": QueryV1UserListPositiveVariant1;
  "post /v1/login": PostV1LoginPositiveVariant1;
  /** @deprecated */
  "get /v1/avatar/send": GetV1AvatarSendPositiveVariant1;
  /** @deprecated */
  "head /v1/avatar/send": HeadV1AvatarSendPositiveVariant1;
  "get /v1/avatar/stream": GetV1AvatarStreamPositiveVariant1;
  "head /v1/avatar/stream": HeadV1AvatarStreamPositiveVariant1;
  "post /v1/avatar/upload": PostV1AvatarUploadPositiveVariant1;
  "post /v1/avatar/raw": PostV1AvatarRawPositiveVariant1;
  "get /v1/events/stream": GetV1EventsStreamPositiveVariant1;
  "head /v1/events/stream": HeadV1EventsStreamPositiveVariant1;
  "post /v1/forms/feedback": PostV1FormsFeedbackPositiveVariant1;
  "get /v2/users/list": GetV2UsersListPositiveVariant1;
  "head /v2/users/list": HeadV2UsersListPositiveVariant1;
}

export interface NegativeResponse {
  "get /v1/user/retrieve": GetV1UserRetrieveNegativeVariant1;
  "head /v1/user/retrieve": HeadV1UserRetrieveNegativeVariant1;
  "delete /v1/user/:id/remove": DeleteV1UserIdRemoveNegativeVariant1;
  "patch /v1/user/:id": PatchV1UserIdNegativeVariant1;
  "post /v1/user/create": PostV1UserCreateNegativeVariant1 | PostV1UserCreateNegativeVariant2;
  "query /v1/user/list": QueryV1UserListNegativeVariant1;
  "post /v1/login": PostV1LoginNegativeVariant1;
  /** @deprecated */
  "get /v1/avatar/send": GetV1AvatarSendNegativeVariant1;
  /** @deprecated */
  "head /v1/avatar/send": HeadV1AvatarSendNegativeVariant1;
  "get /v1/avatar/stream": GetV1AvatarStreamNegativeVariant1;
  "head /v1/avatar/stream": HeadV1AvatarStreamNegativeVariant1;
  "post /v1/avatar/upload": PostV1AvatarUploadNegativeVariant1;
  "post /v1/avatar/raw": PostV1AvatarRawNegativeVariant1;
  "get /v1/events/stream": GetV1EventsStreamNegativeVariant1;
  "head /v1/events/stream": HeadV1EventsStreamNegativeVariant1;
  "post /v1/forms/feedback": PostV1FormsFeedbackNegativeVariant1;
  "get /v2/users/list": GetV2UsersListNegativeVariant1;
  "head /v2/users/list": HeadV2UsersListNegativeVariant1;
}

export interface EncodedResponse {
  "get /v1/user/retrieve":
    | { statusCode: 200; status: "success"; data: GetV1UserRetrievePositiveVariant1 }
    | { statusCode: 400; status: "error"; data: GetV1UserRetrieveNegativeVariant1 };
  "head /v1/user/retrieve":
    | { statusCode: 200; status: "success"; data: HeadV1UserRetrievePositiveVariant1 }
    | { statusCode: 400; status: "error"; data: HeadV1UserRetrieveNegativeVariant1 };
  "delete /v1/user/:id/remove":
    | { statusCode: 204; status: "success"; data: DeleteV1UserIdRemovePositiveVariant1 }
    | { statusCode: 404; status: "error"; data: DeleteV1UserIdRemoveNegativeVariant1 };
  "patch /v1/user/:id":
    | { statusCode: 200; status: "success"; data: PatchV1UserIdPositiveVariant1 }
    | { statusCode: 429 | 401 | 400 | 404; status: "error"; data: PatchV1UserIdNegativeVariant1 };
  "post /v1/user/create":
    | { statusCode: 201; status: "success"; data: PostV1UserCreatePositiveVariant1 }
    | { statusCode: 409; status: "error"; data: PostV1UserCreateNegativeVariant1 }
    | { statusCode: 400 | 500; status: "error"; data: PostV1UserCreateNegativeVariant2 };
  "query /v1/user/list":
    | { statusCode: 200; status: "success"; data: QueryV1UserListPositiveVariant1 }
    | { statusCode: 400; status: "error"; data: QueryV1UserListNegativeVariant1 };
  "post /v1/login":
    | { statusCode: 200; status: "success"; data: PostV1LoginPositiveVariant1 }
    | { statusCode: 400; status: "error"; data: PostV1LoginNegativeVariant1 };
  /** @deprecated */
  "get /v1/avatar/send":
    | { statusCode: 200; status: "success"; data: GetV1AvatarSendPositiveVariant1 }
    | { statusCode: 400; status: "error"; data: GetV1AvatarSendNegativeVariant1 };
  /** @deprecated */
  "head /v1/avatar/send":
    | { statusCode: 200; status: "success"; data: HeadV1AvatarSendPositiveVariant1 }
    | { statusCode: 400; status: "error"; data: HeadV1AvatarSendNegativeVariant1 };
  "get /v1/avatar/stream":
    | { statusCode: 200; status: "success"; data: GetV1AvatarStreamPositiveVariant1 }
    | { statusCode: 400; status: "error"; data: GetV1AvatarStreamNegativeVariant1 };
  "head /v1/avatar/stream":
    | { statusCode: 200; status: "success"; data: HeadV1AvatarStreamPositiveVariant1 }
    | { statusCode: 400; status: "error"; data: HeadV1AvatarStreamNegativeVariant1 };
  "post /v1/avatar/upload":
    | { statusCode: 200; status: "success"; data: PostV1AvatarUploadPositiveVariant1 }
    | { statusCode: 400; status: "error"; data: PostV1AvatarUploadNegativeVariant1 };
  "post /v1/avatar/raw":
    | { statusCode: 200; status: "success"; data: PostV1AvatarRawPositiveVariant1 }
    | { statusCode: 400; status: "error"; data: PostV1AvatarRawNegativeVariant1 };
  "get /v1/events/stream":
    | { statusCode: 200; status: "success"; data: GetV1EventsStreamPositiveVariant1 }
    | { statusCode: 400; status: "error"; data: GetV1EventsStreamNegativeVariant1 };
  "head /v1/events/stream":
    | { statusCode: 200; status: "success"; data: HeadV1EventsStreamPositiveVariant1 }
    | { statusCode: 400; status: "error"; data: HeadV1EventsStreamNegativeVariant1 };
  "post /v1/forms/feedback":
    | { statusCode: 200; status: "success"; data: PostV1FormsFeedbackPositiveVariant1 }
    | { statusCode: 400; status: "error"; data: PostV1FormsFeedbackNegativeVariant1 };
  "get /v2/users/list":
    | { statusCode: 200; status: "success"; data: GetV2UsersListPositiveVariant1 }
    | { statusCode: 400; status: "error"; data: GetV2UsersListNegativeVariant1 };
  "head /v2/users/list":
    | { statusCode: 200; status: "success"; data: HeadV2UsersListPositiveVariant1 }
    | { statusCode: 400; status: "error"; data: HeadV2UsersListNegativeVariant1 };
}

export interface Response {
  "get /v1/user/retrieve": GetV1UserRetrievePositiveVariant1 | GetV1UserRetrieveNegativeVariant1;
  "head /v1/user/retrieve": HeadV1UserRetrievePositiveVariant1 | HeadV1UserRetrieveNegativeVariant1;
  "delete /v1/user/:id/remove":
    | DeleteV1UserIdRemovePositiveVariant1
    | DeleteV1UserIdRemoveNegativeVariant1;
  "patch /v1/user/:id": PatchV1UserIdPositiveVariant1 | PatchV1UserIdNegativeVariant1;
  "post /v1/user/create":
    | PostV1UserCreatePositiveVariant1
    | PostV1UserCreateNegativeVariant1
    | PostV1UserCreateNegativeVariant2;
  "query /v1/user/list": QueryV1UserListPositiveVariant1 | QueryV1UserListNegativeVariant1;
  "post /v1/login": PostV1LoginPositiveVariant1 | PostV1LoginNegativeVariant1;
  /** @deprecated */
  "get /v1/avatar/send": GetV1AvatarSendPositiveVariant1 | GetV1AvatarSendNegativeVariant1;
  /** @deprecated */
  "head /v1/avatar/send": HeadV1AvatarSendPositiveVariant1 | HeadV1AvatarSendNegativeVariant1;
  "get /v1/avatar/stream": GetV1AvatarStreamPositiveVariant1 | GetV1AvatarStreamNegativeVariant1;
  "head /v1/avatar/stream": HeadV1AvatarStreamPositiveVariant1 | HeadV1AvatarStreamNegativeVariant1;
  "post /v1/avatar/upload": PostV1AvatarUploadPositiveVariant1 | PostV1AvatarUploadNegativeVariant1;
  "post /v1/avatar/raw": PostV1AvatarRawPositiveVariant1 | PostV1AvatarRawNegativeVariant1;
  "get /v1/events/stream": GetV1EventsStreamPositiveVariant1 | GetV1EventsStreamNegativeVariant1;
  "head /v1/events/stream": HeadV1EventsStreamPositiveVariant1 | HeadV1EventsStreamNegativeVariant1;
  "post /v1/forms/feedback":
    | PostV1FormsFeedbackPositiveVariant1
    | PostV1FormsFeedbackNegativeVariant1;
  "get /v2/users/list": GetV2UsersListPositiveVariant1 | GetV2UsersListNegativeVariant1;
  "head /v2/users/list": HeadV2UsersListPositiveVariant1 | HeadV2UsersListNegativeVariant1;
}

export type Request = keyof Input;

export const endpointTags = {
  "get /v1/user/retrieve": ["users"],
  "head /v1/user/retrieve": ["users"],
  "delete /v1/user/:id/remove": ["users"],
  "patch /v1/user/:id": ["users"],
  "post /v1/user/create": ["users"],
  "query /v1/user/list": ["users"],
  "post /v1/login": ["cookies"],
  "get /v1/avatar/send": ["files", "users"],
  "head /v1/avatar/send": ["files", "users"],
  "get /v1/avatar/stream": ["users", "files"],
  "head /v1/avatar/stream": ["users", "files"],
  "post /v1/avatar/upload": ["files"],
  "post /v1/avatar/raw": ["files"],
  "get /v1/events/stream": ["subscriptions"],
  "head /v1/events/stream": ["subscriptions"],
  "post /v1/forms/feedback": ["forms"],
  "get /v2/users/list": ["users"],
  "head /v2/users/list": ["users"],
};

const parseRequest = (request: string) => request.split(/ (.+)/, 2) as [Method, Path];

const substitute = (path: string, params: Record<string, any>): [typeof path, typeof params] => {
  if (params instanceof Blob) return [path, params] as const;
  const rest = { ...params };
  for (const key in params) {
    path = path.replace(`:${key}`, () => {
      delete rest[key];
      return params[key];
    });
  }
  return [path, rest] as const;
};

export type Implementation<T extends Record<string, unknown>> = (
  method: Method,
  path: string,
  params: Record<string, any>,
  ctx?: T,
) => Promise<any>;

type Pagination = { nextCursor: string | null } | { total: number; limit: number; offset: number };

export type DefaultContext = { override?: (init: RequestInit) => RequestInit };

const defaultImplementation: Implementation<DefaultContext> = async (method, path, params, ctx) => {
  const isBlob = params instanceof Blob;
  const hasFiles =
    !isBlob && Object.values(params).some((one) => one instanceof Blob || one instanceof File);
  const hasBody = !["get", "head", "delete"].includes(method);
  const searchParams = isBlob || hasBody ? "" : `?${new URLSearchParams(params)}`;
  const headers =
    !hasBody || hasFiles
      ? undefined
      : { "Content-Type": isBlob ? "application/octet-stream" : "application/json" };
  let body: RequestInit["body"] = undefined;
  if (hasBody) {
    if (isBlob) {
      body = params;
    } else if (hasFiles) {
      body = new FormData();
      for (const [key, value] of Object.entries(params))
        if (value !== undefined) body.append(key, value);
    } else {
      body = JSON.stringify(params);
    }
  }
  let init: RequestInit = {
    method: method.toUpperCase(),
    credentials: undefined,
    headers,
    body,
  };
  if (ctx?.override) init = ctx.override(init);
  const response = await fetch(new URL(`${path}${searchParams}`, "http://localhost:8090"), init);
  const contentType = response.headers.get("content-type");
  if (!contentType) return;
  if (contentType.startsWith("application/json")) return response.json();
  if (contentType.startsWith("text/")) return response.text();
  return response.blob();
};

export class Client<T extends Record<string, unknown> = DefaultContext> {
  public constructor(
    protected readonly implementation: Implementation<T> = defaultImplementation,
  ) {}
  public provide<K extends Request>(request: K, params: Input[K], ctx?: T): Promise<Response[K]> {
    const [method, path] = parseRequest(request);
    return this.implementation(method, ...substitute(path, params), ctx);
  }
  public static hasMore(response: Pagination): boolean {
    if ("nextCursor" in response) return response.nextCursor !== null;
    return response.offset + response.limit < response.total;
  }
  public static discriminate(statusCode: number): "success" | "error" {
    return statusCode < 400 ? "success" : "error";
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
    this.source = new EventSource(new URL(`${path}${searchParams}`, "http://localhost:8090"), {
      withCredentials: undefined,
    });
  }
  public on<E extends R["event"]>(
    event: E,
    handler: (data: Extract<R, { event: E }>["data"]) => void | Promise<void>,
  ) {
    this.source.addEventListener(event, (msg) => handler(JSON.parse((msg as MessageEvent).data)));
    return this;
  }
}

// Usage example:
/*
const client = new Client();
client.provide("get /v1/user/retrieve", { id: "10" });
new Subscription("get /v1/events/stream", {}).on("time", (time) => {});
*/
