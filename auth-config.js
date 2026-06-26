(function () {
  "use strict";

  /**
   * 多账号登录配置（纯静态站：校验在浏览器内完成，仅作简易门禁）。
   * 每条：username 为登录名；passwordSha256Hex 为密码经 UTF-8 编码后的 SHA-256 十六进制（小写）。
   * 生成哈希：在本目录执行 node tools/hash_password.js "你的密码"
   *
   * users 留空数组 [] 表示不启用登录（便于本地开发或与旧行为一致）。
   */
  window.__PARASITE_SLIDE_AUTH__ = {
    users: [
      // 单字母账号，密码均为 123（哈希相同；换密码请用 node tools/hash_password.js "新密码"）
      { username: "a", passwordSha256Hex: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3" },
      { username: "b", passwordSha256Hex: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3" },
      { username: "c", passwordSha256Hex: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3" },
      { username: "d", passwordSha256Hex: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3" },
      { username: "e", passwordSha256Hex: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3" },
      { username: "f", passwordSha256Hex: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3" },
      { username: "g", passwordSha256Hex: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3" },
      { username: "h", passwordSha256Hex: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3" },
      { username: "i", passwordSha256Hex: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3" },
      { username: "j", passwordSha256Hex: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3" },
    ],
  };
})();
