const API_BASE_URL = 'https://hellopiggys-main-api.onrender.com';
const PRODUCT_ENDPOINT = `${API_BASE_URL}/admin/products`;
const REVIEW_STATS_ENDPOINT = `${API_BASE_URL}/admin/products/review-stats`;
const DEFAULT_CHUNK_SIZE = 20;

const tableBody = document.getElementById('sellerTableBody');
const rowTemplate = document.getElementById('rowTemplate');
const alertContainer = document.getElementById('alertContainer');
const refreshButton = document.getElementById('refreshButton');
const lastUpdatedLabel = document.getElementById('lastUpdated');

let isLoading = false;

refreshButton?.addEventListener('click', () => {
  if (isLoading) {
    return;
  }
  loadSellerProducts({ showInfo: true });
});

loadSellerProducts();

async function loadSellerProducts(options = {}) {
  const { showInfo = false } = options;
  isLoading = true;
  showLoadingState();
  hideAlert();

  try {
    const productResponse = await fetchJson(PRODUCT_ENDPOINT);
    const productList = normalizeProductList(productResponse);

    if (!Array.isArray(productList) || productList.length === 0) {
      renderEmptyState('등록된 판매자 상품이 없습니다.');
      updateLastUpdated();
      if (showInfo) {
        showAlert('현재 표시할 상품이 없습니다.', 'info');
      }
      return;
    }

    const productIds = productList
      .map(getProductId)
      .filter((value, index, array) => value && array.indexOf(value) === index);

    let reviewStatsMap = {};
    if (productIds.length > 0) {
      try {
        reviewStatsMap = await fetchReviewStats(productIds);
      } catch (error) {
        console.error('체험단 통계 조회 실패:', error);
        showAlert('체험단 통계를 불러오는 데 실패했습니다. 상품 정보만 표시합니다.', 'error');
      }
    }

    const combinedRows = productList.map((product) => {
      const productId = getProductId(product);
      const stats = productId ? reviewStatsMap[productId] : undefined;
      return buildRowModel(product, stats);
    });

    renderRows(combinedRows);
    updateLastUpdated();
    if (showInfo) {
      showAlert('데이터가 새로고침되었습니다.', 'info');
    }
  } catch (error) {
    console.error('판매자 상품 데이터를 불러오는 중 오류:', error);
    renderEmptyState('데이터를 불러오는 데 실패했습니다. 잠시 후 다시 시도해 주세요.');
    showAlert('데이터 로딩 중 오류가 발생했습니다.', 'error');
  } finally {
    isLoading = false;
  }
}

function showLoadingState() {
  if (!tableBody) {
    return;
  }
  tableBody.innerHTML = '';
  const loadingRow = document.createElement('tr');
  loadingRow.className = 'placeholder-row';
  const cell = document.createElement('td');
  cell.colSpan = 7;
  cell.textContent = '데이터를 불러오는 중입니다...';
  loadingRow.appendChild(cell);
  tableBody.appendChild(loadingRow);
}

function renderEmptyState(message) {
  if (!tableBody) {
    return;
  }
  tableBody.innerHTML = '';
  const emptyRow = document.createElement('tr');
  emptyRow.className = 'placeholder-row';
  const cell = document.createElement('td');
  cell.colSpan = 7;
  cell.textContent = message;
  emptyRow.appendChild(cell);
  tableBody.appendChild(emptyRow);
}

function renderRows(rows) {
  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = '';

  if (!rows.length) {
    renderEmptyState('표시할 데이터가 없습니다.');
    return;
  }

  rows.forEach((row) => {
    const clone = rowTemplate?.content?.firstElementChild?.cloneNode(true);
    const targetRow = clone || document.createElement('tr');

    populateCell(targetRow.querySelector('.product-name'), row.productName || '-');
    populateCell(targetRow.querySelector('.seller-name'), row.sellerName || '-');
    populateCell(targetRow.querySelector('.platform'), row.platform || '-');

    populateNumericCell(targetRow.querySelector('.total'), row.totalCount);
    populateNumericCell(targetRow.querySelector('.recruiting'), row.recruitingCount, {
      emphasizeZero: false,
    });
    populateNumericCell(targetRow.querySelector('.progress'), row.progressCount, {
      highlightPositive: true,
    });
    populateNumericCell(targetRow.querySelector('.completed'), row.completedCount, {
      emphasizeZero: false,
    });

    tableBody.appendChild(targetRow);
  });
}

