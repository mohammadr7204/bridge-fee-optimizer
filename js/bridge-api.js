/**
 * Bridge API Integration Module - PRODUCTION VERSION
 * 
 * Now uses backend API proxy instead of direct bridge API calls.
 * This solves CORS issues and enables proper tracking.
 */

class BridgeAPI {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.apiBaseUrl = window.location.origin; // Automatically uses correct domain
        this.userId = this.getUserId();
    }

    // Get or create user ID for tracking
    getUserId() {
        let userId = localStorage.getItem('bridgeCompareUserId');
        
        if (!userId) {
            userId = this.generateUserId();
            localStorage.setItem('bridgeCompareUserId', userId);
            console.log('[USER] New user ID generated:', userId);
        }
        
        return userId;
    }

    // Generate unique user ID
    generateUserId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 11);
        return `user_${timestamp}_${random}`;
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

    /**
     * Get quote from a single bridge using backend API
     * This now goes through /api/quote instead of calling bridge APIs directly
     */
    async getBridgeQuote(bridge, fromChain, toChain, amount) {
        const cacheKey = `${bridge}_${fromChain}_${toChain}_${amount}`;
        const cached = this.getCachedResult(cacheKey);
        if (cached) {
            console.log(`[CACHE HIT] ${bridge}`);
            return cached;
        }

        try {
            console.log(`[API CALL] ${bridge} via backend proxy`);
            
            // Call OUR backend instead of bridge APIs directly
            const url = `${this.apiBaseUrl}/api/quote?${new URLSearchParams({
                bridge,
                fromChain,
                toChain,
                amount: amount.toString(),
                token: 'usdc'
            })}`;

            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Backend API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Unknown error from backend');
            }

            // Format the quote data
            const quote = {
                name: data.quote.name,
                logo: bridge.charAt(0).toUpperCase(),
                fee: data.quote.fee,
                gasEstimate: data.quote.gasEstimate,
                time: data.quote.estimatedTime,
                reliability: data.quote.reliability,
                affiliateUrl: `https://${bridge}.com?ref=bridgecompare`, // Will be replaced by track-click
                cached: data.cached || false
            };

            this.setCachedResult(cacheKey, quote);
            return quote;

        } catch (error) {
            console.error(`[ERROR] ${bridge} API call failed:`, error.message);
            throw error;
        }
    }

    /**
     * Get quotes from all available bridges
     * Now uses backend API for all calls
     */
    async getAllQuotes(fromChain, toChain, amount) {
        const quotes = [];
        const errors = [];

        // Try each bridge through the backend
        const bridges = ['stargate', 'across', 'hop'];

        const promises = bridges.map(async (bridge) => {
            try {
                const quote = await this.getBridgeQuote(bridge, fromChain, toChain, amount);
                quotes.push(quote);
            } catch (error) {
                errors.push({ bridge, error: error.message });
            }
        });

        await Promise.allSettled(promises);

        // Only use fallback if ALL bridges failed
        if (quotes.length === 0) {
            console.warn('[FALLBACK] All API calls failed, using mock data');
            quotes.push(...this.getFallbackData(fromChain, toChain, amount));
        }

        return {
            quotes: quotes.sort((a, b) => (a.fee + a.gasEstimate) - (b.fee + b.gasEstimate)),
            errors
        };
    }

    /**
     * Track affiliate click and get tracking URL
     * Called when user selects a bridge
     */
    async trackClick(bridge, fromChain, toChain, amount) {
        try {
            console.log('[TRACKING] Recording click for', bridge);

            const response = await fetch(`${this.apiBaseUrl}/api/track-click`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    bridge,
                    fromChain,
                    toChain,
                    amount,
                    userId: this.userId
                })
            });

            if (!response.ok) {
                throw new Error(`Tracking failed: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Tracking failed');
            }

            console.log('[TRACKING] Click tracked successfully:', data.trackingId);
            return data.affiliateUrl;

        } catch (error) {
            console.error('[TRACKING ERROR]', error.message);
            
            // Even if tracking fails, return a basic affiliate URL
            const fallbackUrls = {
                stargate: 'https://stargate.finance/transfer?ref=bridgecompare',
                across: 'https://across.to?ref=bridgecompare',
                hop: 'https://app.hop.exchange/send?ref=bridgecompare'
            };
            
            return fallbackUrls[bridge.toLowerCase()] || `https://${bridge}.com?ref=bridgecompare`;
        }
    }

    /**
     * Fallback mock data for development/testing
     * Only used if all APIs fail
     */
    getFallbackData(fromChain, toChain, amount) {
        console.warn('[FALLBACK] Using mock data - APIs are down');
        
        const mockBridges = [
            {
                name: 'Bridge Service 1',
                logo: 'B',
                fee: (amount * 0.003),
                gasEstimate: (amount * 0.002),
                time: '5 min',
                reliability: 99.5,
                affiliateUrl: '#'
            },
            {
                name: 'Bridge Service 2',
                logo: 'B',
                fee: (amount * 0.004),
                gasEstimate: (amount * 0.0015),
                time: '3 min',
                reliability: 99.8,
                affiliateUrl: '#'
            }
        ];

        return mockBridges;
    }
}

// Export for use in main application
window.BridgeAPI = BridgeAPI;