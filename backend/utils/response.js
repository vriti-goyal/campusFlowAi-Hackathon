// utils/response.js — helpers for consistent API responses

export function ok(res, data = {}, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function fail(res, message = 'Error', status = 400) {
  return res.status(status).json({ success: false, error: message });
}
