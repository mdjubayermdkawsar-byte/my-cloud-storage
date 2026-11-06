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
    // ১. ইউজার তালিকা দেখার জন্য (GET)
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const projectKey = url.searchParams.get('projectKey') || 'default';

      const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=100`);
      const tgData = await tgRes.json();

      let users = [];
      if (tgData.ok) {
        tgData.result.forEach(update => {
          const msg = update.channel_post || update.message;
          if (msg && msg.text && msg.text.startsWith(`[USER_DB:${projectKey}]`)) {
            try {
              users.push(JSON.parse(msg.text.replace(`[USER_DB:${projectKey}]`, '')));
            } catch (e) {}
          }
        });
      }

      return new Response(JSON.stringify({ success: true, users }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // ২. লগইন ও সাইন-আপ হ্যান্ডেল করা (POST)
    if (req.method === 'POST') {
      const { action, projectKey, email, password } = await req.json();
      const proj = projectKey || 'default';

      const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=100`);
      const tgData = await tgRes.json();

      let adminAccount = null;
      let regularUsers = [];

      if (tgData.ok) {
        tgData.result.forEach(update => {
          const msg = update.channel_post || update.message;
          if (msg && msg.text) {
            // অ্যাডমিন অ্যাকাউন্ট খোঁজা
            if (msg.text.startsWith(`[ADMIN_AUTH:${proj}]`)) {
              adminAccount = JSON.parse(msg.text.replace(`[ADMIN_AUTH:${proj}]`, ''));
            }
            // সাধারণ ইউজার খোঁজা
            if (msg.text.startsWith(`[USER_DB:${proj}]`)) {
              try {
                regularUsers.push(JSON.parse(msg.text.replace(`[USER_DB:${proj}]`, '')));
              } catch (e) {}
            }
          }
        });
      }

      // ক. অ্যাডমিন প্যানেলে লগইন করার চেষ্টা
      if (action === 'admin_login') {
        // যদি এখনো কোনো অ্যাডমিন না থাকে, প্রথমবার যে ইমেইল দিয়ে লগইন করবে সেটাই চিরতরে অ্যাডমিন হয়ে যাবে
        if (!adminAccount) {
          const newAdmin = { email, password, role: 'admin' };
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHANNEL_ID, text: `[ADMIN_AUTH:${proj}]${JSON.stringify(newAdmin)}` })
          });
          return new Response(JSON.stringify({ success: true, message: 'অভিনন্দন! আপনি এই প্রজেক্টের প্রধান অ্যাডমিন হিসেবে নিবন্ধিত হয়েছেন।' }), { status: 200, headers });
        }

        // সাধারণ ইউজার যদি অ্যাডমিন প্যানেলে ঢুকতে চায় — সরাসরি ব্লক
        const isNormalUser = regularUsers.some(u => u.email === email);
        if (isNormalUser && email !== adminAccount.email) {
          return new Response(JSON.stringify({ error: '🚫 অ্যাক্সেস ডিনাইড! আপনি সাধারণ ইউজার, অ্যাডমিন নন।' }), { status: 403, headers });
        }

        // অ্যাডমিন ইমেইল ও পাসওয়ার্ড যাচাই
        if (adminAccount.email === email && adminAccount.password === password) {
          return new Response(JSON.stringify({ success: true, message: 'অ্যাডমিন লগইন সফল!' }), { status: 200, headers });
        } else {
          return new Response(JSON.stringify({ error: 'ভুল অ্যাডমিন ইমেইল অথবা পাসওয়ার্ড!' }), { status: 401, headers });
        }
      }

      // খ. সাধারণ ইউজার সাইন-আপ (ওয়েবসাইট থেকে)
      if (action === 'signup') {
        // কোনো সাধারণ ইউজার অ্যাডমিন ইমেইল দিয়ে সাইন আপ করতে পারবে না
        if (adminAccount && email === adminAccount.email) {
          return new Response(JSON.stringify({ error: 'এই ইমেইলটি অ্যাডমিনের জন্য সংরক্ষিত!' }), { status: 400, headers });
        }

        const newUser = { email, password, role: 'user', createdAt: new Date().toLocaleString('bn-BD') };
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: CHANNEL_ID, text: `[USER_DB:${proj}]${JSON.stringify(newUser)}` })
        });

        return new Response(JSON.stringify({ success: true, message: 'ইউজার রেজিস্ট্রেশন সম্পন্ন হয়েছে!' }), { status: 200, headers });
      }

      // গ. ইউজার প্যানেল লগইন (এখানে সাধারণ ইউজার ও অ্যাডমিন উভয়ই ঢুকতে পারবে)
      if (action === 'user_login') {
        // অ্যাডমিন কি ইউজার প্যানেলে ঢুকতে চাইছে? (Master Access)
        if (adminAccount && adminAccount.email === email && adminAccount.password === password) {
          return new Response(JSON.stringify({ success: true, role: 'admin', message: 'সুপার-অ্যাডমিন হিসেবে ইউজার প্যানেলে প্রবেশ করেছেন।' }), { status: 200, headers });
        }

        // সাধারণ ইউজার লগইন
        const validUser = regularUsers.find(u => u.email === email && u.password === password);
        if (validUser) {
          return new Response(JSON.stringify({ success: true, role: 'user', message: 'ইউজার লগইন সফল!' }), { status: 200, headers });
        } else {
          return new Response(JSON.stringify({ error: 'ভুল ইউজার ইমেইল বা পাসওয়ার্ড!' }), { status: 401, headers });
        }
      }
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }

  return new Response('Method not allowed', { status: 405, headers });
}
