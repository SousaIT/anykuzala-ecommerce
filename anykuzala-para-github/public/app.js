const DEFAULT_STORE_DATA = {
  settings: {
    storeName: "AnyKuzala",
    tagline: "Boutique Feminina • Peças Exclusivas selecionadas a dedo",
    whatsappNumber: "244949723140",
    tiktokUrl: "https://www.tiktok.com/@anykuzala",
    isLiveOnTiktok: true,
    liveTitle: "Estamos em direto! Escolhe a tua peça antes que esgote!",
    bankName: "BFA & BAI",
    accountHolder: "AnyKuzala Femme",
    ibanBfa: "0006 0000 2492 2950 3017 3",
    ibanBai: "0040 0000 6292 6876 1029 2",
    iban: "BFA: 000600002492295030173 | BAI: 0040 0000 6292 6876 1029 2",
    mcxExpress: "949 723 140"
  },
  products: [
    {
      id: "peca-real-1",
      code: "#01",
      name: "Blusa de Cetim Rosa Perolado Manga Longa",
      category: "Cetim",
      size: "M",
      price: 5000,
      stock: 1,
      isUnique: true,
      image: "/uploads/peca1_clean.jpg",
      images: [
        "/uploads/peca1_clean.jpg",
        "/uploads/modelo_real_peca1.jpg",
        "/uploads/peca1_angle2.jpg",
        "/uploads/peca1_back.jpg"
      ]
    },
    {
      id: "peca-real-2",
      code: "#02",
      name: "Camisa de Cetim Estampada Luxo (Laranja & Azul Royal)",
      category: "Cetim",
      size: "M",
      price: 5000,
      stock: 1,
      isUnique: true,
      image: "/uploads/peca2_clean.jpg",
      images: [
        "/uploads/peca2_clean.jpg",
        "/uploads/modelo_real_peca2.jpg",
        "/uploads/peca2_angle2.jpg",
        "/uploads/peca2_back.jpg"
      ]
    },
    {
      id: "peca-real-3",
      code: "#03",
      name: "Camisa Floral Mostarda Gola Clássica Preta (Manga 3/4)",
      category: "Blusas",
      size: "M40",
      price: 5000,
      stock: 1,
      isUnique: true,
      image: "/uploads/peca3_clean.jpg",
      images: [
        "/uploads/peca3_clean.jpg",
        "/uploads/modelo_real_peca3_lado.jpg",
        "/uploads/modelo_real_peca3_cruzados.jpg",
        "/uploads/peca3_angle2.jpg",
        "/uploads/peca3_back.jpg"
      ]
    },
    {
      id: "peca-real-4",
      code: "#04",
      name: "Blusa Preta & Estampa Floral Vermelha (Manga 3/4)",
      category: "Blusas",
      size: "M40",
      price: 5000,
      stock: 1,
      isUnique: true,
      image: "/uploads/peca4_clean.jpg",
      images: [
        "/uploads/peca4_clean.jpg",
        "/uploads/modelo_peca4.jpg",
        "/uploads/peca4_angle2.jpg",
        "/uploads/peca4_back.jpg"
      ]
    },
    {
      id: "peca-real-5",
      code: "#05",
      name: "Camisa Branca Elegante com Laço & Mangas Plissadas",
      category: "Camisas Brancas",
      size: "2XL",
      price: 7000,
      stock: 1,
      isUnique: true,
      image: "/uploads/peca5_clean.jpg",
      images: [
        "/uploads/peca5_clean.jpg",
        "/uploads/modelo_peca5.jpg",
        "/uploads/peca5_angle2.jpg"
      ]
    }
  ]
};

let storeSettings = { ...DEFAULT_STORE_DATA.settings };
let allProducts = [...DEFAULT_STORE_DATA.products];
let activeCategory = 'Todos';
let activeSize = 'Todos';
let onlyFavorites = false;

let cart = JSON.parse(localStorage.getItem('anykuzala_retail_cart') || '[]');
let favorites = JSON.parse(localStorage.getItem('anykuzala_favorites') || '[]');

let currentGalleryProduct = null;
let currentAngleIndex = 0;

function formatKz(value) {
  return Number(value || 0).toLocaleString('pt-AO') + ' Kz';
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>✨</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

function getProductImages(product) {
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images;
  }
  return [product.image];
}

