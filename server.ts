import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import multer from "multer";
import MailComposer from "nodemailer/lib/mail-composer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit per file
  });

  // Helper to get IMAP client
  const getImapClient = (user: string, pass: string) => {
    return new ImapFlow({
      host: 'premium181.web-hosting.com',
      port: 993,
      secure: true,
      auth: { user, pass },
      logger: false
    });
  };

  // Helper to get SMTP client
  const getSmtpClient = (user: string, pass: string) => {
    return nodemailer.createTransport({
      host: 'premium181.web-hosting.com',
      port: 465,
      secure: true,
      auth: { user, pass }
    });
  };

  // Verify IMAP credentials
  app.post("/api/verify", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Missing credentials" });

    const client = getImapClient(email, password);
    try {
      await client.connect();
      await client.logout();
      res.json({ success: true });
    } catch (error: any) {
      res.status(401).json({ error: error.message || "Authentication failed" });
    }
  });

  // Sync emails
  app.post("/api/sync", async (req, res) => {
    const { email, password, folder = 'INBOX', since } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Missing credentials" });

    const client = getImapClient(email, password);
    try {
      await client.connect();
      const lock = await client.getMailboxLock(folder);
      
      const emails: any[] = [];
      const otpsToMove: number[] = [];
      try {
        // Fetch last 50 emails for prototype
        const searchCriteria = since ? { since: new Date(since) } : { seq: '1:*' };
        const fetchOptions = {
          uid: true,
          flags: true,
          envelope: true,
          source: true,
          internalDate: true
        };

        // We'll just fetch the last 50 messages to avoid massive payloads
        const status = await client.status(folder, { messages: true });
        const total = status.messages || 0;
        
        if (total > 0) {
          const start = Math.max(1, total - 49);
          const seq = `${start}:*`;

          for await (let message of client.fetch(seq, fetchOptions)) {
            try {
              const parsed = await simpleParser(message.source);
              const isOTP = /(otp|verification code|one-time password|security code|verify your email|login code)/i.test(parsed.subject || '') || /(otp|verification code|one-time password|security code|verify your email|login code)/i.test(parsed.text || '');
              
              if (folder === 'INBOX' && isOTP) {
                otpsToMove.push(message.uid);
              }

              emails.push({
                id: message.uid.toString(),
                uid: message.uid,
                folder: (folder === 'INBOX' && isOTP) ? 'Updates' : folder,
                subject: parsed.subject || '(No Subject)',
                from: parsed.from?.text || '',
                to: Array.isArray(parsed.to) ? parsed.to.map(t => t.text).join(', ') : (parsed.to?.text || ''),
                date: typeof message.internalDate === 'string' ? new Date(message.internalDate).toISOString() : message.internalDate.toISOString(),
                snippet: parsed.text ? parsed.text.substring(0, 100) : '',
                body: parsed.html || parsed.textAsHtml || parsed.text || '',
                read: message.flags.has('\\Seen'),
                starred: message.flags.has('\\Flagged'),
                flags: Array.from(message.flags)
              });
            } catch (err) {
              console.error("Error parsing message", err);
            }
          }
        }
      } finally {
        lock.release();
      }
      
      // Move OTPs to Updates folder on the server
      if (otpsToMove.length > 0) {
        try { await client.mailboxCreate('Updates'); } catch (e) {} // Ignore if exists
        const lock2 = await client.getMailboxLock('INBOX');
        try {
          await client.messageMove(otpsToMove.join(','), 'Updates', { uid: true });
        } catch (e) {
          console.error("Failed to move OTPs", e);
        } finally {
          lock2.release();
        }
      }

      await client.logout();
      
      // Sort newest first
      emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      res.json({ success: true, emails });
    } catch (error: any) {
      console.error("Sync error:", error);
      res.status(500).json({ error: error.message || "Sync failed" });
    }
  });

  // Move email
  app.post("/api/move", async (req, res) => {
    const { email, password, folder, uid, destination } = req.body;
    if (!email || !password || !folder || !uid || !destination) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const client = getImapClient(email, password);
    try {
      await client.connect();
      try { await client.mailboxCreate(destination); } catch (e) {} // Ensure destination exists
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageMove(uid.toString(), destination, { uid: true });
      } finally {
        lock.release();
      }
      await client.logout();
      res.json({ success: true });
    } catch (error: any) {
      console.error("Move error:", error);
      res.status(500).json({ error: error.message || "Move failed" });
    }
  });

  // Save Draft
  app.post("/api/draft", upload.array('attachments'), async (req, res) => {
    const { email, password, to, subject, text, html } = req.body;
    const files = req.files as Express.Multer.File[];
    
    if (!email || !password) return res.status(400).json({ error: "Missing credentials" });

    const client = getImapClient(email, password);
    try {
      await client.connect();
      const mailOptions: any = {
        from: email,
        to: to || '',
        subject: subject || '',
        text: text || '',
        html: html || ''
      };

      if (files && files.length > 0) {
        mailOptions.attachments = files.map(file => ({
          filename: file.originalname,
          content: file.buffer
        }));
      }

      const mail = new MailComposer(mailOptions);
      const rawMessage = await mail.compile().build();
      
      try { await client.mailboxCreate('Drafts'); } catch (e) {}
      await client.append('Drafts', rawMessage, ['\\Draft', '\\Seen']);
      await client.logout();

      res.json({ success: true });
    } catch (error: any) {
      console.error("Draft error:", error);
      res.status(500).json({ error: error.message || "Draft failed" });
    }
  });

  // Mark email
  app.post("/api/mark", async (req, res) => {
    const { email, password, folder, uid, action } = req.body;
    if (!email || !password || !folder || !uid || !action) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const client = getImapClient(email, password);
    try {
      await client.connect();
      const lock = await client.getMailboxLock(folder);
      try {
        if (action === 'read') {
          await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        } else if (action === 'unread') {
          await client.messageFlagsRemove(uid, ['\\Seen'], { uid: true });
        } else if (action === 'star') {
          await client.messageFlagsAdd(uid, ['\\Flagged'], { uid: true });
        } else if (action === 'unstar') {
          await client.messageFlagsRemove(uid, ['\\Flagged'], { uid: true });
        }
      } finally {
        lock.release();
      }
      await client.logout();
      res.json({ success: true });
    } catch (error: any) {
      console.error("Mark error:", error);
      res.status(500).json({ error: error.message || "Mark failed" });
    }
  });

  // Send email
  app.post("/api/send", upload.array('attachments'), async (req, res) => {
    const { email, password, to, subject, text, html } = req.body;
    const files = req.files as Express.Multer.File[];
    
    if (!email || !password || !to) return res.status(400).json({ error: "Missing required fields" });

    const transporter = getSmtpClient(email, password);
    try {
      const mailOptions: any = {
        from: email,
        to,
        subject,
        text,
        html
      };

      if (files && files.length > 0) {
        mailOptions.attachments = files.map(file => ({
          filename: file.originalname,
          content: file.buffer
        }));
      }

      const info = await transporter.sendMail(mailOptions);
      
      // Also append to Sent folder via IMAP
      const client = getImapClient(email, password);
      try {
        await client.connect();
        const mail = new MailComposer(mailOptions);
        const rawMessage = await mail.compile().build();
        
        await client.append('Sent', rawMessage, ['\\Seen']);
        await client.logout();
      } catch (appendErr) {
        console.error("Failed to append to Sent folder", appendErr);
      }

      res.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
      console.error("Send error:", error);
      res.status(500).json({ error: error.message || "Send failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
