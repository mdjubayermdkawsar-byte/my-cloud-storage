export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const CHANNEL_ID = process.env.CHANNEL_ID;
  const host = req.headers.get('host');

  // ১. সাইট ভিজিট করা (GET Request)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const fileId = url.searchParams.get('id');
    const msgId = url.searchParams.get('msg'); // মেসেজের ট্র্যাকিং আইডি

    if (!fileId) {
      return new Response('Website ID missing!', { status: 400 });
    }

    try {
      // রিয়েল-টাইম চেক: মেসেজটি কি টেলিগ্রাম চ্যানেলে এখনো আছে?
      if (msgId) {
        const checkRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: CHANNEL_ID, message_id: msgId })
        });
        const checkData = await checkRes.json();

        // যদি টেলিগ্রাম বলে মেসেজ খুঁজে পাওয়া যায়নি (অর্থাৎ তুমি ডিলিট করে দিয়েছ)
        if (!checkData.ok && checkData.description && checkData.description.includes('message to edit not found')) {
          return new Response(`
            <!DOCTYPE html>
            <html>
            <head><title>Website Deleted</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0f172a; color: white;">
              <h1 style="color: #ef4444; font-size: 40px;">❌ 404 - Website Deleted!</h1>
              <p style="font-size: 18px; color: #94a3b8;">এই ওয়েবসাইটটি টেলিগ্রাম ক্লাউড স্টোরেজ থেকে ডিলিট করে দেওয়া হয়েছে।</p>
            </body>
            </html>
          `, {
            status: 404,
            headers: { 
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' // ব্রাউজার ক্যাশ বন্ধ
            }
          });
        }
      }

      // মেসেজ থাকলে ফাইল নামিয়ে ওয়েবসাইট শো করা হবে
      const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
      const tgData = await tgRes.json();

      if (!tgData.ok) {
        return new Response('Website not found on Telegram!', { status: 404 });
      }

      const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${tgData.result.file_path}`;
      const htmlRes = await fetch(fileUrl);
      const htmlContent = await htmlRes.text();

      return new Response(htmlContent, {
        headers: { 
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' // কোনো ক্যাশ থাকবে না
        }
      });
    } catch (err) {
      return new Response('Error loading website: ' + err.message, { status: 500 });
    }
  }

  // ২. নতুন ওয়েবসাইট হোস্ট করা (POST Request)
  if (req.method === 'POST') {
    try {
      const { siteName, htmlCode } = await req.json();

      if (!htmlCode) {
        return new Response(JSON.stringify({ error: 'HTML code is required' }), { status: 400 });
      }

      const fileName = `${siteName ? siteName.replace(/\s+/g, '_') : 'website'}.html`;
      const blob = new Blob([htmlCode], { type: 'text/html' });

      const tgFormData = new FormData();
      tgFormData.append('chat_id', CHANNEL_ID);
      tgFormData.append('document', blob, fileName);

      // টেলিগ্রামে পাঠানো
      const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
        method: 'POST',
        body: tgFormData
      });

      const tgData = await tgRes.json();

      if (!tgData.ok) {
        return new Response(JSON.stringify({ error: 'Hosting failed', details: tgData }), { status: 500 });
      }

      const fileId = tgData.result.document.file_id;
      const messageId = tgData.result.message_id; // মেসেজের আইডি নেওয়া হলো ট্র্যাকিংয়ের জন্য
      
      // লাইভ লিঙ্ক যাতে ফাইল আইডি এবং মেসেজ আইডি দুটোই থাকবে
      const liveSiteUrl = `https://${host}/api/site?id=${fileId}&msg=${messageId}`;

      return new Response(JSON.stringify({
        success: true,
        siteName: fileName,
        liveUrl: liveSiteUrl
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}
