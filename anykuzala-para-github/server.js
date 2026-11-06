const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const BUNDLED_UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
const SEED_DB_PATH = path.join(__dirname, 'data', 'db.json');

// Em produção (Railway/VPS) defina DATA_DIR para um volume persistente (ex: /data).
// Assim os pedidos, o stock e os comprovativos NÃO se perdem a cada novo deploy.
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : null;
const DB_PATH = DATA_DIR ? path.join(DATA_DIR, 'db.json') : SEED_DB_PATH;
const UPLOADS_DIR = DATA_DIR ? path.join(DATA_DIR, 'uploads') : BUNDLED_UPLOADS_DIR;

// Garantir que as pastas existem
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Primeiro arranque com volume vazio: copia o catálogo inicial
if (DATA_DIR && !fs.existsSync(DB_PATH) && fs.existsSync(SEED_DB_PATH)) {
  fs.copyFileSync(SEED_DB_PATH, DB_PATH);
  console.log(`📦 Base de dados inicial copiada para ${DB_PATH}`);
}

// Sincroniza fotos soltas na raiz (__dirname) para a pasta de uploads
try {
  const rootFiles = fs.readdirSync(__dirname);
  for (const f of rootFiles) {
    if (/\.(jpg|jpeg|png|webp|svg)$/i.test(f)) {
      const src = path.join(__dirname, f);
      const dest = path.join(UPLOADS_DIR, f);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        console.log(`📸 Foto auto-migrada para uploads: ${f}`);
      }
    }
  }
} catch (e) {
  console.error('Erro na auto-migração de fotos:', e);
}

