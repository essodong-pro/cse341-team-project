import bcrypt from "bcrypt";
import User from "./schemas/user.js";
import Role from "./schemas/role.js";

export async function createUser(
  displayName,
  username,
  email,
  password
) {
  const customerRole = await Role.findOne({
    name: "customer",
  });

  if (!customerRole) {
    throw new Error("Customer role not found.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  return User.create({
    displayName,
    username,
    email,
    passwordHash,
    role: customerRole._id,
  });
}

export async function findUserByEmail(email) {
  return User.findOne({ email }).populate("role");
}

export async function verifyPassword(
  password,
  passwordHash
) {
  return bcrypt.compare(password, passwordHash);
}