/**
 * Bridge Quote API Proxy - Solves CORS issues
 * 
 * This endpoint proxies requests to bridge APIs from server-side,
 * solving CORS restrictions that would block direct browser calls.
 * 
 * GET /api/quote?bridge=stargate&fromChain=ethereum&toChain=polygon&amount=100
 */

const CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const REQUEST_TIMEOUT = 15000; // 15 seconds

// Chain configurations
const CHAIN_IDS = {
  ethereum: { id: 1, stargate: 'ethereum' },
  polygon: { id: 137, stargate: 'polygon' },
  arbitrum: { id: 42161, stargate: 'arbitrum' },
  optimism: { id: 10, stargate: 'optimism' },
  avalanche: { id: 43114, stargate: 'avalanche' }
};

// Token addresses
const TOKEN_ADDRESSES = {
  ethereum: { usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  polygon: { usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
  arbitrum: { usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
  optimism: { usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' },
  avalanche: { usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E' }
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use GET.' 
    });
  }

  const { bridge, fromChain, toChain, amount, token = 'usdc' } = req.query;

  // Validation
  if (!bridge || !fromChain || !toChain || !amount) {
    return res.status(400).json({
      success: false,
      error: 'Missing parameters: bridge, fromChain, toChain, amount required'
    });
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid amount - must be positive number' 
    });
  }

  // Check cache
  const cacheKey = `${bridge}_${fromChain}_${toChain}_${amount}_${token}`;
  const cached = CACHE.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[CACHE HIT] ${cacheKey}`);
    return res.status(200).json({ 
      ...cached.data, 
      cached: true,
      cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000)
    });
  }

  const startTime = Date.now();
  console.log(`[API REQUEST] ${bridge} | ${fromChain}→${toChain} | $${amount}`);

  try {
    let quote;

    switch (bridge.toLowerCase()) {
      case 'stargate':
        quote = await getStargateQuote(fromChain, toChain, amountNum);
        break;
      case 'across':
        quote = await getAcrossQuote(fromChain, toChain, amountNum);
        break;
      case 'hop':
        quote = await getHopQuote(fromChain, toChain, amountNum);
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          error: `Unsupported bridge: ${bridge}`,
          supportedBridges: ['stargate', 'across', 'hop']
        });
    }

    const responseTime = Date.now() - startTime;
    const response = {
      success: true,
      bridge,
      quote,
      metadata: {
        fromChain,
        toChain,
        amount: amountNum,
        token: token.toUpperCase(),
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
        cached: false
      }
    };

    // Cache successful response
    CACHE.set(cacheKey, { data: response, timestamp: Date.now() });
    
    console.log(`[SUCCESS] ${bridge} | ${responseTime}ms`);
    return res.status(200).json(response);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`[ERROR] ${bridge} | ${error.message} | ${responseTime}ms`);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      bridge,
      timestamp: new Date().toISOString()
    });
  }
}

// Stargate Finance API
async function getStargateQuote(fromChain, toChain, amount) {
  const fromToken = TOKEN_ADDRESSES[fromChain]?.usdc;
  const toToken = TOKEN_ADDRESSES[toChain]?.usdc;
  
  if (!fromToken || !toToken) {
    throw new Error(`Stargate doesn't support this chain combination`);
  }

  const amountWei = Math.floor(amount * 1000000);
  const url = `https://api.stargate.finance/api/v1/quotes?${new URLSearchParams({
    srcToken: fromToken,
    dstToken: toToken,
    srcChainKey: CHAIN_IDS[fromChain].stargate,
    dstChainKey: CHAIN_IDS[toChain].stargate,
    srcAmount: amountWei.toString()
  })}`;

  const response = await fetchWithTimeout(url);
  const data = await response.json();

  if (!data.quotes || data.quotes.length === 0) {
    throw new Error('No Stargate routes available for this pair');
  }

  const quote = data.quotes[0];
  const totalFees = quote.fees?.reduce((sum, fee) => sum + parseFloat(fee.amount || 0), 0) || 0;
  const feeInUsd = (totalFees / 1e18) * 3000; // Approximate ETH price

  return {
    name: 'Stargate Finance',
    fee: parseFloat(feeInUsd.toFixed(4)),
    gasEstimate: parseFloat((feeInUsd * 0.3).toFixed(4)),
    estimatedTime: '2-3 min',
    reliability: 99.8
  };
}

// Across Protocol API
async function getAcrossQuote(fromChain, toChain, amount) {
  const originChainId = CHAIN_IDS[fromChain]?.id;
  const destinationChainId = CHAIN_IDS[toChain]?.id;
  const inputToken = TOKEN_ADDRESSES[fromChain]?.usdc;
  const outputToken = TOKEN_ADDRESSES[toChain]?.usdc;

  if (!originChainId || !destinationChainId) {
    throw new Error('Across doesn\'t support this route');
  }

  const amountWei = Math.floor(amount * 1000000);
  const url = `https://app.across.to/api/suggested-fees?${new URLSearchParams({
    inputToken,
    outputToken,
    originChainId: originChainId.toString(),
    destinationChainId: destinationChainId.toString(),
    amount: amountWei.toString()
  })}`;

  const response = await fetchWithTimeout(url);
  const data = await response.json();

  if (!data || typeof data.totalRelayFee === 'undefined') {
    throw new Error('Invalid Across API response');
  }

  const totalFeeWei = parseFloat(data.totalRelayFee?.total || 0);
  const feeInUsd = totalFeeWei / 1000000;

  return {
    name: 'Across Protocol',
    fee: parseFloat(feeInUsd.toFixed(4)),
    gasEstimate: parseFloat((feeInUsd * 0.2).toFixed(4)),
    estimatedTime: '30 sec',
    reliability: 99.9
  };
}

// Hop Protocol API
async function getHopQuote(fromChain, toChain, amount) {
  const chainMapping = {
    ethereum: 'ethereum',
    polygon: 'polygon',
    arbitrum: 'arbitrum',
    optimism: 'optimism'
  };

  const fromKey = chainMapping[fromChain];
  const toKey = chainMapping[toChain];

  if (!fromKey || !toKey) {
    throw new Error('Hop doesn\'t support this route');
  }

  const amountWei = Math.floor(amount * 1000000);
  const url = `https://api.hop.exchange/v1/quote?${new URLSearchParams({
    amount: amountWei.toString(),
    token: 'USDC',
    fromChain: fromKey,
    toChain: toKey,
    slippage: '0.5'
  })}`;

  const response = await fetchWithTimeout(url);
  const data = await response.json();

  if (!data || typeof data.bonderFee === 'undefined') {
    throw new Error('Invalid Hop API response');
  }

  const bonderFeeWei = parseFloat(data.bonderFee || 0);
  const feeInUsd = bonderFeeWei / 1000000;
  const time = fromChain === 'ethereum' || toChain === 'ethereum' ? '7-10 min' : '3-5 min';

  return {
    name: 'Hop Protocol',
    fee: parseFloat(feeInUsd.toFixed(4)),
    gasEstimate: parseFloat((feeInUsd * 0.4).toFixed(4)),
    estimatedTime: time,
    reliability: 99.2
  };
}

// Utility: Fetch with timeout
async function fetchWithTimeout(url, timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BridgeCompare/2.0'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - API took too long to respond');
    }
    throw error;
  }
}