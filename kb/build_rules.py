# KB authoring source. Run: python3 kb/build_rules.py  -> writes kb/rules.json
# Excerpts marked verified/verified_ocr MUST be exact (whitespace-insensitive) substrings of kb/snapshots/<snapshot>.
# Check with: npm run kb:verify
import json, datetime
R = "2026-10-23"
U = {
 "th_regime": ("https://asean.org/wp-content/uploads/2026/03/TH_Updated-Regulatory-Regime_September-2025.pdf", "ASEAN ACCSQ – Thailand Updated Regulatory Regime (Revised matrix on mandatory standards, as of April 2025)", "official", "th_asean_regime.txt"),
 "th_toy": ("https://www3.tisi.go.th/hscode/hscode_view.asp?id=141", "สมอ. ฐานข้อมูลผลิตภัณฑ์ที่มีกฎหมายกำหนดให้ต้องเป็นไปตามมาตรฐาน – มอก. 685 เล่ม 1-2562", "official", "th_tisi_hscode_toy.txt"),
 "th_cosm": ("https://catalog.fda.moph.go.th/dataset/1e51956a-5718-4aa9-8b23-076349ed1856/resource/848bf9fe-ee17-4d7d-89e3-f4d6e304e6eb/download/cosmetics-act-b.e.-2015.pdf", "Thai FDA – Cosmetics Act B.E. 2558 (2015), English translation", "official_translation", "th_cosmetics_act.txt"),
 "th_nbtc": ("https://www.csagroup.org/global-certification-regulatory-update/thailand-nbtc-regulations-for-selling-radio-communication-equipment-as-per-act-b-e-2498/", "CSA Group – Thailand (NBTC) regulations for selling radio communication equipment", "secondary", "th_csa_nbtc.txt"),
 "th_etda": ("https://www.etda.or.th/th/pr-news/announce_dpslaw18.aspx", "ETDA ข่าวประชาสัมพันธ์ – ประกาศ กพธ. มาตรา 18 (2) ตลาดสินค้าออนไลน์", "official", "th_etda_news.txt"),
 "th_tilleke": ("https://www.tilleke.com/insights/thailand-introduces-new-obligations-for-online-marketplaces/", "Tilleke & Gibbins – Thailand Introduces New Obligations for Online Marketplaces", "secondary", "th_tilleke_etda.txt"),
 "th_grab": ("https://www.grab.com/th/en/merchant-blog/tisi/", "Grab TH – Products requiring the TISI Certification (平台示例)", "platform", "th_grab_tisi.txt"),
 "ph_bps": ("https://bps.dti.gov.ph/component/content/category/10-list-of-products-under-mandatory-certification", "DTI-BPS – List of Products Under Mandatory Certification", "official", "ph_bps_list.txt"),
 "ph_dao": ("https://www.aseanconsumer.org/file/post_image/DAO%2025-02%20(1).pdf", "DTI Department Administrative Order No. 25-02 (2025)（扫描件 OCR）", "official", "ph_dao_25_02.ocr.txt"),
 "ph_ita": ("https://lawphil.net/statutes/repacts/ra2023/ra_11967_2023.html", "Republic Act No. 11967 – Internet Transactions Act of 2023", "official", "ph_ra11967.txt"),
 "ph_fda_cosm": ("https://www.fda.gov.ph/fda-advisory-no-2024-0907-public-health-warning-against-the-purchase-and-use-of-unnotified-cosmetic-manis-herbal-whitening-soap-with-sunblock/", "FDA Philippines Advisory No. 2024-0907", "official", "ph_fda_advisory_2024_0907.txt"),
 "ph_fda_toy": ("https://www.fda.gov.ph/fda-advisory-no-2020-2022-reiteration-of-the-mandatory-labeling-requirements-for-toys-and-child-care-article-products-pursuant-to-the-irr-of-ra-10620/", "FDA Philippines Advisory No. 2020-2022 (RA 10620 TCCA labeling)", "official", "ph_fda_toys_label_2020_2022.txt"),
 "ph_ntc": ("https://region7.ntc.gov.ph/wp-content/uploads/2024/01/MC_09-09-2003.pdf", "NTC Memorandum Circular No. 09-09-2003 – Wireless Data Networks and Devices", "official", "ph_ntc_mc_09_09_2003.txt"),
 "my_st_ecom": ("https://www.st.gov.my/sites/default/files/2026-02/Regulated_Eelectrical_Equipment_-_e-Commerce.pdf", "Suruhanjaya Tenaga – Regulated Electrical Equipment (e-Commerce)", "official", "my_st_ecommerce.txt"),
 "my_st_list": ("https://www.st.gov.my/stakeholders/electricity/appliances/list-regulated-electrical-equipment", "Suruhanjaya Tenaga – List of Regulated Electrical Equipment", "official", "my_st_list.txt"),
 "my_st_coa": ("https://www.st.gov.my/sites/default/files/2026-02/Regulated-Electrical-Equipments-that-requires-certificate-of-approval-%28COA%29.pdf", "Suruhanjaya Tenaga – Regulated electrical equipment that requires CoA（扫描件 OCR）", "official", "my_st_coa_list.ocr.txt"),
 "my_st_faq": ("https://www.st.gov.my/if-piece-equipment-supplied-together-adaptercharger-separate-certificate-approval-coa-required", "Suruhanjaya Tenaga FAQ – adapter/charger CoA", "official", "my_st_faq_adapter.txt"),
 "my_st_guide": ("https://www.st.gov.my/sites/default/files/2026-02/Guidelines-for-the-Approval-of-Electrical-Equipment-%282024-Edition%29.pdf", "Suruhanjaya Tenaga – Guidelines for the Approval of Electrical Equipment (2024 Edition)", "official", "my_st_guidelines.txt"),
 "my_mcmc": ("https://www.mcmc.gov.my/skmmgovmy/media/General/pdf2/Guidelines-for-Online-Shopping-Platform-Merchant-and-Consumer-in-Electronic-Commerce-for-Communications-Equipment.pdf", "MCMC – Guidelines for Online Shopping Platform, Merchant and Consumer in E-Commerce for Communications Equipment", "official", "my_mcmc_ecommerce.txt"),
 "my_mcmc_faq": ("https://www.mcmc.gov.my/en/faqs/communications-equipment-certification/equipment-labelling/what-sort-of-certification-mark-o-r-label-must-be", "MCMC FAQ – Equipment labelling", "official", "my_mcmc_label_faq.txt"),
 "my_toy": ("https://mysafe.kpdn.gov.my/portal/post/8", "KPDN mySAFE – Toy safety FAQ", "official", "my_mysafe_toys.txt"),
 "my_npra": ("https://www.npra.gov.my/index.php/en/component/content/article/147-guidelines-central/guidelines-cosmetic/1595-2-0-cosmetic-notification", "NPRA – 2.0 Cosmetic Notification", "official", "my_npra_notif.txt"),
 "my_lvg": ("https://mylvg.customs.gov.my/FAQ", "Royal Malaysian Customs – LVG FAQ", "official", "my_lvg_faq.txt"),
 "my_cpettr": ("https://seller.shopee.com.my/edu/article/25285", "Shopee MY Seller Education – CPETTR 2024 (页面需 JS，未能抓取全文)", "platform", None),
 "id_permendag": ("https://peraturan.bpk.go.id/Download/415514/permendag-no-19-tahun-2026.pdf", "Permendag No. 19 Tahun 2026", "official", "id_permendag_19_2026.txt"),
 "id_halal": ("https://en.antaranews.com/news/436173/ri-extends-halal-certification-mandate-for-select-sectors-to-oct-2028", "ANTARA – RI extends halal certification mandate to Oct. 2028 (2026-10-17)", "secondary", "id_halal_antara.txt"),
 "vn_qd01": ("https://thuvienphapluat.vn/van-ban/Bo-may-hanh-chinh/Quyet-dinh-01-2025-QD-TTg-bai-bo-toan-bo-Quyet-dinh-78-2010-QD-TTg-638514.aspx", "Quyết định 01/2025/QĐ-TTg (Thư Viện Pháp Luật 转载全文)", "official", "vn_qd_01_2025.txt"),
 "tt_prohib": ("https://seller-id.tokopedia.com/university/essay?knowledge_id=10000846&lang=en", "TikTok Shop by Tokopedia – Prohibited Products Guidelines（印尼站版本，泰/菲/马站需在各自 Seller University 核对）", "platform", "tiktok_tokopedia_prohibited.txt"),
 "shopee_ph": ("https://seller.shopee.ph/edu/article/698", "Shopee PH Seller Education – Prohibited & restricted items（页面需 JS，未能抓取）", "platform", None),
 "shopee_my": ("https://seller.shopee.com.my/edu/article/614", "Shopee MY Seller Education – Prohibited & restricted items（页面需 JS，未能抓取）", "platform", None),
 "lazada": ("https://gsp.lazada.com/gsp/helpcenter/prohibited-and-controlled-products-policy-9600.html", "Lazada – Prohibited and Controlled Products Policy（页面需 JS，未能抓取）", "platform", None),
}
def ex(src, text, verification="verified", lang="en"):
    url, title, stype, snap = U[src]
    if snap is None: verification = "paraphrase"
    return {"text": text, "lang": lang, "source_url": url, "source_title": title, "source_type": stype,
            "verification": verification, "snapshot": snap, "retrieved_date": R}
