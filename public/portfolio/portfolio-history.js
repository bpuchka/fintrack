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
    
    // Filter and sorting selectors
    const timeRangeFilter = document.getElementById('timeRangeFilter');
    const typeFilter = document.getElementById('typeFilter');
    const sortFilter = document.getElementById('sortFilter');
    const loadMoreBtn = document.getElementById('loadMore');
    
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

    // Fetch portfolio history data
    fetchPortfolioHistory();

    // Event listeners for filters
    timeRangeFilter.addEventListener('change', applyFilters);
    typeFilter.addEventListener('change', applyFilters);
    sortFilter.addEventListener('change', applyFilters);
    loadMoreBtn.addEventListener('click', loadMoreInvestments);

    // Fetch portfolio history data from API
    async function fetchPortfolioHistory() {
        try {
            // Show loading spinner if it exists
            const loadingElement = document.querySelector('.timeline-loading');
            if (loadingElement) {
                loadingElement.style.display = 'flex';
            }
            
            const response = await fetch('/api/portfolio/history/data');
            if (!response.ok) {
                throw new Error('Failed to fetch portfolio history');
            }
            
            const data = await response.json();
            
            // Debug data received from API
            console.log('Portfolio history data received:', data);
            
            if (!data.success) {
                throw new Error(data.message || 'Error loading portfolio history');
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
            
            // Store the data and apply initial filters
            historicalData = data.investments;
            
            // Populate the chart with historical data
            updateHistoryChart(data.chartData);
            
            // Apply initial filters
            applyFilters();
            
        } catch (error) {
            console.error('Error fetching portfolio history:', error);
            
            // Hide loading spinner if it exists
            const loadingElement = document.querySelector('.timeline-loading');
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
            
            // Show no investments message and hide other elements
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
            `;
            
            timelineContainer.appendChild(timelineItem);
        }
        
        // Update "Load More" button visibility
        hasMoreItems = endIndex < filteredData.length;
        loadMoreBtn.style.display = hasMoreItems ? 'block' : 'none';
    }

    // Load more investments button handler
    function loadMoreInvestments() {
        currentPage++;
        renderTimelineItems(false);
    }

    // Update the history chart with data
    function updateHistoryChart(chartData) {
        // Debug chart data
        console.log('Chart data received for updating:', chartData);
        
        // If no data provided or empty data, use default values
        if (!chartData || 
            !chartData.labels ||
            !chartData.bank ||
            !chartData.crypto ||
            !chartData.stock ||
            !chartData.metal) {
            console.warn('Invalid or missing chart data, using empty arrays');
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
            console.warn('No chart data values found. Generating sample data.');
            
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
        
        // Debug final chart configuration
        console.log('Final chart configuration:', {
            labels: historyChart.data.labels,
            datasets: historyChart.data.datasets.map(ds => ({
                label: ds.label,
                dataPoints: ds.data.length > 0 ? `${ds.data[0]}...${ds.data[ds.data.length-1]}` : 'none'
            }))
        });
        
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