// Configuration settings for BridgeCompare
window.BridgeConfig = {
    // API Settings
    api: {
        // Cache timeout in milliseconds (5 minutes)
        cacheTimeout: 5 * 60 * 1000,
        
        // Request timeout in milliseconds (10 seconds)
        requestTimeout: 10000,
        
        // Retry attempts for failed requests
        maxRetries: 2,
        
        // Rate limiting (requests per minute)
        rateLimit: 60,
    },

    // Supported networks and their configurations
    networks: {
        ethereum: {
            name: 'Ethereum',
            chainId: 1,
            symbol: 'ETH',
            emoji: '🔵',
            rpcUrl: 'https://mainnet.infura.io/v3/',
            tokens: {
                usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
                dai: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
            }
        },
        polygon: {
            name: 'Polygon',
            chainId: 137,
            symbol: 'MATIC',
            emoji: '🟣',
            rpcUrl: 'https://polygon-rpc.com/',
            tokens: {
                usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
                usdt: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
                dai: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
            }
        },
        arbitrum: {
            name: 'Arbitrum',
            chainId: 42161,
            symbol: 'ETH',
            emoji: '🔴',
            rpcUrl: 'https://arb1.arbitrum.io/rpc',
            tokens: {
                usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
                usdt: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
                dai: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1'
            }
        },
        optimism: {
            name: 'Optimism',
            chainId: 10,
            symbol: 'ETH',
            emoji: '🔴',
            rpcUrl: 'https://mainnet.optimism.io/',
            tokens: {
                usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
                usdt: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
                dai: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1'
            }
        },
        avalanche: {
            name: 'Avalanche',
            chainId: 43114,
            symbol: 'AVAX',
            emoji: '🔺',
            rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
            tokens: {
                usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
                usdt: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
                dai: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70'
            }
        }
    },

    // Bridge configurations
    bridges: {
        stargate: {
            name: 'Stargate Finance',
            apiUrl: 'https://api.stargate.finance/api/v1/quotes',
            supportedChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche'],
            supportedTokens: ['usdc', 'usdt'],
            reliability: 99.8,
            affiliateUrl: 'https://stargate.finance?ref=bridgecompare'
        },
        across: {
            name: 'Across Protocol', 
            apiUrl: 'https://app.across.to/api/suggested-fees',
            supportedChains: ['ethereum', 'polygon', 'arbitrum', 'optimism'],
            supportedTokens: ['usdc', 'usdt', 'dai'],
            reliability: 99.9,
            affiliateUrl: 'https://across.to?ref=bridgecompare'
        },
        hop: {
            name: 'Hop Protocol',
            apiUrl: 'https://api.hop.exchange/v1/quote',
            supportedChains: ['ethereum', 'polygon', 'arbitrum', 'optimism'],
            supportedTokens: ['usdc', 'usdt', 'dai'],
            reliability: 99.2,
            affiliateUrl: 'https://app.hop.exchange?ref=bridgecompare'
        }
    },

    // UI Settings
    ui: {
        // Default amount for comparisons (USDC)
        defaultAmount: 100,
        
        // Minimum amount for bridge comparisons
        minAmount: 1,
        
        // Maximum amount for bridge comparisons
        maxAmount: 1000000,
        
        // Animation duration in milliseconds
        animationDuration: 300,
        
        // Update interval for live quotes (5 minutes)
        updateInterval: 5 * 60 * 1000,
    },

    // Analytics and tracking
    analytics: {
        enabled: false, // Set to true when Google Analytics is added
        trackingId: '', // GA tracking ID
        events: {
            bridgeComparison: 'bridge_comparison',
            bridgeSelection: 'bridge_selection',
            errorOccurred: 'api_error'
        }
    },

    // Feature flags for development
    features: {
        enableCache: true,
        enableFallback: true,
        enableAnalytics: false,
        showApiStatus: true,
        showLoadingSteps: true
    },

    // Environment settings (will be set based on deployment)
    environment: 'development', // development, staging, production

    // Version info
    version: '2.0.0',
    buildDate: new Date().toISOString(),
    
    // Contact and support
    support: {
        email: '', // Add support email when available
        github: 'https://github.com/mohammadr7204/bridge-fee-optimizer',
        discord: '', // Add Discord invite when available
    }
};