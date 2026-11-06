const fetch = require('node-fetch');

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).send('File ID missing');
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;

  try {
    // টেলিগ্রাম থেকে ফাইল পাথ নেওয়া
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${id}`);
    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return res.status(404).send('File not found on Telegram');
    }

    const filePath = tgData.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

    // সরাসরি ফাইলে রিডাইরেক্ট করে দেওয়া
    return res.redirect(fileUrl);
  } catch (error) {
    return res.status(500).send('Error fetching file');
  }
}
