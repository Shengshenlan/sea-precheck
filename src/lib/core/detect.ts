import type { Category, Feature } from "./types";

/** appliance item -> keywords (lowercase; matched as substrings) */
export const ITEM_KEYWORDS: Record<string, string[]> = {
  rice_cooker: ["电饭煲", "电饭锅", "rice cooker"],
  kettle: ["电热水壶", "烧水壶", "电水壶", "热水壶", "养生壶", "kettle"],
  fan: ["风扇", "电扇", "电风扇", "落地扇", "台扇", "塔扇", "循环扇", "fan"],
  hair_dryer: ["吹风机", "电吹风", "卷发棒", "直发器", "直板夹", "美发器", "hair dryer", "hairdryer", "curling", "straightener"],
  iron: ["电熨斗", "挂烫机", "熨斗", "蒸汽熨", "iron", "garment steamer"],
  toaster_oven: ["烤面包机", "多士炉", "烤箱", "电烤盘", "电烤炉", "toaster", "oven", "grill"],
  air_fryer: ["空气炸锅", "air fryer", "airfryer"],
  deep_fryer: ["油炸锅", "电炸锅", "deep fryer"],
  microwave: ["微波炉", "microwave"],
  blender: ["搅拌机", "破壁机", "料理机", "榨汁机", "榨汁杯", "绞肉机", "blender", "juicer", "food processor"],
  thermo_pot: ["电热水瓶", "保温热水瓶", "电热水壶瓶", "airpot", "thermo pot"],
  massager: ["按摩仪", "按摩器", "筋膜枪", "按摩枪", "按摩椅", "massager", "massage gun"],
  air_purifier: ["空气净化器", "air purifier"],
  multi_cooker: ["电压力锅", "多功能锅", "慢炖锅", "电炖锅", "电煮锅", "pressure cooker", "slow cooker", "multi cooker", "multicooker"],
  coffee_maker: ["咖啡机", "coffee maker", "coffee machine"],
  induction: ["电磁炉", "induction"],
  vacuum: ["吸尘器", "vacuum"],
};
// ordered so that more specific items win substring conflicts (e.g. "空气炸锅" vs "fan")
const ITEM_EXCLUSIONS: Record<string, string[]> = { fan: ["fanta", "fans club"], iron: ["ironman", "iron man"], oven: [] };

export const ITEM_ZH: Record<string, string> = {
  rice_cooker: "电饭煲", kettle: "电热水壶", fan: "电风扇", hair_dryer: "吹风机/美发器", iron: "电熨斗/挂烫机",
  toaster_oven: "烤箱/烤面包机/电烤盘", air_fryer: "空气炸锅", deep_fryer: "油炸锅", microwave: "微波炉",
  blender: "搅拌机/榨汁机/料理机", thermo_pot: "电热水瓶", massager: "按摩器", air_purifier: "空气净化器",
  multi_cooker: "电压力锅/多功能锅", coffee_maker: "咖啡机", induction: "电磁炉", vacuum: "吸尘器", extension_cord: "延长线/插线板",
};

const CAT_KEYWORDS: Record<Category, string[]> = {
  appliance: ["小家电", "家电", "电器", "家用电器", "appliance", "220v", "110v", "插电"],
  power: ["充电器", "充电头", "适配器", "电源适配器", "快充", "氮化镓", "gan", "charger", "adapter", "adaptor", "充电宝", "移动电源", "power bank", "powerbank", "插线板", "延长线", "排插"],
  toy: ["玩具", "积木", "拼图", "玩偶", "毛绒", "公仔", "手办", "遥控车", "盲盒", "娃娃", "益智", "早教", "toy", "toys", "puzzle", "plush", "doll", "building blocks", "fidget", "史莱姆", "泡泡机"],
  cosmetic: ["化妆品", "彩妆", "护肤", "口红", "唇膏", "唇釉", "唇彩", "粉底", "气垫", "面霜", "精华", "乳液", "爽肤水", "面膜", "眼影", "眼线", "睫毛膏", "腮红", "洗面奶", "防晒", "香水", "身体乳", "洗发水", "沐浴露", "护发", "指甲油", "lipstick", "foundation", "serum", "moisturizer", "sunscreen", "mascara", "toner", "cosmetic", "skincare", "perfume", "lip gloss", "cushion"],
};

