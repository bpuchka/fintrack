document.addEventListener("DOMContentLoaded", function() {
    // Set current date for "Last updated"
    const today = new Date();
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    document.getElementById('last-updated-date').textContent = today.toLocaleDateString('bg-BG', options);
    
    // Get the investment type from the URL path
    const path = window.location.pathname;
    const pathParts = path.split('/');
    // Extract the investment type (crypto, stock, metal)
    const investmentType = pathParts[pathParts.length - 1];
    
    console.log("Extracted investment type:", investmentType);
    
    // Validate investment type to ensure it's one of the expected values
    const validTypes = ['bank', 'crypto', 'stock', 'metal', 'stocks', 'metals'];
    const normalizedType = validTypes.includes(investmentType) ? investmentType : 'bank';
    
    // Handle plural forms in URLs
    const apiType = normalizedType === 'stocks' ? 'stock' : 
                   normalizedType === 'metals' ? 'metal' : 
                   normalizedType;
    
    console.log("Normalized investment type for API:", apiType);
    
    // Set the correct color theme based on investment type
    document.body.classList.add(`investment-type-${apiType}`);
    
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
    
    // Modal elements
    const modal = document.getElementById('investmentModal');
    const confirmDialog = document.getElementById('confirmDialog');
    const newInvestmentBtn = document.getElementById('newInvestmentBtn');
    const modalTitle = document.getElementById('modal-title');
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
    
    // Investment history chart setup
    let historyChart = null;
    setupHistoryChart();
    
    // Load investments data
    loadInvestments();
    
    // Event listeners for modal
    if (newInvestmentBtn) {
        newInvestmentBtn.addEventListener('click', openAddModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', confirmDelete);
    }
    
    // Close modal when clicking on close button or outside
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            closeModal();
        });
    });
    
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeModal();
        } else if (event.target === confirmDialog) {
            closeConfirmDialog();
        }
    });
    
    // Close confirm dialog
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
    
    // Initialize insights section
    updateInsights();
    
    /**
     * Load investments from server based on investment type
     */
    function loadInvestments() {
        let apiEndpoint = '';
        
        console.log("Loading investments for type:", apiType);
        
        // Select the appropriate API endpoint based on investment type
        if (apiType === 'bank') {
            apiEndpoint = '/api/bank-investments';
        } else {
            apiEndpoint = `/api/investments/type/${apiType}`;
        }
        
        console.log("Using API endpoint:", apiEndpoint);
        
        // Show loading state
        showLoading();
        
        // Fetch data from API
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
            // Hide loading
            hideLoading();
            
            // Check if we have valid data
            if (!data.success) {
                throw new Error(data.message || 'Error loading investments');
            }
            
            // Process investments
            const investments = data.investments || data.data || [];
            console.log("Loaded investments:", investments.length);
            renderInvestments(investments);
            updateSummary(investments);
            updateHistoryChart(investments);
            updateInsights(investments);
        })
        .catch(error => {
            hideLoading();
            console.error('Error loading investments:', error);
            Notify.error('Грешка', 'Неуспешно зареждане на инвестиции: ' + error.message);
            
            // Show no data message in the table
            const tableBody = document.getElementById('investments-table-body');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr class="no-data-row">
                        <td colspan="6">Грешка при зареждане на данни. ${error.message}</td>
                    </tr>
                `;
            }
        });
    }
    
    /**
     * Show loading indicator in the table
     */
    function showLoading() {
        if (!tableBody) return;
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="loading-row">
                    <div style="display: flex; justify-content: center; align-items: center; padding: 2rem; flex-direction: column;">
                        <div class="loading-spinner" style="width: 40px; height: 40px; border: 3px solid #333; border-top: 3px solid ${themeColor}; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <p style="margin-top: 1rem; color: #ccc;">Зареждане на инвестиции...</p>
                    </div>
                </td>
            </tr>
        `;
        
        // Add keyframes for the spinner if not already added
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
        // Nothing to do if already hidden
    }
    
    /**
     * Render empty state when no investments are found
     */
    function renderEmptyState() {
        if (!tableBody) return;
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="no-data-row">
                    <div style="text-align: center; padding: 2rem;">
                        <p>Няма намерени инвестиции. Добавете нова инвестиция, за да започнете.</p>
                    </div>
                </td>
            </tr>
        `;
        
        // Reset summary cards
        updateSummaryCards([]);
        
        // Reset chart
        updateHistoryChart([]);
        
        // Reset insights
        generateInsights([]);
    }
    
    /**
     * Render investments table with the provided data
     */
    function renderInvestmentsTable(investments) {
        if (!tableBody) return;
        
        // Clear table first
        tableBody.innerHTML = '';
        
        // Check if we have any investments
        if (!investments || investments.length === 0) {
            renderEmptyState();
            return;
        }
        
        // Render each investment as a table row
        investments.forEach(investment => {
            // Create table row
            const row = document.createElement('tr');
            row.dataset.id = investment.id;
            
            // Calculate profit/loss
            let initialValue, currentValue, profit, profitPercentage;
            
            if (apiInvestmentType === 'bank') {
                initialValue = parseFloat(investment.quantity || investment.amount);
                currentValue = parseFloat(investment.current_value || initialValue);
            } else {
                initialValue = parseFloat(investment.quantity) * parseFloat(investment.purchase_price);
                currentValue = parseFloat(investment.current_value || initialValue);
            }
            
            profit = currentValue - initialValue;
            profitPercentage = initialValue > 0 ? (profit / initialValue) * 100 : 0;
            const isProfitPositive = profit >= 0;
            
            // Format display values
            const profitDisplay = `${isProfitPositive ? '+' : ''}${formatCurrency(profit)} (${isProfitPositive ? '+' : ''}${profitPercentage.toFixed(2)}%)`;
            
            // Create row HTML based on investment type
            if (apiInvestmentType === 'bank') {
                row.innerHTML = `
                    <td>${investment.currency} Депозит</td>
                    <td>${formatCurrency(investment.quantity || investment.amount)} ${investment.currency}</td>
                    <td>${investment.interest_rate}% (${getInterestTypeDisplay(investment.interest_type)})</td>
                    <td>${formatCurrency(currentValue)} ${investment.currency}</td>
                    <td class="${isProfitPositive ? 'positive' : 'negative'}">${profitDisplay}</td>
                    <td>
                        <div class="table-actions">
                            <button class="action-btn edit" data-id="${investment.id}">Редактирай</button>
                            <button class="action-btn delete" data-id="${investment.id}">Изтрий</button>
                        </div>
                    </td>
                `;
            } else {
                row.innerHTML = `
                    <td>${investment.symbol}</td>
                    <td>${formatQuantity(investment.quantity)} ${investment.symbol}</td>
                    <td>${formatCurrency(investment.purchase_price)} ${investment.currency || 'BGN'}</td>
                    <td>${formatCurrency(currentValue)} ${investment.currency || 'BGN'}</td>
                    <td class="${isProfitPositive ? 'positive' : 'negative'}">${profitDisplay}</td>
                    <td>
                        <div class="table-actions">
                            <button class="action-btn edit" data-id="${investment.id}">Редактирай</button>
                            <button class="action-btn delete" data-id="${investment.id}">Изтрий</button>
                        </div>
                    </td>
                `;
            }
            
            tableBody.appendChild(row);
        });
        
        // Add event listeners to the new buttons
        addTableButtonListeners();
    }
    
    /**
     * Add event listeners to table action buttons
     */
    function addTableButtonListeners() {
        // Edit buttons
        document.querySelectorAll('.action-btn.edit').forEach(button => {
            button.addEventListener('click', function() {
                const investmentId = this.getAttribute('data-id');
                openEditModal(investmentId);
            });
        });
        
        // Delete buttons
        document.querySelectorAll('.action-btn.delete').forEach(button => {
            button.addEventListener('click', function() {
                const investmentId = this.getAttribute('data-id');
                currentInvestmentId = investmentId;
                openConfirmDialog('Изтриване на инвестиция', 'Сигурни ли сте, че искате да изтриете тази инвестиция?');
            });
        });
    }
    
    /**
     * Render investments in the table
     */
    function renderInvestments(investments) {
        const tableBody = document.getElementById('investments-table-body');
        if (!tableBody) return;
        
        // Clear existing content
        tableBody.innerHTML = '';
        
        // Check if we have investments
        if (!investments || investments.length === 0) {
            const noDataRow = document.createElement('tr');
            noDataRow.className = 'no-data-row';
            noDataRow.innerHTML = `<td colspan="6">Няма инвестиции от този тип. Добавете нова инвестиция, за да започнете.</td>`;
            tableBody.appendChild(noDataRow);
            return;
        }
        
        // Render each investment
        investments.forEach(investment => {
            const row = document.createElement('tr');
            row.dataset.id = investment.id;
            
            // Calculate profit values for display
            const profit = (investment.current_value || 0) - (investment.investment_type === 'bank' ? investment.quantity : (investment.quantity * investment.purchase_price));
            const profitPercentage = investment.profit_percentage || 0;
            const isProfitPositive = profit >= 0;
            
            // Format display values
            const profitDisplay = `${isProfitPositive ? '+' : ''}${formatCurrency(profit)} (${isProfitPositive ? '+' : ''}${profitPercentage.toFixed(2)}%)`;
            
            // Create table row based on investment type
            if (investment.investment_type === 'bank') {
                row.innerHTML = `
                    <td>${investment.currency} Депозит</td>
                    <td>${formatCurrency(investment.quantity)} ${investment.currency}</td>
                    <td>${investment.interest_rate}% (${getInterestTypeDisplay(investment.interest_type)})</td>
                    <td>${formatCurrency(investment.current_value)} ${investment.currency}</td>
                    <td class="investment-value ${isProfitPositive ? 'positive' : 'negative'}">${profitDisplay}</td>
                    <td>
                        <div class="table-actions">
                            <button class="action-btn edit" data-id="${investment.id}">
                                <i class="fas fa-edit"></i> Редактирай
                            </button>
                            <button class="action-btn delete" data-id="${investment.id}">
                                <i class="fas fa-trash"></i> Изтрий
                            </button>
                        </div>
                    </td>
                `;
            } else {
                row.innerHTML = `
                    <td>${investment.symbol}</td>
                    <td>${formatQuantity(investment.quantity)} ${investment.symbol}</td>
                    <td>${formatCurrency(investment.purchase_price)} ${investment.currency}</td>
                    <td>${formatCurrency(investment.current_value)} ${investment.currency}</td>
                    <td class="investment-value ${isProfitPositive ? 'positive' : 'negative'}">${profitDisplay}</td>
                    <td>
                        <div class="table-actions">
                            <button class="action-btn edit" data-id="${investment.id}">
                                <i class="fas fa-edit"></i> Редактирай
                            </button>
                            <button class="action-btn delete" data-id="${investment.id}">
                                <i class="fas fa-trash"></i> Изтрий
                            </button>
                        </div>
                    </td>
                `;
            }
            
            tableBody.appendChild(row);
        });
        
        // Add event listeners to edit/delete buttons
        addTableActionListeners();
    }
    
    /**
     * Add event listeners to table action buttons
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
     * Update the summary cards with investment data
     */
    function updateSummary(investments) {
        // Calculate total values
        let totalCurrentValue = 0;
        let totalInitialValue = 0;
        let totalProfit = 0;
        
        investments.forEach(investment => {
            // Current value
            if (investment.current_value) {
                totalCurrentValue += parseFloat(investment.current_value);
            }
            
            // Initial value
            if (investment.investment_type === 'bank') {
                totalInitialValue += parseFloat(investment.quantity);
            } else {
                totalInitialValue += parseFloat(investment.quantity) * parseFloat(investment.purchase_price);
            }
        });
        
        // Calculate profit
        totalProfit = totalCurrentValue - totalInitialValue;
        const profitPercentage = totalInitialValue > 0 ? (totalProfit / totalInitialValue) * 100 : 0;
        
        // Update summary cards
        const totalValueEl = document.getElementById('total-investment-value');
        if (totalValueEl) {
            totalValueEl.textContent = `${formatCurrency(totalCurrentValue)} лв.`;
        }
        
        const totalChangeElement = document.getElementById('total-investment-change');
        if (totalChangeElement) {
            totalChangeElement.textContent = `${profitPercentage >= 0 ? '+' : ''}${profitPercentage.toFixed(2)}% от първоначалната инвестиция`;
            totalChangeElement.className = `change ${profitPercentage >= 0 ? 'positive' : 'negative'}`;
        }
        
        const totalProfitEl = document.getElementById('total-investment-profit');
        if (totalProfitEl) {
            totalProfitEl.textContent = `${formatCurrency(totalProfit)} лв.`;
        }
        
        const profitPercentageElement = document.getElementById('profit-percentage');
        if (profitPercentageElement) {
            profitPercentageElement.textContent = `${profitPercentage >= 0 ? '+' : ''}${profitPercentage.toFixed(2)}%`;
            profitPercentageElement.className = `change ${profitPercentage >= 0 ? 'positive' : 'negative'}`;
        }
    }
    
    /**
     * Setup and update the history chart
     */
    function setupHistoryChart() {
        const chartEl = document.getElementById('investment-history-chart');
        if (!chartEl) return;
        
        const ctx = chartEl.getContext('2d');
        
        // Create empty chart initially
        historyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: displayNames[apiType] || 'Инвестиции',
                    data: [],
                    borderColor: colorMap[apiType] || '#6dc0e0',
                    backgroundColor: `${colorMap[apiType]}20` || '#6dc0e020',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
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
                                    label += formatCurrency(context.parsed.y) + ' лв.';
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
                            color: '#ccc'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#ccc',
                            callback: function(value) {
                                return formatCurrency(value) + ' лв.';
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
     * Update the history chart with investment data
     */
    function updateHistoryChart(investments) {
        if (!historyChart) return;
        
        // Generate monthly data points for the last 6 months
        const labels = [];
        const dataPoints = [];
        
        // Get the last 6 months
        const today = new Date();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            labels.push(date.toLocaleDateString('bg-BG', { month: 'short', year: 'numeric' }));
            
            // Initialize with zero
            dataPoints.push(0);
        }
        
        // Populate data points based on investments
        investments.forEach(investment => {
            const purchaseDate = new Date(investment.purchase_date);
            
            for (let i = 0; i < labels.length; i++) {
                const monthDate = parseMonthLabel(labels[i]);
                
                // Skip if investment was made after this month
                if (purchaseDate > monthDate) continue;
                
                // Calculate value based on investment type
                if (apiInvestmentType === 'bank') {
                    // Calculate bank deposit value with interest
                    const initialValue = parseFloat(investment.quantity || investment.amount);
                    const interestRate = parseFloat(investment.interest_rate) / 100;
                    const monthsHeld = monthsBetween(purchaseDate, monthDate);
                    
                    let value = initialValue;
                    
                    // Apply interest based on type
                    switch(investment.interest_type) {
                        case 'daily':
                            value *= (1 + (interestRate * (monthsHeld * 30) / 365));
                            break;
                        case 'monthly_1':
                            value *= (1 + (interestRate * monthsHeld / 12));
                            break;
                        case 'monthly_3':
                            value *= (1 + (interestRate * Math.floor(monthsHeld / 3) / 4));
                            break;
                        case 'monthly_6':
                            value *= (1 + (interestRate * Math.floor(monthsHeld / 6) / 2));
                            break;
                        case 'yearly':
                        default:
                            value *= (1 + (interestRate * Math.floor(monthsHeld / 12)));
                            break;
                    }
                    
                    dataPoints[i] += value;
                } else {
                    // For other investments, estimate based on current value
                    const initialValue = parseFloat(investment.quantity) * parseFloat(investment.purchase_price);
                    const currentValue = parseFloat(investment.current_value || initialValue);
                    
                    // Linear growth estimation between purchase and now
                    const totalMonths = monthsBetween(purchaseDate, today);
                    const growthPerMonth = totalMonths > 0 ? (currentValue - initialValue) / totalMonths : 0;
                    const monthsFromPurchase = monthsBetween(purchaseDate, monthDate);
                    
                    const estimatedValue = initialValue + (growthPerMonth * monthsFromPurchase);
                    dataPoints[i] += estimatedValue;
                }
            }
        });
        
        // Update chart data
        historyChart.data.labels = labels;
        historyChart.data.datasets[0].data = dataPoints;
        historyChart.update();
    }
    
    /**
     * Generate insights based on investment data
     */
    function generateInsights(investments) {
        const insightsContainer = document.getElementById('investment-insights');
        if (!insightsContainer) return;
        
        // Reset insights container
        insightsContainer.innerHTML = '<h2>Анализ на инвестициите</h2>';
        
        // If no investments, show default message
        if (!investments || investments.length === 0) {
            const noInsightsMsg = document.createElement('div');
            noInsightsMsg.className = 'insight-card';
            noInsightsMsg.innerHTML = `
                <p class="insight-description">Добавете инвестиции, за да видите анализ и препоръки.</p>
            `;
            insightsContainer.appendChild(noInsightsMsg);
            return;
        }
        
        // Generate insights based on investment type
        if (apiInvestmentType === 'bank') {
            generateBankInsights(investments, insightsContainer);
        } else if (apiInvestmentType === 'crypto') {
            generateCryptoInsights(investments, insightsContainer);
        } else if (apiInvestmentType === 'stock') {
            generateStockInsights(investments, insightsContainer);
        } else if (apiInvestmentType === 'metal') {
            generateMetalInsights(investments, insightsContainer);
        }
    }
    
    /**
     * Generate insights for bank investments
     */
    function generateBankInsights(investments, container) {
        // Calculate average interest rate
        let totalInterestRate = 0;
        investments.forEach(inv => {
            totalInterestRate += parseFloat(inv.interest_rate);
        });
        const avgInterestRate = totalInterestRate / investments.length;
        
        // Average interest rate insight
        const avgRateInsight = document.createElement('div');
        avgRateInsight.className = 'insight-card';
        avgRateInsight.innerHTML = `
            <h3 class="insight-title">Среден лихвен процент</h3>
            <p class="insight-description">
                Средният лихвен процент на вашите депозити е ${avgInterestRate.toFixed(2)}%.
                ${avgInterestRate < 3 ? 'Можете да потърсите банки, които предлагат по-високи лихви.' : 'Вашите депозити имат добра лихвена доходност.'}
            </p>
        `;
        container.appendChild(avgRateInsight);
        
        // Currency diversification insight
        const currencies = {};
        investments.forEach(inv => {
            if (!currencies[inv.currency]) {
                currencies[inv.currency] = 0;
            }
            currencies[inv.currency] += parseFloat(inv.quantity || inv.amount);
        });
        
        const currencyInsight = document.createElement('div');
        currencyInsight.className = 'insight-card';
        currencyInsight.innerHTML = `
            <h3 class="insight-title">Валутна диверсификация</h3>
            <p class="insight-description">
                Вашите депозити са разпределени в ${Object.keys(currencies).length} валути.
                ${Object.keys(currencies).length < 2 ? 'Можете да помислите за диверсификация в повече валути, за да намалите валутния риск.' : 'Добра диверсификация на валутите.'}
            </p>
        `;
        container.appendChild(currencyInsight);
    }
    
    /**
     * Generate insights for crypto investments
     */
    function generateCryptoInsights(investments, container) {
        // Check if portfolio is diversified
        const cryptoTypes = new Set(investments.map(inv => inv.symbol));
        
        const diversificationInsight = document.createElement('div');
        diversificationInsight.className = 'insight-card';
        diversificationInsight.innerHTML = `
            <h3 class="insight-title">Диверсификация</h3>
            <p class="insight-description">
                Вашето крипто портфолио съдържа ${cryptoTypes.size} различни криптовалути.
                ${cryptoTypes.size < 3 ? 'Препоръчваме по-голяма диверсификация за намаляване на риска.' : 'Добра диверсификация на портфолиото.'}
            </p>
        `;
        container.appendChild(diversificationInsight);
        
        // Volatility insight
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
     * Generate insights for stock investments
     */
    function generateStockInsights(investments, container) {
        // Calculate performance
        let totalProfit = 0;
        let totalInvestment = 0;
        
        investments.forEach(inv => {
            const initialValue = parseFloat(inv.quantity) * parseFloat(inv.purchase_price);
            totalInvestment += initialValue;
            
            if (inv.current_value) {
                totalProfit += parseFloat(inv.current_value) - initialValue;
            }
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
        
        // Sector diversification insight
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
     * Generate insights for metal investments
     */
    function generateMetalInsights(investments, container) {
        // Inflation hedge insight
        const inflationInsight = document.createElement('div');
        inflationInsight.className = 'insight-card';
        inflationInsight.innerHTML = `
            <h3 class="insight-title">Защита от инфлация</h3>
            <p class="insight-description">
                Благородните метали често се използват като защита срещу инфлация и икономическа несигурност.
            </p>
        `;
        container.appendChild(inflationInsight);
        
        // Portfolio allocation insight
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
        if (!modal) return;
        
        // Reset form
        if (form) form.reset();
        
        // Set modal title
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) modalTitle.textContent = 'Добави нова инвестиция';
        
        // Hide delete button for new investments
        if (deleteBtn) deleteBtn.style.display = 'none';
        
        // Show the modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent scrolling
        
        // Set default date to today
        const dateInput = document.getElementById('investmentDate');
        if (dateInput) dateInput.valueAsDate = new Date();
        
        // Reset current investment ID
        currentInvestmentId = null;
    }
    
    /**
     * Open edit investment modal
     */
    function openEditModal(investmentId) {
        if (!modal || !investmentId) return;
        
        console.log(`Opening edit modal for investment ID: ${investmentId}`);
        
        // Set current investment ID
        currentInvestmentId = investmentId;
        
        // Set modal title
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) modalTitle.textContent = 'Редактирай инвестиция';
        
        // Show delete button for existing investments
        if (deleteBtn) deleteBtn.style.display = 'block';
        
        // Determine API endpoint based on investment type
        let apiEndpoint;
        
        if (apiInvestmentType === 'bank') {
            apiEndpoint = `/api/bank-investments/${investmentId}`;
        } else {
            apiEndpoint = `/api/investments/${investmentId}`;
        }
        
        // Show loading state
        // (We could add a loading indicator to the modal)
        
        // Fetch investment data
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
            // Extract investment data
            const investment = data.data || {};
            
            console.log('Investment data for edit:', investment);
            
            // Set hidden investment ID
            const idInput = document.getElementById('investmentId');
            if (idInput) idInput.value = investmentId;
            
            // Populate form fields based on investment type
            if (apiInvestmentType === 'bank') {
                populateBankForm(investment);
            } else {
                populateStandardForm(investment);
            }
            
            // Show the modal
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent scrolling
        })
        .catch(error => {
            console.error('Error loading investment data:', error);
            Notify.error('Грешка', `Неуспешно зареждане на данни: ${error.message}`);
        });
    }
    
    /**
     * Populate form fields for bank investment
     */
    function populateBankForm(investment) {
        // Basic validation
        if (!investment) return;
        
        // Currency
        const currencyInput = document.getElementById('depositCurrency');
        if (currencyInput) currencyInput.value = investment.currency || 'BGN';
        
        // Amount
        const amountInput = document.getElementById('depositAmount');
        if (amountInput) amountInput.value = investment.quantity || investment.amount;
        
        // Interest rate
        const rateInput = document.getElementById('interestRate');
        if (rateInput) rateInput.value = investment.interest_rate || 0;
        
        // Interest type
        const typeInput = document.getElementById('interestType');
        if (typeInput) typeInput.value = investment.interest_type || 'yearly';
        
        // Date
        const dateInput = document.getElementById('investmentDate');
        if (dateInput && investment.purchase_date) {
            // Format date for input field (YYYY-MM-DD)
            const date = new Date(investment.purchase_date);
            dateInput.value = date.toISOString().split('T')[0];
        }
        
        // Notes
        const notesInput = document.getElementById('investmentNotes');
        if (notesInput) notesInput.value = investment.notes || '';
    }
    
    /**
     * Populate form fields for standard investment (crypto, stock, metal)
     */
    function populateStandardForm(investment) {
        // Basic validation
        if (!investment) return;
        
        // Symbol
        const symbolInput = document.getElementById('investmentSymbol');
        if (symbolInput) {
            // Check if the symbol exists in the dropdown
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
                option.text = investment.symbol;
                symbolInput.add(option);
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
            // Format date for input field (YYYY-MM-DD)
            const date = new Date(investment.purchase_date);
            dateInput.value = date.toISOString().split('T')[0];
        }
        
        // Notes
        const notesInput = document.getElementById('investmentNotes');
        if (notesInput) notesInput.value = investment.notes || '';
    }
    
    /**
     * Close the modal
     */
    function closeModal() {
        if (!modal) return;
        
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Re-enable scrolling
        
        // Reset form
        if (form) form.reset();
        
        // Reset current investment ID
        currentInvestmentId = null;
    }
    
    /**
     * Open confirmation dialog
     */
    function openConfirmDialog(title, message) {
        if (!confirmDialog) return;
        
        // Set dialog content
        const titleElement = confirmDialog.querySelector('.modal-header h2');
        if (titleElement) titleElement.textContent = title;
        
        const messageElement = document.getElementById('confirmMessage');
        if (messageElement) messageElement.textContent = message;
        
        // Set confirm action
        if (confirmActionBtn) {
            confirmActionBtn.onclick = function() {
                closeConfirmDialog();
                deleteInvestment(currentInvestmentId);
            };
        }
        
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
        if (!investmentId) {
            console.error('No investment ID provided for delete');
            return;
        }
        
        // Determine API endpoint based on investment type
        let apiEndpoint;
        
        if (apiInvestmentType === 'bank') {
            apiEndpoint = `/api/bank-investments/${investmentId}`;
        } else {
            apiEndpoint = `/api/investments/${investmentId}`;
        }
        
        console.log(`Deleting investment with ID ${investmentId} from ${apiEndpoint}`);
        
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
            Notify.success('Успех', 'Инвестицията беше изтрита успешно!');
            
            // Reload investments data
            loadInvestments();
        })
        .catch(error => {
            console.error('Error deleting investment:', error);
            Notify.error('Грешка', `Неуспешно изтриване на инвестиция: ${error.message}`);
        });
    }
    
    /**
     * Handle form submission (create/update investment)
     */
    function handleFormSubmit(event) {
        event.preventDefault();
        
        if (!form) return;
        
        // Get form data
        const formData = new FormData(form);
        
        // Determine API endpoint and HTTP method
        let apiEndpoint, method;
        
        if (currentInvestmentId) {
            // Update existing investment
            method = 'PUT';
            
            if (apiInvestmentType === 'bank') {
                apiEndpoint = `/api/bank-investments/${currentInvestmentId}`;
            } else {
                apiEndpoint = `/api/investments/${currentInvestmentId}`;
            }
        } else {
            // Create new investment
            method = 'POST';
            
            if (apiInvestmentType === 'bank') {
                apiEndpoint = '/api/bank-investments';
            } else {
                apiEndpoint = '/api/investments';
            }
        }
        
        // Prepare data based on investment type
        let requestData = {};
        
        if (apiInvestmentType === 'bank') {
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
                type: apiInvestmentType,
                symbol: formData.get('investmentSymbol'),
                amount: parseFloat(formData.get('investmentAmount')),
                price: parseFloat(formData.get('investmentPrice')),
                currency: formData.get('investmentCurrency'),
                date: formData.get('investmentDate'),
                notes: formData.get('investmentNotes') || null
            };
        }
        
        console.log(`Submitting ${method} request to ${apiEndpoint} with data:`, requestData);
        
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
            const actionType = currentInvestmentId ? 'обновена' : 'добавена';
            Notify.success('Успех', `Инвестицията беше ${actionType} успешно!`);
            
            // Reload investments data
            loadInvestments();
        })
        .catch(error => {
            console.error('Error saving investment:', error);
            Notify.error('Грешка', `Неуспешно запазване на инвестиция: ${error.message}`);
        });
    }
    
    /**
     * Format currency value
     */
    function formatCurrency(value) {
        // Handle undefined or null values
        if (value === undefined || value === null) {
            return '0.00';
        }
        
        // Parse value to number if it's a string
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        
        // Handle NaN
        if (isNaN(numValue)) {
            return '0.00';
        }
        
        // Format the number with 2 decimal places and thousands separators
        return numValue.toLocaleString('bg-BG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
    
    function formatQuantity(value) {
        // Handle undefined, null, or invalid values
        if (value === undefined || value === null || isNaN(parseFloat(value))) {
            return '0';
        }
        
        // Parse value to number if it's a string
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        
        // For small values (like crypto), show more decimal places
        if (numValue < 0.01) {
            return numValue.toLocaleString('bg-BG', {
                minimumFractionDigits: 4,
                maximumFractionDigits: 8
            });
        }
        
        // For larger values, show standard 2 decimal places
        return numValue.toLocaleString('bg-BG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
    
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
    
    /**
     * Show loading state
     */
    function showLoading() {
        // Add loading indicator to table
        const tableBody = document.getElementById('investments-table-body');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr class="loading-row">
                    <td colspan="6" style="text-align: center; padding: 2rem;">
                        <div style="display: inline-block; width: 30px; height: 30px; border: 3px solid #3c3c3c; border-top: 3px solid ${colorMap[apiType]}; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <p style="margin-top: 1rem; color: #ccc;">Зареждане на инвестиции...</p>
                    </td>
                </tr>
            `;
        }
        
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
     * Hide loading state
     */
    function hideLoading() {
        // Remove loading indicator from table
        const loadingRow = document.querySelector('.loading-row');
        if (loadingRow) {
            loadingRow.remove();
        }
    }
    
    // These functions are placeholders - implement them based on your application needs
    function updateHistoryChart() { /* Implementation skipped for brevity */ }
    function updateInsights() { /* Implementation skipped for brevity */ }
    function openAddModal() { /* Implementation skipped for brevity */ }
    function openEditModal() { /* Implementation skipped for brevity */ }
    function closeModal() { /* Implementation skipped for brevity */ }
    function confirmDelete() { /* Implementation skipped for brevity */ }
    function openConfirmDialog() { /* Implementation skipped for brevity */ }
    function closeConfirmDialog() { /* Implementation skipped for brevity */ }
    function handleFormSubmit() { /* Implementation skipped for brevity */ }
});