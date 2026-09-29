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

/**
 * Returns one page of public users and how many users match the filter.
 * The controller validates every option before calling this.
 */
export async function getPaginatedUsers({ filter = {}, page, limit, sort, order }) {
  const skip = (page - 1) * limit;
  const direction = order === "desc" ? -1 : 1;
  // _id breaks ties so a user never shows up on two pages.
  const sortOptions = { [sort]: direction, _id: direction };

  const [users, totalItems] = await Promise.all([
    User.find(filter)
      .select(PUBLIC_FIELDS)
      .populate("role")
      // Case-insensitive alphabetical order ("ada" before "Zed").
      .collation({ locale: "en" })
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return { users: users.map(toPublicUser), totalItems };
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