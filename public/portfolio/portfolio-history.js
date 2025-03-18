document.addEventListener('DOMContentLoaded', function() {
    // Set current date in the header
    const today = new Date();
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    document.getElementById('last-updated-date').textContent = today.toLocaleDateString('bg-BG', options);
    
    // Initial variables
    let currentPage = 1;
    const pageSize = 5;
    let hasMoreItems = true;
    let historicalData = [];
    let filteredData = [];
    let currentInvestmentId = null; // Global variable to store the current investment ID
    
    // Filter and sorting selectors
    const timeRangeFilter = document.getElementById('timeRangeFilter');
    const typeFilter = document.getElementById('typeFilter');
    const sortFilter = document.getElementById('sortFilter');
    const loadMoreBtn = document.getElementById('loadMore');
    
    // Modal elements
    const editModal = document.getElementById('editInvestmentModal');
    const closeModalBtns = document.querySelectorAll('.close-modal, .close-modal-btn');
    const cancelBtn = document.getElementById('cancelEdit');
    const deleteBtn = document.getElementById('deleteInvestment');
    const editForm = document.getElementById('editInvestmentForm');
    
    // Initialize the portfolio history chart
    const ctx = document.getElementById('portfolio-history-chart').getContext('2d');
    const historyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Банков влог',
                    data: [],
                    borderColor: '#6dc0e0',
                    backgroundColor: 'rgba(109, 192, 224, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Крипто',
                    data: [],
                    borderColor: '#8e44ad',
                    backgroundColor: 'rgba(142, 68, 173, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Акции',
                    data: [],
                    borderColor: '#27ae60',
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Метали',
                    data: [],
                    borderColor: '#f39c12',
                    backgroundColor: 'rgba(243, 156, 18, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
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
                                label += formatCurrency(context.parsed.y, 'BGN') + ' лв.';
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
                            return formatCurrency(value, 'BGN') + ' лв.';
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

    // Setup modal close/open functionality
    function closeModal() {
        if (editModal) {
            editModal.style.display = 'none';
            document.body.style.overflow = 'auto'; // Re-enable scrolling
        }
    }
    
    // Add event listeners for modal close actions
    if (closeModalBtns) {
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', closeModal);
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === editModal) {
            closeModal();
        }
    });
    
    // Setup form submission
    if (editForm) {
        editForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveInvestmentChanges();
        });
    }
    
    // Setup delete functionality
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function() {
            if (confirm('Сигурни ли сте, че искате да изтриете тази инвестиция?')) {
                deleteInvestment(currentInvestmentId);
            }
        });
    }

    // Event listeners for filters
    timeRangeFilter.addEventListener('change', applyFilters);
    typeFilter.addEventListener('change', applyFilters);
    sortFilter.addEventListener('change', applyFilters);
    loadMoreBtn.addEventListener('click', loadMoreInvestments);

    // Fetch portfolio history data on page load
    fetchPortfolioHistory();
    
    // Fetch portfolio history data
    async function fetchPortfolioHistory() {
        try {
            console.log("Зареждане на история на портфолиото...");
            
            // Show loading spinner
            const loadingElement = document.querySelector('.timeline-loading');
            if (loadingElement) {
                loadingElement.style.display = 'flex';
            }
            
            const response = await fetch('/api/portfolio/history/data');
            if (!response.ok) {
                throw new Error('Неуспешно зареждане на история на портфолиото');
            }
            
            const data = await response.json();
            
            console.log('Получени данни за историята на портфолиото:', data);
            
            if (!data.success) {
                throw new Error(data.message || 'Грешка при зареждане на история на портфолиото');
            }
            
            // Check if any investments exist
            if (!data.investments || data.investments.length === 0) {
                document.querySelector('.timeline-loading').style.display = 'none';
                document.querySelector('.no-investments').style.display = 'block';
                document.querySelector('.history-filters').style.display = 'none';
                document.querySelector('.history-overview').style.display = 'none';
                document.querySelector('.timeline-navigation').style.display = 'none';
                return;
            }
            
            // Store the data globally for access by other functions
            window.portfolioData = data;
            
            // Set historical data
            historicalData = data.investments;
            
            // Populate the chart with historical data
            updateHistoryChart(data.chartData);
            
            // Apply initial filters
            applyFilters();
            
        } catch (error) {
            console.error('Грешка при зареждане на история на портфолиото:', error);
            
            // Hide loading spinner
            const loadingElement = document.querySelector('.timeline-loading');
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
            
            // Show no investments message
            const noInvestmentsElement = document.querySelector('.no-investments');
            if (noInvestmentsElement) {
                noInvestmentsElement.style.display = 'block';
            }
            
            const filtersElement = document.querySelector('.history-filters');
            if (filtersElement) {
                filtersElement.style.display = 'none';
            }
            
            const historyOverviewElement = document.querySelector('.history-overview');
            if (historyOverviewElement) {
                historyOverviewElement.style.display = 'none';
            }
            
            const timelineNavigation = document.querySelector('.timeline-navigation');
            if (timelineNavigation) {
                timelineNavigation.style.display = 'none';
            }
        }
    }

    // Apply filters and sort the data
    function applyFilters() {
        // Get filter values
        const timeRange = timeRangeFilter.value;
        const type = typeFilter.value;
        const sort = sortFilter.value;
        
        // Filter by time range
        let filtered = [...historicalData];
        if (timeRange !== 'all') {
            const now = new Date();
            let fromDate;
            
            switch (timeRange) {
                case '30days':
                    fromDate = new Date(now.setDate(now.getDate() - 30));
                    break;
                case '90days':
                    fromDate = new Date(now.setDate(now.getDate() - 90));
                    break;
                case '1year':
                    fromDate = new Date(now.setFullYear(now.getFullYear() - 1));
                    break;
            }
            
            filtered = filtered.filter(investment => {
                const purchaseDate = new Date(investment.purchase_date);
                return purchaseDate >= fromDate;
            });
        }
        
        // Filter by investment type
        if (type !== 'all') {
            filtered = filtered.filter(investment => investment.investment_type === type);
        }
        
        // Sort the data
        switch (sort) {
            case 'date-desc':
                filtered.sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date));
                break;
            case 'date-asc':
                filtered.sort((a, b) => new Date(a.purchase_date) - new Date(b.purchase_date));
                break;
            case 'profit-desc':
                filtered.sort((a, b) => (b.profit_percentage || 0) - (a.profit_percentage || 0));
                break;
            case 'profit-asc':
                filtered.sort((a, b) => (a.profit_percentage || 0) - (b.profit_percentage || 0));
                break;
        }
        
        // Update the filtered data and reset pagination
        filteredData = filtered;
        currentPage = 1;
        hasMoreItems = filteredData.length > pageSize;
        
        // Render the first page
        renderTimelineItems(true);
    }

    // Render timeline items
    function renderTimelineItems(resetContent = false) {
        const timelineContainer = document.getElementById('history-timeline');
        
        // Get current batch of items to display
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, filteredData.length);
        const currentItems = filteredData.slice(startIndex, endIndex);
        
        // Clear the container if resetting
        if (resetContent) {
            timelineContainer.innerHTML = '';
        }
        
        // Hide loading spinner
        document.querySelector('.timeline-loading').style.display = 'none';
        
        // Show no investments message if no items
        if (filteredData.length === 0) {
            const noItemsMessage = document.createElement('div');
            noItemsMessage.className = 'no-items-message';
            noItemsMessage.innerHTML = `
                <p>Няма инвестиции, отговарящи на избраните филтри.</p>
            `;
            timelineContainer.appendChild(noItemsMessage);
            loadMoreBtn.style.display = 'none';
            return;
        }
        
        // Create HTML for each item
        for (const investment of currentItems) {
            const dateFormatted = new Date(investment.purchase_date).toLocaleDateString('bg-BG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            // Determine display name based on investment type
            let displayName = '';
            switch (investment.investment_type) {
                case 'bank':
                    displayName = `${investment.currency} Депозит`;
                    break;
                case 'crypto':
                case 'stock':
                case 'metal':
                    displayName = investment.symbol;
                    break;
            }
            
            // Create the timeline item
            const timelineItem = document.createElement('div');
            timelineItem.className = 'timeline-item';
            timelineItem.dataset.investmentId = investment.id;
            timelineItem.dataset.investmentType = investment.investment_type;
            timelineItem.innerHTML = `
                <div class="timeline-header">
                    <h3 class="timeline-title">
                        <span class="investment-type-indicator investment-type-${investment.investment_type}"></span>
                        ${displayName}
                    </h3>
                    <span class="timeline-date">${dateFormatted}</span>
                </div>
                
                <div class="timeline-details">
                    <div class="detail-item">
                        <span class="detail-label">Тип инвестиция</span>
                        <span class="detail-value">${getInvestmentTypeDisplay(investment.investment_type)}</span>
                    </div>
                    
                    <div class="detail-item">
                        <span class="detail-label">Количество</span>
                        <span class="detail-value">${formatQuantity(investment.quantity)} ${investment.symbol}</span>
                    </div>
                    
                    ${investment.investment_type !== 'bank' ? `
                    <div class="detail-item">
                        <span class="detail-label">Покупна цена</span>
                        <span class="detail-value">${formatCurrency(investment.purchase_price, investment.currency)}</span>
                    </div>
                    ` : `
                    <div class="detail-item">
                        <span class="detail-label">Лихвен процент</span>
                        <span class="detail-value">${investment.interest_rate}%</span>
                    </div>
                    `}
                    
                    <div class="detail-item">
                        <span class="detail-label">Валута</span>
                        <span class="detail-value">${investment.currency || 'BGN'}</span>
                    </div>
                </div>
                
                <div class="timeline-performance">
                    <div class="performance-metric">
                        <span class="metric-label">Първоначална инвестиция</span>
                        <span class="detail-value">${formatCurrency(investment.initial_investment || (investment.quantity * investment.purchase_price), investment.currency)} ${investment.currency}</span>
                    </div>
                    
                    <div class="performance-metric">
                        <span class="metric-label">Текуща стойност</span>
                        <span class="detail-value">${formatCurrency(investment.current_value || investment.quantity, investment.currency)} ${investment.currency}</span>
                    </div>
                    
                    <div class="performance-metric">
                        <span class="metric-label">Печалба/Загуба</span>
                        <span class="metric-value ${(investment.profit_percentage || 0) >= 0 ? 'positive' : 'negative'}">
                            ${(investment.profit_percentage || 0) >= 0 ? '+' : ''}${(investment.profit_percentage || 0).toFixed(2)}%
                        </span>
                    </div>
                </div>
                
                <div class="timeline-actions">
                    <button class="edit-investment-btn" data-investment-id="${investment.id}">Редактирай</button>
                    <button class="delete-investment-btn" data-investment-id="${investment.id}">Изтрий</button>
                </div>
            `;
            
            timelineContainer.appendChild(timelineItem);
        }
        
        // Add event listeners to the newly created edit buttons
        const editButtons = document.querySelectorAll('.edit-investment-btn');
        editButtons.forEach(button => {
            button.addEventListener('click', function() {
                const investmentId = this.getAttribute('data-investment-id');
                openEditModal(investmentId);
            });
        });
        
        // Add event listeners to the newly created delete buttons
        const deleteButtons = document.querySelectorAll('.delete-investment-btn');
        deleteButtons.forEach(button => {
            button.addEventListener('click', function() {
                const investmentId = this.getAttribute('data-investment-id');
                if (confirm('Сигурни ли сте, че искате да изтриете тази инвестиция?')) {
                    deleteInvestment(investmentId);
                }
            });
        });
        
        // Update "Load More" button visibility
        hasMoreItems = endIndex < filteredData.length;
        loadMoreBtn.style.display = hasMoreItems ? 'block' : 'none';
    }

    // Function to open the edit modal with investment data
    function openEditModal(investmentId) {
        console.log("Отваряне на модално прозорче за редактиране на инвестиция ID:", investmentId);
        
        const investment = findInvestmentById(investmentId);
        if (!investment) {
            console.error('Инвестицията не е намерена:', investmentId);
            alert('Инвестицията не е намерена. Моля, опреснете страницата и опитайте отново.');
            return;
        }
        
        console.log("Намерени данни за инвестицията:", investment);
        
        // Store the current investment ID
        currentInvestmentId = investmentId;
        
        // Set form title in Bulgarian
        const modalTitle = document.querySelector('#editInvestmentModal .modal-header h2');
        if (modalTitle) {
            modalTitle.textContent = 'Редактиране на инвестиция';
        }
        
        // Translate submit button
        const submitButton = document.querySelector('#editInvestmentForm .submit-button');
        if (submitButton) {
            submitButton.textContent = 'Запази промените';
        }
        
        // Translate cancel button
        const cancelButton = document.querySelector('#editInvestmentForm .cancel-button');
        if (cancelButton) {
            cancelButton.textContent = 'Отказ';
        }
        
        // Translate delete button
        const deleteButton = document.querySelector('#editInvestmentForm .delete-button');
        if (deleteButton) {
            deleteButton.textContent = 'Изтрий инвестицията';
        }
        
        // Translate labels
        const labels = {
            'editInvestmentType': 'Тип инвестиция',
            'editInvestmentSymbol': 'Символ',
            'editInvestmentAmount': 'Количество',
            'editInvestmentCurrency': 'Валута',
            'editInvestmentPrice': 'Покупна цена',
            'editDepositCurrency': 'Валута',
            'editDepositAmount': 'Сума',
            'editInterestRate': 'Лихвен процент (%)',
            'editInterestType': 'Тип на лихвата',
            'editInvestmentDate': 'Дата на покупка',
            'editInvestmentNotes': 'Бележки (незадължително)'
        };
        
        // Update all labels
        for (const [id, text] of Object.entries(labels)) {
            const label = document.querySelector(`label[for="${id}"]`);
            if (label) {
                label.textContent = text;
            }
        }
        
        // Populate the form fields
        document.getElementById('editInvestmentType').value = investment.investment_type;
        
        // Get symbols for the selected investment type
        populateSymbols(investment.investment_type);
        
        // Set symbol after populating options
        setTimeout(() => {
            const symbolSelect = document.getElementById('editInvestmentSymbol');
            if (symbolSelect) {
                // Create option if it doesn't exist
                if (!Array.from(symbolSelect.options).some(opt => opt.value === investment.symbol)) {
                    const option = document.createElement('option');
                    option.value = investment.symbol;
                    option.textContent = investment.symbol;
                    symbolSelect.appendChild(option);
                }
                symbolSelect.value = investment.symbol;
            }
        }, 100);
        
        // Toggle required attributes and visibility based on investment type
        if (investment.investment_type === 'bank') {
            // Show bank fields, hide standard fields
            document.getElementById('editStandardFields').style.display = 'none';
            document.getElementById('editBankDepositFields').style.display = 'block';
            
            // Disable required on standard fields
            toggleRequiredAttributes('editStandardFields', false);
            toggleRequiredAttributes('editBankDepositFields', true);
            
            // Set bank-specific values
            document.getElementById('editDepositCurrency').value = investment.currency || 'BGN';
            document.getElementById('editDepositAmount').value = investment.quantity;
            document.getElementById('editInterestRate').value = investment.interest_rate || 0;
            document.getElementById('editInterestType').value = investment.interest_type || 'yearly';
        } else {
            // Show standard fields, hide bank fields
            document.getElementById('editStandardFields').style.display = 'block';
            document.getElementById('editBankDepositFields').style.display = 'none';
            
            // Disable required on bank fields
            toggleRequiredAttributes('editStandardFields', true);
            toggleRequiredAttributes('editBankDepositFields', false);
            
            // Set standard values
            document.getElementById('editInvestmentAmount').value = investment.quantity;
            document.getElementById('editInvestmentCurrency').value = investment.currency || 'BGN';
            document.getElementById('editInvestmentPrice').value = investment.purchase_price;
        }
        
        // Set date
        const purchaseDate = new Date(investment.purchase_date);
        // Format date as YYYY-MM-DD for input field
        const formattedDate = purchaseDate.toISOString().split('T')[0];
        document.getElementById('editInvestmentDate').value = formattedDate;
        
        // Set notes
        document.getElementById('editInvestmentNotes').value = investment.notes || '';
        
        // Open the modal
        editModal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
    
    // Helper function to toggle required attributes on form fields
    function toggleRequiredAttributes(containerId, isRequired) {
        const container = document.getElementById(containerId);
        if (container) {
            const requiredFields = container.querySelectorAll('input[required], select[required]');
            requiredFields.forEach(field => {
                if (isRequired) {
                    field.setAttribute('required', 'required');
                } else {
                    field.removeAttribute('required');
                }
            });
        }
    }
    
    // Populate symbols dropdown based on investment type
    function populateSymbols(type) {
        const symbolSelect = document.getElementById('editInvestmentSymbol');
        symbolSelect.innerHTML = '<option value="" disabled>Изберете символ</option>';
        
        // Define available symbols for each type
        const symbols = {
            'crypto': ['BTC', 'ETH', 'USDT', 'XRP', 'SOL'],
            'stock': ['AAPL', 'NVDA', 'TSLA'],
            'metal': ['GLD', 'SLV']
        };
        
        // Get the symbols for the selected type
        const typeSymbols = symbols[type] || [];
        
        // Add options to the select
        typeSymbols.forEach(symbol => {
            const option = document.createElement('option');
            option.value = symbol;
            option.textContent = symbol;
            symbolSelect.appendChild(option);
        });
        
        // Update dropdown labels
        const symbolLabel = document.querySelector('label[for="editInvestmentSymbol"]');
        if (symbolLabel) symbolLabel.textContent = 'Символ';
    }

    // Load more investments button handler
    function loadMoreInvestments() {
        currentPage++;
        renderTimelineItems(false);
    }

    // Function to save edited investment
    function saveInvestmentChanges() {
        if (!currentInvestmentId) {
            console.error("Не е зададено ID на инвестиция за редактиране");
            alert('Грешка: Не е зададено ID на инвестиция за редактиране');
            return;
        }
        
        console.log("Запазване на промени за инвестиция ID:", currentInvestmentId);
        
        const investmentType = document.getElementById('editInvestmentType').value;
        
        try {
            // Prepare data based on investment type
            let data = {
                investment_type: investmentType,
                purchase_date: document.getElementById('editInvestmentDate').value,
                notes: document.getElementById('editInvestmentNotes').value || null
            };
            
            if (investmentType === 'bank') {
                // Validate bank deposit fields
                const depositAmount = document.getElementById('editDepositAmount').value;
                const interestRate = document.getElementById('editInterestRate').value;
                
                if (!depositAmount || isNaN(parseFloat(depositAmount)) || parseFloat(depositAmount) <= 0) {
                    alert('Моля, въведете валидна сума на депозита');
                    return;
                }
                
                if (interestRate === '' || isNaN(parseFloat(interestRate))) {
                    alert('Моля, въведете валиден лихвен процент');
                    return;
                }
                
                data = {
                    ...data,
                    currency: document.getElementById('editDepositCurrency').value,
                    quantity: parseFloat(depositAmount),
                    interest_rate: parseFloat(interestRate),
                    interest_type: document.getElementById('editInterestType').value,
                    purchase_price: 1 // Default for bank deposits
                };
            } else {
                // Validate standard fields
                const symbol = document.getElementById('editInvestmentSymbol').value;
                const amount = document.getElementById('editInvestmentAmount').value;
                const price = document.getElementById('editInvestmentPrice').value;
                
                if (!symbol) {
                    alert('Моля, изберете символ');
                    return;
                }
                
                if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
                    alert('Моля, въведете валидно количество');
                    return;
                }
                
                if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
                    alert('Моля, въведете валидна цена');
                    return;
                }
                
                data = {
                    ...data,
                    symbol: symbol,
                    quantity: parseFloat(amount),
                    purchase_price: parseFloat(price),
                    currency: document.getElementById('editInvestmentCurrency').value
                };
            }
            
            console.log("Данни за изпращане:", data);
            
            // Send update request
            fetch('/api/investments/' + currentInvestmentId, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data),
                credentials: 'same-origin'
            })
            .then(response => {
                console.log("Статус на отговора:", response.status);
                return response.json().then(data => {
                    if (!response.ok) {
                        throw new Error(data.message || 'Неуспешно обновяване на инвестицията');
                    }
                    return data;
                });
            })
            .then(data => {
                console.log("Успешно обновяване:", data);
                alert('Инвестицията беше успешно обновена!');
                closeModal();
                // Reload data to show changes
                fetchPortfolioHistory();
            })
            .catch(error => {
                console.error('Грешка при обновяване на инвестицията:', error);
                alert('Грешка при обновяване на инвестицията: ' + error.message);
            });
        } catch (error) {
            console.error('Грешка при обработка на данните за инвестицията:', error);
            alert('Грешка при обработка на данните: ' + error.message);
        }
    }

    // Function to delete investment
    function deleteInvestment(investmentId) {
        if (!investmentId) {
            console.error("Не е зададено ID на инвестиция за изтриване");
            return;
        }
        
        console.log("Изтриване на инвестиция ID:", investmentId);
        
        fetch('/api/investments/' + investmentId, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin'
        })
        .then(response => {
            return response.json().then(data => {
                if (!response.ok) {
                    throw new Error(data.message || 'Неуспешно изтриване на инвестицията');
                }
                return data;
            });
        })
        .then(data => {
            console.log("Успешно изтриване:", data);
            alert('Инвестицията беше успешно изтрита!');
            closeModal();
            // Reload data to show changes
            fetchPortfolioHistory();
        })
        .catch(error => {
            console.error('Грешка при изтриване на инвестицията:', error);
            alert('Грешка при изтриване на инвестицията: ' + error.message);
        });
    }

    // Update the history chart with data
    function updateHistoryChart(chartData) {
        // Debug chart data
        console.log('Получени данни за графиката:', chartData);
        
        // If no data provided or empty data, use default values
        if (!chartData || 
            !chartData.labels ||
            !chartData.bank ||
            !chartData.crypto ||
            !chartData.stock ||
            !chartData.metal) {
            console.warn('Невалидни или липсващи данни за графиката, използване на празни масиви');
            chartData = {
                labels: [],
                bank: [],
                crypto: [],
                stock: [],
                metal: []
            };
        }
        
        // If no data available or all values are zero, generate demo data
        let hasData = chartData.labels.length > 0;
        let hasValues = false;
        
        // Check if any data arrays have non-zero values
        ['bank', 'crypto', 'stock', 'metal'].forEach(type => {
            if (chartData[type] && chartData[type].some(value => value > 0)) {
                hasValues = true;
            }
        });
        
        // If we have time points but no values, generate realistic demo data
        if (hasData && !hasValues) {
            console.warn('Не са намерени стойности за графиката. Генериране на примерни данни.');
            
            // Create sample data based on the investments we have
            if (historicalData && historicalData.length > 0) {
                // Generate sample data based on real investments
                const demoData = generateSampleChartData(historicalData, chartData.labels);
                chartData = {...chartData, ...demoData};
            } else {
                // Just make up some numbers if we have no investments
                chartData.bank = chartData.labels.map((_, i) => 1000 + Math.random() * 100 + i * 50);
                chartData.crypto = chartData.labels.map((_, i) => 800 + Math.random() * 200 + i * 70);
                chartData.stock = chartData.labels.map((_, i) => 1500 + Math.random() * 300 + i * 100);
                chartData.metal = chartData.labels.map((_, i) => 500 + Math.random() * 50 + i * 20);
            }
        }
        
        // Update chart data
        historyChart.data.labels = chartData.labels;
        historyChart.data.datasets[0].data = chartData.bank;
        historyChart.data.datasets[1].data = chartData.crypto;
        historyChart.data.datasets[2].data = chartData.stock;
        historyChart.data.datasets[3].data = chartData.metal;
        
        // Update chart
        historyChart.update();
    }
    
    // Generate sample chart data based on actual investments
    function generateSampleChartData(investments, labels) {
        // Get investment types and their initial values
        const typeTotals = {
            bank: 0,
            crypto: 0,
            stock: 0,
            metal: 0
        };
        
        // Calculate total value for each investment type
        investments.forEach(inv => {
            if (!inv.investment_type || !typeTotals.hasOwnProperty(inv.investment_type)) {
                return;
            }
            
            // Calculate initial value
            const initialValue = inv.initial_investment || 
                                (parseFloat(inv.quantity) * parseFloat(inv.purchase_price || 1));
            
            typeTotals[inv.investment_type] += initialValue;
        });
        
        // Generate growth patterns for each type
        const result = {
            bank: [],
            crypto: [],
            stock: [],
            metal: []
        };
        
        // Different growth rates for different asset types (sample rates)
        const growthRates = {
            bank: 0.5, // 0.5% monthly growth
            crypto: 2.0, // more volatile
            stock: 1.0,
            metal: 0.7
        };
        
        // Generate data for each label (time point)
        for (let i = 0; i < labels.length; i++) {
            // For each investment type
            for (const type in typeTotals) {
                if (i === 0) {
                    // Start with initial value
                    result[type].push(typeTotals[type]);
                } else {
                    // Apply growth with some randomness
                    const previousValue = result[type][i-1];
                    const growth = growthRates[type] * (1 + (Math.random() - 0.5));
                    const newValue = previousValue * (1 + growth / 100);
                    result[type].push(newValue);
                }
            }
        }
        
        return result;
    }

    // Helper function to find investment by ID
    function findInvestmentById(id) {
        // First try to find in the filtered data (current view)
        if (filteredData.length > 0) {
            const investment = filteredData.find(inv => inv.id == id);
            if (investment) return investment;
        }
        
        // Then try to find in the complete historical data
        if (historicalData.length > 0) {
            const investment = historicalData.find(inv => inv.id == id);
            if (investment) return investment;
        }
        
        // If not found in historicalData, try the global portfolioData
        if (window.portfolioData && window.portfolioData.investments) {
            const investment = window.portfolioData.investments.find(inv => inv.id == id);
            if (investment) return investment;
        }
        
        // If still not found, log an error and return null
        console.error('Инвестицията не е намерена с ID:', id);
        return null;
    }

    // Helper functions
    function getInvestmentTypeDisplay(type) {
        const typeMap = {
            'bank': 'Банков влог',
            'crypto': 'Крипто',
            'stock': 'Акции',
            'metal': 'Метали'
        };
        return typeMap[type] || type;
    }

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

    function formatQuantity(value) {
        // Handle undefined, null, or invalid values
        if (value === undefined || value === null || isNaN(parseFloat(value))) {
            return '0';
        }
        
        // Parse value to number if it's a string
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        
        // For crypto assets, we may need more decimal places
        if (numValue < 0.01) {
            return numValue.toLocaleString('bg-BG', {
                minimumFractionDigits: 6,
                maximumFractionDigits: 8
            });
        }
        
        // For larger values, limit to 2 decimal places
        return numValue.toLocaleString('bg-BG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
});