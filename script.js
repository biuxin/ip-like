// --------------------------- 工具函数 ------------------------------

/**
 * 简单判断 IPv4 / IPv6
 */
function detectVersion(ip, explicitVersion) {
  if (explicitVersion) return explicitVersion;
  if (!ip) return "未知";
  return ip.includes(":") ? "IPv6" : "IPv4";
}

/**
 * 拼位置字符串
 */
function joinLocation(parts) {
  return parts.filter(Boolean).join(" / ") || "-";
}

// --------------------------- IP API 封装 ---------------------------

/**
 * 统一返回结构:
 * {
 *   ip, version, country, region, city,
 *   isp, asn, timezone, source
 * }
 */

async function fetchFromIpSb() {
  const res = await fetch("https://api.ip.sb/geoip");
  if (!res.ok) throw new Error("IP.SB HTTP " + res.status);
  const d = await res.json();
  const ip = d.ip || d.query;
  return {
    ip,
    version: detectVersion(ip, d.version),
    country: d.country || d.country_code || "",
    region: d.region || d.region_code || "",
    city: d.city || "",
    isp: d.organization || d.isp || d.asn_organization || "",
    asn: d.asn ? "AS" + d.asn + (d.asn_organization ? " " + d.asn_organization : "") : "",
    timezone: d.timezone || "",
    source: "IP.SB",
  };
}

async function fetchFromIpapi() {
  const res = await fetch("https://ipapi.co/json/");
  if (!res.ok) throw new Error("ipapi HTTP " + res.status);
  const d = await res.json();
  const ip = d.ip;
  return {
    ip,
    version: detectVersion(ip, d.version),
    country: d.country_name || d.country || "",
    region: d.region || "",
    city: d.city || "",
    isp: d.org || "",
    asn: d.asn || "",
    timezone: d.timezone || "",
    source: "ipapi.co",
  };
}

async function fetchFromGeojs() {
  const res = await fetch("https://get.geojs.io/v1/ip/geo.json");
  if (!res.ok) throw new Error("GeoJS HTTP " + res.status);
  const d = await res.json();
  const ip = d.ip || d.address;
  return {
    ip,
    version: detectVersion(ip),
    country: d.country || "",
    region: d.region || d.region_name || "",
    city: d.city || "",
    isp: d.organization || d.org || "",
    asn: d.asn || "",
    timezone: d.timezone || d.time_zone || "",
    source: "GeoJS",
  };
}

// 百度奇富：本机 IP 信息
async function fetchFromBaiduQifu() {
  // 本机：不带 ip 参数
  const res = await fetch(
    "https://qifu-api.baidubce.com/ip/local/geo/v1/district"
  );
  if (!res.ok) throw new Error("Baidu Qifu HTTP " + res.status);
  const raw = await res.json();
  const d = raw.data || raw;

  // 字段命名在不同文档中有 province/prov 等，这里做个兼容兜底
  const province = d.prov || d.province;
  const city = d.city;
  const district = d.district;
  const country = d.country || "中国";

  return {
    ip: d.ip || raw.ip || "",
    version: detectVersion(d.ip || raw.ip),
    country,
    region: province || "",
    city: city || "",
    isp: d.isp || d.owner || "",
    asn: d.asnumber ? "AS" + d.asnumber : "",
    timezone: d.timezone || "UTC+8",
    source: "Baidu Qifu",
  };
}

// 提供者列表（和 HTML 里的 data-provider-id 一一对应）
const PROVIDERS = [
  { id: "baidu-qifu", scope: "domestic", fetcher: fetchFromBaiduQifu },
  { id: "ip-sb", scope: "global", fetcher: fetchFromIpSb },
  { id: "ipapi", scope: "global", fetcher: fetchFromIpapi },
  { id: "geojs", scope: "global", fetcher: fetchFromGeojs },
];

// --------------------------- 填充 UI：主 IP 概览 --------------------

const mainResult = {
  v4: null,
  v6: null,
};

/**
 * 把某个 provider 的结果，塞到左侧 IPv4 / IPv6 概览
 * - 只填“第一个拿到的 IPv4 / IPv6”
 */
function applyToMain(result) {
  const v = detectVersion(result.ip, result.version);

  if (v === "IPv4" && !mainResult.v4 && result.ip) {
    mainResult.v4 = result;
  } else if (v === "IPv6" && !mainResult.v6 && result.ip) {
    mainResult.v6 = result;
  }
  renderMainIp();
}

