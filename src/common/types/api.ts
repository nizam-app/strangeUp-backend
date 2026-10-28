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
  nextAction?: string;
  onboardingPhase?: string;
  effectiveApplicationAccess?: string;
  homeAccessAllowed?: false;
};

export type ApiErrorResponse = {
  error: ApiErrorBody;
};
