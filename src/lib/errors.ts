/**
 * RFC 7807-style error envelope with stable machine codes (blueprint §12.2).
 * Used by all API routes to return consistent error shapes.
 */

export type ApiError = {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  requestId: string;
  retryable: boolean;
  fieldErrors?: { field: string; code: string; message: string }[];
};

export function makeError(
  code: string,
  title: string,
  detail: string,
  status: number,
  opts: {
    requestId?: string;
    retryable?: boolean;
    fieldErrors?: { field: string; code: string; message: string }[];
  } = {}
): ApiError {
  return {
    type: `https://api.rillio.example/problems/${code.toLowerCase().replace(/_/g, "-")}`,
    title,
    status,
    code,
    detail,
    requestId: opts.requestId ?? "req_" + Math.random().toString(36).slice(2, 12),
    retryable: opts.retryable ?? false,
    fieldErrors: opts.fieldErrors,
  };
}

export function unauthorized(detail = "Authentication required.") {
  return makeError("AUTH_REQUIRED", "Authentication required", detail, 401);
}

export function accessDenied(detail = "You do not have access to this resource.") {
  return makeError("AUTH_ACCESS_DENIED", "Access denied", detail, 403);
}

export function notFound(detail = "Resource not found.") {
  return makeError("NOT_FOUND", "Not found", detail, 404);
}

export function validationError(
  detail: string,
  fieldErrors: { field: string; code: string; message: string }[]
) {
  return makeError("VALIDATION_ERROR", "Validation failed", detail, 422, {
    fieldErrors,
    retryable: false,
  });
}

export function conflict(code: string, detail: string) {
  return makeError(code, "Conflict", detail, 409);
}

export function internalError(requestId?: string) {
  return makeError(
    "INTERNAL_UNEXPECTED",
    "Something went wrong",
    "An unexpected error occurred. No further action was taken by this request. Share the reference with support if needed.",
    500,
    { requestId, retryable: false }
  );
}

/** Common machine error codes used in the UI (blueprint §29.1). */
export const ERROR_CODES = {
  DATA_IMPORT_INVALID_COLUMN_MAPPING: "DATA_IMPORT_INVALID_COLUMN_MAPPING",
  DATA_IMPORT_PARTIAL_SUCCESS: "DATA_IMPORT_PARTIAL_SUCCESS",
  DATA_IMPORT_FAILED: "DATA_IMPORT_FAILED",
  DATA_PROVIDER_UNAVAILABLE: "DATA_PROVIDER_UNAVAILABLE",
  CHAIN_RPC_UNAVAILABLE: "CHAIN_RPC_UNAVAILABLE",
  CHAIN_ASSET_UNVERIFIED: "CHAIN_ASSET_UNVERIFIED",
  CHAIN_TX_STATUS_UNKNOWN: "CHAIN_TX_STATUS_UNKNOWN",
  PAYMENT_FINALITY_PENDING: "PAYMENT_FINALITY_PENDING",
  AUTH_ACCESS_DENIED: "AUTH_ACCESS_DENIED",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  INTERNAL_UNEXPECTED: "INTERNAL_UNEXPECTED",
} as const;
