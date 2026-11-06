export const config = {
  runtime: 'edge', // সুপার ফাস্ট এবং কোনো এরর ছাড়া ফাইল হ্যান্ডেল করার জন্য
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Only POST allowed' }), { status: 405 });
  }

  try {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const CHANNEL_ID = process.env.CHANNEL_ID;

    // সরাসরি ফাইল রিসিভ করা হচ্ছে
    const incomingFormData = await req.formData();
    const file = incomingFormData.get('file');

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), { status: 400 });
    }

    // টেলিগ্রামে পাঠানোর জন্য ডেটা তৈরি
    const tgFormData = new FormData();
    tgFormData.append('chat_id', CHANNEL_ID);
    tgFormData.append('document', file, file.name);

    // টেলিগ্রামে পাঠানো হচ্ছে
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: tgFormData,
    });

    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return new Response(JSON.stringify({ error: 'Telegram upload failed', details: tgData }), { status: 500 });
    }

    // পার্মানেন্ট ডাউনলোড লিঙ্ক তৈরি
    const fileId = tgData.result.document.file_id;
    const host = req.headers.get('host');
    const downloadUrl = `https://${host}/api/file?id=${fileId}`;

    return new Response(JSON.stringify({
      success: true,
      fileName: file.name,
      fileId: fileId,
      url: downloadUrl
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