function renderMainIp() {
  const errEl = document.getElementById("ip-error");

  const v4 = mainResult.v4;
  const v6 = mainResult.v6;

  // IPv4
  if (v4) {
    document.getElementById("v4-ip").textContent = v4.ip;
    document.getElementById("v4-location").textContent = joinLocation([
      v4.city,
      v4.region,
    ]);
    document.getElementById("v4-country").textContent = v4.country || "-";
    document.getElementById("v4-isp").textContent = v4.isp || "-";
    document.getElementById("v4-asn").textContent = v4.asn || "-";
    document.getElementById("v4-timezone").textContent = v4.timezone || "-";
    document.getElementById("v4-source").textContent = "数据来源：" + v4.source;
  } else {
    document.getElementById("v4-ip").textContent = "未检测到 IPv4";
    document.getElementById("v4-location").textContent = "-";
    document.getElementById("v4-country").textContent = "-";
    document.getElementById("v4-isp").textContent = "-";
    document.getElementById("v4-asn").textContent = "-";
    document.getElementById("v4-timezone").textContent = "-";
    document.getElementById("v4-source").textContent = "";
  }

  // IPv6
  if (v6) {
    document.getElementById("v6-ip").textContent = v6.ip;
    document.getElementById("v6-location").textContent = joinLocation([
      v6.city,
      v6.region,
    ]);
    document.getElementById("v6-country").textContent = v6.country || "-";
    document.getElementById("v6-isp").textContent = v6.isp || "-";
    document.getElementById("v6-asn").textContent = v6.asn || "-";
    document.getElementById("v6-timezone").textContent = v6.timezone || "-";
    document.getElementById("v6-source").textContent = "数据来源：" + v6.source;
  } else {
    document.getElementById("v6-ip").textContent = "未检测到 IPv6";
    document.getElementById("v6-location").textContent = "-";
    document.getElementById("v6-country").textContent = "-";
    document.getElementById("v6-isp").textContent = "-";
    document.getElementById("v6-asn").textContent = "-";
    document.getElementById("v6-timezone").textContent = "-";
    document.getElementById("v6-source").textContent = "";
  }

  // 如果一个都没有成功，显示错误提示
  if (!v4 && !v6) {
    errEl.textContent =
      "所有 IP API 调用都失败了，可能是被浏览器插件或网络环境拦截。建议检查：广告拦截 / 浏览器隐私设置 / 企业网络限制等。";
    errEl.classList.remove("hidden");
  } else {
    errEl.classList.add("hidden");
  }
}

// ------------------------ 填充 UI：多来源 IP 表 ----------------------

function setStatusPill(td, text, kind) {
  td.innerHTML = "";
  const span = document.createElement("span");
  span.className =
    "status-pill " +
    (kind === "ok"
      ? "status-ok"
      : kind === "bad"
      ? "status-bad"
      : "status-pending");
  span.textContent = text;
  td.appendChild(span);
}

async function runIpSources() {
  // 初始化主区块 UI
  mainResult.v4 = null;
  mainResult.v6 = null;
  document.getElementById("v4-ip").textContent = "检测中...";
  document.getElementById("v6-ip").textContent = "检测中...";
  document.getElementById("v4-source").textContent = "";
  document.getElementById("v6-source").textContent = "";

  const table = document.getElementById("ip-sources-table");
  const tbody = table.querySelector("tbody");

  // 重置表格行
  for (const row of tbody.querySelectorAll("tr")) {
    row.querySelector(".ip-cell").textContent = "--";
    row.querySelector(".loc-cell").textContent = "--";
    row.querySelector(".isp-cell").textContent = "--";
    row.querySelector(".asn-cell").textContent = "--";
    const statusTd = row.querySelector(".status-cell");
    setStatusPill(statusTd, "等待中", "pending");
  }

  // 并行跑所有 provider
  await Promise.all(
    PROVIDERS.map(async (p) => {
      const row = tbody.querySelector(
        `tr[data-provider-id="${p.id}"]`
      );
      if (!row) return;

      const ipTd = row.querySelector(".ip-cell");
      const locTd = row.querySelector(".loc-cell");
      const ispTd = row.querySelector(".isp-cell");
      const asnTd = row.querySelector(".asn-cell");
      const statusTd = row.querySelector(".status-cell");

      setStatusPill(statusTd, "查询中", "pending");

      try {
        const result = await p.fetcher();

        ipTd.textContent = result.ip || "-";
        locTd.textContent = joinLocation([
          result.city,
          result.region,
          result.country,
        ]);
        ispTd.textContent = result.isp || "-";
        asnTd.textContent = result.asn || "-";
        setStatusPill(statusTd, "成功", "ok");

        applyToMain(result);
      } catch (e) {
        console.error("Provider failed:", p.id, e);
        setStatusPill(statusTd, "失败", "bad");
        ipTd.textContent = "-";
        locTd.textContent = "-";
        ispTd.textContent = "-";
        asnTd.textContent = "-";
      }
    })
  );

  // 所有 provider 完成后，再渲染一遍（防止一开始都失败）
  renderMainIp();
}

