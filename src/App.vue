<script setup>
import { ref, computed, onMounted } from "vue";

// 工具函数
function detectVersion(ip, explicitVersion) {
  if (explicitVersion) return explicitVersion;
  if (!ip) return "未知";
  return ip.includes(":") ? "IPv6" : "IPv4";
}

function joinLocation(parts) {
  return parts.filter(Boolean).join(" / ") || "-";
}

// ---- IP API 封装 ----
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
    source: "IP.SB"
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
    source: "ipapi.co"
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
    source: "GeoJS"
  };
}

async function fetchFromBaiduQifu() {
  const res = await fetch(
    "https://qifu-api.baidubce.com/ip/local/geo/v1/district"
  );
  if (!res.ok) throw new Error("Baidu Qifu HTTP " + res.status);
  const raw = await res.json();
  const d = raw.data || raw;
  const province = d.prov || d.province;
  const city = d.city;
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
    source: "Baidu Qifu"
  };
}

const providerDefs = [
  { id: "baidu-qifu", name: "百度奇富", scope: "domestic", fetcher: fetchFromBaiduQifu },
  { id: "ip-sb", name: "IP.SB", scope: "global", fetcher: fetchFromIpSb },
  { id: "ipapi", name: "ipapi.co", scope: "global", fetcher: fetchFromIpapi },
  { id: "geojs", name: "GeoJS", scope: "global", fetcher: fetchFromGeojs }
];

const mainV4 = ref(null);
const mainV6 = ref(null);
const mainError = ref("");

// provider 表格状态
const providerRows = ref(
  providerDefs.map((d) => ({
    id: d.id,
    name: d.name,
    scope: d.scope,
    ip: "--",
    location: "--",
    isp: "--",
    asn: "--",
    status: "pending",
    statusText: "等待中"
  }))
);

function resetProviderRows() {
  providerRows.value = providerDefs.map((d) => ({
    id: d.id,
    name: d.name,
    scope: d.scope,
    ip: "--",
    location: "--",
    isp: "--",
    asn: "--",
    status: "pending",
    statusText: "等待中"
  }));
}

function applyToMain(result) {
  const version = detectVersion(result.ip, result.version);
  if (version === "IPv4" && !mainV4.value && result.ip) {
    mainV4.value = result;
  }
  if (version === "IPv6" && !mainV6.value && result.ip) {
    mainV6.value = result;
  }
}

const mainV4View = computed(() => {
  const v4 = mainV4.value;
  if (!v4) {
    return {
      ip: "未检测到 IPv4",
      location: "-",
      country: "-",
      isp: "-",
      asn: "-",
      timezone: "-",
      source: ""
    };
  }
  return {
    ip: v4.ip,
    location: joinLocation([v4.city, v4.region]),
    country: v4.country || "-",
    isp: v4.isp || "-",
    asn: v4.asn || "-",
    timezone: v4.timezone || "-",
    source: "数据来源：" + v4.source
  };
});

const mainV6View = computed(() => {
  const v6 = mainV6.value;
  if (!v6) {
    return {
      ip: "未检测到 IPv6",
      location: "-",
      country: "-",
      isp: "-",
      asn: "-",
      timezone: "-",
      source: ""
    };
  }
  return {
    ip: v6.ip,
    location: joinLocation([v6.city, v6.region]),
    country: v6.country || "-",
    isp: v6.isp || "-",
    asn: v6.asn || "-",
    timezone: v6.timezone || "-",
    source: "数据来源：" + v6.source
  };
});

// 显示过滤
const hideDomestic = ref(false);
const hideGlobal = ref(false);

const filteredProviders = computed(() =>
  providerRows.value.filter((row) => {
    if (row.scope === "domestic" && hideDomestic.value) return false;
    if (row.scope === "global" && hideGlobal.value) return false;
    return true;
  })
);

function statusClass(status) {
  if (status === "ok") return "status-pill status-ok";
  if (status === "bad") return "status-pill status-bad";
  return "status-pill status-pending";
}

function scopeBadgeClass(scope) {
  return scope === "domestic" ? "badge badge-domestic" : "badge badge-global";
}
function scopeLabel(scope) {
  return scope === "domestic" ? "国内" : "国际";
}

