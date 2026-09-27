import {
  createUser,
  findUserByEmail,
  verifyPassword,
} from "../models/users.js";

export async function register(req, res) {
  try {
    const {
      displayName,
      username,
      email,
      password,
    } = req.body;

    await createUser(
      displayName,
      username,
      email,
      password
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

    const passwordMatches =
      await verifyPassword(
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
      username: user.username,
      role: user.role.name,
    };

    return res.redirect("/");
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