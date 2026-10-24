import { LegalPage } from "@/components/site/LegalPage";
export const metadata = { title: "隐私政策" };
export default function Privacy() {
  return (
    <LegalPage title="隐私政策">
      <section><h2>1. 我们处理哪些信息</h2><ul>
        <li><b className="text-foreground">账号信息：</b>邮箱，以及经 PBKDF2 加盐哈希后的密码（不保存明文）。</li>
        <li><b className="text-foreground">检查历史：</b>每次检查的商品信息摘要（标题、描述前 300 字、所选国家、图片数量）、结果与时间。不保存图片。</li>
        <li><b className="text-foreground">邮箱验证码：</b>注册与重置密码时发送的 6 位验证码，仅保存其哈希值，10 分钟后失效。</li>
        <li><b className="text-foreground">防滥用数据：</b>IP 地址与邮箱的不可逆哈希值及当日用量计数，用于频率限制。</li>
      </ul></section>
      <section><h2>2. 数据如何使用</h2><ul>
        <li>检查时，商品信息与图片发送至后端，并转发至第三方大模型服务（智谱 AI）用于本次分析。图片在浏览器端以原图发送（不缩放、不重新编码），仅单张超过 5MB 时才会被自动压缩；图片不在本服务存储。</li>
        <li>验证码邮件通过第三方邮件服务（Brevo）发送，仅向其提供收件邮箱与邮件内容。</li>
        <li>不用于广告，不出售或共享给其他第三方。</li>
      </ul></section>
      <section><h2>3. 本地存储与 Cookie</h2><p>本服务不使用 Cookie，不接入第三方统计或追踪。登录凭证（有效期 7 天）保存在浏览器 localStorage 中；在公共设备上使用后请退出登录。</p></section>
      <section><h2>4. 你的权利</h2><ul>
        <li>可在“历史记录”页面删除单条记录或清空全部历史（右上角头像菜单进入）。</li>
        <li>可在“历史记录”页面注销账号，账号与全部历史将被永久删除。</li>
      </ul></section>
      <section><h2>5. 数据存储</h2><p>账号与历史记录存储于 Cloudflare D1 数据库，服务端运行于 Cloudflare Workers。数据可能在中国大陆以外的地区处理。</p></section>
      <section><h2>6. 政策变更</h2><p>本政策可能更新，更新后在本页公布并注明日期。</p></section>
    </LegalPage>
  );
}
