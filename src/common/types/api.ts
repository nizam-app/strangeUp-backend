export type ApiSuccessResponse<T> = {
  data: T;
  meta: {
    requestId: string;
  };
};

export type ApiErrorBody = {
  code: string;
  message: string;
  requestId: string;
};

export type ApiErrorResponse = {
  error: ApiErrorBody;
};