async function runIpSources() {
  mainV4.value = null;
  mainV6.value = null;
  mainError.value = "";
  resetProviderRows();

  await Promise.all(
    providerDefs.map(async (def) => {
      const row = providerRows.value.find((r) => r.id === def.id);
      if (!row) return;
      row.status = "pending";
      row.statusText = "查询中";

      try {
        const result = await def.fetcher();
        row.ip = result.ip || "-";
        row.location = joinLocation([
          result.city,
          result.region,
          result.country
        ]);
        row.isp = result.isp || "-";
        row.asn = result.asn || "-";
        row.status = "ok";
        row.statusText = "成功";
        applyToMain(result);
      } catch (e) {
        console.error("Provider failed:", def.id, e);
        row.status = "bad";
        row.statusText = "失败";
        row.ip = "-";
        row.location = "-";
        row.isp = "-";
        row.asn = "-";
      }
    })
  );

  if (!mainV4.value && !mainV6.value) {
    mainError.value =
      "所有 IP API 调用都失败了，可能被浏览器插件或网络环境拦截。请检查广告拦截 / 隐私扩展 / 企业网络策略等。";
  }
}

// ---- 连通性测试 ----
const connectivityDefs = [
  {
    id: "bytedance",
    name: "字节跳动",
    url: "https://www.bytedance.com/favicon.ico",
    scope: "domestic"
  },
  {
    id: "bilibili",
    name: "Bilibili",
    url: "https://www.bilibili.com/favicon.ico",
    scope: "domestic"
  },
  {
    id: "wechat",
    name: "微信",
    url: "https://wx.qq.com/favicon.ico",
    scope: "domestic"
  },
  {
    id: "taobao",
    name: "淘宝",
    url: "https://www.taobao.com/favicon.ico",
    scope: "domestic"
  },
  {
    id: "github",
    name: "GitHub",
    url: "https://github.com/favicon.ico",
    scope: "global"
  },
  {
    id: "jsdelivr",
    name: "jsDelivr",
    url: "https://cdn.jsdelivr.net/favicon.ico",
    scope: "global"
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    url: "https://www.cloudflare.com/favicon.ico",
    scope: "global"
  },
  {
    id: "youtube",
    name: "YouTube",
    url: "https://www.youtube.com/favicon.ico",
    scope: "global"
  }
];

const connectivityRows = ref(
  connectivityDefs.map((d) => ({
    ...d,
    latency: "测试中...",
    status: "pending",
    statusText: "测试中"
  }))
);

const filteredConnectivity = computed(() =>
  connectivityRows.value.filter((row) => {
    if (row.scope === "domestic" && hideDomestic.value) return false;
    if (row.scope === "global" && hideGlobal.value) return false;
    return true;
  })
);

function resetConnectivityRows() {
  connectivityRows.value = connectivityDefs.map((d) => ({
    ...d,
    latency: "测试中...",
    status: "pending",
    statusText: "测试中"
  }));
}

function runConnectivityTests() {
  resetConnectivityRows();
  const TIMEOUT_MS = 5000;

  connectivityRows.value.forEach((row) => {
    row.status = "pending";
    row.statusText = "测试中";
    row.latency = "测试中...";

    const img = new Image();
    const start = performance.now();
    let finished = false;

    function finish(ok, reason) {
      if (finished) return;
      finished = true;
      const duration = Math.round(performance.now() - start);
      row.latency =
        duration >= TIMEOUT_MS ? "> " + TIMEOUT_MS + " ms" : duration + " ms";

      if (ok) {
        row.status = "ok";
        row.statusText = "可访问";
      } else {
        row.status = "bad";
        row.statusText =
          reason === "timeout" ? "超时 / 可能被阻断" : "失败 / 可能被阻断";
      }
    }

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
      row.url + (row.url.includes("?") ? "&" : "?") + "t=" + Date.now();
  });
}

onMounted(() => {
  runIpSources();
  runConnectivityTests();
});
</script>

