document.addEventListener("DOMContentLoaded", function() {
    // Set current date for "Last updated"
    const today = new Date();
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    document.getElementById('last-updated-date').textContent = today.toLocaleDateString('bg-BG', options);
    
    // Get the investment type from the URL path
    const path = window.location.pathname;
    const investmentType = path.split('/').pop(); // Gets the last part of the URL path
    
    // Set the correct color theme based on investment type
    document.body.classList.add(`investment-type-${investmentType}`);
    
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
    newInvestmentBtn.addEventListener('click', openAddModal);
    cancelBtn.addEventListener('click', closeModal);
    deleteBtn.addEventListener('click', confirmDelete);
    
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
    cancelActionBtn.addEventListener('click', closeConfirmDialog);
    
    // Form submission
    form.addEventListener('submit', handleFormSubmit);
    
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
        
        // Select the appropriate API endpoint based on investment type
        if (investmentType === 'bank') {
            apiEndpoint = '/api/bank-investments';
        } else {
            apiEndpoint = `/api/investments/type/${investmentType}`;
        }
        
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
            if (!response.ok) {
                throw new Error('Failed to load investments');
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
            const investments = data.data || [];
            renderInvestments(investments);
            updateSummary(investments);
            updateHistoryChart(investments);
            updateInsights(investments);
        })
        .catch(error => {
            hideLoading();
            console.error('Error loading investments:', error);
            Notify.error('Грешка', 'Неуспешно зареждане на инвестиции: ' + error.message);
        });
    }
    
    /**
     * Render investments in the table
     */
    function renderInvestments(investments) {
        const tableBody = document.getElementById('investments-table-body');
        
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
        document.getElementById('total-investment-value').textContent = `${formatCurrency(totalCurrentValue)} лв.`;
        
        const totalChangeElement = document.getElementById('total-investment-change');
        totalChangeElement.textContent = `${profitPercentage >= 0 ? '+' : ''}${profitPercentage.toFixed(2)}% от първоначалната инвестиция`;
        totalChangeElement.className = `change ${profitPercentage >= 0 ? 'positive' : 'negative'}`;
        
        document.getElementById('total-investment-profit').textContent = `${formatCurrency(totalProfit)} лв.`;
        
        const profitPercentageElement = document.getElementById('profit-percentage');
        profitPercentageElement.textContent = `${profitPercentage >= 0 ? '+' : ''}${profitPercentage.toFixed(2)}%`;
        profitPercentageElement.className = `change ${profitPercentage >= 0 ? 'positive' : 'negative'}`;
    }
    
    /**
     * Setup and update the history chart
     */
    function setupHistoryChart() {
        const ctx = document.getElementById('investment-history-chart').getContext('2d');
        
        // Create empty chart initially
        historyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: displayNames[investmentType] || 'Инвестиции',
                    data: [],
                    borderColor: colorMap[investmentType] || '#6dc0e0',
                    backgroundColor: `${colorMap[investmentType]}20` || '#6dc0e020',
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
        // Generate date points for the past 6 months
        const labels = [];
        const dataPoints = [];
        
        // Get the last 6 months
        const today = new Date();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            labels.push(date.toLocaleDateString('bg-BG', { month: 'short', year: 'numeric' }));
            
            // Start with 0 for each month
            dataPoints.push(0);
        }
        
        // Add values to data points based on when investments were made
        investments.forEach(investment => {
            const purchaseDate = new Date(investment.purchase_date);
            
            // For each month in our chart, check if this investment should be included
            for (let i = 0; i < labels.length; i++) {
                const monthDate = parseMonthLabel(labels[i]);
                
                // If investment was made before or during this month, add its value to this month
                if (purchaseDate <= monthDate) {
                    // For bank investments, add with interest calculated up to that month
                    if (investment.investment_type === 'bank') {
                        const monthsHeld = monthsBetween(purchaseDate, monthDate);
                        const interestRate = parseFloat(investment.interest_rate) / 100;
                        let value = parseFloat(investment.quantity);
                        
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
                        // For other investments, use current value if available
                        if (investment.current_value) {
                            dataPoints[i] += parseFloat(investment.current_value);
                        } else {
                            dataPoints[i] += parseFloat(investment.quantity) * parseFloat(investment.purchase_price);
                        }
                    }
                }
            }
        });
        
        // Update chart data
        historyChart.data.labels = labels;
        historyChart.data.datasets[0].data = dataPoints;
        historyChart.update();
    }
    
    /**
     * Update the insights section based on investment data
     */
    function updateInsights(investments = []) {
        const insightsContainer = document.getElementById('investment-insights');
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
        if (investmentType === 'bank') {
            // Bank deposit insights
            generateBankInsights(investments, insightsContainer);
        } else if (investmentType === 'crypto') {
            // Crypto insights
            generateCryptoInsights(investments, insightsContainer);
        } else if (investmentType === 'stock') {
            // Stock insights
            generateStockInsights(investments, insightsContainer);
        } else if (investmentType === 'metal') {
            // Metal insights
            generateMetalInsights(investments, insightsContainer);
        }
    }
    
    /**
     * Generate bank deposit insights
     */
    function generateBankInsights(investments, container) {
        // Calculate average interest rate
        let totalInterestRate = 0;
        investments.forEach(inv => {
            totalInterestRate += parseFloat(inv.interest_rate);
        });
        const avgInterestRate = totalInterestRate / investments.length;
        
        // Create insight card for average interest rate
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
        
        // Insight about currency diversification
        const currencies = {};
        investments.forEach(inv => {
            if (!currencies[inv.currency]) {
                currencies[inv.currency] = 0;
            }
            currencies[inv.currency] += parseFloat(inv.quantity);
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
     * Generate crypto insights
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
     * Generate stock insights
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
        
        // Sector diversification insight (simplified)
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
     * Generate metal insights
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
     * Open the add investment modal
     */
    function openAddModal() {
        modalTitle.textContent = 'Добави нова инвестиция';
        form.reset();
        
        // Set the current date
        const dateInputs = document.querySelectorAll('input[type="date"]');
        dateInputs.forEach(input => {
            input.valueAsDate = new Date();
        });
        
        // Hide delete button
        if (deleteBtn) {
            deleteBtn.style.display = 'none';
        }
        
        // Set investment type (hidden input)
        const investmentTypeInput = document.getElementById('investmentType');
        if (investmentTypeInput) {
            investmentTypeInput.value = investmentType;
        }
        
        // Show the modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
    
    /**
     * Open modal to edit an investment
     */
    function openEditModal(investmentId) {
        if (!investmentId) {
            console.error('No investment ID provided for edit');
            return;
        }
        
        currentInvestmentId = investmentId;
        modalTitle.textContent = 'Редактирай инвестиция';
        
        // Show delete button for edit mode
        if (deleteBtn) {
            deleteBtn.style.display = 'block';
        }
        
        // Fetch investment data
        let apiEndpoint = '';
        
        if (investmentType === 'bank') {
            apiEndpoint = `/api/bank-investments/${investmentId}`;
        } else {
            apiEndpoint = `/api/investments/${investmentId}`;
        }
        
        fetch(apiEndpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load investment data');
            }
            return response.json();
        })
        .then(data => {
            if (!data.success) {
                throw new Error(data.message || 'Error loading investment data');
            }
            
            // Get the investment from the response
            const investment = data.data;
            
            // Set the investment ID in the form
            document.getElementById('investmentId').value = investmentId;
            
            // Populate form based on investment type
            if (investmentType === 'bank') {
                // Bank deposit fields
                document.getElementById('depositCurrency').value = investment.currency || 'BGN';
                document.getElementById('depositAmount').value = investment.quantity || investment.amount;
                document.getElementById('interestRate').value = investment.interest_rate;
                document.getElementById('interestType').value = investment.interest_type || 'yearly';
            } else {
                // Other investment types
                document.getElementById('investmentSymbol').value = investment.symbol;
                document.getElementById('investmentAmount').value = investment.quantity;
                document.getElementById('investmentCurrency').value = investment.currency || 'BGN';
                document.getElementById('investmentPrice').value = investment.purchase_price;
            }
            
            // Common fields
            const dateInput = document.getElementById('investmentDate');
            if (dateInput) {
                // Format the date as YYYY-MM-DD (required for date input)
                const purchaseDate = new Date(investment.purchase_date);
                dateInput.value = purchaseDate.toISOString().split('T')[0];
            }
            
            document.getElementById('investmentNotes').value = investment.notes || '';
            
            // Show the modal
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        })
        .catch(error => {
            console.error('Error loading investment data:', error);
            Notify.error('Грешка', 'Неуспешно зареждане на данни за инвестиция: ' + error.message);
        });
    }
    
    /**
     * Close the investment modal
     */
    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Re-enable scrolling
        form.reset();
        currentInvestmentId = null;
    }
    
    /**
     * Open confirmation dialog
     */
    function openConfirmDialog(title, message) {
        document.getElementById('confirmMessage').textContent = message;
        document.querySelector('#confirmDialog .modal-header h2').textContent = title;
        
        confirmDialog.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        
        // Set action for confirm button
        confirmActionBtn.onclick = function() {
            closeConfirmDialog();
            deleteInvestment(currentInvestmentId);
        };
    }
    
    /**
     * Close the confirmation dialog
     */
    function closeConfirmDialog() {
        confirmDialog.style.display = 'none';
        document.body.style.overflow = 'auto'; // Re-enable scrolling
    }
    
    /**
     * Confirm delete from the modal
     */
    function confirmDelete() {
        if (!currentInvestmentId) {
            console.error('No investment ID provided for delete');
            return;
        }
        
        openConfirmDialog('Изтриване на инвестиция', 'Сигурни ли сте, че искате да изтриете тази инвестиция?');
    }
    
    /**
     * Delete an investment
     */
    function deleteInvestment(investmentId) {
        if (!investmentId) {
            console.error('No investment ID provided for delete');
            return;
        }
        
        // Determine the correct endpoint
        let apiEndpoint = '';
        
        if (investmentType === 'bank') {
            apiEndpoint = `/api/bank-investments/${investmentId}`;
        } else {
            apiEndpoint = `/api/investments/${investmentId}`;
        }
        
        fetch(apiEndpoint, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to delete investment');
            }
            return response.json();
        })
        .then(data => {
            if (!data.success) {
                throw new Error(data.message || 'Error deleting investment');
            }
            
            Notify.success('Успех', 'Инвестицията е изтрита успешно!');
            closeModal();
            
            // Reload investments to update the view
            loadInvestments();
        })
        .catch(error => {
            console.error('Error deleting investment:', error);
            Notify.error('Грешка', 'Неуспешно изтриване на инвестиция: ' + error.message);
        });
    }
    
    /**
     * Handle form submission (add/edit investment)
     */
    function handleFormSubmit(e) {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(form);
        
        // Process form data based on investment type
        let investmentData = {};
        let apiEndpoint = '';
        let method = 'POST';
        
        if (investmentType === 'bank') {
            // Bank deposit data
            investmentData = {
                amount: parseFloat(formData.get('depositAmount')),
                interest_rate: parseFloat(formData.get('interestRate')),
                interest_type: formData.get('interestType'),
                investment_date: formData.get('investmentDate'),
                currency: formData.get('depositCurrency'),
                notes: formData.get('investmentNotes') || ''
            };
            
            // Set API endpoint
            apiEndpoint = '/api/bank-investments';
        } else {
            // Other investment types
            investmentData = {
                type: investmentType,
                symbol: formData.get('investmentSymbol'),
                amount: parseFloat(formData.get('investmentAmount')),
                price: parseFloat(formData.get('investmentPrice')),
                currency: formData.get('investmentCurrency'),
                date: formData.get('investmentDate'),
                notes: formData.get('investmentNotes') || ''
            };
            
            // Set API endpoint
            apiEndpoint = '/api/investments';
        }
        
        // If editing, update the endpoint and method
        if (currentInvestmentId) {
            apiEndpoint = `${apiEndpoint}/${currentInvestmentId}`;
            method = 'PUT';
        }
        
        // Send request to server
        fetch(apiEndpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(investmentData),
            credentials: 'same-origin'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to save investment');
            }
            return response.json();
        })
        .then(data => {
            if (!data.success) {
                throw new Error(data.message || 'Error saving investment');
            }
            
            Notify.success('Успех', `Инвестицията е ${currentInvestmentId ? 'обновена' : 'добавена'} успешно!`);
            closeModal();
            
            // Reload investments to update the view
            loadInvestments();
        })
        .catch(error => {
            console.error('Error saving investment:', error);
            Notify.error('Грешка', `Неуспешно ${currentInvestmentId ? 'обновяване' : 'добавяне'} на инвестиция: ${error.message}`);
        });
    }
    
    /**
     * Show loading state
     */
    function showLoading() {
        // Add loading indicator to table
        const tableBody = document.getElementById('investments-table-body');
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
     * Hide loading state
     */
    function hideLoading() {
        // Remove loading indicator from table
        const loadingRow = document.querySelector('.loading-row');
        if (loadingRow) {
            loadingRow.remove();
        }
    }
    
    /**
     * Helper function to format currency values
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
     * Helper function to format quantity values for display
     */
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
    
    /**
     * Helper function to parse a month label (e.g. "Apr 2023") into a Date object
     */
    function parseMonthLabel(label) {
        const parts = label.split(' ');
        const monthNames = {
            'ян.': 0, 'фев.': 1, 'март': 2, 'апр.': 3, 'май': 4, 'юни': 5,
            'юли': 6, 'авг.': 7, 'сеп.': 8, 'окт.': 9, 'ное.': 10, 'дек.': 11
        };
        
        // Extract month name and convert to number (0-11)
        let monthIndex = 0;
        for (const [name, index] of Object.entries(monthNames)) {
            if (parts[0].includes(name)) {
                monthIndex = index;
                break;
            }
        }
        
        // Create date for first day of that month
        return new Date(parseInt(parts[1]), monthIndex, 1);
    }
    
    /**
     * Calculate months between two dates
     */
    function monthsBetween(date1, date2) {
        return (date2.getFullYear() - date1.getFullYear()) * 12 + 
               (date2.getMonth() - date1.getMonth());
    }
    
    /**
     * Get display text for interest type
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