// Real-time market data fetching for accurate gas estimates
export async function getMarketData() {
  const cache = globalThis.__marketDataCache || {};
  const cacheExpiry = 5 * 60 * 1000; // 5 minutes
  
  // Check cache
  if (cache.data && cache.timestamp && Date.now() - cache.timestamp < cacheExpiry) {
    return cache.data;
  }

  let ethPrice = 3000; // Default fallback
  let gasPrice = 30; // Default 30 gwei
  const gasPrices = {
    ethereum: 30,
    polygon: 100,
    arbitrum: 0.1,
    optimism: 0.1,
    avalanche: 25
  };

  try {
    // Fetch ETH price from multiple sources with fallbacks
    const pricePromises = [
      fetchCoinGeckoPrice(),
      fetchCoinbasePrice(),
      fetchBinancePrice()
    ];

    const prices = await Promise.allSettled(pricePromises);
    const validPrices = prices
      .filter(p => p.status === 'fulfilled' && p.value > 0)
      .map(p => p.value);

    if (validPrices.length > 0) {
      // Use median price for accuracy
      validPrices.sort((a, b) => a - b);
      ethPrice = validPrices[Math.floor(validPrices.length / 2)];
    }

    // Fetch gas prices
    const gasData = await fetchGasPrice();
    if (gasData) {
      gasPrice = gasData.standard || gasPrice;
      
      // Update chain-specific gas prices
      if (gasData.chains) {
        Object.assign(gasPrices, gasData.chains);
      }
    }

  } catch (error) {
    console.error('Market data fetch error:', error);
  }

  const data = {
    ethPrice,
    gasPrice,
    gasPrices,
    timestamp: new Date().toISOString(),
    sources: ['coingecko', 'coinbase', 'binance']
  };

  // Update cache
  globalThis.__marketDataCache = {
    data,
    timestamp: Date.now()
  };

  return data;
}

async function fetchCoinGeckoPrice() {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (!response.ok) throw new Error('CoinGecko API error');
    
    const data = await response.json();
    return data.ethereum?.usd || 0;
  } catch (error) {
    console.warn('CoinGecko price fetch failed:', error.message);
    return 0;
  }
}

async function fetchCoinbasePrice() {
  try {
    const response = await fetch(
      'https://api.coinbase.com/v2/exchange-rates?currency=ETH',
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (!response.ok) throw new Error('Coinbase API error');
    
    const data = await response.json();
    return parseFloat(data.data?.rates?.USD) || 0;
  } catch (error) {
    console.warn('Coinbase price fetch failed:', error.message);
    return 0;
  }
}

async function fetchBinancePrice() {
  try {
    const response = await fetch(
      'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT',
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (!response.ok) throw new Error('Binance API error');
    
    const data = await response.json();
    return parseFloat(data.price) || 0;
  } catch (error) {
    console.warn('Binance price fetch failed:', error.message);
    return 0;
  }
}

async function fetchGasPrice() {
  try {
    // Use Etherscan API if key is available
    if (process.env.ETHERSCAN_API_KEY) {
      const response = await fetch(
        `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${process.env.ETHERSCAN_API_KEY}`,
        { signal: AbortSignal.timeout(5000) }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          return {
            safe: parseFloat(data.result.SafeGasPrice),
            standard: parseFloat(data.result.ProposeGasPrice),
            fast: parseFloat(data.result.FastGasPrice),
            chains: {
              ethereum: parseFloat(data.result.ProposeGasPrice)
            }
          };
        }
      }
    }

    // Fallback to ETH Gas Station
    const response = await fetch(
      'https://api.ethgasstation.info/api/fee-estimate',
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (!response.ok) throw new Error('Gas API error');
    
    const data = await response.json();
    return {
      safe: data.low?.suggestedMaxFeePerGas || 20,
      standard: data.medium?.suggestedMaxFeePerGas || 30,
      fast: data.high?.suggestedMaxFeePerGas || 40
    };
  } catch (error) {
    console.warn('Gas price fetch failed:', error.message);
    return null;
  }
}

export function estimateGasForChain(chain, gasPrice, ethPrice) {
  // Base gas units for bridge transactions
  const gasUnits = {
    ethereum: 120000,  // Higher for mainnet
    polygon: 80000,    // Lower for L2s
    arbitrum: 60000,
    optimism: 60000,
    avalanche: 80000
  };

  const units = gasUnits[chain] || 100000;
  const chainGasPrice = gasPrice[chain] || gasPrice;
  
  // Calculate gas cost in USD
  const gasCostInEth = (units * chainGasPrice) / 1e9;
  const gasCostInUsd = gasCostInEth * ethPrice;
  
  return Math.max(gasCostInUsd, 0.5); // Minimum $0.50
}