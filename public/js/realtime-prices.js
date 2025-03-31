// public/js/realtime-prices.js

/**
 * FinTrack Real-time Price Client
 * 
 * This script provides functionality to fetch and display real-time
 * price data for various asset types including stocks, crypto, and metals.
 */

const RealtimePrices = (function() {
    // Private variables
    let refreshInterval = null;
    let REFRESH_RATE = 5000; // 5 second refresh rate for true real-time updates
    let priceCache = {};
    let assetMappings = {};
    
    /**
     * Initialize the real-time price system
     * @param {Object} config - Configuration options
     */
    function init(config = {}) {
      // Apply configuration
      if (config.refreshRate) {
        REFRESH_RATE = config.refreshRate;
      }
      
      // Load asset mappings
      loadAssetMappings();
      
      // Start auto-refresh if specified
      if (config.autoRefresh) {
        startAutoRefresh();
      }
    }
    
    /**
     * Load asset mappings from the server
     */
    async function loadAssetMappings() {
      try {
        const response = await fetch('/api/assets/mappings');
        if (response.ok) {
          const data = await response.json();
          assetMappings = data;
        }
      } catch (error) {
        console.warn('Could not load asset mappings:', error);
        // Use defaults
        assetMappings = {
          // Crypto
          'BTC': { type: 'crypto', name: 'Bitcoin' },
          'ETH': { type: 'crypto', name: 'Ethereum' },
          'USDT': { type: 'crypto', name: 'Tether' },
          'XRP': { type: 'crypto', name: 'Ripple' },
          'SOL': { type: 'crypto', name: 'Solana' },
          
          // Stocks
          'AAPL': { type: 'stock', name: 'Apple Inc.' },
          'NVDA': { type: 'stock', name: 'NVIDIA Corporation' },
          'TSLA': { type: 'stock', name: 'Tesla Inc.' },
          
          // ETFs (Metals)
          'GLD': { type: 'etf', name: 'SPDR Gold Shares' },
          'SLV': { type: 'etf', name: 'iShares Silver Trust' }
        };
      }
    }
    
    /**
     * Start auto-refresh of prices
     */
    function startAutoRefresh() {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      
      refreshInterval = setInterval(() => {
        refreshAllPrices();
      }, REFRESH_RATE);
      
      console.log(`Auto-refresh started with ${REFRESH_RATE/1000} second interval`);
    }
    
    /**
     * Stop auto-refresh of prices
     */
    function stopAutoRefresh() {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
        console.log('Auto-refresh stopped');
      }
    }
    
    /**
     * Refresh all price displays on the page
     */
    function refreshAllPrices() {
      // Find all elements with the data-price-symbol attribute
      const priceElements = document.querySelectorAll('[data-price-symbol]');
      
      // Group symbols to batch API calls
      const symbols = new Set();
      priceElements.forEach(el => {
        const symbol = el.getAttribute('data-price-symbol');
        if (symbol) {
          symbols.add(symbol);
        }
      });
      
      // If we have symbols to update, fetch their prices
      if (symbols.size > 0) {
        const assetList = [...symbols].map(symbol => {
          const assetType = assetMappings[symbol]?.type || 
                          determineAssetType(symbol);
          return { symbol, assetType };
        });
        
        // Fetch prices in batch
        fetchBatchPrices(assetList)
          .then(priceData => {
            // Update elements with the new price data
            priceElements.forEach(el => {
              const symbol = el.getAttribute('data-price-symbol');
              if (priceData[symbol]) {
                updatePriceElement(el, priceData[symbol]);
              }
            });
          })
          .catch(error => {
            console.error('Error refreshing prices:', error);
          });
      }
    }
    
    /**
     * Determine asset type based on symbol format
     * @param {string} symbol - Asset symbol
     * @returns {string} - Asset type
     */
    function determineAssetType(symbol) {
      // Logic to guess asset type based on symbol
      if (['BTC', 'ETH', 'XRP', 'USDT', 'SOL'].includes(symbol)) {
        return 'crypto';
      } else if (['GLD', 'SLV'].includes(symbol)) {
        return 'etf';
      } else if (['EUR', 'USD', 'GBP', 'BGN'].includes(symbol)) {
        return 'forex';
      } else {
        return 'stock'; // Default
      }
    }
    
    /**
     * Fetch price for a single asset
     * @param {string} symbol - Asset symbol
     * @param {string} assetType - Asset type (stock, crypto, forex, etc.)
     * @returns {Promise<Object>} - Price data
     */
    async function fetchPrice(symbol, assetType) {
      try {
        // Check cache first
        const cacheKey = `${symbol}_${assetType}`;
        const now = new Date();
        const cacheItem = priceCache[cacheKey];
        
        // Use cache if it's less than 3 seconds old (minimal caching for true real-time)
        if (cacheItem && (now - cacheItem.timestamp) < 3000) {
          return cacheItem.data;
        }
        
        // If not in cache or cache expired, fetch from API
        const response = await fetch(`/api/realtime-prices/${symbol}?type=${assetType}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch price for ${symbol}`);
        }
        
        const data = await response.json();
        
        // Update cache
        priceCache[cacheKey] = {
          data: data.data,
          timestamp: now
        };
        
        return data.data;
      } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error);
        throw error;
      }
    }
    
    /**
     * Fetch prices for multiple assets in batch
     * @param {Array<Object>} assets - Array of asset objects with symbol and assetType
     * @returns {Promise<Object>} - Object mapping symbols to price data
     */
    async function fetchBatchPrices(assets) {
      try {
        // Check if we need to actually make the API call
        // or if we can use cached data for all assets
        const now = new Date();
        const needFetch = assets.some(asset => {
          const cacheKey = `${asset.symbol}_${asset.assetType}`;
          const cacheItem = priceCache[cacheKey];
          return !cacheItem || (now - cacheItem.timestamp) >= 3000;
        });
        
        // If all data is in cache and fresh, use that
        if (!needFetch) {
          console.log('Using cached price data for all assets');
          const result = {};
          assets.forEach(asset => {
            const cacheKey = `${asset.symbol}_${asset.assetType}`;
            result[asset.symbol] = priceCache[cacheKey].data;
          });
          return result;
        }
        
        // Otherwise, make the API call
        const response = await fetch('/api/realtime-prices/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ assets })
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch batch prices');
        }
        
        const data = await response.json();
        
        // Update cache
        if (data.success && data.data) {
          Object.keys(data.data).forEach(symbol => {
            const asset = assets.find(a => a.symbol === symbol);
            if (asset) {
              const cacheKey = `${symbol}_${asset.assetType}`;
              priceCache[cacheKey] = {
                data: data.data[symbol],
                timestamp: now
              };
            }
          });
        }
        
        return data.data || {};
      } catch (error) {
        console.error('Error fetching batch prices:', error);
        throw error;
      }
    }
    
    /**
     * Update a price element with new data
     * @param {HTMLElement} element - The DOM element to update
     * @param {Object} priceData - Price data from API
     */
    function updatePriceElement(element, priceData) {
      // Basic validation
      if (!element || !priceData) return;
      
      // Check what type of display the element wants
      const displayType = element.getAttribute('data-price-display') || 'price';
      
      // Get formatting options
      const format = element.getAttribute('data-price-format') || 'default';
      const showChange = element.getAttribute('data-show-change') !== 'false';
      const showCurrency = element.getAttribute('data-show-currency') !== 'false';
      
      // Format price based on display type
      let displayValue = '';
      let changeClass = '';
      
      switch (displayType) {
        case 'price':
          displayValue = formatPrice(priceData.price, format, priceData.currency, showCurrency);
          break;
        
        case 'change':
          displayValue = formatChange(priceData.change, format);
          changeClass = priceData.change >= 0 ? 'positive' : 'negative';
          break;
        
        case 'change-percent':
          displayValue = formatChangePercent(priceData.changePercent, format);
          changeClass = priceData.changePercent >= 0 ? 'positive' : 'negative';
          break;
        
        case 'full':
          // Full display shows price and change
          const priceString = formatPrice(priceData.price, format, priceData.currency, showCurrency);
          const changeString = showChange ? 
            ` (${formatChangePercent(priceData.changePercent, format)})` : '';
          
          displayValue = `${priceString}${changeString}`;
          changeClass = priceData.changePercent >= 0 ? 'positive' : 'negative';
          break;
        
        default:
          displayValue = formatPrice(priceData.price, format, priceData.currency, showCurrency);
          break;
      }
      
      // Update the element
      element.textContent = displayValue;
      
      // Add/remove classes for styling based on change direction
      if (changeClass) {
        element.classList.remove('positive', 'negative');
        if (changeClass !== 'neutral') {
          element.classList.add(changeClass);
        }
      }
      
      // Add timestamp as data attribute
      element.setAttribute('data-price-updated', new Date().toISOString());
      
      // Dispatch event that price was updated
      element.dispatchEvent(new CustomEvent('priceUpdated', { 
        detail: priceData,
        bubbles: true
      }));
    }
    
    /**
     * Format price value
     * @param {number} price - Price value
     * @param {string} format - Format type
     * @param {string} currency - Currency code
     * @param {boolean} showCurrency - Whether to show currency symbol
     * @returns {string} - Formatted price
     */
    function formatPrice(price, format, currency = 'USD', showCurrency = true) {
      if (price === null || price === undefined || isNaN(price)) {
        return 'N/A';
      }
      
      // Get currency symbol
      const currencySymbol = getCurrencySymbol(currency);
      const prefix = showCurrency ? currencySymbol : '';
      
      // Handle formatting
      switch (format) {
        case 'compact':
          // Compact format for large numbers (e.g., 1.5K, 2.3M)
          return `${prefix}${compactNumber(price)}`;
        
        case 'precise':
          // More decimal places for small values like crypto
          return `${prefix}${formatPreciseNumber(price)}`;
        
        case 'integer':
          // No decimal places
          return `${prefix}${Math.round(price).toLocaleString()}`;
        
        case 'default':
        default:
          // Default format with 2 decimal places
          return `${prefix}${price.toLocaleString(undefined, { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          })}`;
      }
    }
    
    /**
     * Format change value
     * @param {number} change - Change value
     * @param {string} format - Format type
     * @returns {string} - Formatted change
     */
    function formatChange(change, format) {
      if (change === null || change === undefined || isNaN(change)) {
        return 'N/A';
      }
      
      const prefix = change >= 0 ? '+' : '';
      
      switch (format) {
        case 'compact':
          return `${prefix}${compactNumber(change)}`;
        
        case 'precise':
          return `${prefix}${formatPreciseNumber(change)}`;
        
        case 'default':
        default:
          return `${prefix}${change.toLocaleString(undefined, { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          })}`;
      }
    }
    
    /**
     * Format change percentage
     * @param {number} percentChange - Percentage change
     * @param {string} format - Format type
     * @returns {string} - Formatted percentage
     */
    function formatChangePercent(percentChange, format) {
      if (percentChange === null || percentChange === undefined || isNaN(percentChange)) {
        return 'N/A';
      }
      
      const prefix = percentChange >= 0 ? '+' : '';
      
      switch (format) {
        case 'precise':
          return `${prefix}${percentChange.toFixed(3)}%`;
        
        case 'default':
        default:
          return `${prefix}${percentChange.toFixed(2)}%`;
      }
    }
    
    /**
     * Format a number with appropriate precision based on its magnitude
     * @param {number} num - Number to format
     * @returns {string} - Formatted number
     */
    function formatPreciseNumber(num) {
      const absNum = Math.abs(num);
      
      if (absNum === 0) {
        return '0';
      } else if (absNum < 0.0001) {
        return num.toExponential(4);
      } else if (absNum < 0.01) {
        return num.toFixed(6);
      } else if (absNum < 1) {
        return num.toFixed(4);
      } else if (absNum < 10) {
        return num.toFixed(3);
      } else if (absNum < 100) {
        return num.toFixed(2);
      } else {
        return num.toLocaleString(undefined, { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        });
      }
    }
    
    /**
     * Format a number in compact notation (e.g., 1.5K, 2.3M)
     * @param {number} num - Number to format
     * @returns {string} - Formatted number
     */
    function compactNumber(num) {
      const absNum = Math.abs(num);
      
      if (absNum < 1000) {
        return num.toLocaleString(undefined, { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        });
      } else if (absNum < 1000000) {
        return (num / 1000).toLocaleString(undefined, { 
          minimumFractionDigits: 1, 
          maximumFractionDigits: 1 
        }) + 'K';
      } else if (absNum < 1000000000) {
        return (num / 1000000).toLocaleString(undefined, { 
          minimumFractionDigits: 1, 
          maximumFractionDigits: 1 
        }) + 'M';
      } else {
        return (num / 1000000000).toLocaleString(undefined, { 
          minimumFractionDigits: 1, 
          maximumFractionDigits: 1 
        }) + 'B';
      }
    }
    
    /**
     * Get currency symbol for a currency code
     * @param {string} currencyCode - Currency code (USD, EUR, etc.)
     * @returns {string} - Currency symbol
     */
    function getCurrencySymbol(currencyCode) {
      const currencySymbols = {
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'BGN': 'лв',
        'JPY': '¥',
        'CNY': '¥',
        'BTC': '₿'
      };
      
      return currencySymbols[currencyCode] || currencyCode;
    }
    
    /**
     * Update investment prices on a table
     * @param {string} tableSelector - CSS selector for the table
     * @param {string} symbolColumn - Column index or data attribute for symbol
     * @param {string} priceColumn - Column index or data attribute for price
     * @param {string} changeColumn - Column index or data attribute for change (optional)
     */
    async function updateTablePrices(tableSelector, symbolColumn, priceColumn, changeColumn) {
      try {
        const table = document.querySelector(tableSelector);
        if (!table) return;
        
        const rows = table.querySelectorAll('tbody tr');
        if (rows.length === 0) return;
        
        // Collect symbols to fetch
        const symbols = [];
        rows.forEach(row => {
          let symbol;
          
          // Handle various ways to find the symbol
          if (typeof symbolColumn === 'number') {
            // Column index
            symbol = row.cells[symbolColumn]?.textContent?.trim();
          } else if (symbolColumn.startsWith('data-')) {
            // Data attribute
            symbol = row.getAttribute(symbolColumn);
          } else {
            // CSS selector
            const element = row.querySelector(symbolColumn);
            symbol = element?.textContent?.trim();
          }
          
          // Clean symbol if needed
          if (symbol) {
            // Remove any currency or non-alphanumeric prefixes
            symbol = symbol.replace(/^[^A-Z0-9]+/, '').split(' ')[0];
            
            // Add to list
            const assetType = assetMappings[symbol]?.type || determineAssetType(symbol);
            symbols.push({ symbol, assetType, row });
          }
        });
        
        // If we have symbols, fetch prices
        if (symbols.length > 0) {
          // Get unique symbols
          const uniqueSymbols = [...new Set(symbols.map(s => s.symbol))].map(symbol => {
            const item = symbols.find(s => s.symbol === symbol);
            return { symbol, assetType: item.assetType };
          });
          
          // Fetch prices in batch
          const prices = await fetchBatchPrices(uniqueSymbols);
          
          // Update rows
          symbols.forEach(({ symbol, row }) => {
            if (prices[symbol]) {
              // Update price column
              if (typeof priceColumn === 'number') {
                const cell = row.cells[priceColumn];
                if (cell) {
                  cell.textContent = formatPrice(prices[symbol].price, 'default', prices[symbol].currency);
                }
              } else if (priceColumn.startsWith('data-')) {
                row.setAttribute(priceColumn, prices[symbol].price);
              } else {
                const element = row.querySelector(priceColumn);
                if (element) {
                  element.textContent = formatPrice(prices[symbol].price, 'default', prices[symbol].currency);
                }
              }
              
              // Update change column if provided
              if (changeColumn !== undefined) {
                if (typeof changeColumn === 'number') {
                  const cell = row.cells[changeColumn];
                  if (cell) {
                    cell.textContent = formatChangePercent(prices[symbol].changePercent, 'default');
                    cell.classList.remove('positive', 'negative');
                    cell.classList.add(prices[symbol].changePercent >= 0 ? 'positive' : 'negative');
                  }
                } else if (changeColumn.startsWith('data-')) {
                  row.setAttribute(changeColumn, prices[symbol].changePercent);
                } else {
                  const element = row.querySelector(changeColumn);
                  if (element) {
                    element.textContent = formatChangePercent(prices[symbol].changePercent, 'default');
                    element.classList.remove('positive', 'negative');
                    element.classList.add(prices[symbol].changePercent >= 0 ? 'positive' : 'negative');
                  }
                }
              }
            }
          });
        }
      } catch (error) {
        console.error('Error updating table prices:', error);
      }
    }
    
    // Return public API
    return {
      init,
      fetchPrice,
      fetchBatchPrices,
      refreshAllPrices,
      updateTablePrices,
      startAutoRefresh,
      stopAutoRefresh
    };
  })();