function readDB() {
  try {
    let raw = fs.readFileSync(DB_PATH, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) {
      raw = raw.slice(1);
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erro ao ler banco de dados:', err);
    return { settings: {}, products: [], orders: [] };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function sendJSON(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password'
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      // Limite de 15MB para permitir upload de comprovativos em base64
      if (body.length > 15 * 1024 * 1024) {
        reject(new Error('Payload demasiado grande'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function checkAdmin(req, db) {
  const pass = req.headers['x-admin-password'];
  // A variável de ambiente ADMIN_PASSWORD (produção) tem prioridade sobre o db.json
  const expected = process.env.ADMIN_PASSWORD || db.settings.adminPassword || 'admin';
  return pass && pass === expected;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJSON(res, 200, { ok: true });
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // ==================== API ROUTES ====================

  // 1. Dados públicos da loja (produtos + configurações públicas)
  if (pathname === '/api/store' && req.method === 'GET') {
    const db = readDB();
    const publicSettings = { ...db.settings };
    delete publicSettings.adminPassword;
    return sendJSON(res, 200, {
      settings: publicSettings,
      products: db.products
    });
  }

  // 2. Criar novo pedido (Checkout da Cliente)
  if (pathname === '/api/orders' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const db = readDB();

      const orderNumber = 'AK-' + Math.floor(1000 + Math.random() * 9000);
      let savedReceiptUrl = '';
      let savedSummaryImageUrl = '';

      // Se enviou comprovativo em base64, salva em /public/uploads
      if (body.receiptBase64 && body.receiptFileName) {
        const matches = body.receiptBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const ext = path.extname(body.receiptFileName) || '.png';
          const safeFileName = `${orderNumber}_${Date.now()}${ext}`.replace(/[^a-zA-Z0-9._-]/g, '');
          const filePath = path.join(UPLOADS_DIR, safeFileName);
          fs.writeFileSync(filePath, Buffer.from(matches[2], 'base64'));
          savedReceiptUrl = `/uploads/${safeFileName}`;
        }
      }

      // Salva o Cartão Visual com as fotos das peças do pedido para aparecer no WhatsApp (og:image) e no Painel!
      if (body.summaryImageBase64) {
        const matches = body.summaryImageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const cardFileName = `pedido_${orderNumber}.png`;
          const cardPath = path.join(UPLOADS_DIR, cardFileName);
          fs.writeFileSync(cardPath, Buffer.from(matches[2], 'base64'));
          savedSummaryImageUrl = `/uploads/${cardFileName}`;
        }
      }

      const newOrder = {
        id: orderNumber,
        createdAt: new Date().toISOString(),
        customerName: body.customerName || 'Cliente TikTok',
        customerPhone: body.customerPhone || '',
        province: body.province || 'Luanda',
        address: body.address || '',
        paymentMethod: body.paymentMethod || 'Multicaixa Express',
        items: Array.isArray(body.items) ? body.items : [],
        subtotal: Number(body.subtotal) || 0,
        deliveryFee: Number(body.deliveryFee) || 0,
        total: Number(body.total) || 0,
        status: savedReceiptUrl ? 'Comprovativo Enviado' : 'Aguardando Comprovativo',
        receiptUrl: savedReceiptUrl,
        summaryImageUrl: savedSummaryImageUrl,
        receiptFileName: body.receiptFileName || '',
        notes: body.notes || ''
      };

      db.orders.unshift(newOrder);
      writeDB(db);

      return sendJSON(res, 201, { ok: true, order: newOrder });
    } catch (err) {
      return sendJSON(res, 400, { error: err.message });
    }
  }

  // 3. Consultar status de um pedido pelo código
  if (pathname.startsWith('/api/orders/track/') && req.method === 'GET') {
    const orderId = pathname.replace('/api/orders/track/', '').trim().toUpperCase();
    const db = readDB();
    const order = db.orders.find(o => o.id.toUpperCase() === orderId);
    if (!order) {
      return sendJSON(res, 404, { error: 'Pedido não encontrado' });
    }
    return sendJSON(res, 200, { order });
  }

  // 3.1 Página Visual do Pedido (Gera o Preview Automático com Foto no WhatsApp via og:image)
  if (pathname.startsWith('/pedido/') && req.method === 'GET') {
    const orderId = pathname.replace('/pedido/', '').trim().toUpperCase();
    const db = readDB();
    const order = db.orders.find(o => o.id.toUpperCase() === orderId);
    if (!order) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>Pedido não encontrado</h1>');
    }
    // Atrás de proxies HTTPS (Railway, Render, Nginx) usa o protocolo real para o og:image do WhatsApp
    const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
    const hostUrl = process.env.PUBLIC_URL ? process.env.PUBLIC_URL.replace(/\/$/, '') : `${proto}://${req.headers.host}`;
    const imgUrl = order.summaryImageUrl ? `${hostUrl}${order.summaryImageUrl}` : `${hostUrl}/logo.jpg`;
    const itemsListHtml = (order.items || []).map(i => `
      <div style="display:flex; align-items:center; gap:14px; padding:12px 0; border-bottom:1px solid #eee;">
        <img src="${i.image || '/uploads/peca1_clean.jpg'}" style="width:80px; height:95px; object-fit:cover; border-radius:8px; border:1px solid #ddd;" />
        <div>
          <strong style="font-size:1.05rem;">${i.code || ''} - ${i.name}</strong>
          <div style="color:#555; font-size:0.9rem;">Tamanho: <strong>${i.size || 'Único'}</strong></div>
          <div style="color:#b8860b; font-weight:800; font-size:1rem;">${Number(i.price).toLocaleString('pt-AO')} Kz</div>
        </div>
      </div>
    `).join('');

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!DOCTYPE html>
    <html lang="pt-AO">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Pedido ${order.id} • AnyKuzala Femme</title>
      <meta property="og:title" content="Pedido ${order.id} • Total: ${Number(order.total).toLocaleString('pt-AO')} Kz" />
      <meta property="og:description" content="${(order.items || []).map(i => `${i.code} ${i.name} (${i.size})`).join(' + ')}" />
      <meta property="og:image" content="${imgUrl}" />
      <meta property="og:type" content="website" />
      <style>
        body { font-family: sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
        .card { max-width: 640px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .top { background: #111; color: #fde68a; padding: 18px 24px; font-weight: 800; font-size: 1.2rem; }
        .body { padding: 20px 24px; }
        .total { background: #f8dad2; padding: 16px 20px; font-weight: 800; font-size: 1.3rem; border-radius: 8px; margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="top">ANYKUZALA FEMME • PEDIDO ${order.id}</div>
        <div class="body">
          ${order.summaryImageUrl ? `<img src="${order.summaryImageUrl}" style="width:100%; border-radius:8px; border:1px solid #eee; margin-bottom:16px;" />` : itemsListHtml}
          <div style="margin-top:14px; text-align:center;">
            <a href="/" style="display:inline-block; background:#111; color:#fff; text-decoration:none; padding:12px 24px; font-weight:700; border-radius:6px;">← Voltar para a Loja AnyKuzala</a>
          </div>
        </div>
      </div>
    </body>
    </html>`);
  }

  // ==================== ADMIN API ROUTES ====================

  // 4. Obter dados completos para o Painel Admin
  if (pathname === '/api/admin/data' && req.method === 'GET') {
    const db = readDB();
    if (!checkAdmin(req, db)) {
      return sendJSON(res, 401, { error: 'Senha de administrador inválida' });
    }
    return sendJSON(res, 200, db);
  }

  // 5. Salvar / Atualizar Produto (Fardo)
  if (pathname === '/api/admin/products' && req.method === 'POST') {
    const db = readDB();
    if (!checkAdmin(req, db)) return sendJSON(res, 401, { error: 'Não autorizado' });

    const product = await parseBody(req);
    if (!product.id) {
      product.id = 'fardo-' + Date.now();
    }

    const existingIndex = db.products.findIndex(p => p.id === product.id);
    if (existingIndex >= 0) {
      db.products[existingIndex] = { ...db.products[existingIndex], ...product };
    } else {
      db.products.unshift(product);
    }

    writeDB(db);
    return sendJSON(res, 200, { ok: true, products: db.products });
  }

  // 5.1 Upload Direto de Imagem de Produto
  if (pathname === '/api/admin/upload-image' && req.method === 'POST') {
    const db = readDB();
    if (!checkAdmin(req, db)) return sendJSON(res, 401, { error: 'Não autorizado' });
    try {
      const body = await parseBody(req);
      if (!body.fileName || !body.base64) {
        return sendJSON(res, 400, { error: 'fileName e base64 são obrigatórios' });
      }
      const safeName = path.basename(body.fileName).replace(/[^a-zA-Z0-9._-]/g, '');
      const cleanBase64 = body.base64.replace(/^data:image\/[a-z]+;base64,/, '');
      const targetPath = path.join(UPLOADS_DIR, safeName);
      fs.writeFileSync(targetPath, Buffer.from(cleanBase64, 'base64'));
      return sendJSON(res, 200, { ok: true, url: `/uploads/${safeName}` });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }



  // 6. Excluir Produto
  if (pathname.startsWith('/api/admin/products/') && req.method === 'DELETE') {
    const db = readDB();
    if (!checkAdmin(req, db)) return sendJSON(res, 401, { error: 'Não autorizado' });

    const prodId = decodeURIComponent(pathname.replace('/api/admin/products/', ''));
    db.products = db.products.filter(p => p.id !== prodId);
    writeDB(db);
    return sendJSON(res, 200, { ok: true, products: db.products });
  }



  // 7. Atualizar Status do Pedido (e abater stock quando pago)
  if (pathname.startsWith('/api/admin/orders/') && req.method === 'PUT') {
    const db = readDB();
    if (!checkAdmin(req, db)) return sendJSON(res, 401, { error: 'Não autorizado' });

    const orderId = decodeURIComponent(pathname.replace('/api/admin/orders/', ''));
    const body = await parseBody(req);
    const order = db.orders.find(o => o.id === orderId);

    if (!order) return sendJSON(res, 404, { error: 'Pedido não encontrado' });

    const previousStatus = order.status;
    order.status = body.status || order.status;

    // Se o pedido foi aprovado para "Pago / Confirmado" pela primeira vez, desconta do stock
    if (order.status === 'Pago / Confirmado' && previousStatus !== 'Pago / Confirmado' && !order.stockDeducted) {
      order.items.forEach(item => {
        const prod = db.products.find(p => p.id === item.id);
        if (prod && prod.stock > 0) {
          prod.stock = Math.max(0, prod.stock - (item.qty || 1));
        }
      });
      order.stockDeducted = true;
    }

    writeDB(db);
    return sendJSON(res, 200, { ok: true, orders: db.orders, products: db.products });
  }

  // 8. Atualizar Configurações da Loja (IBAN, Express, Status de Live no TikTok, etc.)
  if (pathname === '/api/admin/settings' && req.method === 'PUT') {
    const db = readDB();
    if (!checkAdmin(req, db)) return sendJSON(res, 401, { error: 'Não autorizado' });

    const newSettings = await parseBody(req);
    db.settings = { ...db.settings, ...newSettings };
    writeDB(db);
    return sendJSON(res, 200, { ok: true, settings: db.settings });
  }

  // 9. Verificar ao vivo o status do TikTok Live
  if (pathname === '/api/tiktok-live-check' && req.method === 'GET') {
    const db = readDB();
    const handle = db.settings.tiktokHandle || 'aniezasousa';
    const result = await checkTikTokLiveStatus(handle);
    if (db.settings.autoDetectLive !== false && db.settings.isLiveOnTiktok !== result.isLive) {
      db.settings.isLiveOnTiktok = result.isLive;
      writeDB(db);
    }
    return sendJSON(res, 200, { ok: true, isLive: result.isLive, handle, status: result.status });
  }

  // ==================== STATIC FILES ====================
  // Servir arquivos de uploads com busca inteligente multi-diretório
  if (pathname.startsWith('/uploads/')) {
    const fileName = path.basename(decodeURIComponent(pathname));
    const candidates = [
      DATA_DIR ? path.join(UPLOADS_DIR, fileName) : null,
      path.join(BUNDLED_UPLOADS_DIR, fileName),
      path.join(__dirname, fileName),
      path.join(PUBLIC_DIR, fileName)
    ].filter(Boolean);

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        const cExt = path.extname(c).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[cExt] || 'application/octet-stream',
          'Cache-Control': 'public, max-age=86400'
        });
        return fs.createReadStream(c).pipe(res);
      }
    }
  }

  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();

  // Prevenir directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Acesso negado');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>404 - Página não encontrada</h1><a href="/">Voltar para a loja AnyKuzala</a>');
    }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

function checkTikTokLiveStatus(username) {
  return new Promise((resolve) => {
    const cleanUser = (username || '').replace(/^@/, '').trim();
    if (!cleanUser) return resolve({ isLive: false, status: 0 });

    const options = {
      hostname: 'www.tiktok.com',
      path: `/@${cleanUser}/live`,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8'
      }
    };

    const req = https.get(options, (res) => {
      let html = '';
      res.on('data', chunk => html += chunk);
      res.on('end', () => {
        // TikTok define liveRoomStatus: 2 quando a transmissão ao vivo está ON
        const match = html.match(/"liveRoomStatus":\s*([0-9]+)/);
        const st = match ? parseInt(match[1], 10) : 0;
        resolve({ isLive: st === 2, status: st });
      });
    });

    req.on('error', () => resolve({ isLive: false, status: 0 }));
    req.setTimeout(7000, () => {
      req.destroy();
      resolve({ isLive: false, status: 0 });
    });
  });
}

// Robô verificador em segundo plano (corre a cada 60 segundos)
setInterval(async () => {
  try {
    const db = readDB();
    if (db.settings.autoDetectLive !== false) {
      const handle = db.settings.tiktokHandle || 'aniezasousa';
      const liveCheck = await checkTikTokLiveStatus(handle);
      if (db.settings.isLiveOnTiktok !== liveCheck.isLive) {
        db.settings.isLiveOnTiktok = liveCheck.isLive;
        writeDB(db);
        console.log(`📡 [TikTok Live Auto] @${handle} alterou para: ${liveCheck.isLive ? '🔴 EM DIRETO' : '⚪ OFFLINE'}`);
      }
    }
  } catch (e) {}
}, 60000);

server.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🛍️  AnyKuzala E-Commerce de Fardos está ONLINE!`);
  console.log(`🌐 Loja (Clientes):   http://localhost:${PORT}`);
  console.log(`⚙️  Painel Admin:     http://localhost:${PORT}/admin.html`);
  console.log(process.env.ADMIN_PASSWORD ? '🔑 Senha Admin: definida via ADMIN_PASSWORD' : '⚠️  Senha Admin padrão: admin (defina ADMIN_PASSWORD em produção!)');
  console.log(`💾 Dados em: ${DB_PATH}`);
  console.log('====================================================');
});
