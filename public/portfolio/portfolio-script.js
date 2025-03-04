document.addEventListener('DOMContentLoaded', function() {
    const today = new Date();
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    document.getElementById('last-updated-date').textContent = today.toLocaleDateString('bg-BG', options);
    
    // Load portfolio data from the server
    loadPortfolioData();
    
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
    
    // Function to load portfolio data from server
    async function loadPortfolioData() {
        try {
            const response = await fetch('/api/portfolio');
            if (!response.ok) {
                throw new Error('Failed to load portfolio data');
            }
            
            const data = await response.json();
            
            // Store data globally for access by other functions
            window.portfolioData = data;
            
            // Update portfolio value in the UI
            const totalValueElement = document.querySelector('.total-value .amount');
            if (totalValueElement) {
                totalValueElement.textContent = 
                    `${data.summary.totalCurrentValue.toFixed(2)} лв.`;
            }
            
            // Update profit/change
            const profitElement = document.querySelector('.total-value .change');
            if (profitElement) {
                const profitPercentage = data.summary.profitPercentage.toFixed(1);
                profitElement.textContent = `${profitPercentage >= 0 ? '+' : ''}${profitPercentage}% от първоначалната инвестиция`;
                profitElement.className = `change ${profitPercentage >= 0 ? 'positive' : 'negative'}`;
            }
            
            // Update monthly profit
            const monthlyProfitElement = document.querySelector('.monthly-profit .amount');
            if (monthlyProfitElement && data.summary.monthlyProfit) {
                monthlyProfitElement.textContent = `${data.summary.monthlyProfit.toFixed(2)} лв.`;
            }
            
            // Update pie chart with distribution data
            updateInvestmentChart(data.summary.byType);
            
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
            if (summary.byType[type].amount > 0) {
                // Create the investment item
                const item = document.createElement('div');
                item.className = 'investment-item';
                item.innerHTML = `
                    <div class="investment-info">
                        <div class="investment-color" style="background-color: ${colors[type]};"></div>
                        <div class="investment-name">${typeNames[type]}</div>
                    </div>
                    <div class="investment-value">${summary.byType[type].amount.toFixed(2)} лв.</div>
                    <div class="investment-percentage">${summary.byType[type].percentage.toFixed(1)}%</div>
                `;
                
                container.appendChild(item);
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
            
            // Construct the API payload differently based on type
            let payload;
            
            if (type === 'bank') {
                // Validate interest rate once more before submission
                const rate = parseFloat(investmentData.interestRate);
                if (rate < 0 || rate > 100) {
                    alert('Лихвеният процент трябва да бъде между 0 и 100%');
                    submitButton.disabled = false;
                    submitButton.textContent = originalButtonText;
                    return;
                }
                
                payload = {
                    type: 'bank',
                    currency: investmentData.depositCurrency,
                    amount: parseFloat(investmentData.depositAmount),
                    interestRate: parseFloat(investmentData.interestRate),
                    interestType: investmentData.interestType,
                    date: investmentData.investmentDate,
                    notes: investmentData.investmentNotes || ''
                };
            } else {
                payload = {
                    type: investmentData.investmentType,
                    symbol: investmentData.investmentSymbol,
                    amount: parseFloat(investmentData.investmentAmount),
                    price: parseFloat(investmentData.investmentPrice),
                    date: investmentData.investmentDate,
                    notes: investmentData.investmentNotes || ''
                };
            }
            
            // Log payload for debugging
            console.log('Payload being sent:', payload);
            
            // Send data to server
            fetch('/api/investments', {
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
        }
    }
});