async function initStore() {
  try {
    const res = await fetch('/api/store');
    if (res.ok) {
      const data = await res.json();
      storeSettings = data.settings || storeSettings;
      allProducts = data.products || allProducts;
    }
  } catch (err) {}

  applyStoreSettings();
  setupCategoryButtons();

  // Garantir que o carrinho só tem peças reais válidas do catálogo atual e com a foto atualizada
  cart = cart
    .map(item => {
      const realProd = allProducts.find(p => p.id === item.id || p.code === item.code);
      if (!realProd) return null;
      return {
        ...item,
        id: realProd.id,
        code: realProd.code,
        name: realProd.name,
        size: realProd.size,
        price: Number(realProd.price),
        image: realProd.image || (Array.isArray(realProd.images) ? realProd.images[0] : '')
      };
    })
    .filter(Boolean);
  saveCart();

  updateFavBadge();
  renderProducts();
  updateCartUI();

  // Navegação por teclado na galeria de ângulos
  window.addEventListener('keydown', (e) => {
    const modal = document.getElementById('productGalleryModal');
    if (!modal || !modal.classList.contains('open')) return;
    if (e.key === 'ArrowRight') changeAngle(1);
    if (e.key === 'ArrowLeft') changeAngle(-1);
    if (e.key === 'Escape') closeGalleryModal();
  });
}

function applyStoreSettings() {
  const nameEl = document.getElementById('storeNameHeading');
  if (nameEl) nameEl.textContent = (storeSettings.storeName || 'ANYKUZALA').replace(/femme/i, '').trim() || 'ANYKUZALA';

  const waHeader = document.getElementById('headerWhatsappLink');
  if (waHeader) {
    const cleanPhone = (storeSettings.whatsappNumber || '244923000000').replace(/\D/g, '');
    waHeader.href = `https://wa.me/${cleanPhone}`;
  }

  const liveBanner = document.getElementById('liveBanner');
  if (liveBanner) {
    if (storeSettings.isLiveOnTiktok) {
      liveBanner.style.display = 'flex';
      document.getElementById('liveTitleText').textContent = storeSettings.liveTitle || 'Estamos em Live no TikTok!';
      document.getElementById('liveTiktokLink').href = storeSettings.tiktokUrl || 'https://www.tiktok.com';
    } else {
      liveBanner.style.display = 'none';
    }
  }

  if (document.getElementById('mcxText')) {
    document.getElementById('mcxText').textContent = storeSettings.mcxExpress || '949 723 140';
  }
  if (document.getElementById('ibanBfaText')) {
    document.getElementById('ibanBfaText').textContent = storeSettings.ibanBfa || '0006 0000 2492 2950 3017 3';
  }
  if (document.getElementById('ibanBaiText')) {
    document.getElementById('ibanBaiText').textContent = storeSettings.ibanBai || '0040 0000 6292 6876 1029 2';
  }
}

function setupCategoryButtons() {
  const buttons = document.querySelectorAll('.cat-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      onlyFavorites = false;
      const favBtn = document.getElementById('favNavBtn');
      if (favBtn) favBtn.style.borderColor = '';
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.getAttribute('data-cat');
      renderProducts();
    });
  });
}

function setSizeFilter(size, chipEl) {
  activeSize = size;
  document.querySelectorAll('.size-chip').forEach(c => c.classList.remove('active'));
  chipEl.classList.add('active');
  renderProducts();
}

function toggleFavorite(event, productId) {
  event.stopPropagation();
  const idx = favorites.indexOf(productId);
  if (idx >= 0) {
    favorites.splice(idx, 1);
    showToast('Removida das suas favoritas');
  } else {
    favorites.push(productId);
    showToast('❤️ Guardada nas suas peças favoritas!');
  }
  localStorage.setItem('anykuzala_favorites', JSON.stringify(favorites));
  updateFavBadge();
  renderProducts();
}

function filterFavorites() {
  onlyFavorites = !onlyFavorites;
  const favBtn = document.getElementById('favNavBtn');
  if (favBtn) {
    favBtn.style.borderColor = onlyFavorites ? 'var(--primary)' : '';
    favBtn.style.color = onlyFavorites ? 'var(--primary)' : '';
  }
  renderProducts();
}

function updateFavBadge() {
  const badge = document.getElementById('favCountBadge');
  if (badge) badge.textContent = favorites.length;
}

