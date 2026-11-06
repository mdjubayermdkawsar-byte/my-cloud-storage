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

    if (!fileId) {
      return new Response('Website ID missing!', { status: 400 });
    }

    try {
      // টেলিগ্রাম থেকে ফাইল পাথ নেওয়া
      const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
      const tgData = await tgRes.json();

      if (!tgData.ok) {
        return new Response('Website not found!', { status: 404 });
      }

      // সাইটের আসল HTML কোড নামিয়ে ব্রাউজারে রেন্ডার করা
      const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${tgData.result.file_path}`;
      const htmlRes = await fetch(fileUrl);
      const htmlContent = await htmlRes.text();

      // ব্রাউজারে ওয়েবসাইট হিসেবে শো করা
      return new Response(htmlContent, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
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

      // টেলিগ্রাম ক্লাউডে ওয়েবসাইট ফাইল সংরক্ষণ
      const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
        method: 'POST',
        body: tgFormData
      });

      const tgData = await tgRes.json();

      if (!tgData.ok) {
        return new Response(JSON.stringify({ error: 'Hosting failed', details: tgData }), { status: 500 });
      }

      const fileId = tgData.result.document.file_id;
      const liveSiteUrl = `https://${host}/api/site?id=${fileId}`;

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
