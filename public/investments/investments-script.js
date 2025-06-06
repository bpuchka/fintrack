document.addEventListener("DOMContentLoaded", function() {
    // Get current date for "Last updated"
    const today = new Date();
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    document.getElementById('last-updated-date').textContent = today.toLocaleDateString('bg-BG', options);
    
    // Extract the investment type from the URL and page data
    const path = window.location.pathname;
    const pathParts = path.split('/');
    let investmentType = pathParts[pathParts.length - 1];
    
    // Handle plural forms and other possible variations in URLs
    if (investmentType === 'stocks') {
        investmentType = 'stock';
    } else if (investmentType === 'metals') {
        investmentType = 'metal';
    } else if (investmentType === 'crypto' || investmentType === 'cryptocurrencies') {
        investmentType = 'crypto';
    } else if (investmentType === 'bank' || investmentType === 'deposits') {
        investmentType = 'bank';
    }
    
    console.log("Investment type detected from URL:", investmentType);
    
    // Fallback to a default if not recognized
    if (!['bank', 'crypto', 'stock', 'metal'].includes(investmentType)) {
        console.warn("Unrecognized investment type, defaulting to 'bank'");
        investmentType = 'bank';
    }
    
    // Color mapping for investment types
    const colorMap = {
        'bank': '#6dc0e0',
        'crypto': '#8e44ad',
        'stock': '#27ae60',
        'metal': '#f39c12'
    };
    
    // Display names for investment types
    const displayNames = {
        'bank': 'Банкови влогове',
        'crypto': 'Криптовалути',
        'stock': 'Акции',
        'metal': 'Метали'
    };

    // Add class for styling based on investment type
    document.body.classList.add(`investment-type-${investmentType}`);
    
    // Modal and form elements
    const modal = document.getElementById('investmentModal');
    const confirmDialog = document.getElementById('confirmDialog');
    const newInvestmentBtn = document.getElementById('newInvestmentBtn');
    const cancelBtn = document.getElementById('cancelInvestment');
    const closeModalBtns = document.querySelectorAll('.close-modal');
    const deleteBtn = document.getElementById('deleteInvestment');
    const form = document.getElementById('investmentForm');
    
    // Dialog elements
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmActionBtn = document.getElementById('confirmAction');
    const cancelActionBtn = document.getElementById('cancelAction');
    
    // Current investment ID for edit/delete operations
    let currentInvestmentId = null;
    
    // Setup investment history chart
    const historyChart = setupHistoryChart();
    
    // Load investment data
    loadInvestments();
    
    // Event listeners for modal controls
   if (newInvestmentBtn) {
        newInvestmentBtn.addEventListener('click', openAddModal);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', confirmDelete);
    }

    // Close modal when clicking on X or outside
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            closeModal();
            closeConfirmDialog();
        });
    });

    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeModal();
        } else if (event.target === confirmDialog) {
            closeConfirmDialog();
        }
    });

    // Close confirm dialog on cancel
    if (cancelActionBtn) {
        cancelActionBtn.addEventListener('click', closeConfirmDialog);
    }
    
    // Form submission
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
    
    // Set current date as default for date inputs
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        input.valueAsDate = new Date();
    });
    
    /**
     * Load investment data from API
     */
    function loadInvestments() {
        console.log("Loading investments for type:", investmentType);
        
        // API endpoint for getting investment data
        const apiEndpoint = `/investments/api/${investmentType}`;
        
        // Show loading state
        showLoading();
        
        // Fetch data from the API
        fetch(apiEndpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Hide loading indicator
            hideLoading();
            
            if (!data.success) {
                throw new Error(data.message || 'Error loading investments');
            }
            
            console.log("Received investment data:", data);
            
            // Update the UI with the data
            renderInvestmentsTable(data.investments);
            updateSummaryCards(data.summary);
            updateHistoryChart(data.investments);
            generateInsights(data.investments);
        })
        .catch(error => {
            hideLoading();
            console.error("Error loading investments:", error);
            
            // Show error notification
            if (window.Notify) {
                Notify.error("Грешка", `Грешка при зареждане на инвестиции: ${error.message}`);
            } else {
                alert(`Грешка при зареждане на инвестиции: ${error.message}`);
            }
            
            // Show no data message
            renderEmptyState();
        });
    }
    
/**
 * Setup the investment history chart with updated configuration
 */