rules = []
def rule(**k):
    k.setdefault("features", []); k.setdefault("items", []); k.setdefault("platforms", [])
    k.setdefault("effective_date", None); k.setdefault("mandatory", k.get("kind") == "cert")
    rules.append(k)

# ---------------- THAILAND ----------------
TH_HDR = ex("th_regime", "REVISED MATRIX ON MANDATORY STANDARDS FOR THAILAND (AS OF April, 2025)")
for item, row, std in [
  ("rice_cooker", "Electric rice-cookers TIS 1039-2547", "มอก. 1039-2547"),
  ("iron", "Electric irons TIS 60335 Part", "มอก. 60335 Part 2(3)"),
  ("fan", "AC electric fans TIS 934-2558", "มอก. 934-2558"),
  ("hair_dryer", "Appliances for skin or hair TIS 60335 Part", "มอก. 60335 Part 2(23)"),
  ("microwave", "Microwave ovens TIS 60335 Part", "มอก. 60335 Part 2(25)"),
  ("toaster_oven", "Grills, toasters and similar TIS 1641-", "มอก. 1641"),
  ("deep_fryer", "Deep fat fryers and TIS 60335 Part", "มอก. 60335 Part 2(37)"),
  ("thermo_pot", "Electric thermo pots TIS 2062-2558", "มอก. 2062-2558"),
  ("massager", "Massage appliances TIS 60335 Part", "มอก. 60335 Part 2(32)"),
  ("air_purifier", "Air-cleaning appliances TIS 60335 Part", "มอก. 60335 Part 2(65)"),
]:
    rule(id=f"TH-TISI-{item.upper()}", country="TH", categories=["appliance"], items=[item], kind="cert",
         title=f"泰国 TISI 强制性标准（{std}）", cert="TISI 强制认证（มอก. 标志 + 许可证号）", authority="Thai Industrial Standards Institute (TISI / สมอ.)",
         requirement=f"该类电器属于泰国强制性标准产品，需取得 TISI 许可（{std}），产品须带 TISI 标志后方可进口/销售。",
         excerpts=[ex("th_regime", row), TH_HDR],
         next_steps=["在 TISI 证书查询 https://tcps.tisi.go.th/public/en/certificatesearch.aspx 核对型号是否已获证", "由泰国本地进口商/代理人申请 TISI 许可（进口商须持证）"])
