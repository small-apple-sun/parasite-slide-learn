(function () {
  "use strict";

  /**
   * 复制本文件为 auth-config.js 后编辑；或直接编辑仓库里的 auth-config.js。
   * 密码只写哈希，不写明文。生成：node tools/hash_password.js "密码"
   */
  window.__PARASITE_SLIDE_AUTH__ = {
    users: [
      { username: "demo_a", passwordSha256Hex: "REPLACE_WITH_SHA256_OF_PASSWORD_A" },
      { username: "demo_b", passwordSha256Hex: "REPLACE_WITH_SHA256_OF_PASSWORD_B" },
    ],
  };
})();
