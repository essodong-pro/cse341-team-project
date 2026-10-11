import {
  createUser,
  findUserByEmail,
  verifyPassword,
} from "../models/users.js";
import { EMAIL_PATTERN, MAX_FIELD_LENGTHS } from "./users.js";

const REGISTER_FIELDS = ["displayName", "username", "email", "password"];

/**
 * Checks the registration form. Returns { values } with trimmed fields on
 * success or { error } describing the first problem found.
 */
function validateRegistration(body = {}) {
  const values = {};

  for (const field of REGISTER_FIELDS) {
    const value = body[field];

    // Repeated form fields arrive as arrays, so check the type too.
    if (typeof value !== "string" || value.trim() === "") {
      return { error: `Please provide a valid ${field}.` };
    }

    // Spaces can be part of a password, so only the other fields are trimmed.
    values[field] = field === "password" ? value : value.trim();

    if (values[field].length > MAX_FIELD_LENGTHS[field]) {
      return { error: `${field} is too long.` };
    }
  }

  if (!EMAIL_PATTERN.test(values.email)) {
    return { error: "Please provide a valid email." };
  }

  return { values };
}

export async function register(req, res) {
  try {
    const { values, error } = validateRegistration(req.body);

    if (error) {
      return res.status(400).render("register", {
        title: "Register",
        error
      });
    }

    await createUser(
      values.displayName,
      values.username,
      values.email,
      values.password
    );

    return res.redirect("/login");
  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === 11000) {
      return res.status(409).render("register", {
        title: "Register",
        error: "A user with that email or username already exists."
      });
    }

    return res.status(500).render("errors/500", {
      title: "Registration Error",
      error: "An unexpected error occurred."
    });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await findUserByEmail(email);

    if (!user) {
      return res.status(401).render("login", {
        title: "Login",
        error: "Invalid email or password",
      });
    }

    const passwordMatches = await verifyPassword(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).render("login", {
        title: "Login",
        error: "Invalid email or password",
      });
    }

    req.session.user = {
      id: user._id.toString(),
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      role: user.role.name,
    };

    if (user.role.name === "admin") {
      return res.redirect("/admin");
    }

    return res.redirect("/dashboard");
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).render("errors/500", {
      title: "Login Error",
      error: "An unexpected error occurred."
    });
  }
}

export async function logout(req, res) {
  req.session.destroy(() => {
    return res.redirect("/");
  });
}