rule(id="TH-TISI-AIR_FRYER", country="TH", categories=["appliance"], items=["air_fryer"], kind="cert", mandatory=True,
     title="泰国 TISI：空气炸锅（归类需复核）", cert="TISI 强制认证（可能按 มอก. 1641 / 60335-2-9 系列）", authority="TISI",
     requirement="ASEAN 矩阵未单列“空气炸锅”；常见做法按 grills/toasters and similar 或 fryers 类别处理，具体适用标准需向 TISI/实验室确认。",
     excerpts=[ex("th_regime", "Grills, toasters and similar TIS 1641-"), TH_HDR],
     needs_review=True, next_steps=["请检测机构确认空气炸锅适用的 มอก. 标准编号"])
rule(id="TH-TISI-ADAPTER", country="TH", categories=["power"], features=["charger"], kind="cert",
     title="泰国 TISI：电源适配器/充电器（มอก. 62368 Part 1-2563）", cert="TISI 强制认证 มอก. 62368-1", authority="TISI",
     requirement="手机/平板电源适配器、电子产品适配器在泰国属于 TIS 62368 Part 1-2563 强制标准范围。",
     excerpts=[ex("th_regime", "Mains operated electronic TIS 62368 Part 1-"), ex("th_regime", "- Supply equipment (adaptor) for smart phone and tablet"), TH_HDR],
     next_steps=["核对适配器型号的 TISI 许可", "无线充电器、车充等形态的适用性需检测机构确认"])
rule(id="TH-TISI-POWERBANK", country="TH", categories=["power"], features=["powerbank"], kind="cert",
     title="泰国 TISI：移动电源（มอก. 2879-2560）", cert="TISI 强制认证 มอก. 2879", authority="TISI",
     requirement="移动电源属于泰国强制标准 TIS 2879-2560（2024 年已发布新版 TIS 2879-2567，过渡期请核对）。",
     excerpts=[ex("th_regime", "Portable Power Bank – TIS 2879-2560"), TH_HDR],
     next_steps=["核对新版 TIS 2879-2567 的生效/过渡日期", "锂电池运输另需符合物流危险品要求"])
rule(id="TH-TISI-TOY", country="TH", categories=["toy"], kind="cert", effective_date="2022-09-21",
     title="泰国 TISI：玩具（มอก. 685 เล่ม 1-2562）", cert="TISI 强制认证 มอก. 685-1", authority="TISI",
     requirement="供 14 岁以下儿童玩耍的玩具须符合强制标准 TIS 685 Part 1-2562（2022-09-21 起强制）。",
     excerpts=[ex("th_toy", "ของเล่น: เฉพาะด้านความปลอดภัย เล่ม 1 ข้อกำหนด (วันที่มีผลบังคับใช้ 21 ก.ย. 65)", lang="th"),
               ex("th_toy", "กําหนดคุณลักษณะเฉพาะด้านความปลอดภัยของของเล่นสําหรับเด็ก ที่มีอายุต่ำกว่า 14 ปีบริบูรณ์", lang="th")],
     next_steps=["由泰国进口商申请 TISI 许可", "电动/带电池玩具可能还涉及其他标准，需复核"])