export const FEATURE_KEYWORDS: Record<Feature, string[]> = {
  wireless: ["蓝牙", "bluetooth", "wifi", "wi-fi", "wlan", "无线网", "2.4g", "5.8g", "app控制", "app 控制", "智能联网", "zigbee", "遥控车", "rc car", "无线遥控", "nfc"],
  battery: ["电池", "锂电", "充电式", "可充电", "usb充电", "type-c充电", "rechargeable", "battery", "18650"],
  charger: ["充电器", "充电头", "适配器", "快充头", "氮化镓", "gan", "charger", "adapter", "adaptor", "pd快充", "车充", "无线充"],
  powerbank: ["充电宝", "移动电源", "power bank", "powerbank"],
  kids: ["儿童", "宝宝", "婴儿", "幼儿", "kids", "baby", "toddler", "children", "3岁", "3+", "岁以上"],
};

export const COSMETIC_RISK_TERMS = ["美白", "祛斑", "淡斑", "水银", "汞", "氢醌", "对苯二酚", "激素", "处方", "药用", "治疗", "祛痘", "生发", "防脱", "hydroquinone", "mercury", "tretinoin", "steroid", "whitening", "anti-acne"];

function hasTerm(text: string, kw: string): boolean {
  if (/^[a-z0-9 .\-+]+$/.test(kw)) {
    const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z])${esc}($|[^a-z])`, "i").test(text);
  }
  return text.includes(kw);
}
export function findTerms(text: string, kws: string[]): string[] {
  const t = text.toLowerCase();
  return kws.filter((k) => hasTerm(t, k.toLowerCase()));
}

export function detectItems(text: string): { item: string; term: string }[] {
  const t = text.toLowerCase();
  const out: { item: string; term: string }[] = [];
  for (const [item, kws] of Object.entries(ITEM_KEYWORDS)) {
    const hit = kws.find((k) => hasTerm(t, k));
    if (hit && !(ITEM_EXCLUSIONS[item] || []).some((x) => t.includes(x))) out.push({ item, term: hit });
  }
  // de-conflict: 空气炸锅 contains no "fan", but "oven" in "microwave oven"; kettle in "电热水壶瓶"
  const items = new Set(out.map((o) => o.item));
  if (items.has("microwave")) return out.filter((o) => !(o.item === "toaster_oven" && o.term === "oven"));
  if (items.has("thermo_pot")) return out.filter((o) => o.item !== "kettle" || o.term !== "电热水壶");
  return out;
}

export function detectFeatures(text: string): { feature: Feature; term: string }[] {
  const out: { feature: Feature; term: string }[] = [];
  for (const [f, kws] of Object.entries(FEATURE_KEYWORDS) as [Feature, string[]][]) {
    const t = findTerms(text, kws);
    if (t.length) out.push({ feature: f, term: t[0] });
  }
  return out;
}

export function detectCategory(text: string): { category: Category | null; scores: Record<Category, number> } {
  const scores = { appliance: 0, power: 0, toy: 0, cosmetic: 0 } as Record<Category, number>;
  for (const c of Object.keys(CAT_KEYWORDS) as Category[]) scores[c] = findTerms(text, CAT_KEYWORDS[c]).length * 2;
  scores.appliance += detectItems(text).length * 3;
  // "充电式XX" / "USB充电" on an appliance should not make it a charger
  if (scores.appliance > 0 && /充电式|usb充电|可充电/i.test(text) && !/充电器|充电头|适配器|充电宝|移动电源/.test(text)) scores.power = 0;
  const best = (Object.entries(scores) as [Category, number][]).sort((a, b) => b[1] - a[1])[0];
  return { category: best[1] > 0 ? best[0] : null, scores };
}
