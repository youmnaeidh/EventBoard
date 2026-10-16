import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export const notFound = (message = "المورد المطلوب غير موجود") => new HttpError(404, "not_found", message);
export const badRequest = (message: string, details?: unknown) => new HttpError(400, "bad_request", message, details);
export const unauthorized = (message = "سجّل الدخول للمتابعة") => new HttpError(401, "unauthorized", message);
export const forbidden = (message = "ما عندك صلاحية لهذا الإجراء") => new HttpError(403, "forbidden", message);
export const conflict = (message: string, code = "conflict") => new HttpError(409, code, message);

/** Wrap async route handlers so rejected promises reach the error middleware (Express 4). */
export const handler =
  (fn: (...args: Parameters<RequestHandler>) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "validation_error",
        message: "البيانات المدخلة غير صحيحة",
        details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
      }
    });
    return;
  }
  if (error && typeof error === "object" && "type" in error && (error as { type: string }).type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "invalid_json", message: "صيغة الطلب غير صحيحة" } });
    return;
  }
  console.error("[unhandled]", error);
  res.status(500).json({ error: { code: "internal_error", message: "صار خطأ غير متوقع، حاول مرة ثانية" } });
};
