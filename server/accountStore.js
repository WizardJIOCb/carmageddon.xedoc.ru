import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const SESSION_TTL = 1000 * 60 * 60 * 24 * 30;
const MAX_RESULTS_PER_USER = 500;

const cleanName = value => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 20);
const normalizedName = value => cleanName(value).toLocaleLowerCase('ru-RU');
const tokenHash = token => createHash('sha256').update(token).digest('hex');
const number = (value, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));

export class AccountStore {
  constructor(file = process.env.WRECKRUN_DATA_FILE || resolve('data', 'accounts.json')) {
    this.file = file;
    this.data = { users: [], sessions: [], results: [] };
    this.writeQueue = Promise.resolve();
  }

  async init() {
    try { this.data = { ...this.data, ...JSON.parse(await readFile(this.file, 'utf8')) }; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    this.cleanup();
    await this.persist();
  }

  cleanup() {
    const now = Date.now();
    this.data.sessions = this.data.sessions.filter(session => session.expiresAt > now);
    const validUsers = new Set(this.data.users.map(user => user.id));
    this.data.results = this.data.results.filter(result => validUsers.has(result.userId));
  }

  persist() {
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(dirname(this.file), { recursive: true });
      const temporary = `${this.file}.tmp`;
      await writeFile(temporary, JSON.stringify(this.data, null, 2), { mode: 0o600 });
      await rename(temporary, this.file);
    });
    return this.writeQueue;
  }

  publicUser(user) { return user ? { id: user.id, username: user.username, createdAt: user.createdAt } : null; }

  async register(username, password) {
    const displayName = cleanName(username);
    if (!/^[\p{L}\p{N}_-]{3,20}$/u.test(displayName)) throw new Error('Имя: 3–20 букв, цифр, _ или -');
    if (String(password || '').length < 8 || String(password || '').length > 128) throw new Error('Пароль должен содержать от 8 до 128 символов');
    if (this.data.users.some(user => user.normalizedName === normalizedName(displayName))) throw new Error('Такое имя уже занято');
    const salt = randomBytes(16).toString('hex');
    const derived = await scrypt(String(password), salt, 64);
    const user = { id: randomUUID(), username: displayName, normalizedName: normalizedName(displayName), passwordHash: Buffer.from(derived).toString('hex'), salt, createdAt: Date.now() };
    this.data.users.push(user);
    const session = this.createSession(user.id);
    await this.persist();
    return { user: this.publicUser(user), ...session };
  }

  async login(username, password) {
    const user = this.data.users.find(item => item.normalizedName === normalizedName(username));
    if (!user) throw new Error('Неверное имя или пароль');
    const derived = Buffer.from(await scrypt(String(password || ''), user.salt, 64));
    const expected = Buffer.from(user.passwordHash, 'hex');
    if (derived.length !== expected.length || !timingSafeEqual(derived, expected)) throw new Error('Неверное имя или пароль');
    const session = this.createSession(user.id);
    await this.persist();
    return { user: this.publicUser(user), ...session };
  }

  createSession(userId) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + SESSION_TTL;
    this.data.sessions.push({ tokenHash: tokenHash(token), userId, expiresAt });
    return { token, expiresAt };
  }

  userForToken(token) {
    if (!token) return null;
    const session = this.data.sessions.find(item => item.tokenHash === tokenHash(token) && item.expiresAt > Date.now());
    return this.publicUser(this.data.users.find(user => user.id === session?.userId));
  }

  async logout(token) {
    const hash = tokenHash(token || '');
    this.data.sessions = this.data.sessions.filter(session => session.tokenHash !== hash);
    await this.persist();
  }

  async addResult(userId, raw) {
    const result = {
      id: randomUUID(), userId, levelId: Math.trunc(number(raw.levelId, 0, 9)),
      win: Boolean(raw.win), time: number(raw.time, 1, 86400), kills: Math.trunc(number(raw.kills, 0, 9999)),
      wrecks: Math.trunc(number(raw.wrecks, 0, 999)), destructions: Math.trunc(number(raw.destructions, 0, 9999)),
      damage: Math.round(number(raw.damage, 0, 10000000)), score: Math.round(number(raw.score, 0, 100000000)),
      mode: raw.mode === 'multiplayer' ? 'multiplayer' : 'campaign', createdAt: Date.now(),
    };
    this.data.results.push(result);
    const userResults = this.data.results.filter(item => item.userId === userId);
    if (userResults.length > MAX_RESULTS_PER_USER) {
      const remove = new Set(userResults.sort((a, b) => b.createdAt - a.createdAt).slice(MAX_RESULTS_PER_USER).map(item => item.id));
      this.data.results = this.data.results.filter(item => !remove.has(item.id));
    }
    await this.persist();
    return result;
  }

  leaderboard(metric = 'score', levelId = null, limit = 50) {
    const metrics = new Set(['fastest', 'kills', 'wrecks', 'destructions', 'damage', 'wins', 'score']);
    const selected = metrics.has(metric) ? metric : 'score';
    const filtered = this.data.results.filter(result => levelId === null || result.levelId === levelId);
    const byUser = new Map();
    for (const result of filtered) {
      const entry = byUser.get(result.userId) || { userId: result.userId, wins: 0, attempts: 0, kills: 0, wrecks: 0, destructions: 0, damage: 0, score: 0, fastest: null };
      entry.attempts++; entry.kills += result.kills; entry.wrecks += result.wrecks; entry.destructions += result.destructions; entry.damage += result.damage; entry.score += result.score;
      if (result.win) { entry.wins++; if (entry.fastest === null || result.time < entry.fastest) entry.fastest = result.time; }
      byUser.set(result.userId, entry);
    }
    const rows = [...byUser.values()].map(entry => ({ ...entry, username: this.data.users.find(user => user.id === entry.userId)?.username || 'Unknown' }));
    const value = row => selected === 'fastest' ? (row.fastest ?? Infinity) : row[selected];
    rows.sort((a, b) => selected === 'fastest' ? value(a) - value(b) : value(b) - value(a) || b.wins - a.wins);
    return { metric: selected, levelId, rows: rows.filter(row => selected !== 'fastest' || row.fastest !== null).slice(0, Math.trunc(number(limit, 1, 100))) };
  }
}
