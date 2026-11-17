// Joseph Glaum - Lab 4: multiplayer Tic-Tac-Toe
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { WebSocketServer, WebSocket } = require('ws');
const clients = new Map();
let board = Array(9).fill('');
let turn = 'X';
let result = '';
const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function reset() { board = Array(9).fill(''); turn = 'X'; result = ''; }
function send(ws, data) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); }
function broadcast() {
  const list = [...clients.values()];
  for (const [ws, client] of clients) send(ws, {type:'state', ...client, board, turn, result,
    ready:list.filter(c=>c.role!=='Spectator').length===2,
    spectators:list.filter(c=>c.role==='Spectator').length});
}
function assignWaiting() {
  for (const role of ['X','O']) {
    if (![...clients.values()].some(c=>c.role===role)) {
      const waiting = [...clients.values()].find(c=>c.role==='Spectator');
      if (waiting) waiting.role = role;
    }
  }
}
const server = http.createServer((req,res)=>{
  const url = new URL(req.url,'http://localhost');
  const files = {'/':'index.html','/index.html':'index.html','/style.css':'style.css','/client.js':'client.js'};
  if (req.method!=='GET' || !files[url.pathname]) { res.writeHead(404); return res.end('Not found'); }
  const file = files[url.pathname];
  fs.readFile(path.join(__dirname,'public',file),(error,bytes)=>{
    if(error) {res.writeHead(500); return res.end('Unable to load page');}
    res.writeHead(200, {'Content-Type':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html', 'Cache-Control':'no-store'});
    res.end(bytes);
  });
});
const wss = new WebSocketServer({server, maxPayload:2048});
wss.on('connection',ws=>{
  ws.isAlive = true;
  ws.on('pong',()=>{ ws.isAlive = true; });
  ws.on('error',()=>{});
  ws.on('message',message=>{
    let data;
    try { data = JSON.parse(message.toString()); } catch {return send(ws,{type:'error',message:'Invalid message.'});}
    if (!data || typeof data!=='object') return;
    const reject = message=>send(ws,{type:'error',message});
    if (data.type==='join') {
      if(clients.has(ws)) return reject('You already joined.');
      if(data.password!=='password123') return reject('Incorrect password. Please try again.');
      const name = typeof data.name==='string'?data.name.trim().slice(0,30):'';
      if(!name) return reject('Enter your name.');
      clients.set(ws,{name,role:'Spectator'});
      assignWaiting(); broadcast(); return;
    }
    const client = clients.get(ws);
    if(!client || client.role==='Spectator') return reject('Only connected players can play.');
    if(data.type==='reset') { reset(); broadcast(); return; }
    if(data.type!=='move') return reject('Unknown action.');
    if([...clients.values()].filter(c=>c.role!=='Spectator').length!==2 || result || client.role!==turn)
      return reject('Wait for your turn and a second player.');
    if(!Number.isInteger(data.cell) || data.cell<0 || data.cell>8 || board[data.cell]) return reject('Choose an empty square.');
    board[data.cell] = turn;
    if(wins.some(line=>line.every(i=>board[i]===turn))) result = `${turn} wins!`;
    else if(board.every(Boolean)) result = 'Draw!';
    else turn = turn==='X'?'O':'X';
    broadcast();
  });
  ws.on('close',()=>{
    const client = clients.get(ws);
    clients.delete(ws);
    if(client && client.role!=='Spectator') { reset(); assignWaiting(); }
    broadcast();
  });
});
// Detect clients whose network vanished without a normal disconnect.
const heartbeat = setInterval(()=>{
  for(const ws of wss.clients) {
    if(!ws.isAlive) {ws.terminate();continue;}
    ws.isAlive = false; ws.ping();
  }
},30000);
wss.on('close',()=>clearInterval(heartbeat));
// Render supplies PORT; 3000 remains the local default.
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0',()=>console.log(`Server running on port ${PORT}`));
