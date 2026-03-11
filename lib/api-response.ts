export function ok<T>(data: T): Response {
  return Response.json({ ok: true, data });
}

export function badRequest(message: string): Response {
  return Response.json({ ok: false, error: message }, { status: 400 });
}

export function forbidden(message = "forbidden"): Response {
  return Response.json({ ok: false, error: message }, { status: 403 });
}
