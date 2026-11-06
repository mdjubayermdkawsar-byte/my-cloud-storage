export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Only POST allowed' }), { status: 405 });
  }

  try {
    const { language, version, code } = await req.json();

    if (!language || !code) {
      return new Response(JSON.stringify({ error: 'Language and Code are required' }), { status: 400 });
    }

    // ক্লাউড ইঞ্জিনে কোড পাঠানো হচ্ছে যা সব ভাষা সাপোর্ট করে
    const response = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: language,
        version: version || '*', // লেটেস্ট ভার্সন অটো সিলেক্ট হবে
        files: [{ content: code }]
      })
    });

    const result = await response.json();

    return new Response(JSON.stringify({
      success: true,
      output: result.run ? result.run.output : 'Execution failed',
      details: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
