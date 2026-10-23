"""Generate synthetic packaging images for the vision eval (our own drawings: no third-party assets).
Ground truth lives in eval/image_samples.json. Run: python3 eval/images/gen.py"""
from PIL import Image, ImageDraw, ImageFont
import os
D = os.path.dirname(os.path.abspath(__file__))
CJK = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
THAI = next((p for p in ["/usr/share/fonts/truetype/sand-box/google/Krub/Krub-Bold.ttf"] if os.path.exists(p)), CJK)
def f(sz, path=CJK): return ImageFont.truetype(path, sz)

def base(bg, accent):
    im = Image.new("RGB", (900, 900), "#e9e6e1"); d = ImageDraw.Draw(im)
    d.rounded_rectangle((90, 70, 810, 830), 18, fill=bg, outline="#333", width=4)
    d.rectangle((90, 70, 810, 190), fill=accent)
    return im, d

def mark_circle(d, xy, text, sub="", color="#1f3a93"):
    x, y = xy; d.ellipse((x, y, x+130, y+130), outline=color, width=6)
    d.text((x+65, y+52), text, font=f(30, THAI if any("\u0e00"<=c<="\u0e7f" for c in text) else CJK), fill=color, anchor="mm")
    if sub: d.text((x+65, y+92), sub, font=f(16), fill=color, anchor="mm")

def mark_rect(d, xy, text, color="#0a6b2b", w=190):
    x, y = xy; d.rectangle((x, y, x+w, y+70), outline=color, width=5); d.text((x+w/2, y+35), text, font=f(28), fill=color, anchor="mm")

def save(im, n): im.save(os.path.join(D, n), quality=88); print(n)

# 1 TH bluetooth smart kettle, TISI mark, Thai label
im, d = base("#fafafa", "#0e7490")
d.text((450, 130), "SONIQ Smart Kettle 1.7L", font=f(46), fill="white", anchor="mm")
d.rounded_rectangle((330, 250, 570, 520), 30, fill="#222"); d.arc((520, 300, 640, 450), 270, 90, fill="#222", width=22)
d.text((450, 570), "Bluetooth APP 控制 · 1800W 220V", font=f(34), fill="#111", anchor="mm")
d.text((450, 630), "กาต้มน้ำไฟฟ้า ควบคุมผ่านบลูทูธ", font=f(36, THAI), fill="#111", anchor="mm")
mark_circle(d, (140, 680), "มอก.", "TIS 1561", "#1f3a93")
d.text((620, 745), "Made in China", font=f(26), fill="#333", anchor="mm")
save(im, "img-th-kettle.jpg")

# 2 MY magnetic power bank, SIRIM mark, UK plug icon
im, d = base("#f4f4f5", "#4338ca")
d.text((450, 130), "VOLTA 10000mAh Power Bank", font=f(42), fill="white", anchor="mm")
d.rounded_rectangle((330, 230, 570, 520), 30, fill="#ddd", outline="#444", width=4); d.ellipse((390, 300, 510, 420), outline="#888", width=8)
d.text((450, 570), "Magnetic Wireless Charging 15W", font=f(34), fill="#111", anchor="mm")
d.text((450, 620), "磁吸无线充电宝  PD 20W", font=f(34), fill="#111", anchor="mm")
mark_rect(d, (130, 690), "SIRIM", "#b91c1c", 160); d.text((210, 785), "ST-SIRIM label", font=f(18), fill="#b91c1c", anchor="mm")
d.text((620, 730), "37Wh Li-ion", font=f(28), fill="#333", anchor="mm")
save(im, "img-my-powerbank.jpg")

# 3 PH RC toy car, ICC mark, ages, batteries
im, d = base("#fff7ed", "#ea580c")
d.text((450, 130), "TURBO RC Racer", font=f(52), fill="white", anchor="mm")
d.polygon([(250, 450), (320, 330), (580, 330), (660, 450)], fill="#dc2626"); d.ellipse((290, 420, 380, 510), fill="#111"); d.ellipse((530, 420, 620, 510), fill="#111")
d.text((450, 575), "2.4GHz Remote Control · Ages 6+", font=f(34), fill="#111", anchor="mm")
d.text((450, 630), "Requires 4 x AA batteries (not included)", font=f(28), fill="#111", anchor="mm")
mark_rect(d, (130, 690), "ICC", "#1d4ed8", 140); d.text((200, 780), "PS/ICC Mark", font=f(18), fill="#1d4ed8", anchor="mm")
mark_circle(d, (640, 680), "CE", "", "#111")
save(im, "img-ph-rctoy.jpg")

# 4 TH hair dryer with brand word "Dyson" on box (brand risk), CE only
im, d = base("#fdf2f8", "#9d174d")
d.text((450, 130), "Dyson Style Hair Dryer", font=f(46), fill="white", anchor="mm")
d.ellipse((330, 250, 520, 440), fill="#7c3aed"); d.rectangle((400, 430, 450, 580), fill="#7c3aed")
d.text((450, 630), "1600W  220-240V  吹风机 负离子", font=f(34), fill="#111", anchor="mm")
mark_circle(d, (150, 680), "CE", "", "#111")
d.text((600, 745), "Plug: Type C (EU)", font=f(28), fill="#333", anchor="mm")
save(im, "img-th-hairdryer.jpg")

# 5 PH whitening cream, Chinese-only label, no FDA number
im, d = base("#ecfdf5", "#047857")
d.text((450, 130), "烟酰胺美白霜", font=f(56), fill="white", anchor="mm")
d.ellipse((300, 250, 600, 400), fill="#fff", outline="#047857", width=6); d.rectangle((300, 325, 600, 520), fill="#fff", outline="#047857", width=6)
d.text((450, 440), "50g", font=f(48), fill="#047857", anchor="mm")
d.text((450, 600), "美白祛斑 7天见效", font=f(40), fill="#111", anchor="mm")
d.text((450, 670), "成分：烟酰胺、熊果苷、水杨酸", font=f(30), fill="#111", anchor="mm")
d.text((450, 740), "广州某某化妆品厂 出品", font=f(26), fill="#555", anchor="mm")
save(im, "img-ph-cream.jpg")

# 6 MY cordless vacuum ("无线" = cordless, no radio), SIRIM? no; battery yes
im, d = base("#f8fafc", "#334155")
d.text((450, 130), "CLEANO 无线吸尘器 Cordless Vacuum", font=f(38), fill="white", anchor="mm")
d.rectangle((430, 230, 470, 520), fill="#64748b"); d.rounded_rectangle((380, 480, 520, 560), 15, fill="#0f172a")
d.text((450, 620), "Cordless · 25.2V Li-ion battery · 120W", font=f(32), fill="#111", anchor="mm")
d.text((450, 680), "Charging adapter included (UK plug)", font=f(30), fill="#111", anchor="mm")
d.text((450, 750), "Penyedut Hampagas Tanpa Wayar", font=f(30), fill="#333", anchor="mm")
save(im, "img-my-vacuum.jpg")
