export const config = {
  runtime: 'edge',
};

// টেলিগ্রামের পিনড মেসেজ থেকে রিয়েল ডাটাবেজ পড়ার হেল্পার
async function getCloudDB(token, chatId) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${chatId}`);
    const data = await res.json();
    if (data.ok && data.result.pinned_message && data.result.pinned_message.text) {
      return { db: JSON.parse(data.result.pinned_message.text), msgId: data.result.pinned_message.message_id };
    }
  } catch (e) {}
  return { db: { projects: {} }, msgId: null };
}

// টেলিগ্রামে পার্মানেন্ট ডাটাবেজ আপডেট করার হেল্পার
async function saveCloudDB(token, chatId, db, msgId) {
  const text = JSON.stringify(db);
  if (msgId) {
    const editRes = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: msgId, text })
    });
    const d = await editRes.json();
    if (d.ok) return msgId;
  }
  const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  const d = await sendRes.json();
  if (d.ok) {
    await fetch(`https://api.telegram.org/bot${token}/pinChatMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: d.result.message_id })
    });
    return d.result.message_id;
  }
}

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers });

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const CHANNEL_ID = process.env.CHANNEL_ID;

  const { db, msgId } = await getCloudDB(BOT_TOKEN, CHANNEL_ID);

  // ১. সকল সংরক্ষিত প্রজেক্টের লিস্ট ক্লাউড থেকে আনা (GET)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'get_projects') {
      const projectList = Object.keys(db.projects).map(k => ({
        name: k,
        email: db.projects[k].email
      }));
      return new Response(JSON.stringify({ success: true, projects: projectList }), {
        status: 200, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  }

  // ২. প্রজেক্ট তৈরি ও অথেন্টিকেশন (POST)
  if (req.method === 'POST') {
    try {
      const { action, projectKey, email, password } = await req.json();
      const proj = projectKey ? projectKey.trim().replace(/\s+/g, '_') : '';

      // ক. নতুন প্রজেক্ট তৈরি ও ক্লাউডে পার্মানেন্ট সেভ
      if (action === 'create_admin') {
        if (!proj || !email || !password) {
          return new Response(JSON.stringify({ error: 'All fields required' }), { status: 400, headers });
        }
        if (db.projects[proj]) {
          return new Response(JSON.stringify({ error: 'Project already exists!' }), { status: 400, headers });
        }

        db.projects[proj] = { email: email.trim(), password: password.trim(), users: [] };
        await saveCloudDB(BOT_TOKEN, CHANNEL_ID, db, msgId);

        return new Response(JSON.stringify({ success: true, message: 'Project created & saved permanently!' }), {
          status: 200, headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      // খ. কঠোর অ্যাডমিন লগইন
      if (action === 'admin_login') {
        const targetProj = db.projects[proj];
        if (!targetProj) {
          return new Response(JSON.stringify({ error: 'Project not found!' }), { status: 404, headers });
        }
        if (targetProj.email === email.trim() && targetProj.password === password.trim()) {
          return new Response(JSON.stringify({ success: true, message: 'Admin login success!' }), {
            status: 200, headers: { ...headers, 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({ error: 'Access Denied: Invalid Admin Credentials!' }), {
            status: 401, headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
      }

      // গ. সাধারণ ইউজার সাইন-আপ
      if (action === 'signup') {
        const targetProj = db.projects[proj];
        if (!targetProj) {
          return new Response(JSON.stringify({ error: 'Project not found!' }), { status: 404, headers });
        }
        if (targetProj.email === email.trim()) {
          return new Response(JSON.stringify({ error: 'This email is reserved for Admin!' }), { status: 400, headers });
        }

        targetProj.users.push({ email: email.trim(), password: password.trim(), createdAt: new Date().toISOString() });
        await saveCloudDB(BOT_TOKEN, CHANNEL_ID, db, msgId);

        return new Response(JSON.stringify({ success: true, message: 'User registered!' }), {
          status: 200, headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  }

  return new Response('Method not allowed', { status: 405, headers });
}
