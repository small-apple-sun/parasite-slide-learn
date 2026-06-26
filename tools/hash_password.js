#!/usr/bin/env node
"use strict";

const crypto = require("crypto");

const p = process.argv[2];
if (p == null || p === "") {
  console.error("用法: node tools/hash_password.js <密码>");
  console.error("示例: node tools/hash_password.js \"MySecret123\"");
  process.exit(1);
}

const hex = crypto.createHash("sha256").update(p, "utf8").digest("hex");
console.log(hex);
