export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // ব্রাউজারের সিকিউরিটি লক খোলার CORS হেডার
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // ব্রাউজারের প্রি-ফ্লাইট চেক হ্যান্ডেল করা
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Only POST allowed' }), { 
      status: 405, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  try {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const CHANNEL_ID = process.env.CHANNEL_ID;

    const incomingFormData = await req.formData();
    const file = incomingFormData.get('file');

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

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
      return new Response(JSON.stringify({ error: 'Telegram upload failed', details: tgData }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const fileId = tgData.result.document.file_id;
    const host = req.headers.get('host');
    const downloadUrl = `https://${host}/api/file?id=${fileId}`;

    // ব্রাউজারকে সফল রেসপন্স পাঠানো
    return new Response(JSON.stringify({
      success: true,
      fileName: file.name,
      fileId: fileId,
      url: downloadUrl
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
}