rule(id="TH-TISI-TOY-LABEL", country="TH", categories=["toy"], kind="display",
     title="泰国玩具泰文标签", authority="TISI",
     requirement="进口并在泰国销售的玩具，每件或其包装须以泰文标示进口商名称地址、制造商与产地、适用年龄、警告语等。",
     excerpts=[ex("th_toy", "ที่ของเล่นหรือภาชนะบรรจุของเล่นที่นำเข้าและจำหน่ายภายในประเทศทุกหน่วย", lang="th")],
     next_steps=["准备泰文标签，listing 图片中展示泰文标签"])
rule(id="TH-FDA-COSM", country="TH", categories=["cosmetic"], kind="cert",
     title="泰国 FDA 化妆品通报（จดแจ้ง）", cert="Thai FDA 化妆品通报回执（เลขที่ใบรับจดแจ้ง）", authority="Thai FDA (อย.)",
     requirement="进口化妆品用于销售，须先由进口方向泰国 FDA 通报并取得通报回执；回执有效期 3 年。",
     excerpts=[ex("th_cosm", "Any individual wishing to manufacture, import for sale, or subcontract for the manufacture and sale of cosmetics must file a notification and only after the issuing of a notification receipt may the individual undertake the manufacture or import of cosmetics."),
               ex("th_cosm", "The notification receipt shall remain valid for a period of three years as from the date of issue.")],
     next_steps=["由泰国本地持证进口商办理通报", "核对成分是否属于泰国禁用/限用物质（待人工复核）"])
rule(id="TH-FDA-COSM-LABEL", country="TH", categories=["cosmetic"], kind="display",
     title="泰国化妆品泰文标签", authority="Thai FDA",
     requirement="化妆品须有泰文标签，进口商品可在清关后、销售前贴附泰文标签。",
     excerpts=[ex("th_cosm", "Cosmetics imported for sale in the Kingdom are not required to have a Thai- language label on the packaging or wrapping at the time of customs inspection but a Thai-language label must be affixed prior to sale;")],
     next_steps=["listing 中上传带泰文标签和通报号的产品图"])
rule(id="TH-NBTC-RADIO", country="TH", categories=["*"], features=["wireless"], kind="cert",
     title="泰国 NBTC 无线电设备合规（蓝牙/WiFi）", cert="NBTC 认证/SDoC + 进口/销售商通报", authority="NBTC (กสทช.)",
     requirement="带蓝牙/WiFi 等无线功能的产品，属于无线电通信设备，进口/销售需符合 NBTC 规定（免执照设备一般走 SDoC）。",
     excerpts=[ex("th_nbtc", "This applies to both license equipment (e.g. UHF/base station/license channels etc) and license exempted equipment (e.g. WWAN, WLAN, NFC, WLAN, Bluetooth).")],
     next_steps=["在 NBTC 设备查询 https://anyregis.nbtc.go.th/rces/ 核对型号", "此条来自第三方（CSA Group）解读，请以 NBTC 原文为准"])
rule(id="TH-ETDA-LISTING", country="TH", categories=["appliance","power","toy","cosmetic"], kind="display", requires_cert_prefix="TH-", effective_date="2025-12-31",
     title="泰国 ETDA 电商平台新规：listing 须展示 TISI/FDA 合规证明", authority="ETDA（电子交易发展局）",
     requirement="2025-12-31 起，被 ETDA 指定的电商平台须要求卖家对 TISI/FDA 管制商品展示许可/通报证明（标志、注册号、泰文标签图片等），违规商品会被删除或下架。",
     excerpts=[ex("th_etda", "มีผลบังคับเมื่อพ้น 180 วันนับจากวันประกาศเป็นต้นไป ซึ่งก็ตรงวันที่ 31 ธันวาคม 2568", lang="th"),
               ex("th_etda", "รวมถึงการแสดง ใบจดแจ้ง หรือ หลักฐานการรับรองมาตรฐาน จากหน่วยงานที่เกี่ยวข้องตามความเหมาะสม เช่น สมอ. และ อย.", lang="th"),
               ex("th_tilleke", "Listings must include detailed product information, such as product name, image (with Thai label), standard or FDA marks, registration or license numbers, and contact channels for the seller or manufacturer."),
               ex("th_grab", "Displaying the TISI mark, QR code, and TISI number on the product image, or")],
     next_steps=["在主图/详情图中展示 TISI 标志+许可证号（或 FDA 通报号）与泰文标签", "在描述中填写许可证号与卖家/制造商联系方式"])

