export class MultiplayerClient {
  constructor() {
    const configured = import.meta.env.VITE_MULTIPLAYER_URL;
    this.url = configured || (location.port ? `ws://${location.hostname}:8081` : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/multiplayer`);
    this.handlers = new Map();
  }

  connect() {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(this.url);
      const timeout = setTimeout(() => reject(new Error('Сервер комнат не отвечает')), 6000);
      this.socket.addEventListener('open', () => { clearTimeout(timeout); resolve(); }, { once: true });
      this.socket.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Нет соединения с сервером комнат')); }, { once: true });
      this.socket.addEventListener('message', event => {
        let message;try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'welcome') this.playerId = message.playerId;
        for (const handler of this.handlers.get(message.type) || []) handler(message);
      });
    });
  }

  on(type, handler) { const handlers=this.handlers.get(type)||[];handlers.push(handler);this.handlers.set(type,handlers);return()=>this.handlers.set(type,(this.handlers.get(type)||[]).filter(item=>item!==handler)); }
  send(type, payload={}) { if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify({type,...payload})); }
  close() { this.socket?.close();this.handlers.clear(); }
}
