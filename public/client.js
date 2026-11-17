// Joseph Glaum — Multiplayer Tic-Tac-Toe
// The server owns all game state; click handlers request moves.
const boardElement = document.querySelector('#board');
const statusElement = document.querySelector('#status');
const errorElement = document.querySelector('#error');
const resetButton = document.querySelector('#reset');
let state = null;
let connected = false;
let pending = false;
const cells = Array.from({length:9},(_,index)=>{
  const button=document.createElement('button');
  button.className='cell';
  button.disabled=true;
  button.addEventListener('click',()=>send('move',{cell:index}));
  boardElement.append(button);
  return button;
});
function render() {
  if(!state) return;
  document.querySelector('#role').textContent=state.role==='Spectator'?'You are a spectator':`Logged in as ${state.name} (${state.role})`;
  document.querySelector('#spectators').textContent=`${state.spectators} spectator${state.spectators===1?'':'s'}`;
  statusElement.textContent=!connected?'Disconnected. Join again to reconnect.':(state.result==='Draw!' ? "It's a draw!" : state.result) || (!state.ready?'Waiting for a second player…':`${state.turn}'s turn${state.role===state.turn?' — your move!':''}`);
  cells.forEach((button,index)=>{
    const mark=state.board[index];
    button.textContent='';
    button.className=`cell ${mark.toLowerCase()}`;
    button.setAttribute('aria-label',`Row ${Math.floor(index/3)+1}, column ${index%3+1}: ${mark || 'empty'}`);
    button.disabled=!connected || pending || !state.ready || Boolean(state.result) || state.role!==state.turn || Boolean(mark);
  });
  resetButton.disabled=!connected || pending || state.role==='Spectator';
}
function send(type,data={}) {
  errorElement.textContent='';
  if(!ws || ws.readyState!==WebSocket.OPEN) {
    errorElement.textContent='Cannot connect. Open this page through the running Node.js server.';
    return;
  }
  ws.send(JSON.stringify({type,...data}));
}
resetButton.addEventListener('click',()=>send('reset'));
let ws;
const joinForm=document.querySelector('#join-form');
function enableJoin() {
  document.querySelectorAll('#join-form input, #join-form button').forEach(control=>control.disabled=false);
}
joinForm.addEventListener('submit',event=>{
  event.preventDefault();
  const name=document.querySelector('#name').value.trim();
  const password=document.querySelector('#password').value;
  if(!name) return;
  if(!['http:','https:'].includes(window.location.protocol)) {
    errorElement.textContent='Start node server.js and open http://localhost:3000 instead of opening the HTML file directly.';
    return;
  }
  errorElement.textContent='';
  if(ws && ws.readyState===WebSocket.OPEN) {send('join',{name,password});return;}
  document.querySelectorAll('#join-form input, #join-form button').forEach(control=>control.disabled=true);
  statusElement.textContent='Connecting...';
  // HTTP uses WS locally; HTTPS uses encrypted WSS on Render.
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocol}//${window.location.host}`);
  ws.onopen=()=>send('join',{name,password});
  ws.onmessage=event=>{
    const data=JSON.parse(event.data);
    if(data.type==='error') {errorElement.textContent=data.message;if(!connected) enableJoin();return;}
    if(data.type==='state') {
      state=data;connected=true;
      document.querySelector('#password').value='';
      document.querySelectorAll('#join-form input, #join-form button').forEach(control=>control.disabled=true);
      render();
    }
  };
  ws.onerror=()=>{errorElement.textContent='Connection failed. Check that the server is running, then join again.';};
  ws.onclose=()=>{
    connected=false;render();enableJoin();
    statusElement.textContent='Disconnected. Join again to reconnect.';
  };
});
