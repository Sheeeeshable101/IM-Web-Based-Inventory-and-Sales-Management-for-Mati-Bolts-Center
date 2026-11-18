const { requireAuth, requireAdmin } = require('../middleware/auth');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function requireFields(body, fields) {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      throw new HttpError(400, `${field} is required.`);
    }
  }
}

function positiveInteger(value, field, allowZero = false) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < (allowZero ? 0 : 1)) {
    throw new HttpError(400, `${field} must be a ${allowZero ? 'non-negative' : 'positive'} whole number.`);
  }
  return number;
}

function nonNegativeMoney(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || Math.round(number * 100) !== number * 100) {
    throw new HttpError(400, `${field} must be a non-negative amount with at most two decimal places.`);
  }
  return number;
}

function validDate(value, field) {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${field} must use YYYY-MM-DD format.`);
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new HttpError(400, `${field} must be a valid calendar date.`);
  }
  return value;
}

function nullableId(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return positiveInteger(value, field);
}

module.exports = {
  HttpError,
  wrap,
  requireFields,
  positiveInteger,
  nonNegativeMoney,
  validDate,
  nullableId,
  requireAuth,
  requireAdmin
};