# ---------------- PHILIPPINES ----------------
PH_HDR = ex("ph_bps", "List of articles in category List of Products Under Mandatory Certification")
for item, names in [
  ("rice_cooker", ["Electric rice cookers"]), ("fan", ["Electric fans"]), ("microwave", ["Microwave ovens"]),
  ("kettle", ["Electric kettles"]), ("toaster_oven", ["Electric ovens", "Electric toasters", "Electric grills"]),
  ("blender", ["Electric blenders", "Electric juicers", "Electric food processors"]), ("iron", ["Electric irons"]),
  ("multi_cooker", ["Electric multi-cookers", "Electric slow cookers", "Electric pressure cookers"]),
  ("thermo_pot", ["Electric airpots"]), ("coffee_maker", ["Electric coffeemakers"]), ("induction", ["Induction cooker"]),
  ("extension_cord", ["Extension cord sets"]),
]:
    rule(id=f"PH-BPS-{item.upper()}", country="PH", categories=["appliance","power"] if item=="extension_cord" else ["appliance"], items=[item], kind="cert",
         title="菲律宾 DTI-BPS 强制认证（PS 标志或 ICC）", cert="PS License 或 ICC 证书", authority="DTI Bureau of Philippine Standards (BPS)",
         requirement=f"{' / '.join(names)} 在 DTI-BPS 强制认证清单内，须持 PS License（本地生产）或 ICC（进口）方可销售。",
         excerpts=[ex("ph_bps", n) for n in names] + [PH_HDR],
         next_steps=["由菲律宾进口商申请 ICC（每批货）", "在线销售前完成 DAO 25-02 的 COR 在线注册"])
rule(id="PH-DAO2502-COR", country="PH", categories=["appliance"], kind="display", mandatory=False, requires_cert_prefix="PH-BPS-",
     title="菲律宾 DAO 25-02：在线卖家注册（COR）", cert="BPS 在线注册证书 COR", authority="DTI-BPS",
     requirement="在线销售 BPS 强制认证产品的商家须在 BPS 一次性注册并取得 COR；平台须确保卖家已注册。未注册会被暂停在线经营；销售无证产品会自动吊销 COR。",
     excerpts=[ex("ph_dao", "Online merchants and e-retailers engaged in the sale of consumer products subject to mandatory certification shall be required to complete a one-time registration with the BPS through its online portal.", "verified_ocr"),
               ex("ph_dao", "E-marketplaces and digital platforms shall ensure that all online merchants and e-retailers selling consumer products under mandatory certification are duly registered with the BPS and possess a valid Certificate of Online Registration (COR), as required under this Order.", "verified_ocr"),
               ex("ph_dao", "Online merchants and e-retailers who fail to register with the DT! as required by this Order will be issued a Notice of Suspension of their online operations.", "verified_ocr"),
               ex("ph_dao", "or e-retailer found to be selling uncertified products shall automatically be cancelled.", "verified_ocr")],
     next_steps=["在 BPS 门户完成 COR 注册（需 PS/ICC 证书副本与在售品牌型号清单）"])
rule(id="PH-ITA-REGULATED", country="PH", categories=["appliance","power","toy","cosmetic"], kind="display", requires_cert_prefix="PH-",
     title="菲律宾《互联网交易法》RA 11967：管制商品须提供许可信息", authority="DTI / E-Commerce Bureau",
     requirement="平台须禁止未提供必要许可/执照信息的管制商品上架；假冒商品属于禁止销售范围。",
     excerpts=[ex("ph_ita", "Prohibit the sale and advertisement of regulated good unless they provide the necessary permits and license information"),
               ex("ph_ita", "Sale or lease of goods or services which are prohibited or regulated under existing laws such as endangered animals, illicit drugs, fireworks and other explosives, and counterfeit goods")],
     next_steps=["在 listing 中填写 PS/ICC、FDA CPN/TCCA 等许可号"])
rule(id="PH-POWER-REVIEW", country="PH", categories=["power"], features=["charger","powerbank"], kind="review", mandatory=False,
     title="菲律宾：充电器/移动电源未在 BPS 强制清单中找到", authority="DTI-BPS",
     requirement="【转述】截至 2026-10-23 抓取的 BPS 强制认证清单未列出手机充电器/移动电源（菲律宾移动电源 PNS 标准据报道为自愿性）。是否需 ICC 请向 BPS 或检测机构确认。",
     excerpts=[ex("ph_bps", "【转述，非原文】BPS 强制认证清单（Refrigerators, Electric fans … Extension cord sets, Plugs 等）中未见 charger / power bank 条目。", "paraphrase", "zh")],
     needs_review=True, next_steps=["向 BPS 确认最新清单", "延长线/插头类配件仍在强制清单内"])
rule(id="PH-FDA-COSM", country="PH", categories=["cosmetic"], kind="cert",
     title="菲律宾 FDA 化妆品通报（CPN）", cert="FDA Certificate of Product Notification (CPN) + 本地公司 LTO", authority="FDA Philippines",
     requirement="未经 FDA 授权（化妆品为 CPN 通报）销售、推广、广告健康产品属违法；本地负责公司需持 LTO。",
     excerpts=[ex("ph_fda_cosm", "the manufacture, importation, exportation, sale, offering for sale, distribution, transfer, non-consumer use, promotion, advertising, or sponsorship of any health product without the proper authorization from the FDA is prohibited.")],
     next_steps=["由菲律宾持 LTO 的进口商在 FDA eServices 提交通报", "在 https://verification.fda.gov.ph 核对 CPN"])
