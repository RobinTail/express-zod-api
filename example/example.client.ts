type Type2048581c137c5b2130eb860e3ae37da196dfc25b = {
  title: string;
  features: Type2048581c137c5b2130eb860e3ae37da196dfc25b;
}[];

type GetV1UserRetrieveInput = {} & {
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
          features: Type2048581c137c5b2130eb860e3ae37da196dfc25b;
        }[];
      };
    }
  | {
      status: "error";
      error: {
        message: string;
      };
    };

type PostV1UserIdInput = {
  key: string;
} & {
  id: string;
  name: string;
  birthday: string;
};

type PostV1UserIdResponse =
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

type GetV1UserListInput = {};

type GetV1UserListResponse =
  | {
      name: string;
    }[]
  | string;

type GetV1AvatarSendInput = {
  userId: string;
};

type GetV1AvatarSendResponse = string | string;

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
  | "/v1/user/:id"
  | "/v1/user/list"
  | "/v1/avatar/send"
  | "/v1/avatar/stream"
  | "/v1/avatar/upload"
  | "/v1/avatar/raw";

export type Method = "get" | "post" | "put" | "delete" | "patch";

export type MethodPath = `${Method} ${Path}`;

export interface Input extends Record<MethodPath, any> {
  "get /v1/user/retrieve": GetV1UserRetrieveInput;
  "post /v1/user/:id": PostV1UserIdInput;
  "get /v1/user/list": GetV1UserListInput;
  "get /v1/avatar/send": GetV1AvatarSendInput;
  "get /v1/avatar/stream": GetV1AvatarStreamInput;
  "post /v1/avatar/upload": PostV1AvatarUploadInput;
  "post /v1/avatar/raw": PostV1AvatarRawInput;
}

export interface Response extends Record<MethodPath, any> {
  "get /v1/user/retrieve": GetV1UserRetrieveResponse;
  "post /v1/user/:id": PostV1UserIdResponse;
  "get /v1/user/list": GetV1UserListResponse;
  "get /v1/avatar/send": GetV1AvatarSendResponse;
  "get /v1/avatar/stream": GetV1AvatarStreamResponse;
  "post /v1/avatar/upload": PostV1AvatarUploadResponse;
  "post /v1/avatar/raw": PostV1AvatarRawResponse;
}

export const jsonEndpoints = {
  "get /v1/user/retrieve": true,
  "post /v1/user/:id": true,
  "get /v1/user/list": true,
  "post /v1/avatar/upload": true,
  "post /v1/avatar/raw": true,
};

export const endpointTags = {
  "get /v1/user/retrieve": ["users"],
  "post /v1/user/:id": ["users"],
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
  if (`${method} ${path}` in jsonEndpoints) {
    return response.json();
  }
  return response.text();
};
const client = new ExpressZodAPIClient(exampleImplementation);
client.provide("get", "/v1/user/retrieve", { id: "10" });
*/
