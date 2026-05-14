import { google } from 'googleapis';

class GmailProvider {
  constructor() {
    this.oAuth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    this.oAuth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    this.gmail = google.gmail({ version: 'v1', auth: this.oAuth2Client });
  }

  static _headerValue(headers = [], name = '') {
    const low = String(name || '').toLowerCase();
    return headers.find((h) => String(h?.name || '').toLowerCase() === low)?.value || '';
  }

  static _decodeBase64Url(input = '') {
    if (!input) return '';
    const normalized = String(input).replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return Buffer.from(padded, 'base64').toString('utf8');
  }

  static _extractBodyParts(payload) {
    const out = { text: '', html: '' };
    const stack = [payload].filter(Boolean);

    while (stack.length) {
      const node = stack.pop();
      const mimeType = String(node?.mimeType || '').toLowerCase();
      const bodyData = node?.body?.data ? GmailProvider._decodeBase64Url(node.body.data) : '';

      if (mimeType === 'text/plain' && bodyData && !out.text) {
        out.text = bodyData;
      }
      if (mimeType === 'text/html' && bodyData && !out.html) {
        out.html = bodyData;
      }

      if (Array.isArray(node?.parts)) {
        for (const part of node.parts) stack.push(part);
      }
    }

    return out;
  }

  static _htmlToText(html = '') {
    return String(html || '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 📤 Send Email
  async send({ to, subject, html, text }) {
    const messageParts = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      html || text
    ];
    const rawMessage = Buffer.from(messageParts.join('\n')).toString('base64');
    const safeMessage = rawMessage.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const res = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: safeMessage }
    });

    return res.data;
  }

  // 📥 Fetch unread emails
  async getUnread() {
    const res = await this.gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread'
    });

    const emails = [];
    for (const msg of res.data.messages || []) {
      const fullMessage = await this.gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: [
          'Subject',
          'From',
          'To',
          'Date',
          'Message-ID',
          'In-Reply-To',
          'References',
        ],
      });
      const headers = fullMessage?.data?.payload?.headers || [];
      const subject = GmailProvider._headerValue(headers, 'Subject');
      const from = GmailProvider._headerValue(headers, 'From');
      const to = GmailProvider._headerValue(headers, 'To');
      const date = GmailProvider._headerValue(headers, 'Date');
      const messageId = GmailProvider._headerValue(headers, 'Message-ID');
      const inReplyTo = GmailProvider._headerValue(headers, 'In-Reply-To');
      const references = GmailProvider._headerValue(headers, 'References');
      emails.push({
        id: msg.id,
        threadId: fullMessage?.data?.threadId || msg?.threadId || null,
        subject,
        from,
        to,
        date,
        messageId,
        inReplyTo,
        references,
        snippet: fullMessage?.data?.snippet || ''
      });
    }
    return emails;
  }

  // Narrower helper to surface likely replies (subject starting with Re/Fwd or has reply headers)
  async getUnreadReplies() {
    const all = await this.getUnread();
    return all.filter(m => {
      const subj = String(m.subject || '').toLowerCase();
      const looksReply = subj.startsWith('re:') || subj.startsWith('fw:') || subj.startsWith('fwd:');
      return looksReply || !!m.inReplyTo;
    });
  }

  // Fetch a single email with full body payload
  async getMessage(id) {
    const msgId = String(id || '').trim();
    if (!msgId) return null;

    const fullMessage = await this.gmail.users.messages.get({
      userId: 'me',
      id: msgId,
      format: 'full',
    });

    const data = fullMessage?.data || {};
    const payload = data?.payload || {};
    const headers = payload?.headers || [];

    const subject = GmailProvider._headerValue(headers, 'Subject');
    const from = GmailProvider._headerValue(headers, 'From');
    const to = GmailProvider._headerValue(headers, 'To');
    const date = GmailProvider._headerValue(headers, 'Date');
    const messageId = GmailProvider._headerValue(headers, 'Message-ID');
    const inReplyTo = GmailProvider._headerValue(headers, 'In-Reply-To');
    const references = GmailProvider._headerValue(headers, 'References');

    const parts = GmailProvider._extractBodyParts(payload);
    const fallbackBody = payload?.body?.data
      ? GmailProvider._decodeBase64Url(payload.body.data)
      : '';
    const bodyText =
      parts.text ||
      GmailProvider._htmlToText(parts.html) ||
      GmailProvider._htmlToText(fallbackBody) ||
      fallbackBody ||
      '';
    const bodyHtml = parts.html || '';

    return {
      id: msgId,
      threadId: data?.threadId || null,
      subject,
      from,
      to,
      date,
      messageId,
      inReplyTo,
      references,
      snippet: data?.snippet || '',
      bodyText,
      bodyHtml,
      body: bodyText || bodyHtml || data?.snippet || '',
    };
  }
}

export default GmailProvider;
