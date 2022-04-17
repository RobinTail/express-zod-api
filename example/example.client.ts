type GetV1UserRetrieveInput = {} & {
  id: string;
};

type GetV1UserRetrieveResponse =
  | {
      status: "success";
      data: {
        id: number;
        name: string;
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

type GetV1AvatarSendInput = {
  userId: string;
};

type GetV1AvatarSendResponse = string | string;

type GetV1AvatarStreamInput = {
  userId: string;
};

type GetV1AvatarStreamResponse = any | string;

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
        otherInputs: {
          [x: string]: any;
        };
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
  | "/v1/avatar/send"
  | "/v1/avatar/stream"
  | "/v1/avatar/upload";

export type Method = "get" | "post" | "put" | "delete" | "patch";

export type MethodPath = `${Method} ${Path}`;

export interface Input extends Record<MethodPath, any> {
  "get /v1/user/retrieve": GetV1UserRetrieveInput;
  "post /v1/user/:id": PostV1UserIdInput;
  "get /v1/avatar/send": GetV1AvatarSendInput;
  "get /v1/avatar/stream": GetV1AvatarStreamInput;
  "post /v1/avatar/upload": PostV1AvatarUploadInput;
}

export interface Response extends Record<MethodPath, any> {
  "get /v1/user/retrieve": GetV1UserRetrieveResponse;
  "post /v1/user/:id": PostV1UserIdResponse;
  "get /v1/avatar/send": GetV1AvatarSendResponse;
  "get /v1/avatar/stream": GetV1AvatarStreamResponse;
  "post /v1/avatar/upload": PostV1AvatarUploadResponse;
}

/*
class ApiClient {
  constructor(
    public provider: <P extends Path, M extends Method>(
      path: P,
      method: M,
      params: Input[`${M} ${P}`]
    ) => Promise<Response[`${M} ${P}`]>
  ) {}
}

const client = new ApiClient(async (path, method, params) =>
  (
    await fetch(`https://example.com${path}`, {
      method: `${method}`,
      body: JSON.stringify(params),
    })
  ).json()
);

const m = client.provider("/v1/user/retrieve", "get", { id: "123" });

 */
