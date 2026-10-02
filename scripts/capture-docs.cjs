const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs', 'images');
const preload = path.join(__dirname, 'capture-preload.cjs');
const index = path.join(root, 'dist', 'index.html');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
app.on('window-all-closed', () => {});

async function captureWindow(options, query, destination, alert = false) {
  const win = new BrowserWindow({ ...options, show: false, frame: false, transparent: !!options.transparent, backgroundColor: options.transparent ? '#00000000' : '#F6FAF8', webPreferences: { preload, contextIsolation: true, nodeIntegration: false } });
  await win.loadFile(index, { query }); await delay(650);
  if (alert) { win.webContents.send('pet:alert', { pending: 1 }); await delay(180); }
  const image = await win.capturePage(); fs.writeFileSync(destination, image.toPNG()); win.destroy();
}

app.whenReady().then(async () => {
  fs.mkdirSync(output, { recursive: true });
  const temp = path.join(app.getPath('temp'), 'mochiminder-docs'); fs.mkdirSync(temp, { recursive: true });
  await captureWindow({ width: 860, height: 600 }, {}, path.join(output, 'dashboard.png'));
  const pets = [
    ['stretch', '站起来伸展', '#59CFA8', 'mint.png', false],
    ['water', '喝一杯水', '#63A9F5', 'blue.png', false],
    ['eyes', '眺望远处', '#F47DA5', 'pink.png', true],
  ];
  for (const [id, name, color, file, alert] of pets) await captureWindow({ width: 92, height: 108, transparent: true }, { view: 'pet', id, name, color }, path.join(temp, file), alert);
  await captureWindow({ width: 62, height: 62, transparent: true }, { view: 'hub' }, path.join(temp, 'hub.png'));

  const img = (file) => `data:image/png;base64,${fs.readFileSync(path.join(temp, file)).toString('base64')}`;
  const html = `<!doctype html><html><style>
    *{box-sizing:border-box}body{margin:0;width:720px;height:420px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#effff8;background:radial-gradient(circle at 76% 70%,#324940 0,transparent 28%),linear-gradient(145deg,#171522,#252333 58%,#18332d)}
    .top{height:31px;background:rgba(255,255,255,.055);border-bottom:1px solid rgba(255,255,255,.055)}.dots{display:flex;gap:7px;padding:10px 14px}.dots i{width:7px;height:7px;border-radius:50%;background:#ff746d}.dots i:nth-child(2){background:#ffc85c}.dots i:nth-child(3){background:#5bd59b}
    .panel{position:absolute;left:34px;top:72px;width:250px;padding:22px 24px;border:1px solid rgba(255,255,255,.1);border-radius:22px;background:rgba(255,255,255,.075);box-shadow:0 18px 55px rgba(0,0,0,.22);backdrop-filter:blur(12px)}.tag{font-size:10px;letter-spacing:1.5px;color:#86d8bd}.time{font-size:46px;font-weight:700;letter-spacing:-2px;margin:7px 0 2px}.sub{font-size:12px;color:#a7bdb6}.line{height:5px;border-radius:5px;background:rgba(255,255,255,.08);margin-top:19px;overflow:hidden}.line i{display:block;width:68%;height:100%;background:#63d2ae;border-radius:5px}
    .hint{position:absolute;right:37px;top:58px;font-size:11px;color:#9eb6ae}.hint b{color:#fff;font-weight:600}.glow{position:absolute;right:38px;bottom:22px;width:370px;height:230px;border-radius:50%;background:radial-gradient(ellipse,rgba(104,220,177,.12),transparent 66%)}
    .sprite{position:absolute;width:92px;height:108px;object-fit:contain}.mint{left:364px;top:226px}.blue{left:438px;top:154px}.pink{left:510px;top:226px}.hub{position:absolute;width:62px;height:62px;left:454px;top:255px}.caption{position:absolute;right:36px;bottom:18px;font-size:10px;color:#79978e;letter-spacing:.5px}
  </style><body><div class="top"><div class="dots"><i></i><i></i><i></i></div></div><div class="panel"><div class="tag">FOCUS SESSION</div><div class="time">00:38:12</div><div class="sub">Three companions are working with you</div><div class="line"><i></i></div></div><div class="hint"><b>Drag the campfire</b> to move everyone together</div><div class="glow"></div><img class="sprite mint" src="${img('mint.png')}"><img class="sprite blue" src="${img('blue.png')}"><img class="sprite pink" src="${img('pink.png')}"><img class="hub" src="${img('hub.png')}"><div class="caption">MochiMinder desktop companions</div></body></html>`;
  const showcase = new BrowserWindow({ width: 720, height: 420, show: false, frame: false, backgroundColor: '#171522' });
  await showcase.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`); await delay(900);
  fs.writeFileSync(path.join(output, 'desktop-companions.png'), (await showcase.capturePage()).toPNG()); showcase.destroy();
  app.quit();
});
