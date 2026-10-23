import type { BrandHit, Country } from "./types";

/** brand -> aliases (lowercase). Curated, not exhaustive: absence of a hit does NOT mean no infringement. */
export const BRANDS: Record<string, string[]> = {
  Apple: ["apple", "iphone", "ipad", "airpods", "macbook", "苹果", "magsafe"],
  Samsung: ["samsung", "galaxy", "三星"], Xiaomi: ["xiaomi", "mijia", "redmi", "小米", "米家"],
  Huawei: ["huawei", "华为"], Anker: ["anker", "安克"], Baseus: ["baseus", "倍思"], Ugreen: ["ugreen", "绿联"],
  Dyson: ["dyson", "戴森"], Philips: ["philips", "飞利浦"], Panasonic: ["panasonic", "松下"], Sharp: ["sharp", "夏普"],
  Midea: ["midea", "美的"], Tefal: ["tefal", "特福"], Braun: ["braun", "博朗"], Sony: ["sony", "索尼"], Bose: ["bose"],
  JBL: ["jbl"], Nintendo: ["nintendo", "任天堂", "nintendo switch"], Disney: ["disney", "迪士尼", "frozen", "冰雪奇缘", "mickey", "米老鼠", "米奇"],
  Marvel: ["marvel", "漫威", "spider-man", "spiderman", "蜘蛛侠", "avengers", "复仇者"], LEGO: ["lego", "乐高"],
  Pokemon: ["pokemon", "pokémon", "宝可梦", "pikachu", "皮卡丘"], "Hello Kitty / Sanrio": ["hello kitty", "sanrio", "三丽鸥", "kuromi", "库洛米", "美乐蒂", "cinnamoroll", "玉桂狗", "my melody"],
  "Barbie / Mattel": ["barbie", "芭比", "mattel", "hot wheels", "风火轮"], Hasbro: ["hasbro", "transformers", "变形金刚", "nerf"],
  "Labubu / Pop Mart": ["labubu", "拉布布", "pop mart", "泡泡玛特"], Bandai: ["bandai", "万代", "gundam", "高达"],
  "Doraemon": ["doraemon", "哆啦a梦", "机器猫"], "Peppa Pig": ["peppa", "小猪佩奇"], Squishmallows: ["squishmallow"],
  "L'Oréal": ["l'oreal", "loreal", "欧莱雅"], "Estée Lauder": ["estee lauder", "estée lauder", "雅诗兰黛"], Lancôme: ["lancome", "lancôme", "兰蔻"],
  "Dior": ["dior", "迪奥"], Chanel: ["chanel", "香奈儿"], MAC: ["mac cosmetics", "魅可"], Maybelline: ["maybelline", "美宝莲"],
  "SK-II": ["sk-ii", "sk2", "神仙水"], Shiseido: ["shiseido", "资生堂"], "YSL": ["ysl", "yves saint laurent", "圣罗兰"],
  "Charlotte Tilbury": ["charlotte tilbury"], "Fenty Beauty": ["fenty"], "The Ordinary": ["the ordinary"], CeraVe: ["cerave", "适乐肤"],
  Nivea: ["nivea", "妮维雅"], Innisfree: ["innisfree", "悦诗风吟"], Sulwhasoo: ["sulwhasoo", "雪花秀"], Gucci: ["gucci", "古驰"],
  "Louis Vuitton": ["louis vuitton", "lv"], Hermès: ["hermes", "hermès", "爱马仕"], Nike: ["nike", "耐克"], Adidas: ["adidas", "阿迪达斯"],
};
const SHORT_RISKY = new Set(["lv", "ysl", "jbl"]); // ambiguous short tokens: only latin word-boundary match, flagged as possible
export const COUNTERFEIT_TERMS = ["同款", "原单", "高仿", "a货", "复刻", "1:1", "1比1", "一比一", "超a", "精仿", "仿牌", "尾单", "replica", "fake", "copy", "aaa quality", "mirror quality", "原厂代工", "专柜同款", "大牌同款"];
export const DUPE_TERMS = ["平替", "dupe", "inspired by", "类似"];
export const COMPAT_TERMS = ["适用于", "适配", "兼容", "for ", "compatible with", "专用"];

function wordHit(t: string, alias: string): boolean {
  if (/^[a-z0-9'\- .]+$/.test(alias)) {
    const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${esc}($|[^a-z0-9])`, "i").test(t);
  }
  return t.includes(alias);
}

export function checkBrandWords(text: string): BrandHit[] {
  const t = text.toLowerCase();
  const hits: BrandHit[] = [];
  const compat = COMPAT_TERMS.some((c) => t.includes(c));
  for (const [brand, aliases] of Object.entries(BRANDS)) {
    const a = aliases.find((x) => wordHit(t, x));
    if (!a) continue;
    const isCompat = compat && new RegExp(`(适用于|适配|兼容|for|compatible with)\\s*${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(t);
    hits.push({ term: a, brand: SHORT_RISKY.has(a) ? `${brand}（短词，可能误报）` : brand, type: isCompat ? "compat" : "brand" });
  }
  for (const c of COUNTERFEIT_TERMS) if (wordHit(t, c)) hits.push({ term: c, brand: "—", type: "counterfeit" });
  for (const c of DUPE_TERMS) if (wordHit(t, c)) hits.push({ term: c, brand: "—", type: "dupe" });
  return hits;
}

export function ipLinks(country: Country): { name: string; url: string }[] {
  const nat: Record<Country, { name: string; url: string }> = {
    TH: { name: "泰国知识产权厅 DIP 商标检索", url: "https://tmsearch.ipthailand.go.th/" },
    PH: { name: "菲律宾知识产权局 IPOPHL eSearch", url: "https://onlineservices.ipophil.gov.ph/esearch/" },
    MY: { name: "马来西亚知识产权局 MyIPO", url: "https://iponlineext.myipo.gov.my/SPHI/Extra/Default.aspx" },
  };
  return [
    { name: "ASEAN TMview（东盟商标统一检索）", url: "https://www.asean-tmview.org/tmview/welcome" },
    nat[country],
    { name: "WIPO Global Brand Database", url: "https://branddb.wipo.int/" },
    { name: "TikTok Shop 知识产权保护中心", url: "https://ippc.tiktokglobalshop.com/" },
    { name: "Shopee 知识产权投诉门户", url: "https://brandprotection.shopee.com/" },
    { name: "Lazada 知识产权保护平台", url: "https://ipp.lazada.com/" },
  ];
}