function setupHistoryChart() {
    const chartCanvas = document.getElementById('investment-history-chart');
    if (!chartCanvas) return null;
    
    const ctx = chartCanvas.getContext('2d');
    
    // Create chart with updated configuration
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: `${displayNames[investmentType]} - Ценови движения`,
                data: [],
                borderColor: colorMap[investmentType] || '#6dc0e0',
                backgroundColor: `${colorMap[investmentType]}20` || '#6dc0e020',
                fill: false, // Changed to false for cleaner price chart look
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 6,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                // Format based on investment type
                                if (investmentType === 'bank') {
                                    label += formatCurrency(context.parsed.y) + ' лв.';
                                } else {
                                    // For other assets, show in their typical currency (USD for most)
                                    label += '$' + formatCurrency(context.parsed.y);
                                }
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#ccc',
                        maxTicksLimit: 10 // Limit number of x-axis labels
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#ccc',
                        callback: function(value) {
                            // Format Y-axis based on investment type
                            if (investmentType === 'bank') {
                                return formatCurrency(value) + ' лв.';
                            } else {
                                return '$' + formatCurrency(value);
                            }
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

/**
 * Update the history chart with actual asset price data using dedicated API
 */
async function updateHistoryChart(investments) {
    if (!historyChart) {
        console.warn("History chart not initialized");
        return;
    }
    
    if (!investments || investments.length === 0) {
        // If no investments, show empty chart
        historyChart.data.labels = [];
        historyChart.data.datasets[0].data = [];
        historyChart.update();
        return;
    }
    
    console.log("Updating history chart with price data for investment type:", investmentType);
    
    try {
        // Use the new dedicated API endpoint for price history
        const response = await fetch(`/investments/api/${investmentType}/price-history?timeframe=month`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to fetch price history');
        }
        
        const priceData = result.data || [];
        console.log("Received price history data:", priceData.length, "points");
        
        if (priceData.length === 0) {
            // Generate demo data if no data available
            console.log("No price data available, generating demo data");
            const demoData = generateDemoAssetPriceData(investments[0]?.symbol || 'BTC', investmentType);
            updateChartWithData(demoData, result.type || 'demo_data');
            return;
        }
        
        // Update chart with received data
        updateChartWithData(priceData, result.type || 'real_data');
        
    } catch (error) {
        console.error("Error fetching price history:", error);
        
        // Fallback to demo data
        const demoSymbol = investments[0]?.symbol || getDefaultSymbolForType(investmentType);
        const demoData = generateDemoAssetPriceData(demoSymbol, investmentType);
        updateChartWithData(demoData, 'demo_data');
    }
}


    /**
 * Create weighted portfolio value chart when user has multiple assets
 */
function createWeightedPortfolioChart(investments, allPriceData) {
    console.log("Creating weighted portfolio chart");
    
    // Create a map of symbol to price data
    const priceMap = {};
    allPriceData.forEach(item => {
        if (item.data && item.data.length > 0) {
            priceMap[item.symbol] = item.data;
        }
    });
    
    // If no price data available, return empty
    if (Object.keys(priceMap).length === 0) {
        return [];
    }
    
    // Get all unique timestamps and sort them
    const allTimestamps = new Set();
    Object.values(priceMap).forEach(priceData => {
        priceData.forEach(point => {
            allTimestamps.add(point.timestamp);
        });
    });
    
    const sortedTimestamps = Array.from(allTimestamps).sort();
    
    // Calculate portfolio value at each timestamp
    const portfolioData = [];
    
    sortedTimestamps.forEach(timestamp => {
        let totalValue = 0;
        let hasValidData = false;
        
        investments.forEach(investment => {
            const symbol = investment.symbol;
            const quantity = parseFloat(investment.quantity || 0);
            
            if (priceMap[symbol]) {
                // Find price closest to this timestamp
                const pricePoint = findClosestPrice(priceMap[symbol], timestamp);
                if (pricePoint) {
                    const value = quantity * pricePoint.price;
                    totalValue += value;
                    hasValidData = true;
                }
            }
        });
        
        if (hasValidData) {
            portfolioData.push({
                timestamp: timestamp,
                price: totalValue
            });
        }
    });
    
    console.log("Generated portfolio data points:", portfolioData.length);
    return portfolioData;
}
   
/**
 * Update chart with provided data
 */
function updateChartWithData(priceData, dataType) {
    if (!historyChart || !priceData || priceData.length === 0) {
        return;
    }
    
    // Prepare chart data
    const labels = priceData.map(point => {
        const date = new Date(point.timestamp);
        return date.toLocaleDateString('bg-BG', { month: 'short', day: 'numeric' });
    });
    
    const prices = priceData.map(point => point.price);
    
    console.log("Updating chart with", labels.length, "data points");
    console.log("Data type:", dataType);
    
    // Update chart
    historyChart.data.labels = labels;
    historyChart.data.datasets[0].data = prices;
    
    // Update chart label based on data type
    let chartLabel = displayNames[investmentType] || 'Инвестиции';
    
    switch (dataType) {
        case 'single_asset':
            chartLabel += ' - Ценова история';
            break;
        case 'portfolio_value':
            chartLabel += ' - Стойност на портфолиото';
            break;
        case 'demo_data':
            chartLabel += ' - Примерни данни';
            break;
        default:
            chartLabel += ' - Ценови движения';
    }
    
    historyChart.data.datasets[0].label = chartLabel;
    historyChart.update();
}

/**
 * Find the price point closest to a given timestamp
 */
function findClosestPrice(priceData, targetTimestamp) {
    if (!priceData || priceData.length === 0) return null;
    
    const targetTime = new Date(targetTimestamp).getTime();
    let closest = null;
    let minDiff = Infinity;
    
    priceData.forEach(point => {
        const pointTime = new Date(point.timestamp).getTime();
        const diff = Math.abs(pointTime - targetTime);
        
        if (diff < minDiff) {
            minDiff = diff;
            closest = point;
        }
    });
    
    return closest;
}

/**
 * Generate demo asset price data when real data is not available
 */
function generateDemoAssetPriceData(symbol, assetType) {
    console.log(`Generating demo asset price data for ${symbol} (${assetType})`);
    
    // Base prices for different assets
    const basePrices = {
        // Crypto
        'BTC': 65000,
        'ETH': 3500,
        'USDT': 1.00,
        'XRP': 0.55,
        'SOL': 150,
        
        // Stocks
        'AAPL': 220,
        'NVDA': 900,
        'TSLA': 250,
        
        // Metals/ETFs
        'GLD': 200,
        'SLV': 24,
        
        // Bank (special case)
        'BANK_BGN': 1000,
        'BANK_USD': 1000,
        'BANK_EUR': 1000
    };
    
    const basePrice = basePrices[symbol] || 100;
    
    // Volatility based on asset type
    let volatility;
    switch (assetType) {
        case 'crypto':
            volatility = 0.04; // 4% daily volatility
            break;
        case 'stock':
            volatility = 0.02; // 2% daily volatility
            break;
        case 'metal':
            volatility = 0.015; // 1.5% daily volatility
            break;
        case 'bank':
            volatility = 0.001; // Very low volatility for bank deposits
            break;
        default:
            volatility = 0.02;
    }
    
    // Generate 30 days of price data
    const priceData = [];
    let currentPrice = basePrice;
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        // Add random price movement
        const change = currentPrice * (Math.random() * volatility * 2 - volatility);
        
        // Add slight upward trend for more realistic demo
        const trend = currentPrice * 0.001; // 0.1% daily trend
        
        currentPrice += change + trend;
        
        // Ensure price doesn't go negative or too extreme
        if (currentPrice < basePrice * 0.7) {
            currentPrice = basePrice * 0.7 + Math.random() * basePrice * 0.1;
        } else if (currentPrice > basePrice * 1.4) {
            currentPrice = basePrice * 1.3 - Math.random() * basePrice * 0.1;
        }
        
        priceData.push({
            timestamp: date.toISOString(),
            price: currentPrice
        });
    }
    
    return priceData;
}

/**
 * Get default symbol for asset type
 */
function getDefaultSymbolForType(type) {
    const defaults = {
        'crypto': 'BTC',
        'stock': 'AAPL', 
        'metal': 'GLD',
        'bank': 'BANK_BGN'
    };
    return defaults[type] || 'BTC';
}

    /**
     * Parse month label (e.g., "янв. 2023") to Date object
     */
    function parseMonthLabel(monthLabel) {
        // Get month number and year from the label
        const parts = monthLabel.split(' ');
        const month = getMonthNumber(parts[0]);
        const year = parseInt(parts[1]);
        
        return new Date(year, month, 1);
    }
    
    /**
     * Get month number from Bulgarian month name
     */
    function getMonthNumber(monthShort) {
        const monthMap = {
            'яну': 0, 'фев': 1, 'мар': 2, 'апр': 3, 'май': 4, 'юни': 5,
            'юли': 6, 'авг': 7, 'сеп': 8, 'окт': 9, 'ное': 10, 'дек': 11
        };
        
        // Clean up the month name
        const cleanMonth = monthShort.replace('.', '').toLowerCase();
        
        // Find matching month
        for (const key in monthMap) {
            if (cleanMonth.startsWith(key)) {
                return monthMap[key];
            }
        }
        
        return 0; // Default to January if not found
    }
    
    /**
     * Calculate months between two dates
     */
    function monthsBetween(date1, date2) {
        const yearDiff = date2.getFullYear() - date1.getFullYear();
        const monthDiff = date2.getMonth() - date1.getMonth();
        return yearDiff * 12 + monthDiff;
    }
    
    /**
     * Get exchange rate for currency
     * Note: This is a simplified function - in practice, you'd fetch this from an API or database
     */
    function getExchangeRate(currency) {
        const rates = {
            'BGN': 1,
            'USD': 1.79,
            'EUR': 1.96,
            'GBP': 2.30
        };
        
        return rates[currency] || 1;
    }
    
    /**
     * Render the investments table
     */
    function renderInvestmentsTable(investments) {
        const tableBody = document.getElementById('investments-table-body');
        if (!tableBody) return;
        
        // Clear existing rows
        tableBody.innerHTML = '';
        
        // If no investments, show empty state
        if (!investments || investments.length === 0) {
            renderEmptyState();
            return;
        }
        
        // Render each investment
        investments.forEach(investment => {
            const row = document.createElement('tr');
            row.dataset.id = investment.id;
            
            // Calculate profit values for display
            const profit = investment.profit || 0;
            const profitPercentage = investment.profit_percentage || 0;
            const isProfitPositive = profit >= 0;
            
            // Format display values based on investment type
            let displayName, displayQuantity, displayPrice, displayValue, profitDisplay;
            
            if (investment.investment_type === 'bank') {
                // Bank deposit
                displayName = `${investment.currency} Депозит`;
                displayQuantity = `${formatCurrency(investment.quantity)} ${investment.currency}`;
                displayPrice = `${investment.interest_rate}% (${getInterestTypeDisplay(investment.interest_type)})`;
                displayValue = `${formatCurrency(investment.current_value)} ${investment.currency}`;
                profitDisplay = `${isProfitPositive ? '+' : ''}${formatCurrency(profit)} (${isProfitPositive ? '+' : ''}${profitPercentage.toFixed(2)}%)`;
            } else {
                // Other investments
                displayName = investment.symbol;
                displayQuantity = `${formatQuantity(investment.quantity)}`;
                displayPrice = `${formatCurrency(investment.purchase_price)} ${investment.currency}`;
                displayValue = `${formatCurrency(investment.current_value)} ${investment.currency}`;
                profitDisplay = `${isProfitPositive ? '+' : ''}${formatCurrency(profit)} (${isProfitPositive ? '+' : ''}${profitPercentage.toFixed(2)}%)`;
            }
            
            // Create table row
            row.innerHTML = `
                <td>${displayName}</td>
                <td>${displayQuantity}</td>
                <td>${displayPrice}</td>
                <td>${displayValue}</td>
                <td class="investment-value ${isProfitPositive ? 'positive' : 'negative'}">${profitDisplay}</td>
                <!--
                <td>
                    <div class="table-actions">
                        <button class="action-btn edit" data-id="${investment.id}">
                            Редактирай
                        </button>
                        <button class="action-btn delete" data-id="${investment.id}">
                            Изтрий
                        </button>
                    </div>
                </td>
                -->
            `;
            
            tableBody.appendChild(row);
        });
        
        // Add event listeners to the buttons
        addTableActionListeners();
    }
    
    /**
     * Add event listeners to table buttons
     */
    function addTableActionListeners() {
        // Edit buttons
        const editButtons = document.querySelectorAll('.action-btn.edit');
        editButtons.forEach(button => {
            button.addEventListener('click', function() {
                const investmentId = this.dataset.id;
                openEditModal(investmentId);
            });
        });
        
        // Delete buttons
        const deleteButtons = document.querySelectorAll('.action-btn.delete');
        deleteButtons.forEach(button => {
            button.addEventListener('click', function() {
                const investmentId = this.dataset.id;
                currentInvestmentId = investmentId;
                openConfirmDialog('Изтриване на инвестиция', 'Сигурни ли сте, че искате да изтриете тази инвестиция?');
            });
        });
    }
    
    /**
     * Render empty state when no investments
     */
    function renderEmptyState() {
        const tableBody = document.getElementById('investments-table-body');
        if (!tableBody) return;
        
        tableBody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="6">
                    <div style="text-align: center; padding: 2rem;">
                        <p>Няма намерени инвестиции. Добавете нова инвестиция, за да започнете.</p>
                    </div>
                </td>
            </tr>
        `;
        
        // Reset summary cards
        updateSummaryCards({
            totalInvestment: 0,
            totalCurrentValue: 0,
            totalProfit: 0,
            profitPercentage: 0
        });
        
        // Clear insights
        const insightsContainer = document.getElementById('investment-insights');
        if (insightsContainer) {
            insightsContainer.innerHTML = '<h2>Анализ на инвестициите</h2>';
            insightsContainer.innerHTML += '<p>Добавете инвестиции, за да видите анализ.</p>';
        }
    }
    
    /**
     * Update summary cards with data
     */
    function updateSummaryCards(summary) {
        if (!summary) return;
        
        // Update total value
        const totalValueElement = document.getElementById('total-investment-value');
        if (totalValueElement) {
            totalValueElement.textContent = `${formatCurrency(summary.totalCurrentValue)} лв.`;
        }
        
        // Update profit/loss value
        const totalProfitElement = document.getElementById('total-investment-profit');
        if (totalProfitElement) {
            totalProfitElement.textContent = `${formatCurrency(summary.totalProfit)} лв.`;
        }
        
        // Update change percentage
        const changeElement = document.getElementById('total-investment-change');
        if (changeElement) {
            const changeText = `${summary.profitPercentage >= 0 ? '+' : ''}${summary.profitPercentage.toFixed(2)}% от първоначалната инвестиция`;
            changeElement.textContent = changeText;
            changeElement.className = `change ${summary.profitPercentage >= 0 ? 'positive' : 'negative'}`;
        }
        
        // Update profit percentage
        const profitPercentageElement = document.getElementById('profit-percentage');
        if (profitPercentageElement) {
            const percentageText = `${summary.profitPercentage >= 0 ? '+' : ''}${summary.profitPercentage.toFixed(2)}%`;
            profitPercentageElement.textContent = percentageText;
            profitPercentageElement.className = `change ${summary.profitPercentage >= 0 ? 'positive' : 'negative'}`;
        }
    }
    
    /**
     * Generate insights based on investment data
     */
    function generateInsights(investments) {
        const insightsContainer = document.getElementById('investment-insights');
        if (!insightsContainer) return;
        
        // Reset container
        insightsContainer.innerHTML = '<h2>Анализ на инвестициите</h2>';
        
        // If no investments, show message
        if (!investments || investments.length === 0) {
            const noDataMsg = document.createElement('p');
            noDataMsg.textContent = 'Добавете инвестиции, за да видите анализ.';
            insightsContainer.appendChild(noDataMsg);
            return;
        }
        
        // Generate insights based on investment type
        if (investmentType === 'bank') {
            generateBankInsights(investments, insightsContainer);
        } else if (investmentType === 'crypto') {
            generateCryptoInsights(investments, insightsContainer);
        } else if (investmentType === 'stock') {
            generateStockInsights(investments, insightsContainer);
        } else if (investmentType === 'metal') {
            generateMetalInsights(investments, insightsContainer);
        }
    }
    
    /**
     * Generate bank investment insights
     */
    function generateBankInsights(investments, container) {
        // Calculate average interest rate
        let totalInterestRate = 0;
        investments.forEach(inv => {
            totalInterestRate += parseFloat(inv.interest_rate || 0);
        });
        const avgInterestRate = totalInterestRate / investments.length;
        
        // Add insight card for average interest rate
        const rateInsight = document.createElement('div');
        rateInsight.className = 'insight-card';
        rateInsight.innerHTML = `
            <h3 class="insight-title">Среден лихвен процент</h3>
            <p class="insight-description">
                Средният лихвен процент на вашите депозити е ${avgInterestRate.toFixed(2)}%.
                ${avgInterestRate < 3 ? 'Можете да потърсите банки, които предлагат по-високи лихви.' : 'Вашите депозити имат добра лихвена доходност.'}
            </p>
        `;
        container.appendChild(rateInsight);
        
        // Add insight for currency diversification
        const currencies = {};
        investments.forEach(inv => {
            const currency = inv.currency || 'BGN';
            if (!currencies[currency]) {
                currencies[currency] = 0;
            }
            currencies[currency] += parseFloat(inv.quantity || 0);
        });
        
        const currencyInsight = document.createElement('div');
        currencyInsight.className = 'insight-card';
        currencyInsight.innerHTML = `
            <h3 class="insight-title">Валутна диверсификация</h3>
            <p class="insight-description">
                Вашите депозити са разпределени в ${Object.keys(currencies).length} ${Object.keys(currencies).length === 1 ? 'валута' : 'валути'}.
                ${Object.keys(currencies).length < 2 ? 'Можете да помислите за диверсификация в повече валути, за да намалите валутния риск.' : 'Добра диверсификация на валутите.'}
            </p>
        `;
        container.appendChild(currencyInsight);
    }
    
    /**
     * Generate crypto investment insights
     */
    function generateCryptoInsights(investments, container) {
        // Check portfolio diversification
        const symbols = new Set(investments.map(inv => inv.symbol));
        
        const diversificationInsight = document.createElement('div');
        diversificationInsight.className = 'insight-card';
        diversificationInsight.innerHTML = `
            <h3 class="insight-title">Диверсификация</h3>
            <p class="insight-description">
                Вашето крипто портфолио съдържа ${symbols.size} различни криптовалути.
                ${symbols.size < 3 ? 'Препоръчваме по-голяма диверсификация за намаляване на риска.' : 'Добра диверсификация на портфолиото.'}
            </p>
        `;
        container.appendChild(diversificationInsight);
        
        // Add volatility insight
        const volatilityInsight = document.createElement('div');
        volatilityInsight.className = 'insight-card';
        volatilityInsight.innerHTML = `
            <h3 class="insight-title">Волатилност</h3>
            <p class="insight-description">
                Криптовалутите са високоволатилен клас активи. Препоръчваме да инвестирате само средства, които сте готови да загубите.
            </p>
        `;
        container.appendChild(volatilityInsight);
    }
    
    /**
     * Generate stock investment insights
     */
    function generateStockInsights(investments, container) {
        // Calculate performance
        let totalProfit = 0;
        let totalInvestment = 0;
        
        investments.forEach(inv => {
            const initialValue = parseFloat(inv.quantity) * parseFloat(inv.purchase_price);
            totalInvestment += initialValue;
            totalProfit += parseFloat(inv.profit || 0);
        });
        
        const profitPercentage = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
        
        const performanceInsight = document.createElement('div');
        performanceInsight.className = 'insight-card';
        performanceInsight.innerHTML = `
            <h3 class="insight-title">Представяне на акциите</h3>
            <p class="insight-description">
                Вашите акции имат ${profitPercentage >= 0 ? 'положителна' : 'отрицателна'} доходност от ${Math.abs(profitPercentage).toFixed(2)}%.
                ${profitPercentage < 0 ? 'Помислете за дългосрочна стратегия и диверсификация.' : 'Продължавайте да следите представянето на компаниите.'}
            </p>
        `;
        container.appendChild(performanceInsight);
        
        // Add sector diversification recommendation
        const diversificationInsight = document.createElement('div');
        diversificationInsight.className = 'insight-card';
        diversificationInsight.innerHTML = `
            <h3 class="insight-title">Секторна диверсификация</h3>
            <p class="insight-description">
                Препоръчваме инвестиране в различни сектори на икономиката за балансиране на риска.
            </p>
        `;
        container.appendChild(diversificationInsight);
    }
    
    /**
     * Generate metal investment insights
     */
    function generateMetalInsights(investments, container) {
        // Add inflation hedge insight
        const inflationInsight = document.createElement('div');
        inflationInsight.className = 'insight-card';
        inflationInsight.innerHTML = `
            <h3 class="insight-title">Защита от инфлация</h3>
            <p class="insight-description">
                Благородните метали често се използват като защита срещу инфлация и икономическа несигурност.
            </p>
        `;
        container.appendChild(inflationInsight);
        
        // Add allocation recommendation
        const allocationInsight = document.createElement('div');
        allocationInsight.className = 'insight-card';
        allocationInsight.innerHTML = `
            <h3 class="insight-title">Алокация в портфолиото</h3>
            <p class="insight-description">
                Експертите препоръчват благородните метали да представляват 5-10% от общото инвестиционно портфолио.
            </p>
        `;
        container.appendChild(allocationInsight);
    }
    

    /**
     * Open add investment modal
     */
    function openAddModal() {
        if (!modal) {
            console.error("Modal element not found");
            return;
        }
        
        console.log("Opening add modal");
        
        // Update modal title
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) modalTitle.textContent = 'Добави нова инвестиция';
        
        // Hide delete button for new investments
        if (deleteBtn) deleteBtn.style.display = 'none';
        
        // Reset current ID
        currentInvestmentId = null;
        
        // Reset form if it exists
        if (form) form.reset();
        
        // Set today's date
        const dateInputs = document.querySelectorAll('input[type="date"]');
        dateInputs.forEach(input => {
            input.valueAsDate = new Date();
        });
        
        // Set form based on investment type
        if (investmentType === 'bank') {
            // Show bank deposit fields
            const bankDepositFields = document.getElementById('bankDepositFields');
            const standardFields = document.getElementById('standardFields');
            
            if (bankDepositFields) bankDepositFields.style.display = 'block';
            if (standardFields) standardFields.style.display = 'none';
        } else {
            // Show standard investment fields
            const bankDepositFields = document.getElementById('bankDepositFields');
            const standardFields = document.getElementById('standardFields');
            
            if (bankDepositFields) bankDepositFields.style.display = 'none';
            if (standardFields) standardFields.style.display = 'block';
        }
        
        // Show modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent scrolling
        
        // Fetch investment data with fallback
        fetchInvestmentData(investmentId, apiEndpoint);
    }
    
    /**
     * Fetch investment data with fallback to another endpoint if needed
     */
    function fetchInvestmentData(investmentId, primaryEndpoint) {
        fetch(primaryEndpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin'
        })
        .then(response => {
            console.log("Primary response status:", response.status);
            
            if (response.ok) {
                return response.json().then(data => {
                    processInvestmentData(data, investmentId);
                });
            }
            
            // If primary endpoint fails, try the alternative
            console.log("Primary endpoint failed, trying alternative...");
            const isBank = primaryEndpoint.includes('bank-investments');
            const alternativeEndpoint = isBank ? 
                `/api/investments/${investmentId}` : 
                `/api/bank-investments/${investmentId}`;
            
            console.log("Using alternative API endpoint:", alternativeEndpoint);
            
            return fetch(alternativeEndpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin'
            }).then(altResponse => {
                console.log("Alternative response status:", altResponse.status);
                
                if (!altResponse.ok) {
                    throw new Error(`Both endpoints failed. Last status: ${altResponse.status}`);
                }
                
                return altResponse.json().then(data => {
                    processInvestmentData(data, investmentId);
                });
            });
        })
        .catch(error => {
            console.error("Error fetching investment:", error);
            
            // Remove loading indicator
            const loadingElement = document.querySelector('.modal-loading');
            if (loadingElement) {
                loadingElement.remove();
            }
            
            // Show error notification
            if (window.Notify) {
                Notify.error("Грешка", `Грешка при зареждане на инвестиция: ${error.message}`);
            } else {
                alert(`Грешка при зареждане на инвестиция: ${error.message}`);
            }
        });
    }
    
    /**
     * Process the investment data once retrieved
     */
    function processInvestmentData(data, investmentId) {
        console.log("Fetched investment data:", data);
        
        // Remove loading indicator
        const loadingElement = document.querySelector('.modal-loading');
        if (loadingElement) {
            loadingElement.remove();
        }
        
        if (!data.success) {
            throw new Error(data.message || "Failed to fetch investment data");
        }
        
        // Extract investment data
        const investment = data.data || {};
        
        // Detect actual investment type
        const actualType = investment.investment_type || investmentType;
        console.log("Actual investment type:", actualType);
        
        // Set hidden investment ID field
        const idInput = document.getElementById('investmentId');
        if (idInput) idInput.value = investmentId;
        
        // Populate form based on detected investment type
        if (actualType === 'bank') {
            populateBankForm(investment);
        } else {
            populateStandardForm(investment);
        }
    }
    
    /**
     * Open edit investment modal
     */
    function openEditModal(investmentId) {
        if (!modal || !investmentId) return;
        
        console.log("Opening edit modal for investment ID:", investmentId);
        console.log("Current investment type:", investmentType);
        
        // Store current investment ID
        currentInvestmentId = investmentId;
        
        // Update modal title
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) modalTitle.textContent = 'Редактирай инвестиция';
        
        // Show delete button
        if (deleteBtn) deleteBtn.style.display = 'block';
        
        // Choose the correct API endpoint based on investment type
        let apiEndpoint;
            apiEndpoint = `/api/investments/${investmentId}`;
        
        console.log("Using API endpoint:", apiEndpoint);
        
        // Fetch investment data
        fetch(apiEndpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin'
        })
        .then(response => {
            console.log("Response status:", response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Fetched investment data:", data);
            // Extract investment data
            const investment = data.data || {};
            
            // Set hidden investment ID field
            const idInput = document.getElementById('investmentId');
            if (idInput) idInput.value = investmentId;
            
            // Populate form based on investment type
            if (investmentType === 'bank') {
                populateBankForm(investment);
            } else {
                populateStandardForm(investment);
            }
            
            // Show modal with proper styling
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent scrolling
        })
        .catch(error => {
            console.error("Error fetching investment:", error);
            
            // Show error notification
            if (window.Notify) {
                Notify.error("Грешка", `Грешка при зареждане на инвестиция: ${error.message}`);
            } else {
                alert(`Грешка при зареждане на инвестиция: ${error.message}`);
            }
        });
    }
    
    /**
     * Populate standard investment form
     */
    function populateStandardForm(investment) {
        // Symbol
        const symbolInput = document.getElementById('investmentSymbol');
        if (symbolInput) {
            // Check if symbol exists in dropdown
            let symbolExists = false;
            for (let i = 0; i < symbolInput.options.length; i++) {
                if (symbolInput.options[i].value === investment.symbol) {
                    symbolExists = true;
                    break;
                }
            }
            
            // Add option if it doesn't exist
            if (!symbolExists && investment.symbol) {
                const option = document.createElement('option');
                option.value = investment.symbol;
                option.textContent = investment.symbol;
                symbolInput.appendChild(option);
            }
            
            symbolInput.value = investment.symbol;
        }
        
        // Amount
        const amountInput = document.getElementById('investmentAmount');
        if (amountInput) amountInput.value = investment.quantity;
        
        // Currency
        const currencyInput = document.getElementById('investmentCurrency');
        if (currencyInput) currencyInput.value = investment.currency || 'BGN';
        
        // Price
        const priceInput = document.getElementById('investmentPrice');
        if (priceInput) priceInput.value = investment.purchase_price;
        
        // Date
        const dateInput = document.getElementById('investmentDate');
        if (dateInput && investment.purchase_date) {
            // Format date for input (YYYY-MM-DD)
            const date = new Date(investment.purchase_date);
            const formattedDate = date.toISOString().split('T')[0];
            dateInput.value = formattedDate;
        }
        
        // Notes
        const notesInput = document.getElementById('investmentNotes');
        if (notesInput) notesInput.value = investment.notes || '';
    }
    
    /**
     * Close modal
     */
    function closeModal() {
        if (!modal) return;
        
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Re-enable scrolling
        
        // Reset form
        if (form) form.reset();
    }
    
    /**
     * Open confirmation dialog
     */
    function openConfirmDialog(title, message) {
        if (!confirmDialog) return;
        
        // Set dialog content
        document.querySelector('#confirmDialog .modal-header h2').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        
        // Set confirm action
        confirmActionBtn.onclick = function() {
            closeConfirmDialog();
            deleteInvestment(currentInvestmentId);
        };
        
        // Show dialog
        confirmDialog.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }
    
    /**
     * Close confirmation dialog
     */
    function closeConfirmDialog() {
        if (!confirmDialog) return;
        
        confirmDialog.style.display = 'none';
        document.body.style.overflow = 'auto'; // Re-enable scrolling
    }
    
    /**
     * Confirm delete operation
     */
    function confirmDelete() {
        if (!currentInvestmentId) {
            console.error('No investment ID set for delete operation');
            return;
        }
        openConfirmDialog('Изтриване на инвестиция', 'Сигурни ли сте, че искате да изтриете тази инвестиция?');
    }
    
    /**
     * Delete investment
     */
    function deleteInvestment(investmentId) {
        if (!investmentId) return;
        
        // Choose API endpoint based on investment type
        let apiEndpoint;
        if (investmentType === 'bank') {
            apiEndpoint = `/api/bank-investments/${investmentId}`;
        } else {
            apiEndpoint = `/api/investments/${investmentId}`;
        }
        
        // Send delete request
        fetch(apiEndpoint, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Close modal if open
            closeModal();
            
            // Show success message
            if (window.Notify) {
                Notify.success("Успех", "Инвестицията беше изтрита успешно!");
            } else {
                alert("Инвестицията беше изтрита успешно!");
            }
            
            // Reload investments
            loadInvestments();
        })
        .catch(error => {
            console.error("Error deleting investment:", error);
            
            // Show error notification
            if (window.Notify) {
                Notify.error("Грешка", `Грешка при изтриване: ${error.message}`);
            } else {
                alert(`Грешка при изтриване: ${error.message}`);
            }
        });
    }
    
    /**
     * Handle form submission
     */
    function handleFormSubmit(event) {
        event.preventDefault();
        
        // Get form data
        const formData = new FormData(form);
        
        // Determine API endpoint and method
        let apiEndpoint, method;
        
        if (currentInvestmentId) {
            // Update existing investment
            method = 'PUT';
            
            if (investmentType === 'bank') {
                apiEndpoint = `/api/bank-investments/${currentInvestmentId}`;
            } else {
                apiEndpoint = `/api/investments/${currentInvestmentId}`;
            }
        } else {
            // Create new investment
            method = 'POST';
            
            if (investmentType === 'bank') {
                apiEndpoint = '/api/bank-investments';
            } else {
                apiEndpoint = '/api/investments';
            }
        }
        
        // Prepare request data based on investment type
        let requestData = {};
        
        if (investmentType === 'bank') {
            requestData = {
                amount: parseFloat(formData.get('depositAmount')),
                interest_rate: parseFloat(formData.get('interestRate')),
                interest_type: formData.get('interestType'),
                investment_date: formData.get('investmentDate'),
                currency: formData.get('depositCurrency'),
                notes: formData.get('investmentNotes') || null
            };
        } else {
            requestData = {
                type: investmentType,
                symbol: formData.get('investmentSymbol'),
                amount: parseFloat(formData.get('investmentAmount')),
                price: parseFloat(formData.get('investmentPrice')),
                currency: formData.get('investmentCurrency'),
                date: formData.get('investmentDate'),
                notes: formData.get('investmentNotes') || null
            };
        }
        
        console.log("Submitting form data:", requestData);
        
        // Send request
        fetch(apiEndpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData),
            credentials: 'same-origin'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Close modal
            closeModal();
            
            // Show success message
            const actionText = currentInvestmentId ? "обновена" : "добавена";
            if (window.Notify) {
                Notify.success("Успех", `Инвестицията беше ${actionText} успешно!`);
            } else {
                alert(`Инвестицията беше ${actionText} успешно!`);
            }
            
            // Reload investments
            loadInvestments();
        })
        .catch(error => {
            console.error("Error saving investment:", error);
            
            // Show error notification
            if (window.Notify) {
                Notify.error("Грешка", `Грешка при запазване: ${error.message}`);
            } else {
                alert(`Грешка при запазване: ${error.message}`);
            }
        });
    }
    
    /**
     * Show loading indicator
     */
    function showLoading() {
        const tableBody = document.getElementById('investments-table-body');
        if (!tableBody) return;
        
        tableBody.innerHTML = `
            <tr class="loading-row">
                <td colspan="6" style="text-align: center; padding: 2rem;">
                    <div style="display: inline-block; width: 30px; height: 30px; border: 3px solid #3c3c3c; border-top: 3px solid ${colorMap[investmentType]}; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <p style="margin-top: 1rem; color: #ccc;">Зареждане на инвестиции...</p>
                </td>
            </tr>
        `;
        
        // Add keyframes for spin animation if not already present
        if (!document.getElementById('spin-animation')) {
            const style = document.createElement('style');
            style.id = 'spin-animation';
            style.innerHTML = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    /**
     * Hide loading indicator
     */
    function hideLoading() {
        const loadingRow = document.querySelector('.loading-row');
        if (loadingRow) loadingRow.remove();
    }
    
    /**
     * Format currency value with 2 decimal places
     */
    function formatCurrency(value) {
        if (value === undefined || value === null) {
            return '0.00';
        }
        
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        
        if (isNaN(numValue)) {
            return '0.00';
        }
        
        return numValue.toLocaleString('bg-BG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
    
    /**
     * Format quantity value (with more decimal places for small values)
     */
    function formatQuantity(value) {
        if (value === undefined || value === null || isNaN(parseFloat(value))) {
            return '0';
        }
        
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        
        // For small values (like crypto), show more decimal places
        if (numValue < 0.01) {
            return numValue.toLocaleString('bg-BG', {
                minimumFractionDigits: 6,
                maximumFractionDigits: 8
            });
        }
        
        // For larger values, show standard 2 decimal places
        return numValue.toLocaleString('bg-BG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
    
    /**
     * Get interest type display text
     */
    function getInterestTypeDisplay(interestType) {
        const types = {
            'daily': 'Дневна',
            'monthly_1': 'Месечна (1м)',
            'monthly_3': 'Месечна (3м)',
            'monthly_6': 'Месечна (6м)',
            'yearly': 'Годишна'
        };
        
        return types[interestType] || 'Годишна';
    }
});