function populateCell(cell, value) {
  if (!cell) {
    return;
  }
  cell.textContent = value == null || value === '' ? '-' : String(value);
}

function populateNumericCell(cell, value, options = {}) {
  if (!cell) {
    return;
  }
  const { highlightPositive = false, emphasizeZero = true } = options;
  const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : null;

  cell.classList.remove('cell-number', 'positive', 'warning', 'muted');

  if (numericValue === null) {
    cell.textContent = '-';
    cell.classList.add('cell-number', 'muted');
    return;
  }

  cell.textContent = numericValue.toLocaleString('ko-KR');
  cell.classList.add('cell-number');

  if (highlightPositive && numericValue > 0) {
    cell.classList.add('positive');
  } else if (!emphasizeZero && numericValue === 0) {
    cell.classList.add('muted');
  }
}

function updateLastUpdated() {
  if (!lastUpdatedLabel) {
    return;
  }
  const now = new Date();
  lastUpdatedLabel.textContent = `최근 업데이트: ${now.toLocaleString('ko-KR')}`;
}

async function fetchReviewStats(productIds) {
  const statsMap = {};
  const chunks = chunkArray(productIds, DEFAULT_CHUNK_SIZE);

  for (const chunk of chunks) {
    if (!chunk.length) {
      continue;
    }

    const query = chunk.map(encodeURIComponent).join(',');
    const url = `${REVIEW_STATS_ENDPOINT}?ids=${query}`;
    const response = await fetch(url, {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const error = new Error(`리뷰 통계 요청 실패 (HTTP ${response.status})`);
      error.response = response;
      throw error;
    }

    const payload = await response.json();
    const partialMap = normalizeReviewStats(payload);
    Object.assign(statsMap, partialMap);
  }

  return statsMap;
}

function chunkArray(items, size) {
  const chunked = [];
  for (let i = 0; i < items.length; i += size) {
    chunked.push(items.slice(i, i + size));
  }
  return chunked;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    credentials: 'omit',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const error = new Error(`요청 실패: ${response.status}`);
    error.response = response;
    throw error;
  }

  return response.json();
}

function normalizeProductList(payload) {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  if (Array.isArray(payload.results)) {
    return payload.results;
  }

  return [];
}

function normalizeReviewStats(payload) {
  const candidateSources = [
    payload,
    payload?.data,
    payload?.stats,
    payload?.result,
    payload?.results,
  ];

  for (const source of candidateSources) {
    const mapped = convertReviewStatsSourceToMap(source);
    if (mapped) {
      return mapped;
    }
  }

  return {};
}

function convertReviewStatsSourceToMap(source) {
  if (!source) {
    return null;
  }

  if (Array.isArray(source)) {
    return source.reduce((acc, item) => {
      const productId = getProductId(item);
      if (productId) {
        acc[productId] = item;
      }
      return acc;
    }, {});
  }

  if (typeof source === 'object') {
    const entries = Object.entries(source).filter(([, value]) => value && typeof value === 'object');
    if (!entries.length) {
      return null;
    }
    return entries.reduce((acc, [key, value]) => {
      acc[key] = { productId: key, ...value };
      return acc;
    }, {});
  }

  return null;
}

