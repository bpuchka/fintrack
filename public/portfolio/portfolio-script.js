document.addEventListener('DOMContentLoaded', function() {
    initializeRealtimePrices();
    const today = new Date();
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    document.getElementById('last-updated-date').textContent = today.toLocaleDateString('bg-BG', options);
    
    // Load portfolio data from the server
    loadPortfolioData();
    document.dispatchEvent(new CustomEvent('portfolioDataLoaded'));
    // Pie Chart for Investment Distribution - will be updated when data loads
    const ctx = document.getElementById('investment-chart').getContext('2d');
    const investmentChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Банков влог', 'Крипто', 'Акции', 'Метали'],
            datasets: [{
                data: [34.1, 22.0, 37.1, 6.8], // Default data, will be updated
                backgroundColor: [
                    '#6dc0e0',
                    '#8e44ad',
                    '#27ae60',
                    '#f39c12'
                ],
                borderColor: '#2c2c2c',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'right',
                    labels: {
                        color: '#ffffff',
                        font: {
                            size: 14,
                            family: "'Poppins', sans-serif"
                        },
                        padding: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.raw}%`;
                        }
                    }
                }
            }
        }
    });
    
    // Modified loadPortfolioData function to handle potential missing data
    async function loadPortfolioData() {
        try {
            const response = await fetch('/api/investments/summary');
            if (!response.ok) {
                throw new Error('Failed to load portfolio data');
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Error loading portfolio data');
            }
            
            // Store data globally for access by other functions
            window.portfolioData = data;
            
            // Make sure all necessary properties exist to avoid errors
            if (!data.summary) {
                data.summary = {
                    totalInvested: 0,
                    totalCurrentValue: 0,
                    profitPercentage: 0,
                    monthlyProfit: 0,
                    byType: {
                        bank: { amount: 0, percentage: 0 },
                        crypto: { amount: 0, percentage: 0 },
                        stock: { amount: 0, percentage: 0 },
                        metal: { amount: 0, percentage: 0 }
                    }
                };
            }
            
            // Update portfolio value in the UI
            const totalValueElement = document.querySelector('.total-value .amount');
            if (totalValueElement) {
                totalValueElement.textContent = 
                    `${formatCurrency(data.summary.totalCurrentValue)} лв.`;
            }
            
            // Calculate total initial investment value and total current value
            let totalInitialValue = 0;
            let totalCurrentValue = 0;
            
            if (data.investments && data.investments.length > 0) {
                data.investments.forEach(investment => {
                    // For each investment, add the initial purchase value
                    const initialValue = investment.quantity * investment.purchase_price;
                    totalInitialValue += initialValue;
                    
                    // Add the current value
                    totalCurrentValue += investment.current_value || initialValue;
                });
            } else {
                // If no investments are found, use the summary data
                totalInitialValue = data.summary.totalInvested || 0;
                totalCurrentValue = data.summary.totalCurrentValue || 0;
            }
            
            // Calculate percentage change from initial to current value
            let percentageChange = 0;
            if (totalInitialValue > 0) {
                percentageChange = ((totalCurrentValue / totalInitialValue) - 1) * 100;
            }
            
            // Update profit/change with the calculated percentage
            const profitElement = document.querySelector('.total-value .change');
            if (profitElement) {
                const profitPercentage = percentageChange.toFixed(1);
                profitElement.textContent = `${profitPercentage >= 0 ? '+' : ''}${profitPercentage}% от първоначалната инвестиция`;
                profitElement.className = `change ${profitPercentage >= 0 ? 'positive' : 'negative'}`;
            }
            
            // Update monthly profit
            const monthlyProfitElement = document.querySelector('.monthly-profit .amount');
            if (monthlyProfitElement && data.summary.monthlyProfit !== undefined) {
                monthlyProfitElement.textContent = `${formatCurrency(data.summary.monthlyProfit)} лв.`;
            }
            
            // Update pie chart with distribution data
            if (data.summary.byType) {
                updateInvestmentChart(data.summary.byType);
            }
            
            // Update investment list
            updateInvestmentList(data.investments, data.summary);
        } catch (error) {
            console.error('Error loading portfolio data:', error);
            // Continue with default values if data can't be loaded
        }
    }
    
    // Function to update the investment chart with real data
    function updateInvestmentChart(typeData) {
        if (!typeData) return;
        
        // Extract percentages for each investment type
        const chartData = [
            typeData.bank.percentage || 0,
            typeData.crypto.percentage || 0,
            typeData.stock.percentage || 0,
            typeData.metal.percentage || 0
        ];
        
        // Update chart data
        investmentChart.data.datasets[0].data = chartData;
        
        // Update chart
        investmentChart.update();
    }
    
    // Function to update the investment list with real data
    function updateInvestmentList(investments, summary) {
        if (!investments || !summary) return;
        
        const container = document.querySelector('.investment-list');
        if (!container) return;
        
        container.innerHTML = ''; // Clear current items
        
        // Define colors for each type
        const colors = {
            bank: '#6dc0e0',
            crypto: '#8e44ad',
            stock: '#27ae60',
            metal: '#f39c12'
        };
        
        // Define display names for each type
        const typeNames = {
            bank: 'Банков влог',
            crypto: 'Крипто',
            stock: 'Акции',
            metal: 'Метали'
        };
        
        // Add an item for each investment type that has value
        for (const type in summary.byType) {
            // Skip types with no value or undefined amount
            if (!summary.byType[type] || !summary.byType[type].amount) continue;
            
            // Only show types with positive values
            if (summary.byType[type].amount > 0) {
                // Create the investment item
                const item = document.createElement('div');
                item.className = 'investment-item';
                
                // Format value with currency
                const displayValue = `${formatCurrency(summary.byType[type].amount, 'BGN')} лв.`;
                
                item.innerHTML = `
                    <div class="investment-info">
                        <div class="investment-color" style="background-color: ${colors[type]};"></div>
                        <div class="investment-name">${typeNames[type]}</div>
                    </div>
                    <div class="investment-value-container">
                        <div class="investment-value">${displayValue}</div>
                    </div>
                    <div class="investment-percentage">${formatCurrency(summary.byType[type].percentage)}%</div>
                `;
                
                container.appendChild(item);
                
                // Find investments of this type
                const typeInvestments = investments.filter(inv => inv.investment_type === type);
                
                // If we have more than 0 but fewer than 6 investments of this type, show details
                if (typeInvestments.length > 0 && typeInvestments.length < 6) {
                    // Add a details section for this type
                    const detailsContainer = document.createElement('div');
                    detailsContainer.className = 'investment-item-detail';
                    
                    typeInvestments.forEach(inv => {
                        // Check if the current_value exists before using it
                        const currentValue = inv.current_value !== undefined ? inv.current_value : inv.quantity * inv.purchase_price;
                        const currentValueBgn = inv.current_value_bgn !== undefined ? inv.current_value_bgn : inv.quantity * inv.purchase_price;
                        
                        // Format value with original currency if not BGN
                        let valueDisplay = '';
                        
                        if (inv.currency && inv.currency !== 'BGN') {
                            valueDisplay = `
                                <span>${formatCurrency(currentValue, inv.currency)} ${inv.currency}</span>
                                <span class="investment-currency-tag">≈ ${formatCurrency(currentValueBgn, 'BGN')} лв.</span>
                            `;
                        } else {
                            valueDisplay = `${formatCurrency(currentValueBgn, 'BGN')} лв.`;
                        }
                        
                        const detail = document.createElement('div');
                        detail.className = 'investment-meta';
                        detail.innerHTML = `
                            <span>${inv.symbol} (${parseFloat(inv.quantity).toString()})</span>
                        `;
                        
                        detailsContainer.appendChild(detail);
                    });
                    
                    item.appendChild(detailsContainer);
                }
            }
        }
        
        // If no investments, show a message
        if (container.children.length === 0) {
            container.innerHTML = '<p class="no-investments">Нямате инвестиции. Добавете нова инвестиция, за да започнете.</p>';
        }
    }
    
    // Asset data including listing dates
    const assetData = {
        crypto: {
            BTC: { name: "Bitcoin", listingDate: "2010-07-17" },
            ETH: { name: "Ethereum", listingDate: "2015-07-30" },
            USDT: { name: "Tether", listingDate: "2015-02-25" },
            SOL: { name: "Solana", listingDate: "2020-04-10" },
            XRP: { name: "Ripple", listingDate: "2013-08-04" }
        },
        stock: {
            AAPL: { name: "Apple Inc.", listingDate: "1980-12-12" },
            TSLA: { name: "Tesla Inc.", listingDate: "2010-06-29" },
            NVDA: { name: "NVIDIA Corporation", listingDate: "1999-01-22" }
        },
        metal: {
            GLD: { name: "SPDR Gold Shares", listingDate: "2004-11-18" },
            SLV: { name: "iShares Silver Trust", listingDate: "2006-04-21" }
        }
    };

    // Function to format currency values with proper formatting
    function formatCurrency(value, currency = 'BGN') {
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
    
    // Form elements
    const modal = document.getElementById('newInvestmentModal');
    const newInvestmentBtn = document.getElementById('newInvestmentBtn');
    const closeBtn = document.querySelector('.close-modal');
    const cancelBtn = document.getElementById('cancelInvestment');
    const form = document.getElementById('newInvestmentForm');
    const investmentType = document.getElementById('investmentType');
    const standardFields = document.getElementById('standardFields');
    const bankDepositFields = document.getElementById('bankDepositFields');
    const investmentSymbol = document.getElementById('investmentSymbol');
    const investmentDate = document.getElementById('investmentDate');
    const interestRate = document.getElementById('interestRate');
    
    // Set default date to today
    if (investmentDate) {
        investmentDate.valueAsDate = new Date();
    }
    
    // Function to populate symbol dropdown based on investment type
    function populateSymbolDropdown(type) {
        // Clear current options
        investmentSymbol.innerHTML = '<option value="" disabled selected>Изберете символ</option>';
        
        if (type === 'crypto' || type === 'stock' || type === 'metal') {
            const symbols = assetData[type];
            
            for (const symbol in symbols) {
                const option = document.createElement('option');
                option.value = symbol;
                option.textContent = `${symbol} - ${symbols[symbol].name}`;
                option.dataset.listingDate = symbols[symbol].listingDate;
                investmentSymbol.appendChild(option);
            }
        }
    }
    
    // Function to validate purchase date
    function validatePurchaseDate() {
        const selectedOption = investmentSymbol.options[investmentSymbol.selectedIndex];
        if (selectedOption && selectedOption.dataset.listingDate) {
            const listingDate = new Date(selectedOption.dataset.listingDate);
            const purchaseDate = new Date(investmentDate.value);
            
            // Set min date attribute
            investmentDate.min = selectedOption.dataset.listingDate;
            
            if (purchaseDate < listingDate) {
                investmentDate.setCustomValidity(`Датата не може да бъде преди листването на ${selectedOption.textContent} (${selectedOption.dataset.listingDate})`);
            } else {
                investmentDate.setCustomValidity('');
            }
        }
    }
    
    // Function to validate interest rate
    function validateInterestRate() {
        const rate = parseFloat(interestRate.value);
        if (isNaN(rate)) {
            interestRate.setCustomValidity('Моля, въведете валиден процент');
        } else if (rate < 0) {
            interestRate.setCustomValidity('Лихвеният процент не може да бъде отрицателен');
        } else if (rate > 100) {
            interestRate.setCustomValidity('Лихвеният процент не може да надвишава 100%');
        } else {
            interestRate.setCustomValidity('');
        }
    }
    
    // Only set up form handlers if the form exists
    if (form) {
        // Event listeners for form fields
        investmentType.addEventListener('change', function() {
            if (this.value === 'bank') {
                standardFields.style.display = 'none';
                bankDepositFields.style.display = 'block';
                
                // Update required attributes
                document.querySelectorAll('#standardFields input, #standardFields select').forEach(input => {
                    input.required = false;
                });
                document.querySelectorAll('#bankDepositFields input, #bankDepositFields select').forEach(input => {
                    if (input.id !== 'investmentNotes') {
                        input.required = true;
                    }
                });
            } else {
                standardFields.style.display = 'block';
                bankDepositFields.style.display = 'none';
                
                // Update required attributes
                document.querySelectorAll('#standardFields input, #standardFields select').forEach(input => {
                    input.required = true;
                });
                document.querySelectorAll('#bankDepositFields input, #bankDepositFields select').forEach(input => {
                    input.required = false;
                });
                
                // Populate dropdown with appropriate symbols
                populateSymbolDropdown(this.value);
            }
        });

        // Add this to handle currency selection
        const investmentCurrency = document.getElementById('investmentCurrency');
        const investmentPrice = document.getElementById('investmentPrice');

        // Update price label based on selected currency
        if (investmentCurrency && investmentPrice) {
            investmentCurrency.addEventListener('change', function() {
                const selectedCurrency = this.value;
                const priceLabel = investmentPrice.previousElementSibling;
                if (priceLabel && priceLabel.tagName === 'LABEL') {
                    priceLabel.textContent = `Покупна цена (${selectedCurrency})`;
                }
            });
        }
        
        // Interest rate validation
        if (interestRate) {
            interestRate.addEventListener('input', validateInterestRate);
            interestRate.addEventListener('change', validateInterestRate);
        }
        
        // Validate date when symbol changes
        investmentSymbol.addEventListener('change', validatePurchaseDate);
        
        // Validate date when date changes
        investmentDate.addEventListener('change', validatePurchaseDate);
        
        // Open modal
        newInvestmentBtn.onclick = function() {
            modal.style.display = "flex";
            document.body.style.overflow = "hidden"; // Prevent scrolling
        }
        
        // Close modal functions
        function closeModal() {
            modal.style.display = "none";
            document.body.style.overflow = "auto"; // Enable scrolling
            form.reset(); // Reset form when closing
        }
        
        closeBtn.onclick = closeModal;
        cancelBtn.onclick = closeModal;
        
        // Close when clicking outside of modal
        window.onclick = function(event) {
            if (event.target == modal) {
                closeModal();
            }
        }
        
        // Form submission
        form.onsubmit = function(e) {
            e.preventDefault();
            
            // Show loading state
            const submitButton = form.querySelector('.submit-button');
            const originalButtonText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = 'Обработва се...';
            
            // Get form data
            const formData = new FormData(form);
            const investmentData = Object.fromEntries(formData.entries());
            
            // Add additional processing based on investment type
            const type = investmentData.investmentType;
            
            // Determine the right API endpoint
            let apiEndpoint = '/api/investments';
            
            // Construct the API payload differently based on type
            let payload;
            
            if (type === 'bank') {
                // For bank investments, use a different endpoint
                apiEndpoint = '/api/bank-investments';
                
                // Validate interest rate once more before submission
                const rate = parseFloat(investmentData.interestRate);
                if (rate < 0 || rate > 100) {
                    alert('Лихвеният процент трябва да бъде между 0 и 100%');
                    submitButton.disabled = false;
                    submitButton.textContent = originalButtonText;
                    return;
                }
                
                // Format bank investment data in the way the API expects
                payload = {
                    amount: parseFloat(investmentData.depositAmount),
                    interest_rate: parseFloat(investmentData.interestRate),
                    interest_type: investmentData.interestType,
                    investment_date: investmentData.investmentDate,
                    currency: investmentData.depositCurrency,
                    notes: investmentData.investmentNotes || ''
                };
            } else {
                // Handle very small quantities with full precision
                let quantity = parseFloat(investmentData.investmentAmount);
                
                payload = {
                    type: investmentData.investmentType,
                    symbol: investmentData.investmentSymbol,
                    amount: quantity,
                    price: parseFloat(investmentData.investmentPrice),
                    currency: investmentData.investmentCurrency || 'BGN',
                    date: investmentData.investmentDate,
                    notes: investmentData.investmentNotes || ''
                };
            }
            
            // Log payload for debugging
            console.log('Payload being sent:', payload);
            console.log('API Endpoint:', apiEndpoint);
            
            // Send data to server
            fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                },
                body: JSON.stringify(payload),
                credentials: 'same-origin' // Include cookies for session authentication
            })
            .then(response => {
                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error('Не сте влезли в профила си. Моля, влезте и опитайте отново.');
                    } else if (response.status === 403) {
                        throw new Error('Нямате права за тази операция.');
                    } else if (response.status === 422) {
                        return response.json().then(data => {
                            throw new Error(`Грешка при валидация: ${data.message || 'Моля, проверете въведените данни.'}`);
                        });
                    } else {
                        throw new Error('Възникна грешка при обработката на заявката.');
                    }
                }
                return response.json();
            })
            .then(data => {
                // Show success message
                alert('Инвестицията беше добавена успешно!');
                closeModal();
                
                // Update the UI or reload to show the new investment
                location.reload();
            })
            .catch(error => {
                console.error('Error:', error);
                alert(error.message || 'Възникна грешка при добавяне на инвестицията. Моля, опитайте отново.');
            })
            .finally(() => {
                // Restore button state
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            });
        };
    }

    document.addEventListener('portfolioDataLoaded', function(event) {
        // Initialize real-time price updates
        initializeRealtimePrices();
    });
    
    // Function to initialize real-time price updates
    function initializeRealtimePrices() {
        // Initialize the real-time price system
        if (window.RealtimePrices) {
            RealtimePrices.init({
                autoRefresh: true,
                refreshRate: 60000 // 1 minute
            });
            
            // Add real-time price indicators to the page
            addPriceIndicators();
            
            // Do an initial refresh of prices
            RealtimePrices.refreshAllPrices();
        } else {
            console.warn('RealtimePrices not available. Real-time updates disabled.');
        }
    }
    
    // Function to add price indicators to the page
    function addPriceIndicators() {
        // Get all investment items from the page
        const investmentItems = document.querySelectorAll('.investment-item');
        
        investmentItems.forEach(item => {
            // Get the investment name from the item
            const nameElement = item.querySelector('.investment-name');
            if (!nameElement) return;
            
            const name = nameElement.textContent.trim();
            
            // Extract the symbol
            const symbol = extractSymbol(name);
            if (!symbol) return;
            
            // Add real-time indicator to the investment value
            const valueElement = item.querySelector('.investment-value');
            if (valueElement) {
                // Add a small indicator icon for real-time data
                const indicator = document.createElement('span');
                indicator.className = 'realtime-indicator';
                indicator.innerHTML = '<i class="fas fa-sync"></i>';
                indicator.title = 'Real-time price updates enabled';
                valueElement.appendChild(indicator);
                
                // Add data attributes for the real-time price system
                valueElement.setAttribute('data-price-symbol', symbol);
                valueElement.setAttribute('data-price-display', 'price');
                valueElement.setAttribute('data-show-currency', 'true');
            }
            
            // Also add to percentage element if it exists
            const percentageElement = item.querySelector('.investment-percentage');
            if (percentageElement) {
                percentageElement.setAttribute('data-price-symbol', symbol);
                percentageElement.setAttribute('data-price-display', 'change-percent');
            }
        });
        
        // Add indicator to main value display
        const totalValueElement = document.querySelector('.total-value .amount');
        if (totalValueElement) {
            const liveTag = document.createElement('span');
            liveTag.className = 'live-tag';
            liveTag.textContent = 'LIVE';
            totalValueElement.appendChild(liveTag);
        }
        
        // Add CSS for indicators
        addIndicatorStyles();
    }
    
    // Extract symbol from investment name
    function extractSymbol(name) {
        // Special handling for different investment types
        if (name.includes('Банков влог') || name.includes('Депозит')) {
            return null; // Bank deposits don't have real-time prices
        }
        
        // For crypto, stocks, etc. the name often contains the symbol
        const matches = name.match(/^([A-Z0-9]{1,5})\b/);
        if (matches && matches[1]) {
            return matches[1];
        }
        
        // If nothing matched, try to handle some common cases
        if (name.includes('Bitcoin') || name.toLowerCase().includes('биткойн')) return 'BTC';
        if (name.includes('Ethereum') || name.toLowerCase().includes('етериум')) return 'ETH';
        if (name.includes('Apple')) return 'AAPL';
        if (name.includes('Tesla')) return 'TSLA';
        if (name.includes('NVIDIA')) return 'NVDA';
        if (name.includes('Gold') || name.toLowerCase().includes('злато')) return 'GLD';
        if (name.includes('Silver') || name.toLowerCase().includes('сребро')) return 'SLV';
        
        return null;
    }
    
    // Add CSS for real-time indicators
    function addIndicatorStyles() {
        if (document.getElementById('realtime-indicator-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'realtime-indicator-styles';
        style.innerHTML = `
            .realtime-indicator {
                display: inline-block;
                margin-left: 6px;
                font-size: 80%;
                color: #6dc0e0;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0% { opacity: 0.6; }
                50% { opacity: 1; }
                100% { opacity: 0.6; }
            }
            
            .live-tag {
                display: inline-block;
                margin-left: 8px;
                padding: 2px 6px;
                border-radius: 4px;
                background-color: #6dc0e0;
                color: #1e1e1e;
                font-size: 60%;
                font-weight: bold;
                vertical-align: middle;
                animation: pulse 2s infinite;
            }
        `;
        document.head.appendChild(style);
    }
});