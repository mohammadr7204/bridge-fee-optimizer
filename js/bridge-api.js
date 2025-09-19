// Bridge API Integration Module
class BridgeAPI {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    // Get cached result if available and not expired
    getCachedResult(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    // Cache API result
    setCachedResult(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    // Stargate Finance API Integration
    async getStargateQuote(fromChain, toChain, amount) {
        const cacheKey = `stargate_${fromChain}_${toChain}_${amount}`;
        const cached = this.getCachedResult(cacheKey);
        if (cached) return cached;

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

            const amountInWei = Math.floor(amount * 1000000); // USDC has 6 decimals

            const response = await fetch(`https://api.stargate.finance/api/v1/quotes?` + new URLSearchParams({
                srcToken: fromToken.usdc,
                dstToken: toToken.usdc,
                srcChainKey: fromToken.chainKey,
                dstChainKey: toToken.chainKey,
                srcAmount: amountInWei.toString(),
                dstAmountMin: Math.floor(amountInWei * 0.99).toString() // 1% slippage
            }));

            if (!response.ok) {
                throw new Error(`Stargate API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.quotes || data.quotes.length === 0) {
                throw new Error('No Stargate routes available');
            }

            const quote = data.quotes[0];
            const totalFees = quote.fees.reduce((sum, fee) => sum + parseFloat(fee.amount), 0);
            const feeInUsd = totalFees / 1e18 * 3000; // Approximate ETH price conversion

            const result = {
                name: 'Stargate Finance',
                logo: 'S',
                fee: feeInUsd,
                gasEstimate: feeInUsd * 0.3, // Estimate gas as 30% of total fees
                time: '2-3 min',
                reliability: 99.8,
                affiliateUrl: 'https://stargate.finance?ref=bridgecompare',
                rawData: quote
            };

            this.setCachedResult(cacheKey, result);
            return result;

        } catch (error) {
            console.warn('Stargate API failed:', error.message);
            throw error;
        }
    }

    // Across Protocol API Integration
    async getAcrossQuote(fromChain, toChain, amount) {
        const cacheKey = `across_${fromChain}_${toChain}_${amount}`;
        const cached = this.getCachedResult(cacheKey);
        if (cached) return cached;

        try {
            const chainMapping = {
                'ethereum': 1,
                'polygon': 137,
                'arbitrum': 42161,
                'optimism': 10,
                'avalanche': 43114
            };

            const tokenMapping = {
                'ethereum': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
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

            const amountInWei = Math.floor(amount * 1000000); // USDC has 6 decimals

            const response = await fetch('https://app.across.to/api/suggested-fees?' + new URLSearchParams({
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
            
            if (!data || typeof data.totalRelayFee === 'undefined') {
                throw new Error('Invalid Across API response');
            }

            const totalFeeWei = parseFloat(data.totalRelayFee.total);
            const feeInUsd = (totalFeeWei / 1000000) * 1; // Convert from USDC wei to USD

            const result = {
                name: 'Across Protocol',
                logo: 'A',
                fee: feeInUsd,
                gasEstimate: feeInUsd * 0.2, // Lower gas costs
                time: '30 sec',
                reliability: 99.9,
                affiliateUrl: 'https://across.to?ref=bridgecompare',
                rawData: data
            };

            this.setCachedResult(cacheKey, result);
            return result;

        } catch (error) {
            console.warn('Across API failed:', error.message);
            throw error;
        }
    }

    // Hop Protocol API Integration  
    async getHopQuote(fromChain, toChain, amount) {
        const cacheKey = `hop_${fromChain}_${toChain}_${amount}`;
        const cached = this.getCachedResult(cacheKey);
        if (cached) return cached;

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

            const amountInWei = Math.floor(amount * 1000000); // USDC has 6 decimals

            const response = await fetch(`https://api.hop.exchange/v1/quote?` + new URLSearchParams({
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
            
            if (!data || typeof data.bonderFee === 'undefined') {
                throw new Error('Invalid Hop API response');
            }

            const bonderFeeWei = parseFloat(data.bonderFee);
            const feeInUsd = (bonderFeeWei / 1000000) * 1; // Convert from USDC wei to USD
            const estimatedTime = fromChain === 'ethereum' || toChain === 'ethereum' ? '7-10 min' : '3-5 min';

            const result = {
                name: 'Hop Protocol',
                logo: 'H', 
                fee: feeInUsd,
                gasEstimate: feeInUsd * 0.4,
                time: estimatedTime,
                reliability: 99.2,
                affiliateUrl: 'https://app.hop.exchange?ref=bridgecompare',
                rawData: data
            };

            this.setCachedResult(cacheKey, result);
            return result;

        } catch (error) {
            console.warn('Hop API failed:', error.message);
            throw error;
        }
    }

    // Get quotes from all available bridges
    async getAllQuotes(fromChain, toChain, amount) {
        const quotes = [];
        const errors = [];

        // Try each bridge API
        const bridges = [
            { name: 'Stargate', fn: () => this.getStargateQuote(fromChain, toChain, amount) },
            { name: 'Across', fn: () => this.getAcrossQuote(fromChain, toChain, amount) },
            { name: 'Hop', fn: () => this.getHopQuote(fromChain, toChain, amount) }
        ];

        const promises = bridges.map(async (bridge) => {
            try {
                const quote = await bridge.fn();
                quotes.push(quote);
            } catch (error) {
                errors.push({ bridge: bridge.name, error: error.message });
            }
        });

        await Promise.allSettled(promises);

        // Add fallback mock data if no APIs worked (for development)
        if (quotes.length === 0) {
            console.warn('All APIs failed, using fallback data');
            quotes.push(...this.getFallbackData(fromChain, toChain, amount));
        }

        return {
            quotes: quotes.sort((a, b) => (a.fee + a.gasEstimate) - (b.fee + b.gasEstimate)),
            errors
        };
    }

    // Fallback mock data for development
    getFallbackData(fromChain, toChain, amount) {
        const mockData = {
            'ethereum-polygon': [
                {
                    name: 'Polygon Bridge',
                    logo: 'P',
                    fee: 8.90,
                    gasEstimate: 4.10,
                    time: '8-10 min',
                    reliability: 99.5,
                    affiliateUrl: 'https://wallet.polygon.technology/bridge?ref=bridgecompare'
                }
            ],
            'ethereum-arbitrum': [
                {
                    name: 'Arbitrum Bridge',
                    logo: 'A',
                    fee: 5.20,
                    gasEstimate: 2.80,
                    time: '7-10 min',
                    reliability: 99.9,
                    affiliateUrl: 'https://bridge.arbitrum.io?ref=bridgecompare'
                }
            ]
        };

        const routeData = mockData[`${fromChain}-${toChain}`] || [];
        return routeData.map(bridge => ({
            ...bridge,
            fee: (bridge.fee / 1000) * amount,
            gasEstimate: (bridge.gasEstimate / 1000) * amount
        }));
    }
}

// Export for use in main application
window.BridgeAPI = BridgeAPI;