rule(id="PH-FDA-TOY", country="PH", categories=["toy"], kind="cert",
     title="菲律宾 FDA 玩具与儿童用品（TCCA）通报与 LTO", cert="FDA TCCA 通报 + LTO 编号", authority="FDA Philippines (CCRR)",
     requirement="RA 10620 下，玩具（14 岁以下儿童）由 FDA 监管，须经 FDA 授权并在标签上标示 LTO 号。",
     excerpts=[ex("ph_fda_toy", "Toy and Game refers to an object or a number of objects clearly intended as plaything for children below fourteen (14) years of age."),
               ex("ph_fda_toy", "The Food and Drug Administration (FDA) having the mandate to issue appropriate authorizations to establishments and their toy and game products reiterates the mandatory labeling requirement for Toys and Child Care Article (TCCA) products.")],
     next_steps=["由本地持 LTO 进口商完成 TCCA 通报", "在 FDA Verification Portal 核对"])
rule(id="PH-FDA-TOY-LABEL", country="PH", categories=["toy"], kind="display",
     title="菲律宾玩具强制标签（RA 10620）", authority="FDA Philippines",
     requirement="包装须标示 FDA LTO 号、适用年龄、警告语、说明、本地公司名称地址、型号/SKU，英文或菲律宾语。",
     excerpts=[ex("ph_fda_toy", "License to Operate (LTO) Number issued by FDA"), ex("ph_fda_toy", "The label shall be generally written in English, otherwise, a parallel translation in English or Filipino or both shall appear thereon.")],
     next_steps=["listing 图片展示完整标签"])
rule(id="PH-NTC-WIRELESS", country="PH", categories=["*"], features=["wireless"], kind="cert",
     title="菲律宾 NTC 型式认可（WiFi/蓝牙）", cert="NTC Type Approval / Type Acceptance", authority="National Telecommunications Commission (NTC)",
     requirement="2.4/5 GHz 无线数据设备须经 NTC 型式认可/接受后方可销售，且须由 NTC 认可经销商销售。蓝牙短距设备的具体程序需复核。",
     excerpts=[ex("ph_ntc", "Indoor Wireless Data Network (WDN) equipment and devices can only be sold and used after these are duly registered type approved/type accepted by the Commission under this circular."),
               ex("ph_ntc", "Only radio dealers and suppliers accredited by the Commission can sell WDN equipment and devices.")],
     needs_review=True, next_steps=["该通告为 2003 年发布，请向 NTC 确认现行程序（蓝牙 SRD）"])

# ---------------- MALAYSIA ----------------
MY_REG97 = ex("my_st_ecom", "Reg 97 (1) - Certificate of Approval (CoA) is required to manufacture, import, display, sell or")
for item, name in [("rice_cooker","RICE COOKER"),("kettle","KETTLE including HEATING ELEMENTS IF SUPPLIED SEPARATELY"),("fan","WASHING MACHINE\nFAN"),
                   ("hair_dryer","HAND OPERATED HAIR DRYER / HAIRCARE / SKIN CARE"),("iron","IRON\nSHAVER"),("toaster_oven","TOASTER / OVEN (Cooking Appliance)"),
                   ("blender","KITCHEN MACHINE"),("massager","MASSAGER"),("vacuum","VACUUM CLEANER")]:
    rule(id=f"MY-ST-{item.upper()}", country="MY", categories=["appliance"], items=[item], kind="cert",
         title="马来西亚 ST 认证（CoA + ST-SIRIM 标签）", cert="Suruhanjaya Tenaga Certificate of Approval (CoA)", authority="Suruhanjaya Tenaga (Energy Commission)",
         requirement=f"{name.split(chr(10))[1] if name.startswith('WASHING') else name.split(chr(10))[0]} 属于 ST 管制电器，制造、进口、展示、销售或广告前须取得 CoA，并在产品本体贴 ST-SIRIM 标签。",
         excerpts=[ex("my_st_list", name), MY_REG97],
         next_steps=["由马来西亚本地进口商申请 CoA（ST 在线系统）", "listing 需展示 ST-SIRIM 标签"])
rule(id="MY-ST-ADAPTER", country="MY", categories=["power"], features=["charger"], kind="cert",
     title="马来西亚 ST 认证：适配器/充电器（第 32 类）", cert="ST CoA", authority="Suruhanjaya Tenaga",
     requirement="ADAPTER / CHARGER 属于 ST 管制电器（含 Portable Battery Charger、IT 设备适配器）；单独进口/销售的适配器须单独取得 CoA。",
     excerpts=[ex("my_st_list", "ADAPTER / CHARGER"), ex("my_st_coa", "Adaptor for IT Equipment (up to 20V)", "verified_ocr"),
               ex("my_st_faq", "If the adapter/charger is imported or manufactured separately, a separate Certificate of Approval (CoA) is required."), MY_REG97],
     next_steps=["申请 CoA 并贴 ST-SIRIM 标签"])
