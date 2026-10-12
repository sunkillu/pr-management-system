// 主页链接解析达人档案（当前为 mock 实现，预留真实抓取接口）

export type FetchedProfile = {
  platform: string | null; // XIAOHONGSHU / DOUYIN / null
  accountId: string | null;
  nickname: string;
  mock: true;
};

/** 从主页链接 mock 解析平台与账号ID */
export function mockFetchProfile(homeUrl: string): FetchedProfile {
  const url = homeUrl.trim();
  let platform: string | null = null;
  if (/xiaohongshu\.com/i.test(url)) platform = "XIAOHONGSHU";
  else if (/douyin\.com/i.test(url)) platform = "DOUYIN";

  // 取 URL 最后一段 path 作为账号ID
  let accountId: string | null = null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const segs = u.pathname.split("/").filter(Boolean);
    if (segs.length > 0) accountId = decodeURIComponent(segs[segs.length - 1]).slice(0, 64);
  } catch {
    const m = url.match(/\/([^/?#]+)(?:[?#]|$)/);
    if (m) accountId = m[1].slice(0, 64);
  }

  return {
    platform,
    accountId,
    nickname: accountId ? `待补充_${accountId.slice(0, 12)}` : "待补充",
    mock: true,
  };
}

/**
 * 预留真实抓取接口：后续对接小红书/抖音开放平台或爬虫服务时，
 * 在此替换为真实实现，保持返回结构不变。
 */
export async function fetchProfile(homeUrl: string): Promise<FetchedProfile> {
  // TODO: 接入真实抓取服务
  return mockFetchProfile(homeUrl);
}