// ---------------------- 连通性测试（伪 ping） ------------------------

const CONNECTIVITY_SITES = [
  {
    name: "字节跳动",
    url: "https://www.bytedance.com/favicon.ico",
    scope: "domestic",
  },
  {
    name: "Bilibili",
    url: "https://www.bilibili.com/favicon.ico",
    scope: "domestic",
  },
  {
    name: "微信",
    url: "https://wx.qq.com/favicon.ico",
    scope: "domestic",
  },
  {
    name: "淘宝",
    url: "https://www.taobao.com/favicon.ico",
    scope: "domestic",
  },
  {
    name: "GitHub",
    url: "https://github.com/favicon.ico",
    scope: "global",
  },
  {
    name: "jsDelivr",
    url: "https://cdn.jsdelivr.net/favicon.ico",
    scope: "global",
  },
  {
    name: "Cloudflare",
    url: "https://www.cloudflare.com/favicon.ico",
    scope: "global",
  },
  {
    name: "YouTube",
    url: "https://www.youtube.com/favicon.ico",
    scope: "global",
  },
];

function createBadge(scope) {
  const span = document.createElement("span");
  span.className =
    "badge " + (scope === "domestic" ? "badge-domestic" : "badge-global");
  span.textContent = scope === "domestic" ? "国内" : "国际";
  return span;
}

function runConnectivityTests() {
  const tbody = document
    .getElementById("connectivity-table")
    .querySelector("tbody");
  tbody.innerHTML = "";

  const TIMEOUT_MS = 5000;

  CONNECTIVITY_SITES.forEach((site) => {
    const tr = document.createElement("tr");
    tr.dataset.scope = site.scope;

    const nameTd = document.createElement("td");
    nameTd.textContent = site.name;

    const typeTd = document.createElement("td");
    typeTd.appendChild(createBadge(site.scope));

    const latencyTd = document.createElement("td");
    latencyTd.textContent = "测试中...";

    const statusTd = document.createElement("td");
    setStatusPill(statusTd, "测试中", "pending");

    tr.appendChild(nameTd);
    tr.appendChild(typeTd);
    tr.appendChild(latencyTd);
    tr.appendChild(statusTd);
    tbody.appendChild(tr);

    const img = new Image();
    const start = performance.now();
    let finished = false;

    const finish = (ok, reason) => {
      if (finished) return;
      finished = true;

      const duration = Math.round(performance.now() - start);
      latencyTd.textContent =
        duration >= TIMEOUT_MS ? "> " + TIMEOUT_MS + " ms" : duration + " ms";

      if (ok) {
        setStatusPill(statusTd, "可访问", "ok");
      } else {
        const txt =
          reason === "timeout" ? "超时 / 可能被阻断" : "失败 / 可能被阻断";
        setStatusPill(statusTd, txt, "bad");
      }
    };

    const timer = setTimeout(() => {
      finish(false, "timeout");
    }, TIMEOUT_MS);

    img.onload = () => {
      clearTimeout(timer);
      finish(true, "ok");
    };

    img.onerror = () => {
      clearTimeout(timer);
      finish(false, "error");
    };

    img.src =
      site.url + (site.url.includes("?") ? "&" : "?") + "t=" + Date.now();
  });
}

// ----------------------------- 过滤开关 -----------------------------

function applyScopeFilter() {
  const hideDomestic = document.getElementById("hide-domestic").checked;
  const hideGlobal = document.getElementById("hide-global").checked;

  const scopedRows = document.querySelectorAll(
    '#ip-sources-table tbody tr, #connectivity-table tbody tr'
  );

  scopedRows.forEach((row) => {
    const scope = row.dataset.scope;
    let hidden = false;
    if (scope === "domestic" && hideDomestic) hidden = true;
    if (scope === "global" && hideGlobal) hidden = true;
    row.classList.toggle("hidden", hidden);
  });
}

// ----------------------------- 初始化 -------------------------------

document.addEventListener("DOMContentLoaded", () => {
  // 1. IP 信息 + 多来源表
  runIpSources();

  // 2. 连通性测试
  runConnectivityTests();

  // 3. 刷新按钮
  document.getElementById("refresh-ip").addEventListener("click", () => {
    runIpSources();
  });

  // 4. 过滤开关
  document
    .getElementById("hide-domestic")
    .addEventListener("change", applyScopeFilter);
  document
    .getElementById("hide-global")
    .addEventListener("change", applyScopeFilter);
});
