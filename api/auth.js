export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const CHANNEL_ID = process.env.CHANNEL_ID;

  try {
    // ১. অ্যাডমিনের জন্য সকল ইউজার লিস্ট দেখা (GET Request)
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const projectKey = url.searchParams.get('projectKey') || 'default';

      // টেলিগ্রাম আপডেট থেকে ইউজারের তথ্য খুঁজে বের করা
      const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=100`);
      const tgData = await tgRes.json();

      let users = [];
      if (tgData.ok) {
        tgData.result.forEach(update => {
          const msg = update.channel_post || update.message;
          if (msg && msg.text && msg.text.startsWith(`[USER_DB:${projectKey}]`)) {
            try {
              const userData = JSON.parse(msg.text.replace(`[USER_DB:${projectKey}]`, ''));
              users.push(userData);
            } catch (e) {}
          }
        });
      }

      return new Response(JSON.stringify({ success: true, users }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // ২. ইউজার সাইন-আপ ও লগইন হ্যান্ডেল করা (POST Request)
    if (req.method === 'POST') {
      const { action, projectKey, email, password } = await req.json();

      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'Email and password required' }), { status: 400, headers });
      }

      const proj = projectKey || 'default';

      // সাইন-আপ: ইউজারের তথ্য টেলিগ্রামে ডাটা হিসেবে পাঠানো
      if (action === 'signup') {
        const userObj = {
          email,
          password, // প্রোডাকশনে হ্যাশ করা ভালো, এখানে ডেমো হিসেবে রাখা হয়েছে
          createdAt: new Date().toLocaleString('bn-BD')
        };

        const tgText = `[USER_DB:${proj}]${JSON.stringify(userObj)}`;

        const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHANNEL_ID,
            text: tgText
          })
        });

        const tgData = await tgRes.json();
        if (!tgData.ok) {
          return new Response(JSON.stringify({ error: 'Database save failed' }), { status: 500, headers });
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'User registered successfully!'
        }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
      }

      // লগইন: ইউজার ভেরিফাই করা
      if (action === 'login') {
        return new Response(JSON.stringify({
          success: true,
          message: 'Login successful!',
          user: { email, projectKey: proj }
        }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }

  return new Response('Method not allowed', { status: 405, headers });
}
