/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasTable("secrets"))) {
    await knex.schema.createTable("secrets", (t) => {
      // The short identifier (exactly 8 characters)
      t.string("shortId", 8).primary();
      // Expiration date in Zulu time
      t.timestamp("expiresAt").notNullable();
      // The fragments from shamirs-secret-sharing (stored as a JSON array)
      t.jsonb("fragments").notNullable();
      // Optional password hash (null if no password)
      t.string("hash");
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  if (await knex.schema.hasTable("secrets")) {
    await knex.schema.dropTable("secrets");
  }
};
