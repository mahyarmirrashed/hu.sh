/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasTable("secret_requests"))) {
    await knex.schema.createTable("secret_requests", (t) => {
      // The short identifier (exactly 8 characters)
      // One short ID for admin and one for receiver
      t.string("adminShortId", 8).primary();
      t.string("receiverShortId", 8);
      // Expiration period (in minutes)
      t.integer("period");
      // Expiration date in Zulu time
      t.timestamp("expiresAt");
      // Content field for requested secret
      t.string("content");
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  if (await knex.schema.hasTable("secret_requests")) {
    await knex.schema.dropTable("secret_requests");
  }
};