rule(id="MY-ST-LABEL", country="MY", categories=["appliance","power"], kind="display", requires_cert_prefix="MY-ST-",
     title="马来西亚 ST-SIRIM 标签须贴在产品本体", authority="Suruhanjaya Tenaga",
     requirement="ST-SIRIM 标签须清晰贴在管制电器本体上，不得只贴在包装上。",
     excerpts=[ex("my_st_guide", "electrical equipment itself in a legible manner. The ST-SIRIM label shall not be affixed on")],
     next_steps=["主图/详情图展示产品本体上的 ST-SIRIM 标签"])
rule(id="MY-POWERBANK-REVIEW", country="MY", categories=["power"], features=["powerbank"], kind="review", mandatory=False,
     title="马来西亚：移动电源是否属 ST 管制需复核", authority="Suruhanjaya Tenaga",
     requirement="【转述】ST 清单第 32 类列有 Portable Battery Charger (up to 12V)，但未明确写“power bank”；移动电源是否需 CoA 请向 ST/SIRIM 确认。",
     excerpts=[ex("my_st_coa", "Portable Battery Charger (up to 12V)", "verified_ocr")],
     needs_review=True, next_steps=["向 ST 或 SIRIM QAS 确认移动电源归类"])
rule(id="MY-MCMC-COMM", country="MY", categories=["*"], features=["wireless"], kind="cert",
     title="马来西亚 MCMC 通信设备认证（SIRIM）与 MCMC 标签", cert="MCMC/SIRIM 通信设备认证 + MCMC 标签", authority="MCMC（通过 SIRIM QAS 认证）",
     requirement="蓝牙/WiFi 等通信设备须经认证并带 MCMC 标签方可销售；海外商家须如实披露认证状态。",
     excerpts=[ex("my_mcmc", "Subregulation 16 (1): No person shall use, offer for sale, sell or have in his"),
               ex("my_mcmc", "which does not bear a certification mark or label."),
               ex("my_mcmc", "Overseas Merchant must transparently disclose the certification status of the Communications Equipment"),
               ex("my_mcmc_faq", "All communications equipment is required to display an MCMC label, either in")],
     next_steps=["通过 SIRIM QAS 办理认证", "listing 填写 MCMC 注册号 / SIRIM CoC 号"])
rule(id="MY-KPDN-TOY", country="MY", categories=["toy"], kind="cert", effective_date="2010-08-01",
     title="马来西亚 KPDN 玩具安全：MC 合格标志", cert="KPDN 注册 + MC 标志（Malaysian Conformity Mark）", authority="KPDN",
     requirement="14 岁以下儿童玩具须符合 KPDN 玩具安全标准，并在产品或包装上标示 MC 标志及 KPDN 注册号。",
     excerpts=[ex("my_toy", "The toys must be marked or affixed with the conformity mark, together with the registration number determined by KPDN either on the product or packaging."),
               ex("my_toy", "toys means any goods designed or intended for use in play by children less than fourteen years of age.")],
     next_steps=["由马来西亚进口商向 KPDN 注册并提交认可实验室测试报告（ILAC/APLAC MRA 签署方）"])
rule(id="MY-NPRA-COSM", country="MY", categories=["cosmetic"], kind="cert",
     title="马来西亚 NPRA 化妆品通报", cert="NPRA Cosmetic Notification (Notification Note)", authority="NPRA / DPS",
     requirement="化妆品在制造、销售、供应、进口前须由通报持有人（CNH，本地公司）向 NPRA 通报；有效期 2 年。",
     excerpts=[ex("my_npra", "The CNH is responsible to notify the DPS prior to manufacture, sell, supply, import or possess any cosmetic product."),
               ex("my_npra", "The notification of a cosmetic product shall be valid for 2 years.")],
     next_steps=["通过本地 CNH 在 NPRA QUEST 提交通报", "核对成分禁限用清单（待人工复核）"])
rule(id="MY-LVG-TAX", country="MY", categories=["*"], kind="customs", mandatory=False,
     title="马来西亚低价值商品（LVG）销售税 10%", authority="Royal Malaysian Customs Department",
     requirement="经网络平台售往马来西亚、单价不超过 MYR500 的商品，适用 10% LVG 销售税（平台/卖家注册代收）。",
     excerpts=[ex("my_lvg", "The sales tax rate on LVG is 10%."), ex("my_lvg", "which are sold at a price not exceeding MYR500 and are brought into Malaysia by land, sea or air.")],
     next_steps=["定价时计入 LVG 税"])
rule(id="MY-CPETTR", country="MY", categories=["*"], kind="display", mandatory=False,
     title="马来西亚电商交易规例修订（CPETTR 2024）", authority="KPDN",
     requirement="【转述】2024 年电子商务交易规例修订对线上卖家信息披露提出新要求，执法时间据平台通知已延后。请在 Shopee/Lazada 卖家中心核对最新执行日期。",
     excerpts=[ex("my_cpettr", "【转述，非原文】Shopee MY 卖家教育页面提示 CPETTR 2024 执法延后（页面需 JS，未能抓取原文）。", "paraphrase", "zh")],
     needs_review=True, next_steps=["核对 KPDN 最新公告"])

