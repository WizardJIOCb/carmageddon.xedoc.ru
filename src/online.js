const TOKEN_KEY = 'wreckrun-auth-token';

class OnlineService {
  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY) || '';
    this.user = null;
  }

  async request(path, options = {}) {
    const response = await fetch(`/api${path}`, {
      ...options,
      headers: { 'Content-Type':'application/json', ...(this.token ? { Authorization:`Bearer ${this.token}` } : {}), ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Ошибка сервера (${response.status})`);
    return data;
  }

  async restore() {
    if (!this.token) return null;
    try { const data=await this.request('/auth/me');this.user=data.user;return this.user; }
    catch { this.clear();return null; }
  }

  async authenticate(mode, username, password) {
    const data = await this.request(`/auth/${mode}`, { method:'POST', body:JSON.stringify({ username, password }) });
    this.token=data.token;this.user=data.user;localStorage.setItem(TOKEN_KEY,this.token);return this.user;
  }

  async logout() { try { if(this.token)await this.request('/auth/logout',{method:'POST'}); } finally { this.clear(); } }
  clear() { this.token='';this.user=null;localStorage.removeItem(TOKEN_KEY); }
  submitResult(result) { if(!this.user)return Promise.resolve(null);return this.request('/results',{method:'POST',body:JSON.stringify(result)}); }
  leaderboard(metric='score',levelId='all') { return this.request(`/leaderboards?metric=${encodeURIComponent(metric)}&levelId=${encodeURIComponent(levelId)}&limit=50`); }
}

export const online = new OnlineService();
