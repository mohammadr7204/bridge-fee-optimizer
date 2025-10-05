// Backend API proxy to handle CORS and aggregate bridge quotes

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { fromChain, toChain, amount, bridge } = req.query;

  if (!fromChain || !toChain || !amount) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const quotes = [];
  const errors = [];

  // Helper function to safely fetch with timeout
  async function fetchWithTimeout(url, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Stargate Finance Quote
  async function getStargateQuote() {
    try {
      const tokenMapping = {
        'ethereum': { chainKey: 'ethereum', usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
        'polygon': { chainKey: 'polygon', usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
        'arbitrum': { chainKey: 'arbitrum', usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
        'optimism': { chainKey: 'optimism', usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' },
        'avalanche': { chainKey: 'avalanche', usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E' }
      };

      const fromToken = tokenMapping[fromChain];
      const toToken = tokenMapping[toChain];
      
      if (!fromToken || !toToken) {
        throw new Error('Chain not supported by Stargate');
      }

      const amountInWei = Math.floor(parseFloat(amount) * 1000000);
      
      const response = await fetchWithTimeout(`https://api.stargate.finance/api/v1/quotes?` + new URLSearchParams({
        srcToken: fromToken.usdc,
        dstToken: toToken.usdc,
        srcChainKey: fromToken.chainKey,
        dstChainKey: toToken.chainKey,
        srcAmount: amountInWei.toString(),
        dstAmountMin: Math.floor(amountInWei * 0.99).toString()
      }));

      if (!response.ok) {
        throw new Error(`Stargate API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.quotes || data.quotes.length === 0) {
        throw new Error('No Stargate routes available');
      }

      const quote = data.quotes[0];
      const totalFees = quote.fees ? quote.fees.reduce((sum, fee) => sum + parseFloat(fee.amount || 0), 0) : 0;
      
      // Get real gas estimate from quote data
      const gasEstimate = quote.estimatedGas ? parseFloat(quote.estimatedGas) * 0.000000001 * 3000 : 5; // Convert gwei to USD
      const feeInUsd = totalFees / 1e18 * 3000; // Convert ETH to USD (approximate)

      return {
        name: 'Stargate Finance',
        logo: 'S',
        fee: Math.max(feeInUsd, parseFloat(amount) * 0.001), // Minimum 0.1% fee
        gasEstimate: gasEstimate,
        time: '2-3 min',
        reliability: 99.8,
        affiliateUrl: `https://stargate.finance/transfer?ref=bridgecompare&from=${fromChain}&to=${toChain}&amount=${amount}`,
        source: 'live',
        rawData: quote
      };
    } catch (error) {
      console.error('Stargate error:', error.message);
      throw error;
    }
  }

  // Across Protocol Quote
  async function getAcrossQuote() {
    try {
      const chainMapping = {
        'ethereum': 1,
        'polygon': 137,
        'arbitrum': 42161,
        'optimism': 10
      };

      const tokenMapping = {
        'ethereum': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        'polygon': '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        'arbitrum': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        'optimism': '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'
      };

      const originChainId = chainMapping[fromChain];
      const destinationChainId = chainMapping[toChain];
      const inputToken = tokenMapping[fromChain];
      const outputToken = tokenMapping[toChain];

      if (!originChainId || !destinationChainId || !inputToken || !outputToken) {
        throw new Error('Chain not supported by Across');
      }

      const amountInWei = Math.floor(parseFloat(amount) * 1000000);

      const response = await fetchWithTimeout('https://app.across.to/api/suggested-fees?' + new URLSearchParams({
        inputToken,
        outputToken,
        originChainId: originChainId.toString(),
        destinationChainId: destinationChainId.toString(),
        amount: amountInWei.toString()
      }));

      if (!response.ok) {
        throw new Error(`Across API error: ${response.status}`);
      }

      const data = await response.json();
      
      const totalFeeWei = data.totalRelayFee?.total ? parseFloat(data.totalRelayFee.total) : 0;
      const feeInUsd = (totalFeeWei / 1000000) * 1;
      const gasEstimate = data.estimatedFillTimeSec ? 3 : 5; // Lower gas for faster fills

      return {
        name: 'Across Protocol',
        logo: 'A',
        fee: Math.max(feeInUsd, parseFloat(amount) * 0.001),
        gasEstimate: gasEstimate,
        time: data.estimatedFillTimeSec ? `${Math.round(data.estimatedFillTimeSec)} sec` : '30 sec',
        reliability: 99.9,
        affiliateUrl: `https://across.to/bridge?ref=bridgecompare&from=${originChainId}&to=${destinationChainId}&amount=${amount}`,
        source: 'live',
        rawData: data
      };
    } catch (error) {
      console.error('Across error:', error.message);
      throw error;
    }
  }

  // Hop Protocol Quote
  async function getHopQuote() {
    try {
      const chainMapping = {
        'ethereum': 'ethereum',
        'polygon': 'polygon',
        'arbitrum': 'arbitrum',
        'optimism': 'optimism'
      };

      const fromChainKey = chainMapping[fromChain];
      const toChainKey = chainMapping[toChain];

      if (!fromChainKey || !toChainKey) {
        throw new Error('Chain not supported by Hop');
      }

      const amountInWei = Math.floor(parseFloat(amount) * 1000000);

      const response = await fetchWithTimeout(`https://api.hop.exchange/v1/quote?` + new URLSearchParams({
        amount: amountInWei.toString(),
        token: 'USDC',
        fromChain: fromChainKey,
        toChain: toChainKey,
        slippage: '0.5'
      }));

      if (!response.ok) {
        throw new Error(`Hop API error: ${response.status}`);
      }

      const data = await response.json();
      
      const bonderFeeWei = data.bonderFee ? parseFloat(data.bonderFee) : 0;
      const feeInUsd = (bonderFeeWei / 1000000) * 1;
      const estimatedTime = fromChain === 'ethereum' || toChain === 'ethereum' ? '7-10 min' : '3-5 min';
      const gasEstimate = data.destinationTxFee ? parseFloat(data.destinationTxFee) / 1000000 : 6;

      return {
        name: 'Hop Protocol',
        logo: 'H',
        fee: Math.max(feeInUsd, parseFloat(amount) * 0.001),
        gasEstimate: gasEstimate,
        time: estimatedTime,
        reliability: 99.2,
        affiliateUrl: `https://app.hop.exchange/#/send?ref=bridgecompare&sourceNetwork=${fromChainKey}&destNetwork=${toChainKey}&token=USDC&amount=${amount}`,
        source: 'live',
        rawData: data
      };
    } catch (error) {
      console.error('Hop error:', error.message);
      throw error;
    }
  }

  // Get quotes based on bridge parameter or all
  if (bridge === 'stargate') {
    try {
      const quote = await getStargateQuote();
      quotes.push(quote);
    } catch (error) {
      errors.push({ bridge: 'Stargate', error: error.message });
    }
  } else if (bridge === 'across') {
    try {
      const quote = await getAcrossQuote();
      quotes.push(quote);
    } catch (error) {
      errors.push({ bridge: 'Across', error: error.message });
    }
  } else if (bridge === 'hop') {
    try {
      const quote = await getHopQuote();
      quotes.push(quote);
    } catch (error) {
      errors.push({ bridge: 'Hop', error: error.message });
    }
  } else {
    // Get all quotes in parallel
    const promises = [
      getStargateQuote().catch(e => errors.push({ bridge: 'Stargate', error: e.message })),
      getAcrossQuote().catch(e => errors.push({ bridge: 'Across', error: e.message })),
      getHopQuote().catch(e => errors.push({ bridge: 'Hop', error: e.message }))
    ];

    const results = await Promise.allSettled(promises);
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        quotes.push(result.value);
      }
    });
  }

  // Sort by total cost
  quotes.sort((a, b) => (a.fee + a.gasEstimate) - (b.fee + b.gasEstimate));

  res.status(200).json({
    success: true,
    quotes,
    errors,
    timestamp: new Date().toISOString(),
    cached: false
  });
}