function buildRowModel(product, stats) {
  const productName = pickText(product, [
    'productName',
    'name',
    'title',
    'displayName',
    'itemName',
  ]);

  const sellerName = pickText(product, [
    'sellerName',
    'seller',
    'brand',
    'brandName',
    'company',
  ]);

  const platform = pickText(product, [
    'platform',
    'platformName',
    'channel',
    'socialName',
    'shopName',
  ]);

  const totalCountFromProduct = pickNumber(product, [
    'totalCount',
    'totalReviews',
    'reviewCount',
    'totalReviewCount',
    'campaignCount',
    'totalCampaigns',
  ]);

  const recruitingCount = pickNumberFromSources([stats, product], [
    'recruiting',
    'recruitCount',
    'recruit',
    'waiting',
    'pending',
    'open',
    'ready',
  ]);

  const completedCount = pickNumberFromSources([stats, product], [
    'completed',
    'completedCount',
    'complete',
    'completeCount',
    'done',
    'finished',
  ]);

  let progressCount = pickNumberFromSources([stats, product], [
    'progress',
    'progressCount',
    'ongoing',
    'ongoingCount',
    'inProgress',
    'running',
    'active',
  ]);

  const totalCountFromStats = pickNumber(stats, [
    'total',
    'totalCount',
    'totalReviews',
    'totalReviewCount',
  ]);

  let totalCount = firstNonNull([
    totalCountFromStats,
    totalCountFromProduct,
  ]);

  const sumOfKnown = sumNumbers([recruitingCount, progressCount, completedCount]);
  if ((totalCount == null || Number.isNaN(totalCount)) && sumOfKnown !== null) {
    totalCount = sumOfKnown;
  }

  if ((progressCount == null || Number.isNaN(progressCount)) && totalCount != null) {
    const computed = totalCount - sumNumbers([recruitingCount, completedCount], 0);
    if (Number.isFinite(computed) && computed >= 0) {
      progressCount = computed;
    }
  }

  return {
    productName,
    sellerName,
    platform,
    totalCount: ensureNumberOrNull(totalCount),
    recruitingCount: ensureNumberOrNull(recruitingCount),
    progressCount: ensureNumberOrNull(progressCount),
    completedCount: ensureNumberOrNull(completedCount),
  };
}

function firstNonNull(values) {
  for (const value of values) {
    if (value != null && !Number.isNaN(value)) {
      return value;
    }
  }
  return null;
}

function sumNumbers(values, initial = 0) {
  const validNumbers = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (!validNumbers.length) {
    return null;
  }
  return validNumbers.reduce((acc, number) => acc + number, initial);
}

function ensureNumberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function pickText(source, candidates) {
  if (!source || typeof source !== 'object') {
    return null;
  }
  const lookup = createLowercaseKeyLookup(source);
  for (const candidate of candidates) {
    const key = lookup[candidate.toLowerCase()];
    if (key && source[key] != null) {
      const rawValue = source[key];
      if (typeof rawValue === 'string' && rawValue.trim()) {
        return rawValue.trim();
      }
      if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
        return String(rawValue);
      }
    }
  }
  return null;
}

function pickNumber(source, candidates) {
  if (!source || typeof source !== 'object') {
    return null;
  }

  const lookup = createLowercaseKeyLookup(source);
  for (const candidate of candidates) {
    const key = lookup[candidate.toLowerCase()];
    if (!key || source[key] == null) {
      continue;
    }
    const parsed = parseNumber(source[key]);
    if (parsed != null) {
      return parsed;
    }
  }
  return null;
}

function pickNumberFromSources(sources, candidates) {
  for (const source of sources) {
    const value = pickNumber(source, candidates);
    if (value != null) {
      return value;
    }
  }
  return null;
}

function parseNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const sanitized = value.replace(/[^0-9+\-\.]/g, '');
    if (sanitized) {
      const parsed = Number(sanitized);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function createLowercaseKeyLookup(source) {
  return Object.keys(source).reduce((acc, key) => {
    acc[key.toLowerCase()] = key;
    return acc;
  }, {});
}

function getProductId(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const lookup = createLowercaseKeyLookup(item);
  const candidateKeys = ['productId', 'product_id', 'id', '_id', 'uid', 'docId'];

  for (const candidate of candidateKeys) {
    const actualKey = lookup[candidate.toLowerCase()];
    if (!actualKey) {
      continue;
    }
    const rawValue = item[actualKey];
    if (typeof rawValue === 'string' && rawValue.trim()) {
      return rawValue.trim();
    }
  }

  return null;
}

function showAlert(message, type = 'info') {
  if (!alertContainer) {
    return;
  }
  alertContainer.textContent = message;
  alertContainer.classList.remove('visible', 'error', 'info');
  alertContainer.classList.add('visible', type);
}

function hideAlert() {
  if (!alertContainer) {
    return;
  }
  alertContainer.classList.remove('visible', 'error', 'info');
  alertContainer.textContent = '';
}
