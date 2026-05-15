import nodemailer from 'nodemailer';

export async function sendEmailNotification(subject: string, htmlBody: string) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.env.NOTIFY_EMAIL;

  if (!host || !user || !pass || !to) {
    console.warn('[email] SMTP not configured, skipping');
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `"AI Hot Monitor" <${user}>`,
    to,
    subject,
    html: htmlBody,
  });
}

export function buildHotspotEmailHtml(title: string, summary: string, score: number, url?: string): string {
  return `
    <div style="font-family: monospace; background: #0a0a0f; color: #e0e0e8; padding: 20px; border-radius: 8px;">
      <h2 style="color: #00f5ff; margin: 0 0 10px;">⚡ AI 热点提醒</h2>
      <div style="border: 1px solid rgba(0,245,255,0.3); border-radius: 6px; padding: 15px; margin: 10px 0;">
        <h3 style="color: #fff; margin: 0 0 8px;">${title}</h3>
        <p style="color: #999; margin: 0 0 8px;">${summary}</p>
        <span style="color: #f5ff00; font-weight: bold;">Score: ${score}</span>
      </div>
      ${url ? `<a href="${url}" style="color: #00f5ff;">查看原文 →</a>` : ''}
    </div>
  `;
}
