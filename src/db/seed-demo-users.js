import bcrypt from "bcrypt";
import { closeDb, connectToDb } from "./connect.js";
import Role from "../models/schemas/role.js";
import User from "../models/schemas/user.js";

// Demo accounts share the password Password123! and are for local/dev databases only.
// [displayName, username] pairs; every 6th user is an admin.
const DEMO_USERS = [
  ["Ada Lovelace", "ada"], ["Alan Turing", "aturing"], ["Barbara Liskov", "bliskov"],
  ["Charles Babbage", "cbabbage"], ["Dennis Ritchie", "dritchie"], ["Donald Knuth", "dknuth"],
  ["Edsger Dijkstra", "edijkstra"], ["Frances Allen", "fallen"], ["George Stephenson", "gstephenson"],
  ["Grace Hopper", "ghopper"], ["Hedy Lamarr", "hlamarr"], ["Isambard Brunel", "ibrunel"],
  ["John McCarthy", "jmccarthy"], ["Katherine Johnson", "kjohnson"], ["Ken Thompson", "kthompson"],
  ["Linus Torvalds", "ltorvalds"], ["Margaret Hamilton", "mhamilton"], ["Niklaus Wirth", "nwirth"],
  ["Radia Perlman", "rperlman"], ["Shinkansen Fan", "shinkansen"], ["Tim Berners-Lee", "tbernerslee"],
  ["Tsutomu Kizuna", "tkizuna"], ["Yukihiro Matsumoto", "ymatsumoto"], ["Zoe Rail", "zrail"],
];

try {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo users in production.");
  }

  await connectToDb();

  const [adminRole, customerRole] = await Promise.all([
    Role.findOne({ name: "admin" }),
    Role.findOne({ name: "customer" }),
  ]);

  if (!adminRole || !customerRole) {
    throw new Error("Roles are missing. Run npm run db:import first.");
  }

  const passwordHash = await bcrypt.hash("Password123!", 12);

  // Upsert by username so the script is safe to run more than once.
  const result = await User.bulkWrite(
    DEMO_USERS.map(([displayName, username], index) => ({
      updateOne: {
        filter: { username },
        update: {
          $setOnInsert: {
            displayName,
            username,
            email: `${username}@example.com`,
            passwordHash,
            role: index % 6 === 0 ? adminRole._id : customerRole._id,
          },
        },
        upsert: true,
      },
    }))
  );

  console.log(
    `Demo users ready: ${result.upsertedCount} added, ${DEMO_USERS.length - result.upsertedCount} already existed.`
  );
} finally {
  await closeDb();
}