# ---------------- INDONESIA / VIETNAM (warnings only) ----------------
rule(id="ID-FOB100", country="ID", categories=["*"], kind="customs", mandatory=False,
     title="印尼：跨境直售商品最低 FOB US$100/件", authority="Kementerian Perdagangan (Permendag 19/2026)",
     requirement="跨境电商平台对境外卖家直接销售到印尼的成品须执行最低价格 FOB 100 美元/件（有例外清单）。",
     excerpts=[ex("id_permendag", "Harga Barang minimum sebagaimana dimaksud pada ayat (1) sebesar Freight on Board (FOB) USD 100 (seratus United States Dollar) per unit.", lang="id")],
     next_steps=["低价商品不要走跨境直售进入印尼"])
rule(id="ID-HALAL-2028", country="ID", categories=["cosmetic"], kind="customs", mandatory=False, effective_date="2028-10-17",
     title="印尼：化妆品清真认证强制期限已延至 2028-10-17", authority="BPJPH（PP 修订）",
     requirement="原定 2026-10-18 的化妆品等清真认证强制期限已延期至 2028-10-17 —— 规则变化很快，请核对日期。",
     excerpts=[ex("id_halal", "The deadline has also been extended to October 17, 2028, for natural medicines, quasi-drugs, health supplements, cosmetics, chemical products, genetically engineered products, and certain consumer goods that were previously scheduled to meet phased compliance requirements by 2026.")],
     next_steps=["以 BPJPH 官方公告为准"])
rule(id="VN-LOWVALUE-VAT", country="VN", categories=["*"], kind="customs", mandatory=False, effective_date="2025-02-18",
     title="越南：取消 100 万越南盾以下快件免税（含 VAT）", authority="越南政府总理 Quyết định 01/2025/QĐ-TTg",
     requirement="2025-02-18 起，经快递进口的低值商品（≤100 万越南盾）不再免征进口税和增值税。",
     excerpts=[ex("vn_qd01", "The entirety of the Prime Minister’s Decision No. 78/2010/QD-TTg dated November 30, 2010 on duty-free and VAT-free values of imports sent by express delivery services is hereby annulled."),
               ex("vn_qd01", "This Decision comes into force from February 18, 2025.")],
     next_steps=["定价计入进口税与 VAT"])

# ---------------- PLATFORMS ----------------
rule(id="PLAT-TIKTOK-IP", country="ALL", categories=["*"], platforms=["tiktok"], kind="platform", mandatory=False,
     title="TikTok Shop：禁止假冒及侵犯知识产权商品", authority="TikTok Shop",
     requirement="TikTok Shop 禁止侵犯品牌/权利人知识产权的商品和假冒商品（引用为印尼站版本，泰/菲/马站政策类似，需在各站 Seller University 核对）。",
     excerpts=[ex("tt_prohib", "Products that violate the intellectual property rights of brands or other rights owners"), ex("tt_prohib", "Counterfeit products")],
     next_steps=["如使用品牌词，准备品牌授权书", "侵权投诉入口：https://ippc.tiktokglobalshop.com/"])
for p, src, nm in [("shopee","shopee_ph","Shopee"),("lazada","lazada","Lazada")]:
    rule(id=f"PLAT-{p.upper()}-IP", country="ALL", categories=["*"], platforms=[p], kind="platform", mandatory=False,
         title=f"{nm}：禁止假冒/仿冒及侵权商品", authority=nm,
         requirement=f"【转述】{nm} 禁限售政策禁止假冒、仿冒（replica）及侵犯知识产权的商品；违规会被删除 listing、扣分直至封店。页面需登录/JS，未能抓取原文，请在卖家中心核对。",
         excerpts=[ex(src, f"【转述，非原文】{nm} 禁限售/违规 listing 政策：禁止假冒及侵权商品。", "paraphrase", "zh")],
         needs_review=True, next_steps=[f"在 {nm} 卖家中心核对对应站点的禁限售清单"])
rule(id="PLAT-SHOPEE-MY-LIST", country="MY", categories=["*"], platforms=["shopee"], kind="platform", mandatory=False,
     title="Shopee MY 禁限售清单", authority="Shopee",
     requirement="【转述】Shopee MY 对通信设备要求填写 MCMC 注册号和/或 SIRIM CoC 号（据卖家教育页面搜索摘要，未能抓取原文）。",
     excerpts=[ex("shopee_my", "【转述，非原文】Shopee MY：销售通信设备需提供 MCMC 注册号/SIRIM CoC 号。", "paraphrase", "zh")],
     needs_review=True, features=["wireless"], next_steps=["在 Shopee MY 卖家中心核对"])

for r in rules:
    r["retrieved_date"] = R
    r.setdefault("needs_review", False)
out = {"version": "2026.10.23-1", "generated": R, "rules": rules}
json.dump(out, open(__file__.replace("build_rules.py", "rules.json"), "w"), ensure_ascii=False, indent=1)
print(len(rules), "rules")
