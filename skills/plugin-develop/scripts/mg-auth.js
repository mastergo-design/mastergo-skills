// MasterGo admin API 认证辅助
// 从本地 Chrome Cookies 数据库解密会话 cookie，构造请求 Cookie 头。
// 仅支持 macOS 本地 Chrome（默认 profile）。解密算法对应 Chrome 的
// "v10" 加密方案：Safe Storage 口令做 PBKDF2-HMAC-SHA1(1003 次) 得到 AES-128 密钥，
// 密文 v10 前缀后紧跟 16 字节 IV，解密结果需去掉 16 字节常量前缀后才是 cookie 值。
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');

// macOS Chrome Safe Storage 口令（keychain 中 "Chrome Safe Storage" 密码）。
// 每台机器不同，**必须**由环境变量注入，禁止硬编码进仓库：
//   export MG_CHROME_SAFE_STORAGE_PASSWORD="$(security find-generic-password -w -a Chrome -s 'Chrome Safe Storage')"
const PASSWORD = process.env.MG_CHROME_SAFE_STORAGE_PASSWORD;
const SALT = 'saltysalt';
// Chrome Cookies 数据库路径，同样必须显式指定，例如：
//   export MG_CHROME_COOKIES_DB="$HOME/Library/Application Support/Google/Chrome/Default/Cookies"
const COOKIE_DB = process.env.MG_CHROME_COOKIES_DB;

let cachedKey = null;
function getKey() {
  if (!cachedKey) {
    if (!PASSWORD) {
      throw new Error(
        '缺少 MG_CHROME_SAFE_STORAGE_PASSWORD。请先执行：\n' +
        "  export MG_CHROME_SAFE_STORAGE_PASSWORD=\"$(security find-generic-password -w -a Chrome -s 'Chrome Safe Storage')\"",
      );
    }
    cachedKey = crypto.pbkdf2Sync(Buffer.from(PASSWORD, 'ascii'), Buffer.from(SALT, 'ascii'), 1003, 16, 'sha1');
  }
  return cachedKey;
}

function decrypt(encrypted) {
  const body = encrypted.subarray(3); // 去掉 "v10" 前缀
  const iv = body.subarray(0, 16);
  const ct = body.subarray(16);
  const d = crypto.createDecipheriv('aes-128-cbc', getKey(), iv);
  const out = Buffer.concat([d.update(ct), d.final()]);
  const pad = out[out.length - 1];
  if (pad >= 1 && pad <= 16 && pad <= out.length) return out.subarray(0, out.length - pad);
  return out;
}

// cookie 值去掉 16 字节常量前缀后的 UUID
function getCookie(name) {
  if (!COOKIE_DB) {
    throw new Error('缺少 MG_CHROME_COOKIES_DB。请先执行：\n  export MG_CHROME_COOKIES_DB="$HOME/Library/Application Support/Google/Chrome/Default/Cookies"');
  }
  const db = new DatabaseSync(COOKIE_DB);
  const row = db.prepare(
    "SELECT encrypted_value, value FROM cookies WHERE name=? AND host_key='.mastergo.com' LIMIT 1"
  ).get(name);
  db.close();
  if (!row) return null;
  let buf;
  if (row.encrypted_value && row.encrypted_value.length > 0) buf = decrypt(Buffer.from(row.encrypted_value));
  else buf = Buffer.from(row.value || '');
  // 实测解密结果前 16 字节是常量前缀（c9d4e33ea1f9bd2a00b8e10a88195566），
  // 去掉之后才是真正的会话值；若长度不足 16 直接返回原值。
  return buf.length > 16 ? buf.subarray(16).toString('utf8') : buf.toString('utf8');
}

// 构造 admin API 请求用的 Cookie 头
function cookieHeader() {
  const session = getCookie('gfsessionid');
  if (!session) throw new Error('未找到 gfsessionid cookie，请确认本地 Chrome 已登录 mastergo.com');
  const cid = getCookie('_M_C_ID') || '';
  return `gfsessionid=${session}; gfsessionid_backup=${session}; _M_C_ID=${cid}`;
}

module.exports = { cookieHeader, decrypt, getCookie, COOKIE_DB };
