export type PeaksJson = {
  source: string;
  resolution: 'low' | 'high' | string;
  sample_rate: number;
  window_samples: number;
  points: number;
  duration?: number | null;
  peaks: number[]; // normalized 0..1 values
};

export type PeaksJob = {
  job_id: string;
  key: string;
};

export type PeaksStatus = {
  job_id: string;
  url: string;
  key: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  low_ready: boolean;
  high_ready: boolean;
  error?: string | null;
};

const BASE_URL = 'http://localhost:5003';

export const peaksService = {
  async start(url: string): Promise<PeaksJob> {
    const res = await fetch(`${BASE_URL}/peaks/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error(`start failed: ${res.status}`);
    return res.json();
  },

  async status(jobId: string): Promise<PeaksStatus> {
    const res = await fetch(`${BASE_URL}/peaks/${jobId}/status`);
    if (!res.ok) throw new Error(`status failed: ${res.status}`);
    return res.json();
  },

  async low(jobId: string): Promise<PeaksJson | null> {
    const res = await fetch(`${BASE_URL}/peaks/${jobId}/low`);
    if (res.status === 202) return null;
    if (!res.ok) throw new Error(`low failed: ${res.status}`);
    return res.json();
  },

  async high(jobId: string): Promise<PeaksJson | null> {
    const res = await fetch(`${BASE_URL}/peaks/${jobId}/high`);
    if (res.status === 202 || res.status === 404) return null;
    if (!res.ok) throw new Error(`high failed: ${res.status}`);
    return res.json();
  },

  async waitForLow(jobId: string, timeoutMs = 30000): Promise<PeaksJson | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const data = await this.low(jobId);
      if (data) return data;
      await new Promise((r) => setTimeout(r, 200));
    }
    return null;
  },

  async waitForHigh(jobId: string, timeoutMs = 600000): Promise<PeaksJson | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const data = await this.high(jobId);
      if (data) return data;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return null;
  },
};


