import mongoose from "mongoose";
import {
  countUsersWithRole,
  deleteUser as deleteUserRecord,
  getAllUsers as fetchAllUsers,
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

const isAdmin = (req) => req.user.role === "admin";
// target._id comes from toPublicUser as a lowercase hex string, so this
// also catches an uppercase id in the URL.
const isSelf = (req, target) => target._id === req.user.id;

// ==========================
// API CONTROLLERS
// ==========================

export async function getUsers(req, res) {
  try {
    if (isAdmin(req)) {
      const users = await fetchAllUsers();

      return res.status(200).json(users);
    }

    const self = await fetchUserById(req.user.id);

    return res.status(200).json(self ? [self] : []);
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
        username: updated.username,
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
