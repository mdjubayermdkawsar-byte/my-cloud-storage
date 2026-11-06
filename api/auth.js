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

  if (req.method === 'POST') {
    try {
      const { action, projectKey, email, password } = await req.json();

      if (!projectKey || !email || !password) {
        return new Response(JSON.stringify({ error: 'সবগুলো তথ্য পূরণ করতে হবে!' }), { status: 400, headers });
      }

      const proj = projectKey.trim().replace(/\s+/g, '_');

      // টেলিগ্রাম ক্লাউড হিস্ট্রি থেকে এই প্রজেক্টের আসল ডাটা খোঁজা
      const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=100`);
      const tgData = await tgRes.json();

      let registeredAdmin = null;

      if (tgData.ok && tgData.result) {
        // টেলিগ্রাম মেসেজ চেক করা
        for (let update of tgData.result) {
          const msg = update.channel_post || update.message;
          if (msg && msg.text && msg.text.startsWith(`[ADMIN_AUTH:${proj}]`)) {
            try {
              registeredAdmin = JSON.parse(msg.text.replace(`[ADMIN_AUTH:${proj}]`, ''));
            } catch (e) {}
          }
        }
      }

      // ১. কনসোল থেকে নতুন প্রজেক্ট তৈরি ও অ্যাডমিন সেট করা
      if (action === 'create_admin') {
        if (registeredAdmin) {
          return new Response(JSON.stringify({ error: 'এই প্রজেক্টের অ্যাডমিন ইতোমধ্যেই নির্ধারিত আছে!' }), { status: 400, headers });
        }

        const adminData = { email: email.trim(), password: password.trim() };
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: CHANNEL_ID, text: `[ADMIN_AUTH:${proj}]${JSON.stringify(adminData)}` })
        });

        return new Response(JSON.stringify({ success: true, message: 'অ্যাডমিন অ্যাকাউন্ট সুরক্ষিতভাবে তৈরি হয়েছে!' }), { status: 200, headers });
      }

      // ২. অ্যাডমিন প্যানেল লগইন (এখানেই আসল কড়া ফিল্টার!)
      if (action === 'admin_login') {
        // যদি প্রজেক্টটির কোনো অ্যাডমিন ক্লাউডে রেজিস্টার না থাকে
        if (!registeredAdmin) {
          return new Response(JSON.stringify({ error: '🚫 এই নামের কোনো প্রজেক্ট পাওয়া যায়নি! আগে মাস্টার কনসোল থেকে প্রজেক্ট তৈরি করুন।' }), { status: 404, headers });
        }

        // ইমেইল এবং পাসওয়ার্ড হুবহু মিলতে হবে
        if (registeredAdmin.email === email.trim() && registeredAdmin.password === password.trim()) {
          return new Response(JSON.stringify({ success: true, message: 'স্বাগতম অ্যাডমিন! লগইন সফল হয়েছে।' }), { status: 200, headers });
        } else {
          // যেকোনো ভিন্ন ইমেইল বা পাসওয়ার্ড দিলে সাথে সাথে ব্লক
          return new Response(JSON.stringify({ error: '🚫 অ্যাক্সেস ডিনাইড! আপনি এই প্রজেক্টের বৈধ অ্যাডমিন নন অথবা ভুল তথ্য দিয়েছেন।' }), { status: 401, headers });
        }
      }

      // ৩. সাধারণ ইউজার সাইন-আপ
      if (action === 'signup') {
        if (registeredAdmin && registeredAdmin.email === email.trim()) {
          return new Response(JSON.stringify({ error: 'এই ইমেইলটি অ্যাডমিনের জন্য সংরক্ষিত!' }), { status: 400, headers });
        }

        const newUser = { email: email.trim(), password: password.trim(), role: 'user', createdAt: new Date().toLocaleString('bn-BD') };
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: CHANNEL_ID, text: `[USER_DB:${proj}]${JSON.stringify(newUser)}` })
        });

        return new Response(JSON.stringify({ success: true, message: 'ইউজার সাইন-আপ সম্পন্ন!' }), { status: 200, headers });
      }

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  }

  return new Response('Method not allowed', { status: 405, headers });
}
