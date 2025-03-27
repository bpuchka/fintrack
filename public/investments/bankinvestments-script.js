document.addEventListener("DOMContentLoaded", function() {
    // Set current date for "Last updated"
    const today = new Date();
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    document.getElementById('last-updated-date').textContent = today.toLocaleDateString('bg-BG', options);
    
    // Constants
    const THEME_COLOR = '#6dc0e0'; // Bank color
    
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
    
    // Investment history chart setup
    let historyChart = null;
    setupHistoryChart();
    
    // Current investment ID for edit/delete operations
    let currentInvestmentId = null;
    
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
    
    /**
     * Load bank investments from server
     */
    function loadInvestments() {
        // Show loading state
        showLoading();
        
        // Fetch data from API
        fetch('/api/bank-investments', {
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
            // Hide loading
            hideLoading();
            
            // Check if we have valid data
            if (!data.success) {
                throw new Error(data.message || 'Error loading bank investments');
            }
            
            // Process investments
            const investments = data.data || [];
            console.log("Loaded bank investments:", investments.length);
            renderInvestments(investments);
            updateSummary(investments);
            updateHistoryChart(investments);
            generateInsights(investments);
        })
        .catch(error => {
            hideLoading();
            console.error('Error loading bank investments:', error);
            Notify.error('Грешка', 'Неуспешно зареждане на банкови влогове: ' + error.message);
            
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
        const tableBody = document.getElementById('investments-table-body');
        if (!tableBody) return;
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="loading-row">
                    <div style="display: flex; justify-content: center; align-items: center; padding: 2rem; flex-direction: column;">
                        <div class="loading-spinner" style="width: 40px; height: 40px; border: 3px solid #333; border-top: 3px solid ${THEME_COLOR}; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <p style="margin-top: 1rem; color: #ccc;">Зареждане на банкови влогове...</p>
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
        // Remove loading indicator if needed
        const loadingRow = document.querySelector('.loading-row');
        if (loadingRow) {
            loadingRow.remove();
        }
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
            noDataRow.innerHTML = `<td colspan="6">Няма банкови влогове. Добавете нов влог, за да започнете.</td>`;
            tableBody.appendChild(noDataRow);
            return;
        }
        
        // Render each investment
        investments.forEach(investment => {
            // Calculate values for display
            const initialValue = parseFloat(investment.amount);
            const currentValue = parseFloat(investment.current_value || initialValue);
            const profit = currentValue - initialValue;
            const profitPercentage = investment.profit_percentage || 0;
            const isProfitPositive = profit >= 0;
            
            // Format for display
            const formattedAmount = formatCurrency(initialValue);
            const formattedCurrentValue = formatCurrency(currentValue);
            const formattedProfit = `${isProfitPositive ? '+' : ''}${formatCurrency(profit)} (${isProfitPositive ? '+' : ''}${profitPercentage.toFixed(2)}%)`;
            
            // Create table row
            const row = document.createElement('tr');
            row.dataset.id = investment.id;
            
            row.innerHTML = `
                <td>${investment.currency} Депозит</td>
                <td>${formattedAmount} ${investment.currency}</td>
                <td>${investment.interest_rate}% (${getInterestTypeDisplay(investment.interest_type)})</td>
                <td>${formattedCurrentValue} ${investment.currency}</td>
                <td class="investment-value ${isProfitPositive ? 'positive' : 'negative'}">${formattedProfit}</td>
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
                openConfirmDialog('Изтриване на влог', 'Сигурни ли сте, че искате да изтриете този банков влог?');
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
            // Initial value
            const initialValue = parseFloat(investment.amount);
            totalInitialValue += initialValue;
            
            // Current value
            const currentValue = parseFloat(investment.current_value || initialValue);
            totalCurrentValue += currentValue;
            
            // Profit
            totalProfit += (currentValue - initialValue);
        });
        
        // Calculate profit percentage
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
                    label: 'Банкови влогове',
                    data: [],
                    borderColor: THEME_COLOR,
                    backgroundColor: `${THEME_COLOR}20`,
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
     * Update the history chart with bank investments data
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
        
        // Calculate values for each month
        investments.forEach(investment => {
            const investmentDate = new Date(investment.investment_date);
            const initialValue = parseFloat(investment.amount);
            const interestRate = parseFloat(investment.interest_rate) / 100;
            
            // For each month point
            for (let i = 0; i < labels.length; i++) {
                const monthDate = parseMonthLabel(labels[i]);
                
                // Skip if investment was made after this month
                if (investmentDate > monthDate) continue;
                
                // Calculate months held
                const monthsHeld = monthsBetween(investmentDate, monthDate);
                
                // Calculate value with interest
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
                
                // Add to the datapoint for this month
                dataPoints[i] += value;
            }
        });
        
        // Update chart data
        historyChart.data.labels = labels;
        historyChart.data.datasets[0].data = dataPoints;
        historyChart.update();
    }
    
    /**
     * Generate insights based on bank investments data
     */
    function generateInsights(investments) {
        const insightsContainer = document.getElementById('investment-insights');
        if (!insightsContainer) return;
        
        // Reset insights container
        insightsContainer.innerHTML = '<h2>Анализ на банковите влогове</h2>';
        
        // If no investments, show default message
        if (!investments || investments.length === 0) {
            const noInsightsMsg = document.createElement('div');
            noInsightsMsg.className = 'insight-card';
            noInsightsMsg.innerHTML = `
                <p class="insight-description">Добавете банкови влогове, за да видите анализ и препоръки.</p>
            `;
            insightsContainer.appendChild(noInsightsMsg);
            return;
        }
        
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
        insightsContainer.appendChild(avgRateInsight);
        
        // Currency diversification insight
        const currencies = {};
        investments.forEach(inv => {
            if (!currencies[inv.currency]) {
                currencies[inv.currency] = 0;
            }
            currencies[inv.currency] += parseFloat(inv.amount);
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
        insightsContainer.appendChild(currencyInsight);
        
        // Time horizon insight
        const timeHorizons = {
            short: 0, // < 6 months
            medium: 0, // 6-12 months
            long: 0 // > 12 months
        };
        
        investments.forEach(inv => {
            const investmentDate = new Date(inv.investment_date);
            const monthsHeld = monthsBetween(investmentDate, new Date());
            
            if (monthsHeld < 6) {
                timeHorizons.short++;
            } else if (monthsHeld < 12) {
                timeHorizons.medium++;
            } else {
                timeHorizons.long++;
            }
        });
        
        const timeInsight = document.createElement('div');
        timeInsight.className = 'insight-card';
        timeInsight.innerHTML = `
            <h3 class="insight-title">Времеви хоризонт</h3>
            <p class="insight-description">
                Имате ${timeHorizons.short} краткосрочни (< 6 месеца), ${timeHorizons.medium} средносрочни (6-12 месеца) и ${timeHorizons.long} дългосрочни (> 12 месеца) депозита.
                ${timeHorizons.long === 0 ? 'Помислете за дългосрочни депозити, които обикновено предлагат по-висока доходност.' : 'Добра комбинация от краткосрочни и дългосрочни депозити.'}
            </p>
        `;
        insightsContainer.appendChild(timeInsight);
    }
    
    /**
     * Open add bank deposit modal
     */
    function openAddModal() {
        if (!modal) return;
        
        // Reset form
        if (form) form.reset();
        
        // Set modal title
        modalTitle.textContent = 'Добави нов банков влог';
        
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
     * Open edit modal
     */
    function openEditModal(investmentId) {
        if (!modal || !investmentId) return;
        
        console.log(`Opening edit modal for bank deposit ID: ${investmentId}`);
        
        // Set current investment ID
        currentInvestmentId = investmentId;
        
        // Set modal title
        if (modalTitle) modalTitle.textContent = 'Редактирай банков влог';
        
        // Show delete button for existing investments
        if (deleteBtn) deleteBtn.style.display = 'block';
        
        // Fetch investment data
        fetch(`/api/bank-investments/${investmentId}`, {
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
            
            // Populate form fields
            populateBankForm(investment);
            
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
        if (amountInput) amountInput.value = investment.amount;
        
        // Interest rate
        const rateInput = document.getElementById('interestRate');
        if (rateInput) rateInput.value = investment.interest_rate || 0;
        
        // Interest type
        const typeInput = document.getElementById('interestType');
        if (typeInput) typeInput.value = investment.interest_type || 'yearly';
        
        // Date
        const dateInput = document.getElementById('investmentDate');
        if (dateInput && investment.investment_date) {
            // Format date for input field (YYYY-MM-DD)
            const date = new Date(investment.investment_date);
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
        
        if (confirmMessage) confirmMessage.textContent = message;
        
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
        
        openConfirmDialog('Изтриване на влог', 'Сигурни ли сте, че искате да изтриете този банков влог?');
    }
    
    /**
     * Delete investment
     */
    function deleteInvestment(investmentId) {
        if (!investmentId) {
            console.error('No investment ID provided for delete');
            return;
        }
        
        // Send delete request
        fetch(`/api/bank-investments/${investmentId}`, {
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
            Notify.success('Успех', 'Банковият влог беше изтрит успешно!');
            
            // Reload investments data
            loadInvestments();
        })
        .catch(error => {
            console.error('Error deleting investment:', error);
            Notify.error('Грешка', `Неуспешно изтриване на влог: ${error.message}`);
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
            apiEndpoint = `/api/bank-investments/${currentInvestmentId}`;
        } else {
            // Create new investment
            method = 'POST';
            apiEndpoint = '/api/bank-investments';
        }
        
        // Prepare data
        const requestData = {
            amount: parseFloat(formData.get('depositAmount')),
            interest_rate: parseFloat(formData.get('interestRate')),
            interest_type: formData.get('interestType'),
            investment_date: formData.get('investmentDate'),
            currency: formData.get('depositCurrency'),
            notes: formData.get('investmentNotes') || null
        };
        
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
            const actionType = currentInvestmentId ? 'обновен' : 'добавен';
            Notify.success('Успех', `Банковият влог беше ${actionType} успешно!`);
            
            // Reload investments data
            loadInvestments();
        })
        .catch(error => {
            console.error('Error saving bank investment:', error);
            Notify.error('Грешка', `Неуспешно запазване на банков влог: ${error.message}`);
        });
    }
    
    /**
     * Helper function to format currency
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
    
    /**
     * Helper function to get interest type display name
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
    
    /**
     * Helper function to calculate months between two dates
     */
    function monthsBetween(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const years = d2.getFullYear() - d1.getFullYear();
        const months = d2.getMonth() - d1.getMonth();
        
        return years * 12 + months;
    }
    
    /**
     * Helper function to parse month label
     */
    function parseMonthLabel(monthLabel) {
        // Parse Bulgarian month abbreviation
        const months = {
            'яну': 0, 'фев': 1, 'мар': 2, 'апр': 3, 'май': 4, 'юни': 5,
            'юли': 6, 'авг': 7, 'сеп': 8, 'окт': 9, 'ное': 10, 'дек': 11
        };
        
        const parts = monthLabel.split(' ');
        const month = parts[0].replace('.', '').toLowerCase();
        const year = parseInt(parts[1]);
        
        // Find month number
        let monthNum = 0;
        for (const key in months) {
            if (month.startsWith(key)) {
                monthNum = months[key];
                break;
            }
        }
        
        return new Date(year, monthNum, 1);
    }
});