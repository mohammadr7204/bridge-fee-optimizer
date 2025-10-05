// Bridge API Integration Module - Production Ready with Backend
class BridgeAPI {
    constructor() {
        // Use backend API to avoid CORS issues
        this.baseUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000' 
            : '';
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    // Get cached result if available and not expired
    getCachedResult(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            console.log('Using cached result for:', key);
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

    // Get quotes from all bridges through backend API
    async getAllQuotes(fromChain, toChain, amount) {
        const cacheKey = `all_${fromChain}_${toChain}_${amount}`;
        const cached = this.getCachedResult(cacheKey);
        if (cached) return cached;

        try {
            // Call backend API which handles CORS
            const response = await fetch(`${this.baseUrl}/api/quote?` + new URLSearchParams({
                fromChain,
                toChain,
                amount: amount.toString()
            }), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(15000) // 15 second timeout
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            
            const result = {
                quotes: data.quotes || [],
                errors: data.errors || []
            };

            // Cache successful result
            if (result.quotes.length > 0) {
                this.setCachedResult(cacheKey, result);
            }

            return result;

        } catch (error) {
            console.error('Failed to fetch quotes:', error);
            
            // Try to use cached data even if expired
            const expiredCache = this.cache.get(cacheKey);
            if (expiredCache) {
                console.log('Using expired cache due to error');
                return expiredCache.data;
            }

            // Return fallback data as last resort
            return {
                quotes: this.getFallbackData(fromChain, toChain, amount),
                errors: [{ bridge: 'API', error: error.message }]
            };
        }
    }

    // Track affiliate click through backend
    async trackClick(bridge, url, fromChain, toChain, amount) {
        try {
            const response = await fetch(`${this.baseUrl}/api/track-click`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    bridge,
                    url,
                    fromChain,
                    toChain,
                    amount: parseFloat(amount) || 0
                })
            });

            if (!response.ok) {
                throw new Error(`Tracking error: ${response.status}`);
            }

            const data = await response.json();
            console.log('Click tracked:', data.trackingId);
            return data.redirectUrl || url;

        } catch (error) {
            console.error('Failed to track click:', error);
            // Fallback to basic URL with ref parameter
            return `${url}${url.includes('?') ? '&' : '?'}ref=bridgecompare`;
        }
    }

    // Check API health status
    async checkHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/api/health`, {
                signal: AbortSignal.timeout(5000)
            });
            
            if (!response.ok) {
                throw new Error(`Health check failed: ${response.status}`);
            }

            const data = await response.json();
            return data;

        } catch (error) {
            console.error('Health check failed:', error);
            return {
                status: 'unknown',
                error: error.message
            };
        }
    }

    // Fallback data for development/testing
    getFallbackData(fromChain, toChain, amount) {
        console.warn('Using fallback data - API unavailable');
        
        const routes = {
            'ethereum-polygon': [
                {
                    name: 'Stargate Finance',
                    logo: 'S',
                    fee: amount * 0.001,
                    gasEstimate: 5,
                    time: '2-3 min',
                    reliability: 99.8,
                    affiliateUrl: 'https://stargate.finance?ref=bridgecompare',
                    source: 'fallback'
                },
                {
                    name: 'Across Protocol',
                    logo: 'A',
                    fee: amount * 0.0008,
                    gasEstimate: 3,
                    time: '30 sec',
                    reliability: 99.9,
                    affiliateUrl: 'https://across.to?ref=bridgecompare',
                    source: 'fallback'
                }
            ],
            'ethereum-arbitrum': [
                {
                    name: 'Hop Protocol',
                    logo: 'H',
                    fee: amount * 0.0012,
                    gasEstimate: 6,
                    time: '7-10 min',
                    reliability: 99.2,
                    affiliateUrl: 'https://app.hop.exchange?ref=bridgecompare',
                    source: 'fallback'
                }
            ]
        };

        const key = `${fromChain}-${toChain}`;
        const reverseKey = `${toChain}-${fromChain}`;
        
        return routes[key] || routes[reverseKey] || [{
            name: 'Mock Bridge',
            logo: 'M',
            fee: amount * 0.001,
            gasEstimate: 5,
            time: '5 min',
            reliability: 95,
            affiliateUrl: '#',
            source: 'fallback'
        }];
    }

    // Format display amount
    formatUSD(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    // Calculate savings
    calculateSavings(quotes) {
        if (quotes.length < 2) return null;
        
        const costs = quotes.map(q => q.fee + q.gasEstimate);
        const bestPrice = Math.min(...costs);
        const worstPrice = Math.max(...costs);
        const savings = worstPrice - bestPrice;
        const savingsPercent = ((savings / worstPrice) * 100).toFixed(1);
        
        return {
            amount: savings,
            percent: savingsPercent,
            formatted: this.formatUSD(savings)
        };
    }
}

// Export for use in main application
window.BridgeAPI = BridgeAPI;
