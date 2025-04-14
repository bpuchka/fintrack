document.addEventListener('DOMContentLoaded', function() {
    // Get current symbol and asset type from URL
    const pathParts = window.location.pathname.split('/');
    const symbol = pathParts[pathParts.length - 1]; // Last part of URL should be the symbol
    const assetType = document.getElementById('investmentType') ? 
                      document.getElementById('investmentType').value : 
                      getAssetType(symbol);
    
    // Get chart element
    const chartEl = document.getElementById('price-chart');
    let priceChart = null;
    
    // Get timeframe buttons
    const timeButtons = document.querySelectorAll('.timeframe-button');
    let currentTimeframe = 'day'; // Default timeframe
    
    // Get price display elements
    const currentPriceEl = document.getElementById('currentPrice');
    const displayCurrentPriceEl = document.getElementById('displayCurrentPrice');
    const priceChangeEl = document.getElementById('priceChange');
    
    // Get modal elements
    const modal = document.getElementById('investmentModal');
    const closeModalBtns = document.querySelectorAll('.close-modal, .close-modal-btn');
    const cancelBtn = document.getElementById('cancelInvestment');
    const buyAssetBtn = document.getElementById('buyAssetBtn');
    const investmentForm = document.getElementById('investmentForm');
    const investmentPrice = document.getElementById('investmentPrice');
    const investmentDate = document.getElementById('investmentDate');
    
    // Success modal elements
    const successModal = document.getElementById('success-modal');
    const successMessage = document.getElementById('success-message');
    
    // Store price data
    let priceData = {
        current: 0,
        day: [],
        week: [],
        month: [],
        year: [],
        all: []
    };
    
    // Initialize page
    initPage();
    
    // Initialize the page
    async function initPage() {
        // Fetch initial price data
        await fetchPriceData();
        
        // Initialize chart with day data
        initChart();
        
        // Set up event listeners
        setupEventListeners();
        
        // Set today's date as default for the investment date
        if (investmentDate) {
            investmentDate.valueAsDate = new Date();
        }
        
        // Refresh data periodically
        setInterval(refreshPriceData, 30000); // every 30 seconds
    }
    
    // Fetch price data from the server
    async function fetchPriceData() {
        try {
            // For the MAX/ALL timeframe, make a specific request to get all data
            const allHistoryResponse = await fetch(`/api/asset/${symbol}/history?timeframe=all`);
            
            if (allHistoryResponse.ok) {
                // Store ALL data
                priceData.all = await allHistoryResponse.json();
            } else {
                // Fallback - try to get as much data as possible
                try {
                    const yearResponse = await fetch(`/api/asset/${symbol}/history?timeframe=year`);
                    if (yearResponse.ok) {
                        priceData.all = await yearResponse.json();
                    } else {
                        priceData.all = generateMockPriceData('ALL');
                    }
                } catch (error) {
                    console.warn('Failed to fetch all history, using mock data for ALL');
                    priceData.all = generateMockPriceData('ALL');
                }
            }
            
            // Extract 3-month data from the all data if available
            if (priceData.all && priceData.all.length > 0) {
                const threeMonthsAgo = new Date();
                threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                priceData['3month'] = priceData.all.filter(point => 
                    new Date(point.timestamp) >= threeMonthsAgo
                );
            } else {
                // If all data is empty, generate mock data for 3-month
                priceData['3month'] = generateMockPriceData('3M');
            }
            
            // Map the button timeframes to API timeframes
            const timeframeMap = {
                '1D': 'day',
                '1W': 'week',
                '1M': 'month',
                '1Y': 'year'
            };
            
            // Fetch data for each timeframe
            for (const [buttonTime, apiTime] of Object.entries(timeframeMap)) {
                try {
                    const response = await fetch(`/api/asset/${symbol}/history?timeframe=${apiTime}`);
                    
                    if (!response.ok) {
                        throw new Error(`Failed to fetch ${apiTime} price data`);
                    }
                    
                    let data = await response.json();
                    priceData[mapButtonTimeToKey(buttonTime)] = data;
                } catch (error) {
                    console.error(`Error fetching ${apiTime} data:`, error);
                    // Generate mock data as fallback
                    priceData[mapButtonTimeToKey(buttonTime)] = generateMockPriceData(buttonTime);
                }
            }
            
            // Set current price from the most recent data point
            updateCurrentPriceFromData();
            
        } catch (error) {
            console.error('Error fetching price data:', error);
            // Use mock data as fallback
            generateAllMockData();
        }
    }
    
    // Map button timeframe to data key
    function mapButtonTimeToKey(buttonTime) {
        switch (buttonTime) {
            case '1D': return 'day';
            case '1W': return 'week';
            case '1M': return 'month';
            case '3M': return '3month';
            case '1Y': return 'year';
            case 'ALL': return 'all';
            default: return buttonTime.toLowerCase();
        }
    }
    
    // Update current price from data
    function updateCurrentPriceFromData() {
        // Get the most recent price from day data
        if (priceData.day && priceData.day.length > 0) {
            const latestData = priceData.day[priceData.day.length - 1];
            priceData.current = latestData.price;
            
            // Calculate price change
            if (priceData.day.length > 1) {
                const previousPrice = priceData.day[0].price;
                const change = priceData.current - previousPrice;
                const changePercent = (change / previousPrice) * 100;
                
                updatePriceDisplay(priceData.current, changePercent);
            } else {
                updatePriceDisplay(priceData.current, 0);
            }
            
            // Update investment price input
            if (investmentPrice) {
                investmentPrice.value = priceData.current.toFixed(2);
            }
            
            // Update displayed current price
            if (displayCurrentPriceEl) {
                displayCurrentPriceEl.textContent = formatCurrency(priceData.current);
            }
        }
    }
    
    // Initialize the chart
    function initChart() {
        if (!chartEl) return;
        
        const ctx = chartEl.getContext('2d');
        
        // Parse the data for the default timeframe (day)
        const { labels, values } = parseChartData(priceData.day);
        
        // Get color based on price trend
        const priceChange = values.length > 1 ? values[values.length - 1] - values[0] : 0;
        const lineColor = priceChange >= 0 ? '#27ae60' : '#e74c3c';
        
        // Create gradient fill
        const gradientFill = ctx.createLinearGradient(0, 0, 0, 300);
        gradientFill.addColorStop(0, `${lineColor}40`); // 25% opacity
        gradientFill.addColorStop(1, `${lineColor}00`); // 0% opacity
        
        priceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: symbol,
                    data: values,
                    borderColor: lineColor,
                    backgroundColor: gradientFill,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: lineColor,
                    tension: 0.1,
                    fill: true
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
                                return `${symbol}: ${formatCurrency(context.parsed.y)}`;
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
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 8
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#ccc',
                            callback: function(value) {
                                return formatCurrency(value);
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
    
    // Parse chart data
    function parseChartData(data) {
        if (!data || !Array.isArray(data) || data.length === 0) {
            return { labels: [], values: [] };
        }
        
        const labels = [];
        const values = [];
        
        data.forEach(point => {
            labels.push(formatDate(point.timestamp, currentTimeframe));
            values.push(point.price);
        });
        
        return { labels, values };
    }
    
    // Update chart with new timeframe data
    function updateChart(timeframe) {
        if (!priceChart) return;
        
        // Get the appropriate data for the timeframe
        const data = priceData[timeframe] || [];
        
        // Parse the data
        const { labels, values } = parseChartData(data);
        
        // Update chart color based on price trend
        const priceChange = values.length > 1 ? values[values.length - 1] - values[0] : 0;
        const lineColor = priceChange >= 0 ? '#27ae60' : '#e74c3c';
        
        // Update gradient fill
        const ctx = chartEl.getContext('2d');
        const gradientFill = ctx.createLinearGradient(0, 0, 0, 300);
        gradientFill.addColorStop(0, `${lineColor}40`); // 25% opacity
        gradientFill.addColorStop(1, `${lineColor}00`); // 0% opacity
        
        // Update chart data and colors
        priceChart.data.labels = labels;
        priceChart.data.datasets[0].data = values;
        priceChart.data.datasets[0].borderColor = lineColor;
        priceChart.data.datasets[0].backgroundColor = gradientFill;
        priceChart.data.datasets[0].pointHoverBackgroundColor = lineColor;
        
        // Update y-axis to fit the new data range
        if (values.length > 0) {
            const min = Math.min(...values) * 0.95;
            const max = Math.max(...values) * 1.05;
            
            priceChart.options.scales.y.min = min;
            priceChart.options.scales.y.max = max;
        }
        
        priceChart.update();
    }
    
    // Set up event listeners
    function setupEventListeners() {
        // Timeframe buttons
        timeButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Get the timeframe from the button
                const buttonTimeframe = this.getAttribute('data-timeframe');
                
                // Map button timeframe to data key
                currentTimeframe = mapButtonTimeToKey(buttonTimeframe);
                
                // Update active button
                timeButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
                // Update chart with the new timeframe
                updateChart(currentTimeframe);
            });
        });
        
        // Buy button to open modal
        if (buyAssetBtn) {
            buyAssetBtn.addEventListener('click', function() {
                openInvestmentModal();
            });
        }
        
        // Investment form submission
        if (investmentForm) {
            investmentForm.addEventListener('submit', function(e) {
                e.preventDefault();
                saveInvestment();
            });
        }
        
        // Close modal buttons
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                closeModal(this.closest('.modal'));
            });
        });
        
        // Cancel button
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                closeModal(modal);
            });
        }
        
        // Close modal when clicking outside
        window.addEventListener('click', function(event) {
            if (event.target.classList.contains('modal')) {
                closeModal(event.target);
            }
        });
    }
    
    // Open investment modal
    function openInvestmentModal() {
        if (!modal) return;
        
        // Set current price in the form
        if (investmentPrice) {
            investmentPrice.value = priceData.current.toFixed(2);
        }
        
        // Reset form
        if (investmentForm) {
            investmentForm.reset();
            
            // Set the current price again (after reset)
            if (investmentPrice) {
                investmentPrice.value = priceData.current.toFixed(2);
            }
            
            // Set today's date
            if (investmentDate) {
                investmentDate.valueAsDate = new Date();
            }
        }
        
        // Show modal
        modal.style.display = "flex";
        document.body.style.overflow = "hidden"; // Prevent background scrolling
    }
    
    // Close modal
    function closeModal(modalEl) {
        if (!modalEl) return;
        
        modalEl.style.display = "none";
        document.body.style.overflow = "auto"; // Re-enable scrolling
    }
    
    // Handle investment save
    function saveInvestment() {
        if (!investmentForm) return;
        
        // Show loading state on submit button
        const submitButton = investmentForm.querySelector('.submit-button');
        const originalButtonText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Обработва се...';
        
        // Get form data
        const formData = new FormData(investmentForm);
        const formObject = Object.fromEntries(formData.entries());
        
        // Create payload for API
        const payload = {
            type: formObject.investmentType,
            symbol: formObject.investmentSymbol,
            amount: parseFloat(formObject.investmentAmount),
            price: parseFloat(formObject.investmentPrice),
            currency: formObject.investmentCurrency,
            date: formObject.investmentDate,
            notes: formObject.investmentNotes || ''
        };
        
        // Send data to server
        fetch('/api/investments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            credentials: 'same-origin' // Include cookies for session
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.message || 'Failed to add investment');
                });
            }
            return response.json();
        })
        .then(data => {
            // Show success modal
            if (successModal && successMessage) {
                successMessage.textContent = 'Вашата инвестиция беше добавена успешно!';
                closeModal(modal);
                successModal.style.display = 'flex';
            } else {
                Notify.success('Успех', 'Вашата инвестиция беше добавена успешно!');
                closeModal(modal);
            }
        })
        .catch(error => {
            console.error('Error saving investment:', error);
            if (window.Notify) {
                Notify.error('Грешка', error.message);
            } else {
                alert('Грешка: ' + error.message);
            }
        })
        .finally(() => {
            // Reset button state
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        });
    }
    
    // Refresh price data
    async function refreshPriceData() {
        try {
            // Fetch latest price
            const response = await fetch(`/api/asset/${symbol}/latest`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch latest price');
            }
            
            const data = await response.json();
            
            if (data && data.price) {
                // Update current price
                priceData.current = data.price;
                
                // Make sure changePercent is a number to avoid the .toFixed error
                const changePercent = parseFloat(data.changePercent) || 0;
                
                // Update price display with change percentage from the data
                updatePriceDisplay(data.price, changePercent);
                
                // Update current price display
                if (displayCurrentPriceEl) {
                    displayCurrentPriceEl.textContent = formatCurrency(data.price);
                }
                
                // Update investment form price
                if (investmentPrice) {
                    investmentPrice.value = data.price.toFixed(2);
                }
                
                // Add to day data if needed
                if (Array.isArray(priceData.day) && data.timestamp) {
                    const lastPoint = priceData.day[priceData.day.length - 1];
                    
                    // Only add if this is a new timestamp
                    if (!lastPoint || new Date(data.timestamp) > new Date(lastPoint.timestamp)) {
                        priceData.day.push({
                            timestamp: data.timestamp,
                            price: data.price
                        });
                        
                        // If current timeframe is day, update the chart
                        if (currentTimeframe === 'day') {
                            updateChart('day');
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error refreshing price data:', error);
        }
    }
    
    // Update price display
    function updatePriceDisplay(price, changePercent) {
        if (currentPriceEl) {
            currentPriceEl.textContent = formatCurrency(price);
        }
        
        if (priceChangeEl) {
            // Make sure changePercent is a number to avoid the .toFixed error
            const numChangePercent = parseFloat(changePercent) || 0;
            
            const formattedChange = (numChangePercent >= 0 ? '+' : '') + 
                                    numChangePercent.toFixed(2) + '%';
            
            priceChangeEl.textContent = formattedChange;
            priceChangeEl.className = 'price-change ' + (numChangePercent >= 0 ? 'positive' : 'negative');
        }
    }
    
    // Format currency
    function formatCurrency(value) {
        if (isNaN(value)) return '$0.00';
        
        // For crypto or very small values, show more decimal places
        if (Math.abs(value) < 0.01) {
            return '$' + value.toFixed(8);
        }
        
        return '$' + value.toFixed(2);
    }
    
    // Format date based on timeframe
    function formatDate(timestamp, timeframe) {
        const date = new Date(timestamp);
        
        switch (timeframe) {
            case 'day':
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            case 'week':
                return date.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
            case 'month':
                return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            case '3month':
                return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
            case 'year':
                return date.toLocaleDateString([], { month: 'short', year: 'numeric' });
            case 'all':
                return date.toLocaleDateString([], { month: 'short', year: 'numeric' });
            default:
                return date.toLocaleDateString();
        }
    }
    
    // Generate mock price data for a specific timeframe
    function generateMockPriceData(timeframe) {
        // Base price for the asset
        const basePrice = getBasePriceForSymbol(symbol);
        
        // Volatility factor based on asset type
        const volatility = symbol === 'BTC' || symbol === 'ETH' ? 0.05 : 0.02;
        
        // Number of data points based on timeframe
        let numPoints;
        let interval;
        
        switch (timeframe) {
            case '1D':
                numPoints = 24; // hourly for a day
                interval = 'hour';
                break;
            case '1W':
                numPoints = 7; // daily for a week
                interval = 'day';
                break;
            case '1M':
                numPoints = 30; // daily for a month
                interval = 'day';
                break;
            case '3M':
                numPoints = 90; // daily for 3 months
                interval = 'day';
                break;
            case '1Y':
                numPoints = 12; // monthly for a year
                interval = 'month';
                break;
            case 'ALL':
                numPoints = 60; // monthly for 5 years for ALL data
                interval = 'month';
                break;
            default:
                numPoints = 24;
                interval = 'hour';
        }
        
        return generatePricePoints(numPoints, basePrice, volatility, interval);
    }
    
    // Generate all mock data for the asset
    function generateAllMockData() {
        priceData.day = generateMockPriceData('1D');
        priceData.week = generateMockPriceData('1W');
        priceData.month = generateMockPriceData('1M');
        priceData['3month'] = generateMockPriceData('3M');
        priceData.year = generateMockPriceData('1Y');
        priceData.all = generateMockPriceData('ALL');
        
        // Set current price from the most recent data point
        updateCurrentPriceFromData();
    }
    
    // Generate price points
    function generatePricePoints(count, basePrice, volatility, interval) {
        const points = [];
        let price = basePrice;
        const now = new Date();
        
        // Generate points going from past to present
        for (let i = 0; i < count; i++) {
            const timestamp = new Date(now);
            
            // Set timestamp based on interval and count
            switch (interval) {
                case 'hour':
                    timestamp.setHours(now.getHours() - (count - i - 1));
                    break;
                case 'day':
                    timestamp.setDate(now.getDate() - (count - i - 1));
                    break;
                case 'month':
                    timestamp.setMonth(now.getMonth() - (count - i - 1));
                    break;
                case 'quarter':
                    timestamp.setMonth(now.getMonth() - (count - i - 1) * 3);
                    break;
            }
            
            // Add a slight trend (40% likelihood of upward trend)
            const trend = Math.random() > 0.4 ? 1 : -1;
            
            // Calculate random price movement
            const change = price * (Math.random() * volatility * trend);
            price = Math.max(price + change, basePrice * 0.1); // Prevent price from going too low
            
            points.push({
                timestamp: timestamp.toISOString(),
                price: price
            });
        }
        
        return points;
    }
    
    // Get base price for a symbol
    function getBasePriceForSymbol(symbol) {
        const prices = {
            'BTC': 35000,
            'ETH': 2000,
            'USDT': 1,
            'SOL': 60,
            'XRP': 0.5,
            'AAPL': 175,
            'NVDA': 450,
            'TSLA': 250,
            'GLD': 190,
            'SLV': 23
        };
        
        return prices[symbol] || 100;
    }
    
    // Determine asset type from symbol
    function getAssetType(symbol) {
        const cryptoSymbols = ['BTC', 'ETH', 'USDT', 'XRP', 'SOL'];
        const stockSymbols = ['AAPL', 'NVDA', 'TSLA'];
        const metalSymbols = ['GLD', 'SLV'];
        
        if (cryptoSymbols.includes(symbol)) return 'crypto';
        if (stockSymbols.includes(symbol)) return 'stock';
        if (metalSymbols.includes(symbol)) return 'metal';
        
        return 'stock'; // Default
    }
});