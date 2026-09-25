import Role from "./schemas/role.js";

export async function getRoleByName(name) {
  return Role.findOne({ name });
}

export async function getAllRoles() {
  return Role.find({});
}