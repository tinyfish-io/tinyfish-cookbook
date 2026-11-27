export type ApiErrorCode =
  | "not_found"
  | "invalid_request"
  | "rate_limited"
  | "busy"
  | "not_configured"
  | "sign_in_not_ready";

const STATUS: Record<ApiErrorCode, 400 | 404 | 409 | 429 | 503> = {
  not_found: 404,
  invalid_request: 400,
  rate_limited: 429,
  busy: 429,
  not_configured: 503,
  sign_in_not_ready: 409,
};

/** An error whose message is written for the visitor and is safe to send to them. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: 400 | 404 | 409 | 429 | 503;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS[code];
  }
}