function previewCardAngle(productId, imgUrl) {
  const imgEl = document.getElementById(`card-img-${productId}`);
  if (imgEl && imgUrl) imgEl.src = imgUrl;
}

function renderProducts() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;

  const query = (searchInput.value || '').toLowerCase().trim();
  const grid = document.getElementById('productsGrid');

  const filtered = allProducts.filter(p => {
    if (onlyFavorites && !favorites.includes(p.id)) return false;
    const matchCat = activeCategory === 'Todos' || p.category.toLowerCase() === activeCategory.toLowerCase();
    const matchSize = activeSize === 'Todos' || (p.size && p.size.toUpperCase().includes(activeSize.toUpperCase()));
    const matchQuery = !query ||
      p.name.toLowerCase().includes(query) ||
      (p.code && p.code.toLowerCase().includes(query)) ||
      p.category.toLowerCase().includes(query);
    return matchCat && matchSize && matchQuery;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:48px 20px; background:#fff; border-radius:20px; border:1px solid var(--border);">
        <h3 style="margin-bottom:6px;">Nenhuma peça encontrada com este filtro</h3>
        <p style="color:var(--text-muted); font-size:0.9rem;">Experimente selecionar "Todas as Peças" ou outro tamanho.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(product => {
    const isOut = Number(product.stock) <= 0;
    const isUnique = product.isUnique !== false;
    const photos = getProductImages(product);
    const isFav = favorites.includes(product.id);
    const inCart = cart.some(item => item.id === product.id);
    const secondPhoto = photos.length > 1 ? photos[1] : photos[0];

    let btnText = '+ Eu Quero';
    if (isOut) btnText = '⛔ Indisponível';
    else if (inCart) btnText = '✓ Selecionada';

    return `
      <article class="product-card ${isOut ? 'sold-out' : ''}" style="${inCart ? 'border-color: var(--gold); box-shadow: 0 0 0 2px var(--gold);' : ''}">
        <div
          class="product-img-wrap"
          onclick="openGalleryModal('${product.id}')"
          onmouseenter="previewCardAngle('${product.id}', '${secondPhoto}')"
          onmouseleave="previewCardAngle('${product.id}', '${photos[0]}')"
          title="Toque para ver todos os ângulos"
        >
          <img id="card-img-${product.id}" src="${photos[0]}" alt="${product.name}" loading="lazy" />
          ${isOut ? `
            <div class="sold-out-overlay">
              <span class="sold-out-label-badge">⛔ INDISPONÍVEL</span>
            </div>
          ` : ''}
          <span class="product-badge">${product.code || '#'}</span>
          ${isUnique ? `<span class="unique-pill">💎 PEÇA ÚNICA</span>` : ''}
          <button type="button" class="fav-btn" onclick="toggleFavorite(event, '${product.id}')" title="Guardar nos favoritos">
            ${isFav ? '❤️' : '🤍'}
          </button>
          <span class="angles-hint">📸 ${photos.length} ${photos.length > 1 ? 'ângulos' : 'foto'}</span>
          <span class="stock-pill ${isOut ? 'out' : ''}">${isOut ? '⛔ Indisponível' : (isUnique ? 'Exclusiva' : 'Disponível')}</span>
        </div>

        <div class="product-body">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="product-cat">${product.category}</span>
            <span style="background:var(--primary-light); color:var(--primary-dark); padding:3px 10px; border-radius:999px; font-size:0.76rem; font-weight:800;">
              Tam: ${product.size || 'Único'}
            </span>
          </div>

          <h3 class="product-title" style="cursor:pointer;" onclick="openGalleryModal('${product.id}')">${product.name}</h3>

          <div class="product-footer">
            <div class="price-block">
              <span class="current-price">${formatKz(product.price)}</span>
            </div>

            <button
              class="btn ${isOut ? 'btn-outline' : 'btn-primary'}"
              style="${isOut ? 'background:#fee2e2; color:#dc2626; border-color:#fca5a5; cursor:not-allowed;' : (inCart ? 'background: var(--gold); color: #111;' : '')}"
              ${isOut ? 'disabled' : `onclick="togglePieceInCart('${product.id}')"`}
            >
              ${btnText}
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// ==================== GALERIA DE ÂNGULOS DA PEÇA ====================

function openGalleryModal(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  currentGalleryProduct = product;
  currentAngleIndex = 0;

  document.getElementById('galCodeBadge').textContent = `Código Live: ${product.code || '#'}`;
  document.getElementById('galTitle').textContent = product.name;
  document.getElementById('galSize').textContent = `Tamanho: ${product.size || 'Único'}`;
  document.getElementById('galPrice').textContent = formatKz(product.price);

  const isOut = Number(product.stock) <= 0;
  const isUnique = product.isUnique !== false;

  const uniqueAlert = document.getElementById('galUniqueAlert');
  if (uniqueAlert) {
    if (isOut) {
      uniqueAlert.innerHTML = `
        <div class="unique-alert-banner" style="background:#fee2e2; border-color:#fca5a5; color:#991b1b;">
          <span>⛔</span>
          <div>
            <strong>PEÇA INDISPONÍVEL / JÁ FOI PAGA:</strong> Este exemplar único já foi adquirido por outra cliente. Acompanhe a próxima live no TikTok para novas peças exclusivas!
          </div>
        </div>
      `;
    } else if (isUnique) {
      uniqueAlert.innerHTML = `
        <div class="unique-alert-banner">
          <span>💎</span>
          <div>
            <strong>PEÇA ÚNICA EXCLUSIVA:</strong> Apenas 1 exemplar disponível em stock. Assim que for confirmada e paga, ficará automaticamente indisponível para outras clientes!
          </div>
        </div>
      `;
    } else {
      uniqueAlert.innerHTML = '';
    }
  }

  const buyBtn = document.getElementById('galBuyBtn');
  buyBtn.disabled = isOut;
  buyBtn.textContent = isOut ? '⛔ ESTA PEÇA JÁ FOI VENDIDA' : '+ ADICIONAR À SACOLA';
  buyBtn.className = `btn ${isOut ? 'btn-outline' : 'btn-primary'}`;
  if (isOut) {
    buyBtn.style.background = '#fee2e2';
    buyBtn.style.color = '#dc2626';
    buyBtn.style.borderColor = '#fca5a5';
  } else {
    buyBtn.style.background = '';
    buyBtn.style.color = '';
    buyBtn.style.borderColor = '';
  }

  buyBtn.onclick = () => {
    closeGalleryModal();
    addToCart(product.id);
  };

  renderGalleryAngle();
  document.getElementById('productGalleryModal').classList.add('open');
}

  renderGalleryAngle();
  document.getElementById('productGalleryModal').classList.add('open');
}

function closeGalleryModal() {
  document.getElementById('productGalleryModal').classList.remove('open');
}

function getAngleLabel(url, idx) {
  if (url.includes('cruzados')) return 'Braços Cruzados ✨';
  if (url.includes('lado')) return 'De Lado / Perfil ✨';
  if (url.includes('modelo')) return 'Na Modelo ✨';
  if (url.includes('back')) return 'Costas (Trás)';
  if (url.includes('angle2')) return 'Perfil 3/4';
  if (url.includes('clean')) return 'Frente';
  return `Foto ${idx + 1}`;
}

function renderGalleryAngle() {
  if (!currentGalleryProduct) return;
  const photos = getProductImages(currentGalleryProduct);

  document.getElementById('galMainImg').src = photos[currentAngleIndex];

  const showArrows = photos.length > 1 ? 'block' : 'none';
  document.getElementById('galPrevBtn').style.display = showArrows;
  document.getElementById('galNextBtn').style.display = showArrows;

  const thumbsContainer = document.getElementById('galThumbs');
  thumbsContainer.innerHTML = photos.map((url, idx) => `
    <div onclick="selectAngle(${idx})" style="text-align:center; cursor:pointer;">
      <img
        src="${url}"
        class="gallery-thumb ${idx === currentAngleIndex ? 'active' : ''}"
        alt="${getAngleLabel(url, idx)}"
      />
      <div style="font-size:0.68rem; font-weight:700; margin-top:4px; color:${idx === currentAngleIndex ? '#111' : '#777'};">
        ${getAngleLabel(url, idx)}
      </div>
    </div>
  `).join('');
}

function changeAngle(delta) {
  if (!currentGalleryProduct) return;
  const photos = getProductImages(currentGalleryProduct);
  currentAngleIndex = (currentAngleIndex + delta + photos.length) % photos.length;
  renderGalleryAngle();
}

function selectAngle(index) {
  currentAngleIndex = index;
  renderGalleryAngle();
}

// ==================== CESTO & ENVIO DIRETO PARA O WHATSAPP COM FOTOS ====================

function loadImgForCanvas(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Gera a imagem única com as fotos de todas as peças escolhidas (retorna base64 e também copia para Ctrl+V)
async function buildVisualOrderCard() {
  try {
    const canvas = document.createElement('canvas');
    const rowHeight = 130;
    const headerHeight = 90;
    const footerHeight = 95;
    canvas.width = 680;
    canvas.height = headerHeight + (cart.length * rowHeight) + footerHeight;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, canvas.width, 75);
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('ANYKUZALA FEMME • RESUMO DO PEDIDO', 24, 46);

    for (let i = 0; i < cart.length; i++) {
      const item = cart[i];
      const y = headerHeight + (i * rowHeight);

      ctx.strokeStyle = '#eeeeee';
      ctx.beginPath();
      ctx.moveTo(24, y + rowHeight - 8);
      ctx.lineTo(canvas.width - 24, y + rowHeight - 8);
      ctx.stroke();

      const imgUrl = item.image || '/uploads/peca1_clean.jpg';
      const loadedImg = await loadImgForCanvas(imgUrl);
      if (loadedImg) {
        ctx.drawImage(loadedImg, 24, y, 100, 112);
      }

      ctx.fillStyle = '#111111';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`${item.code || ''} - ${item.name}`, 142, y + 36);

      ctx.fillStyle = '#555555';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`Tamanho: ${item.size || 'Único'}`, 142, y + 66);

      ctx.fillStyle = '#b8860b';
      ctx.font = 'bold 19px sans-serif';
      ctx.fillText(formatKz(item.price * item.qty), 142, y + 98);
    }

    const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const footerY = headerHeight + (cart.length * rowHeight) + 10;
    ctx.fillStyle = '#f8dad2';
    ctx.fillRect(24, footerY, canvas.width - 48, 65);
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`TOTAL A PAGAR: ${formatKz(total)}`, 42, footerY + 40);

    const dataUrl = canvas.toDataURL('image/png');

    if (navigator.clipboard && window.ClipboardItem) {
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      if (blob) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).catch(() => {});
      }
    }
    return dataUrl;
  } catch (err) {
    console.warn('Erro ao gerar cartão visual:', err);
    return '';
  }
}

async function sendCartDirectlyToWhatsApp() {
  if (cart.length === 0) return;

  const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const summaryImageBase64 = await buildVisualOrderCard();

  let orderId = 'AK-' + Math.floor(1000 + Math.random() * 9000);

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Cliente WhatsApp',
        customerPhone: 'Via WhatsApp',
        province: 'Luanda',
        address: 'Confirmar no WhatsApp',
        paymentMethod: 'Multicaixa Express / IBAN',
        items: cart,
        subtotal: total,
        deliveryFee: 0,
        total: total,
        summaryImageBase64
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.order && data.order.id) orderId = data.order.id;
    }
  } catch (e) {}

  const itemsText = cart
    .map((i, idx) => `${idx + 1}. *${i.code || ''} ${i.name}* (Tam: ${i.size}) - *${formatKz(i.price * i.qty)}*`)
    .join('\n');

  const mcxInfo = `\n*Express:* ${storeSettings.mcxExpress || '949 723 140'}`;
  const bfaInfo = `\n*IBAN BFA:* ${storeSettings.ibanBfa || '0006 0000 2492 2950 3017 3'}`;
  const baiInfo = `\n*IBAN BAI:* ${storeSettings.ibanBai || '0040 0000 6292 6876 1029 2'}`;

  // Mensagem limpa SEM links localhost!
  const message =
    `*OLÁ ANYKUZALA FEMME! PEDIDO ${orderId}:*\n\n` +
    `${itemsText}\n\n` +
    `*TOTAL A PAGAR: ${formatKz(total)}*\n` +
    `------------------------` +
    `${mcxInfo}${bfaInfo}${baiInfo}\n\n` +
    `*Segue a foto das peças e o comprovativo!*`;

  // 1. No Telemóvel (Android/iOS): envia os FICHEIROS DE IMAGEM REAIS das blusas direto para o WhatsApp!
  if (navigator.canShare && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      const imageFiles = [];
      for (let i = 0; i < cart.length; i++) {
        const item = cart[i];
        const resp = await fetch(item.image || '/uploads/peca1_clean.jpg');
        const blob = await resp.blob();
        imageFiles.push(new File([blob], `peca_${i + 1}.jpg`, { type: blob.type || 'image/jpeg' }));
      }
      if (imageFiles.length > 0 && navigator.canShare({ files: imageFiles })) {
        await navigator.share({
          files: imageFiles,
          title: `Pedido ${orderId} - AnyKuzala Femme`,
          text: message
        });
        return;
      }
    } catch (shareErr) {
      console.warn('Partilha direta cancelada ou indisponível, abrindo link WhatsApp...', shareErr);
    }
  }

  // 2. No PC / Navegador Desktop: a imagem já foi copiada para o Ctrl+V!
  const cleanPhone = (storeSettings.whatsappNumber || '244949723140').replace(/\D/g, '');
  const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;

  showToast('📸 Imagem copiada! Quando o WhatsApp abrir, aperte Ctrl+V para colar a foto!');
  window.open(waUrl, '_blank');
}

function togglePieceInCart(productId) {
  const existingIdx = cart.findIndex(item => item.id === productId);
  if (existingIdx >= 0) {
    cart.splice(existingIdx, 1);
    saveCart();
    updateCartUI();
    renderProducts();
    showToast('Peça desmarcada da sua seleção');
  } else {
    addToCart(productId);
  }
}

function addToCart(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product || product.stock <= 0) return;

  const existing = cart.find(item => item.id === productId);
  if (!existing) {
    cart.push({
      id: product.id,
      code: product.code || '',
      name: product.name,
      size: product.size || '',
      price: Number(product.price),
      image: product.image || (Array.isArray(product.images) ? product.images[0] : ''),
      qty: 1
    });
    showToast(`Peça ${product.code || ''} adicionada! Continue a escolher ou finalize abaixo.`);
  } else if (existing.qty < product.stock) {
    existing.qty += 1;
    showToast(`Adicionada mais 1 unidade de ${product.name}!`);
  } else {
    showToast(`Esta peça já está selecionada!`);
  }

  saveCart();
  updateCartUI();
  renderProducts();
}

function clearCart() {
  cart = [];
  saveCart();
  updateCartUI();
  closeCheckoutModal();
  showToast('Sacola limpa!');
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCart();
  updateCartUI();
  renderCartModalItems();
  showToast('Peça removida da sacola');
}

function saveCart() {
  localStorage.setItem('anykuzala_retail_cart', JSON.stringify(cart));
}

function updateCartUI() {
  const totalCount = cart.reduce((acc, item) => acc + item.qty, 0);
  const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  const navCount = document.getElementById('navCartCount');
  if (navCount) navCount.textContent = totalCount;

  const headerTotal = document.getElementById('headerCartTotal');
  if (headerTotal) headerTotal.textContent = formatKz(total);

  const floatingCart = document.getElementById('floatingCart');
  if (floatingCart) {
    if (totalCount > 0) {
      floatingCart.classList.add('visible');
      document.getElementById('floatCartItems').textContent = `${totalCount} ${totalCount === 1 ? 'peça selecionada' : 'peças selecionadas'}`;
      document.getElementById('floatCartTotal').textContent = `Total: ${formatKz(total)}`;
    } else {
      floatingCart.classList.remove('visible');
    }
  }
}

function openCheckoutModal() {
  if (cart.length === 0) {
    showToast('A sua sacola está vazia! Clique numa peça para pedir no WhatsApp.');
    return;
  }
  renderCartModalItems();
  document.getElementById('checkoutModal').classList.add('open');
}

function closeCheckoutModal() {
  document.getElementById('checkoutModal').classList.remove('open');
}

function renderCartModalItems() {
  const container = document.getElementById('cartItemsContainer');
  if (cart.length === 0) {
    closeCheckoutModal();
    return;
  }

  const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div style="display:flex; align-items:center; gap:12px;">
        <img src="${item.image || '/uploads/peca1_clean.jpg'}" alt="${item.name}" style="width:58px; height:64px; object-fit:cover; border:1px solid #ddd; border-radius:6px;" />
        <div class="cart-item-info">
          <h4>${item.code ? item.code + ' - ' : ''}${item.name} (Tam: ${item.size})</h4>
          <span>${formatKz(item.price)}</span>
        </div>
      </div>
      <button type="button" class="btn btn-outline" style="padding:5px 12px; font-size:0.75rem; color:#dc2626;" onclick="removeFromCart('${item.id}')">
        Remover
      </button>
    </div>
  `).join('');

  document.getElementById('summaryTotal').textContent = formatKz(total);
}

function copyText(elementId) {
  const text = document.getElementById(elementId).textContent.trim();
  navigator.clipboard.writeText(text).then(() => {
    showToast(`📋 Copiado: ${text}`);
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function submitOrder(event) {
  event.preventDefault();
  if (cart.length === 0) return;

  const customerName = document.getElementById('custName').value.trim();
  const customerPhone = document.getElementById('custPhone').value.trim();
  const address = document.getElementById('custAddress').value.trim();
  const receiptInput = document.getElementById('receiptFile');
  const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  let receiptBase64 = '';
  let receiptFileName = '';
  if (receiptInput.files && receiptInput.files[0]) {
    receiptFileName = receiptInput.files[0].name;
    try {
      receiptBase64 = await fileToBase64(receiptInput.files[0]);
    } catch (e) {}
  }

  let orderId = 'AK-' + Math.floor(1000 + Math.random() * 9000);

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName,
        customerPhone,
        province: 'Luanda',
        address,
        paymentMethod: 'IBAN / Multicaixa Express',
        items: cart,
        subtotal: total,
        deliveryFee: 0,
        total,
        receiptBase64,
        receiptFileName
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.order && data.order.id) orderId = data.order.id;
    }
  } catch (e) {}

  const itemsText = cart.map(i => `• ${i.code} ${i.name} (Tam: ${i.size}) - ${formatKz(i.price)}`).join('\n');
  const message =
    `🛍️ *OLÁ ANYKUZALA! QUERO COMPRAR ESTAS PEÇAS (${orderId}):*\n\n` +
    `${itemsText}\n\n` +
    `💰 *Total:* *${formatKz(total)}*\n` +
    `👤 *Cliente:* ${customerName} (${customerPhone})\n` +
    `📍 *Entrega:* ${address}\n\n` +
    `📎 *Segue o meu comprovativo de pagamento!*`;

  const cleanPhone = (storeSettings.whatsappNumber || '244923000000').replace(/\D/g, '');
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  cart = [];
  saveCart();
  updateCartUI();
  closeCheckoutModal();
  showToast('🎉 Pedido enviado! A abrir o WhatsApp...');

  window.open(waUrl, '_blank');
}

// ==================== TOP EDITORIAL SLIDER (ALTERNÂNCIA AUTOMÁTICA) ====================
let currentSlideIndex = 0;
let slideInterval = null;

function initTopSlider() {
  const sliderEl = document.getElementById('editorialSlider');
  if (!sliderEl) return;

  startSlideAutoplay();

  sliderEl.addEventListener('mouseenter', () => clearInterval(slideInterval));
  sliderEl.addEventListener('mouseleave', () => startSlideAutoplay());
}

function startSlideAutoplay() {
  clearInterval(slideInterval);
  slideInterval = setInterval(() => {
    moveSlide(1);
  }, 4800);
}

function moveSlide(delta) {
  const slides = document.querySelectorAll('.editorial-slide');
  if (slides.length === 0) return;
  currentSlideIndex = (currentSlideIndex + delta + slides.length) % slides.length;
  updateSliderDOM();
}

function setSlide(index) {
  currentSlideIndex = index;
  updateSliderDOM();
  startSlideAutoplay();
}

function updateSliderDOM() {
  const slides = document.querySelectorAll('.editorial-slide');
  const dots = document.querySelectorAll('.slider-dot-btn');

  slides.forEach((slide, idx) => {
    if (idx === currentSlideIndex) {
      slide.classList.add('active');
    } else {
      slide.classList.remove('active');
    }
  });

  dots.forEach((dot, idx) => {
    if (idx === currentSlideIndex) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });
}

// Iniciar quando o DOM carregar
window.addEventListener('DOMContentLoaded', () => {
  initStore();
  initTopSlider();
});
