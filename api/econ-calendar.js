// api/econ-calendar.js — Twelve Data economic calendar proxy
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const fmt = d => d.toISOString().split('T')[0];
    const url = `https://api.twelvedata.com/economic_calendar?start_date=${fmt(monday)}&end_date=${fmt(sunday)}&country=United%20States&apikey=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Twelve Data error: ${response.status}`);

    const data = await response.json();

    res.setHeader('Cache-Control', 's-maxage=55, stale-while-revalidate');
    res.status(200).json(data);
  } catch (err) {
    console.error('Econ calendar error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