<template>
  <div class="page">
    <header class="header">
      <nav class="nav">
        <span class="nav-item nav-item-active">本机 IP 查询</span>
        <span class="nav-item nav-item-disabled">网站分流测试（待实现）</span>
        <span class="nav-item nav-item-disabled">中转出口 IP（待实现）</span>
        <span class="nav-item nav-item-disabled">CDN 命中节点（待实现）</span>
        <span class="nav-item nav-item-disabled">DNS 出口查询（待实现）</span>
        <span class="nav-item nav-item-disabled">WebRTC UDP（待实现）</span>
        <span class="nav-item nav-item-disabled">IP 洞察（待实现）</span>
      </nav>

      <div class="headline">
        <h1>本机 IP 查询</h1>
        <p class="subtitle">查看你当前网络的 IPv4 / IPv6 地址、位置信息 和 网络连通性</p>
      </div>
    </header>

    <main class="main">
      <!-- 左侧：IPv4 / IPv6 概览 -->
      <section class="card card-main-ip">
        <h2>当前公网 IP 概览</h2>

        <div class="ip-section">
          <div class="ip-section-header">
            <span class="pill pill-v4">IPv4</span>
            <span class="source-text">{{ mainV4View.source }}</span>
          </div>
          <div class="ip-main">
            <span class="ip-address">{{ mainV4View.ip }}</span>
          </div>
          <div class="ip-meta">
            <div><strong>位置：</strong><span>{{ mainV4View.location }}</span></div>
            <div><strong>国家 / 地区：</strong><span>{{ mainV4View.country }}</span></div>
            <div><strong>运营商：</strong><span>{{ mainV4View.isp }}</span></div>
            <div><strong>ASN：</strong><span>{{ mainV4View.asn }}</span></div>
            <div><strong>时区：</strong><span>{{ mainV4View.timezone }}</span></div>
          </div>
        </div>

        <div class="divider"></div>

        <div class="ip-section">
          <div class="ip-section-header">
            <span class="pill pill-v6">IPv6</span>
            <span class="source-text">{{ mainV6View.source }}</span>
          </div>
          <div class="ip-main">
            <span class="ip-address">{{ mainV6View.ip }}</span>
          </div>
          <div class="ip-meta">
            <div><strong>位置：</strong><span>{{ mainV6View.location }}</span></div>
            <div><strong>国家 / 地区：</strong><span>{{ mainV6View.country }}</span></div>
            <div><strong>运营商：</strong><span>{{ mainV6View.isp }}</span></div>
            <div><strong>ASN：</strong><span>{{ mainV6View.asn }}</span></div>
            <div><strong>时区：</strong><span>{{ mainV6View.timezone }}</span></div>
          </div>
        </div>

        <p v-if="mainError" class="ip-error">
          {{ mainError }}
        </p>

        <button class="btn" @click="runIpSources">重新获取 IP 信息</button>
      </section>

      <!-- 右侧：多来源 IP 信息 + 连通性 -->
      <section class="card card-sources">
        <h2>多来源 IP 信息（更接近 ip.skk.moe）</h2>
        <p class="description">
          同时调用多个免费 IP API（国内 / 国际），交叉比对 IP、位置、ISP、ASN 等信息。
          <br />
          <small>各家数据源不同，结果仅供参考。</small>
        </p>

        <div class="toggle-row">
          <label>
            <input type="checkbox" v-model="hideDomestic" />
            隐藏国内信息
          </label>
          <label>
            <input type="checkbox" v-model="hideGlobal" />
            隐藏国际信息
          </label>
        </div>

        <table class="table table-small" id="ip-sources-table">
          <thead>
            <tr>
              <th>数据源</th>
              <th>类型</th>
              <th>IP</th>
              <th>位置</th>
              <th>ISP</th>
              <th>ASN</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredProviders" :key="row.id">
              <td>{{ row.name }}</td>
              <td>
                <span :class="scopeBadgeClass(row.scope)">
                  {{ scopeLabel(row.scope) }}
                </span>
              </td>
              <td>{{ row.ip }}</td>
              <td>{{ row.location }}</td>
              <td>{{ row.isp }}</td>
              <td>{{ row.asn }}</td>
              <td>
                <span :class="statusClass(row.status)">
                  {{ row.statusText }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <h3 class="subheading">常用网站连通性</h3>
        <p class="description">
          使用小图标资源的加载时间，粗略模拟「分流测试」。
          <br />
          <small>前端环境无法真正 ping，仅作“是否能访问 + 大致延迟”参考。</small>
        </p>

        <table class="table" id="connectivity-table">
          <thead>
            <tr>
              <th>站点</th>
              <th>类型</th>
              <th>延迟</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredConnectivity" :key="row.id">
              <td>{{ row.name }}</td>
              <td>
                <span :class="scopeBadgeClass(row.scope)">
                  {{ scopeLabel(row.scope) }}
                </span>
              </td>
              <td>{{ row.latency }}</td>
              <td>
                <span :class="statusClass(row.status)">
                  {{ row.statusText }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>

    <footer class="footer">
      <span>© 2025 IP Checker · Cloudflare Worker + Vue · Inspired by ip.skk.moe</span>
    </footer>
  </div>
</template>
