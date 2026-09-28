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

const PUBLIC_FIELDS = "-passwordHash";

/**
 * Shapes a lean, role-populated user document for API responses.
 * Never includes the password hash.
 */
export function toPublicUser(user) {
  return {
    _id: user._id.toString(),
    displayName: user.displayName,
    username: user.username,
    email: user.email,
    role: user.role?.name ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getAllUsers() {
  const users = await User.find({})
    .select(PUBLIC_FIELDS)
    .populate("role")
    .sort({ displayName: 1 })
    .lean();

  return users.map(toPublicUser);
}

export async function getUserById(id) {
  const user = await User.findById(id)
    .select(PUBLIC_FIELDS)
    .populate("role")
    .lean();

  return user ? toPublicUser(user) : null;
}

export async function updateUser(id, updates) {
  const user = await User.findByIdAndUpdate(id, updates, {
    returnDocument: "after",
    runValidators: true,
  })
    .select(PUBLIC_FIELDS)
    .populate("role")
    .lean();

  return user ? toPublicUser(user) : null;
}

export async function deleteUser(id) {
  const deleted = await User.findByIdAndDelete(id);

  return Boolean(deleted);
}

export async function countUsersWithRole(roleName) {
  const role = await Role.findOne({ name: roleName });

  if (!role) {
    return 0;
  }

  return User.countDocuments({ role: role._id });
}