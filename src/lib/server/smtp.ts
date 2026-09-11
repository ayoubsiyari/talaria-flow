/**
 * Minimal SMTP client (STARTTLS + AUTH LOGIN) used when SMTP_HOST is set instead of Resend.
 */
import net from 'node:net';
import tls from 'node:tls';

function b64(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64');
}

function readReply(socket: net.Socket): Promise<{ code: number; text: string }> {
  return new Promise((resolve, reject) => {
    let buf = '';
    const onData = (chunk: Buffer) => {
      buf += chunk.toString('utf8');
      const lines = buf.split(/\r?\n/);
      if (!lines.length) return;
      // Last complete line: "250-..." continues, "250 " finishes.
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line) continue;
        const m = line.match(/^(\d{3})([ -])/);
        if (m && m[2] === ' ') {
          socket.off('data', onData);
          socket.off('error', onErr);
          resolve({ code: Number(m[1]), text: buf });
          return;
        }
      }
    };
    const onErr = (err: Error) => {
      socket.off('data', onData);
      reject(err);
    };
    socket.on('data', onData);
    socket.on('error', onErr);
  });
}

async function cmd(socket: net.Socket, line: string, ok: number[]): Promise<string> {
  socket.write(line + '\r\n');
  const reply = await readReply(socket);
  if (!ok.includes(reply.code)) throw new Error(`SMTP ${reply.code}: ${reply.text.trim().slice(0, 300)}`);
  return reply.text;
}

function wrap76(s: string): string {
  return s.replace(/.{1,76}/g, (m) => m + '\r\n').trimEnd();
}

export async function sendSmtp(opts: {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  inlineImages?: { cid: string; filename: string; contentType: string; data: Buffer }[];
}): Promise<{ id: string }> {
  const fromAddr = (opts.from.match(/<([^>]+)>/) || [null, opts.from])[1]!.trim();
  const boundary = `tf${crypto.randomUUID().replace(/-/g, '')}`;
  const id = `smtp_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
  const inlines = opts.inlineImages || [];
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    opts.replyTo ? `Reply-To: ${opts.replyTo}` : '',
    `Subject: ${opts.subject.replace(/[\r\n]+/g, ' ')}`,
    `Message-ID: <${id}@talaria-flow.com>`,
    'MIME-Version: 1.0',
    inlines.length
      ? `Content-Type: multipart/related; type="text/html"; boundary="${boundary}"`
      : `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean).join('\r\n');
  const parts = [
    headers,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    opts.html.replace(/^\./gm, '..'),
  ];
  for (const img of inlines) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${img.contentType}; name="${img.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-ID: <${img.cid}>`,
      `Content-Disposition: inline; filename="${img.filename}"`,
      '',
      wrap76(img.data.toString('base64')),
    );
  }
  parts.push(`--${boundary}--`, '');
  const body = parts.join('\r\n');

  const socket = await new Promise<net.Socket>((resolve, reject) => {
    const s = net.connect({ host: opts.host, port: opts.port }, () => resolve(s));
    s.setTimeout(30000);
    s.on('timeout', () => reject(new Error('SMTP timeout')));
    s.on('error', reject);
  });

  const greet = await readReply(socket);
  if (greet.code !== 220) throw new Error(`SMTP ${greet.code}: ${greet.text.trim()}`);
  await cmd(socket, `EHLO talaria-flow.com`, [250]);

  socket.write('STARTTLS\r\n');
  const tlsReply = await readReply(socket);
  if (tlsReply.code !== 220) throw new Error(`STARTTLS ${tlsReply.code}: ${tlsReply.text.trim()}`);

  const secure = await new Promise<tls.TLSSocket>((resolve, reject) => {
    const t = tls.connect({ socket, servername: opts.host }, () => resolve(t));
    t.on('error', reject);
  });

  await cmd(secure, `EHLO talaria-flow.com`, [250]);
  await cmd(secure, 'AUTH LOGIN', [334]);
  await cmd(secure, b64(opts.user), [334]);
  await cmd(secure, b64(opts.password), [235]);
  await cmd(secure, `MAIL FROM:<${fromAddr}>`, [250]);
  await cmd(secure, `RCPT TO:<${opts.to}>`, [250, 251]);
  await cmd(secure, 'DATA', [354]);
  secure.write(body.replace(/\n\./g, '\n..') + '\r\n.\r\n');
  const dataReply = await readReply(secure);
  if (dataReply.code !== 250) throw new Error(`SMTP DATA ${dataReply.code}: ${dataReply.text.trim().slice(0, 300)}`);
  try { await cmd(secure, 'QUIT', [221, 250]); } catch { /* ignore */ }
  secure.end();
  return { id };
}
