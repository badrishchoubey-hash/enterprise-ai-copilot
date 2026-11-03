const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../.env"), quiet: true });
const mongoose = require("mongoose");
const { getVectorSearchConfig } = require("../dist/config/vectorSearch.js");
const { buildVectorIndexDefinition } = require("../dist/services/vectorIndexService.js");

async function main() {
  let uri = process.env.MONGODB_URI ?? process.env.DATABASE_URL;
  if (!uri) throw new Error("Database configuration is missing.");
  if (uri.split("@")[0].includes("<")) {
    if (!process.env.DB_USERNAME || !process.env.DB_PASSWORD) throw new Error("Database credentials are missing.");
    uri = uri.replace(/^(mongodb(?:\+srv)?:\/\/)[^@]+@/,
      "$1" + encodeURIComponent(process.env.DB_USERNAME) + ":" + encodeURIComponent(process.env.DB_PASSWORD) + "@");
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, autoIndex: false, autoCreate: false });
  const collection = mongoose.connection.db.collection("DocumentChunks");
  const { indexName } = getVectorSearchConfig();
  const existing = await collection.listSearchIndexes({ name: indexName }).toArray();
  if (!existing.length) {
    await collection.createSearchIndex({ name: indexName, type: "vectorSearch", definition: buildVectorIndexDefinition() });
    console.log(JSON.stringify({ indexName, created: true, message: "Index build started. Run again to check readiness." }));
  } else {
    console.log(JSON.stringify({ indexName, status: existing[0].status, queryable: existing[0].queryable }));
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ errorName: error.name, code: error.code ?? "VECTOR_INDEX_SETUP_FAILED" }));
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
