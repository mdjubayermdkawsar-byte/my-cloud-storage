const formidable = require('formidable');
const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');

export const config = {
  api: {
    bodyParser: false, // Vercel-এর ডিফল্ট পার্সার বন্ধ রাখা হলো যাতে ফাইল সহজে ধরা যায়
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST method allowed' });
  }

  const form = formidable();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: 'File parsing failed' });
    }

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const BOT_TOKEN = process.env.BOT_TOKEN;
      const CHANNEL_ID = process.env.CHANNEL_ID;

      const formData = new FormData();
      formData.append('chat_id', CHANNEL_ID);
      formData.append('document', fs.createReadStream(file.filepath), file.originalFilename);

      // টেলিগ্রামে ফাইল পাঠানো হচ্ছে
      const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
        method: 'POST',
        body: formData,
      });

      const tgData = await tgRes.json();

      if (!tgData.ok) {
        return res.status(500).json({ error: 'Telegram upload failed', details: tgData });
      }

      const fileId = tgData.result.document.file_id;

      // আমাদের নিজেদের সার্ভার থেকে ডাউনলোড লিঙ্ক তৈরি করা হচ্ছে
      const downloadUrl = `https://${req.headers.host}/api/file?id=${fileId}`;

      return res.status(200).json({
        success: true,
        fileName: file.originalFilename,
        fileId: fileId,
        url: downloadUrl,
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
}
