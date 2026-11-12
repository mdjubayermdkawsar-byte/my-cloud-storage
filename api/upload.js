export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const CHANNEL_ID = process.env.CHANNEL_ID;
  const host = req.headers.get('host');

  // ১. ওয়েবসাইট ওপেন হলে পূর্বে আপলোড করা সমস্ত পোস্ট লোড করা (GET)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const projectKey = url.searchParams.get('projectKey') || 'default';

    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=100`);
    const tgData = await tgRes.json();

    let posts = [];
    if (tgData.ok && tgData.result) {
      tgData.result.forEach(u => {
        const msg = u.channel_post || u.message;
        if (msg && msg.caption && msg.caption.startsWith(`[SERVICE_DB:${projectKey}]`)) {
          try {
            const jsonStr = msg.caption.replace(`[SERVICE_DB:${projectKey}]`, '');
            posts.push(JSON.parse(jsonStr));
          } catch(e) {}
        }
      });
    }

    return new Response(JSON.stringify({ success: true, posts }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // ২. নতুন সার্ভিস ও ফাইল ক্লাউডে পার্মানেন্ট আপলোড করা (POST)
  if (req.method === 'POST') {
    try {
      const incomingFormData = await req.formData();
      const file = incomingFormData.get('file');
      const projectKey = incomingFormData.get('projectKey') || 'default';
      const title = incomingFormData.get('title') || 'Untitled';
      const desc = incomingFormData.get('desc') || '';

      if (!file) {
        return new Response(JSON.stringify({ error: 'No file uploaded' }), { status: 400, headers: corsHeaders });
      }

      const tgFormData = new FormData();
      tgFormData.append('chat_id', CHANNEL_ID);
      tgFormData.append('document', file, file.name);

      const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
        method: 'POST',
        body: tgFormData,
      });

      const tgData = await tgRes.json();
      if (!tgData.ok) {
        return new Response(JSON.stringify({ error: 'Telegram upload failed' }), { status: 500, headers: corsHeaders });
      }

      const fileId = tgData.result.document.file_id;
      const downloadUrl = `https://${host}/api/file?id=${fileId}`;

      // ফাইলের লিংক এবং টাইটেল ক্লাউড ডাটাবেজে স্থায়ীভাবে সেভ রাখা
      const postData = { title, desc, imgUrl: downloadUrl, createdAt: new Date().toLocaleDateString() };
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHANNEL_ID,
          text: `[SERVICE_DB:${projectKey}]${JSON.stringify(postData)}`
        })
      });

      return new Response(JSON.stringify({
        success: true,
        post: postData
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
}
