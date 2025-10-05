/**
 * Updated selectBridge function with proper click tracking
 * Add this to index.html to replace the existing selectBridge function
 */

// Store current selection context for tracking
let currentSelection = null;

async function selectBridge(bridge, fromChain, toChain, amount) {
    try {
        console.log(`[USER ACTION] Selected ${bridge}`);
        
        // Show loading state
        const confirmMessage = `🚀 Opening ${bridge}...\n\nTracking your selection to help us improve the service.`;
        
        if (!confirm(confirmMessage)) {
            return; // User cancelled
        }

        // Track the click and get the tracking URL
        const trackingUrl = await bridgeAPI.trackClick(
            bridge.toLowerCase().replace(' ', ''),
            fromChain,
            toChain,
            amount
        );

        // Open the tracked URL
        console.log(`[REDIRECT] Opening: ${trackingUrl}`);
        window.open(trackingUrl, '_blank');

    } catch (error) {
        console.error('[SELECTION ERROR]', error);
        
        // Even if tracking fails, still allow the user to proceed
        alert('Having trouble tracking this click, but you can still proceed to the bridge.');
        
        // Fallback: open basic affiliate URL
        const fallbackUrls = {
            'stargate finance': 'https://stargate.finance/transfer?ref=bridgecompare',
            'across protocol': 'https://across.to?ref=bridgecompare',
            'hop protocol': 'https://app.hop.exchange/send?ref=bridgecompare'
        };
        
        const url = fallbackUrls[bridge.toLowerCase()] || '#';
        if (url !== '#') {
            window.open(url, '_blank');
        }
    }
}