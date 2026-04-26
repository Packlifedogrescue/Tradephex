// api/econ-calendar.js — Twelve Data economic calendar proxy
// Keeps API key server-side, returns calendar data to frontend
// ENV VARS: TWELVE_DATA_API_KEY

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    // Get current week date range
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + 1); // Monday
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Sunday

    const fmt = d => d.toISOString().split('T')[0];

    const url = `https://api.twelvedata.com/economic_calendar?start_date=${fmt(start)}&end_date=${fmt(end)}&country=US&apikey=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Twelve Data API error');

    const data = await response.json();

    // Cache for 55 seconds to avoid hammering API
    res.setHeader('Cache-Control', 's-maxage=55, stale-while-revalidate');
    res.status(200).json(data);
  } catch (err) {
    console.error('Econ calendar error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
