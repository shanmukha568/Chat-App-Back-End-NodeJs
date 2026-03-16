export const ok = (res, data = {}, message = "Success", status = 200) =>
  res.status(status).json({ success: true, message, data });

export const created = (res, data = {}, message = "Created") =>
  res.status(201).json({ success: true, message, data });

export const fail = (res, message = "Bad Request", status = 400, errors = null) =>
  res.status(status).json({ success: false, message, ...(errors && { errors }) });

export const unauthorized = (res, message = "Unauthorized") =>
  res.status(401).json({ success: false, message });

export const forbidden = (res, message = "Forbidden") =>
  res.status(403).json({ success: false, message });

export const notFound = (res, message = "Not found") =>
  res.status(404).json({ success: false, message });

export const serverError = (res, message = "Internal server error") =>
  res.status(500).json({ success: false, message });
