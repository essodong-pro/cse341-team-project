import mongoose from "mongoose";
import {
  countUsersWithRole,
  deleteUser as deleteUserRecord,
  getPaginatedUsers as fetchPaginatedUsers,
  getUserById as fetchUserById,
  updateUser as updateUserRecord,
} from "../models/users.js";
import { getRoleByName } from "../models/roles.js";

const LAST_ADMIN_MESSAGE =
  "You can't remove the last administrator. Promote another user to admin first.";
const EDITABLE_FIELDS = ["displayName", "username", "email"];
const MAX_FIELD_LENGTHS = { displayName: 100, username: 50, email: 254 };
// Non-overlapping segments keep matching linear on hostile input.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const DEFAULT_SORT = "username";
const DEFAULT_ORDER = "asc";
const ALLOWED_SORT_FIELDS = ["username", "displayName", "email", "createdAt"];
const ALLOWED_ORDERS = ["asc", "desc"];

const isAdmin = (req) => req.user.role === "admin";
// target._id comes from toPublicUser as a lowercase hex string, so this
// also catches an uppercase id in the URL.
const isSelf = (req, target) => target._id === req.user.id;

// Query values arrive as strings (or arrays when repeated); anything that is
// not a whole number of 1 or more becomes null.
const parsePositiveInteger = (value, defaultValue) => {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
};

/**
 * Validates the list query for GET /api/users. Returns every problem at once
 * so the client can fix them together.
 */
function parseUserListQuery(query) {
  const errors = [];

  const page = parsePositiveInteger(query.page, DEFAULT_PAGE);
  if (page === null) {
    errors.push({ field: "page", message: "page must be a whole number of 1 or more." });
  }

  const limit = parsePositiveInteger(query.limit, DEFAULT_LIMIT);
  if (limit === null || limit > MAX_LIMIT) {
    errors.push({ field: "limit", message: `limit must be a number between 1 and ${MAX_LIMIT}.` });
  }

  const sort = query.sort ?? DEFAULT_SORT;
  if (!ALLOWED_SORT_FIELDS.includes(sort)) {
    errors.push({ field: "sort", message: `sort must be one of: ${ALLOWED_SORT_FIELDS.join(", ")}.` });
  }

  const order = query.order ?? DEFAULT_ORDER;
  if (!ALLOWED_ORDERS.includes(order)) {
    errors.push({ field: "order", message: "order must be asc or desc." });
  }

  return { errors, options: { page, limit, sort, order } };
}

function buildPagination({ page, limit }, totalItems) {
  return {
    page,
    limit,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
    hasNextPage: page * limit < totalItems,
    hasPreviousPage: page > 1,
  };
}

// ==========================
// API CONTROLLERS
// ==========================

export async function getUsers(req, res) {
  try {
    const { errors, options } = parseUserListQuery(req.query);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    // Non-admins go through the same query but can only ever match themselves.
    const filter = isAdmin(req) ? {} : { _id: req.user.id };

    const { users, totalItems } = await fetchPaginatedUsers({ filter, ...options });

    return res.status(200).json({
      data: users,
      query: { sort: options.sort, order: options.order },
      pagination: buildPagination(options, totalItems),
    });
  } catch (error) {
    console.error("Error fetching users:", error);

    return res.status(500).json({
      error: "Internal Server Error"
    });
  }
}

/**
 * Builds the Mongo update from the request body. Returns { updates } on
 * success or { status, error } when the request must be rejected.
 */
async function buildUserUpdates(req, target) {
  const body = req.body ?? {};
  const updates = {};

  for (const field of EDITABLE_FIELDS) {
    const value = body[field];

    if (value === undefined) {
      continue;
    }

    if (typeof value !== "string" || value.trim() === "") {
      return { status: 400, error: `Please provide a valid ${field}.` };
    }

    const trimmed = value.trim();

    if (trimmed.length > MAX_FIELD_LENGTHS[field]) {
      return { status: 400, error: `${field} is too long.` };
    }

    updates[field] = trimmed;
  }

  if (updates.email && !EMAIL_PATTERN.test(updates.email)) {
    return { status: 400, error: "Please provide a valid email." };
  }

  const requestedRole = body.role;

  if (isAdmin(req) && requestedRole !== undefined && requestedRole !== target.role) {
    if (typeof requestedRole !== "string") {
      return { status: 400, error: "Invalid role." };
    }

    const role = await getRoleByName(requestedRole);

    if (!role) {
      return { status: 400, error: "Invalid role." };
    }

    if (target.role === "admin" && (await countUsersWithRole("admin")) <= 1) {
      return { status: 409, error: LAST_ADMIN_MESSAGE };
    }

    updates.role = role._id;
  }

  if (Object.keys(updates).length === 0) {
    return { status: 400, error: "No valid fields to update." };
  }

  return { updates };
}

export async function updateUserById(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid user id." });
  }

  try {
    const target = await fetchUserById(id);

    if (!target) {
      return res.status(404).json({ error: "User not found." });
    }

    const { updates, status, error } = await buildUserUpdates(req, target);

    if (error) {
      return res.status(status).json({ error });
    }

    const updated = await updateUserRecord(id, updates);

    if (!updated) {
      return res.status(404).json({ error: "User not found." });
    }

    if (isSelf(req, target)) {
      req.session.user = {
        ...req.session.user,
        displayName: updated.displayName,
        username: updated.username,
        email: updated.email,
        role: updated.role,
      };
    }

    return res.status(200).json(updated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "That email or username is already in use." });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ error: "Please check the values you entered." });
    }

    console.error("Error updating user:", error);

    return res.status(500).json({
      error: "Internal Server Error"
    });
  }
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) {
        return reject(error);
      }

      return resolve();
    });
  });
}

export async function deleteUserById(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid user id." });
  }

  try {
    const target = await fetchUserById(id);

    if (!target) {
      return res.status(404).json({ error: "User not found." });
    }

    if (target.role === "admin" && (await countUsersWithRole("admin")) <= 1) {
      return res.status(409).json({ error: LAST_ADMIN_MESSAGE });
    }

    await deleteUserRecord(id);

    if (isSelf(req, target)) {
      await destroySession(req);
      res.clearCookie("connect.sid");

      return res.status(200).json({
        message: "Your account was deleted.",
        loggedOut: true
      });
    }

    return res.status(200).json({
      message: "User deleted.",
      loggedOut: false
    });
  } catch (error) {
    console.error("Error deleting user:", error);

    return res.status(500).json({
      error: "Internal Server Error"
    });
  }
}

// ==========================
// EJS PAGE CONTROLLERS
// ==========================

export function renderUsersAdmin(req, res) {
  return res.render("users-admin", {
    title: "User Admin"
  });
}
