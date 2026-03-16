export function validateRegister({ name, phone_number, password }) {
  const errors = [];
  if (!name || name.trim().length < 2)
    errors.push("name must be at least 2 characters");
  if (!phone_number || !/^\+?[\d\s\-(). ]{7,20}$/.test(phone_number.trim()))
    errors.push("phone_number is invalid (7–20 digits, optional leading +)");
  if (!password || password.length < 6)
    errors.push("password must be at least 6 characters");
  return errors;
}

export function validateLogin({ phone_number, password }) {
  const errors = [];
  if (!phone_number?.trim()) errors.push("phone_number is required");
  if (!password)             errors.push("password is required");
  return errors;
}

export function validateResetPassword({ phone_number, new_password }) {
  const errors = [];
  if (!phone_number?.trim()) errors.push("phone_number is required");
  if (!new_password || new_password.length < 6)
    errors.push("new_password must be at least 6 characters");
  return errors;
}

export function validateSendMessage({ conversation_id, message_type, message_text, image_base64 }) {
  const errors = [];
  const type   = message_type || "text";

  if (!conversation_id)
    errors.push("conversation_id is required");
  if (!["text", "image"].includes(type))
    errors.push("message_type must be 'text' or 'image'");
  if (type === "text"  && !message_text?.trim())
    errors.push("message_text is required for text messages");
  if (type === "image" && !image_base64)
    errors.push("image_base64 is required for image messages");

  return errors;
}

export function validateUpdateStatus({ message_id, status }) {
  const errors  = [];
  const ALLOWED = ["sending", "sent", "delivered", "seen"];

  if (!message_id)           errors.push("message_id is required");
  if (!ALLOWED.includes(status))
    errors.push(`status must be one of: ${ALLOWED.join(", ")}`);

  return errors;
}
