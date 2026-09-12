const sql = require("./db");

async function testDatabase() {
  try {
    const result = await sql`SELECT NOW()`;
    console.log("✅ Database connected!");
    console.log(result);
  } catch (error) {
    console.error("❌ Database connection failed:");
    console.error(error.message);
  } finally {
    await sql.end();
  }
}

testDatabase();