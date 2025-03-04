// Sample code to fetch and process portfolio data
// This can be used in your server-side route handler

/**
 * Gets the user's investment portfolio with summary data
 * @param {number} userId - User ID
 * @returns {Object} Portfolio data with summaries by type
 */
async function getUserPortfolio(userId) {
    try {
        // Fetch all investments for the user
        const [investments] = await pool.query(
            `SELECT * FROM user_investments WHERE user_id = ? ORDER BY purchase_date DESC`, 
            [userId]
        );
        
        // Fetch latest pricing data for calculations
        const [prices] = await pool.query(
            `SELECT symbol, price FROM investment_prices 
             WHERE (symbol, timestamp) IN (
                SELECT symbol, MAX(timestamp) 
                FROM investment_prices 
                GROUP BY symbol
             )`
        );
        
        // Create a price lookup map
        const priceMap = {};
        prices.forEach(price => {
            priceMap[price.symbol] = price.price;
        });
        
        // Process investments and calculate current values
        const processedInvestments = investments.map(investment => {
            const result = { ...investment };
            
            // Format display values based on investment type
            if (investment.investment_type === 'bank') {
                // Process bank deposit
                result.displayType = 'Банков влог';
                result.displayName = `${investment.currency} депозит`;
                result.displayAmount = `${investment.quantity.toFixed(2)} ${investment.currency}`;
                result.displayRate = `${investment.interest_rate}%`;
                
                // Calculate current value based on interest
                let monthsHeld = monthsBetween(new Date(investment.purchase_date), new Date());
                let interestMultiplier = 1;
                
                switch(investment.interest_type) {
                    case 'daily':
                        // Simplified daily calculation (30 days per month)
                        interestMultiplier = 1 + ((investment.interest_rate / 100) * (monthsHeld * 30) / 365);
                        break;
                    case 'monthly_1':
                        interestMultiplier = 1 + ((investment.interest_rate / 100) * monthsHeld / 12);
                        break;
                    case 'monthly_3':
                        interestMultiplier = 1 + ((investment.interest_rate / 100) * Math.floor(monthsHeld / 3) / 4);
                        break;
                    case 'monthly_6':
                        interestMultiplier = 1 + ((investment.interest_rate / 100) * Math.floor(monthsHeld / 6) / 2);
                        break;
                    case 'yearly':
                        interestMultiplier = 1 + ((investment.interest_rate / 100) * Math.floor(monthsHeld / 12));
                        break;
                }
                
                result.currentValue = investment.quantity * interestMultiplier;
                result.profit = result.currentValue - investment.quantity;
                result.profitPercentage = ((result.currentValue / investment.quantity) - 1) * 100;
            } else {
                // Process crypto, stock, or metal investment
                result.displayType = getDisplayType(investment.investment_type);
                result.displayName = investment.symbol;
                result.displayAmount = `${investment.quantity.toFixed(2)} ${investment.symbol}`;
                
                // Calculate current value based on latest price
                const currentPrice = priceMap[investment.symbol] || investment.purchase_price;
                result.currentValue = investment.quantity * currentPrice;
                result.profit = result.currentValue - (investment.quantity * investment.purchase_price);
                result.profitPercentage = ((currentPrice / investment.purchase_price) - 1) * 100;
            }
            
            return result;
        });
        
        // Calculate summary statistics
        const summary = {
            totalInvestment: 0,
            totalCurrentValue: 0,
            totalProfit: 0,
            profitPercentage: 0,
            byType: {
                bank: { amount: 0, percentage: 0 },
                crypto: { amount: 0, percentage: 0 },
                stock: { amount: 0, percentage: 0 },
                metal: { amount: 0, percentage: 0 }
            }
        };
        
        // Calculate totals
        processedInvestments.forEach(inv => {
            summary.totalInvestment += inv.investment_type === 'bank' ? 
                inv.quantity : (inv.quantity * inv.purchase_price);
            summary.totalCurrentValue += inv.currentValue;
            
            // Add to type-specific totals
            summary.byType[inv.investment_type].amount += inv.currentValue;
        });
        
        // Calculate profit and percentages
        summary.totalProfit = summary.totalCurrentValue - summary.totalInvestment;
        summary.profitPercentage = summary.totalInvestment > 0 ? 
            ((summary.totalCurrentValue / summary.totalInvestment) - 1) * 100 : 0;
        
        // Calculate percentage distribution by type
        if (summary.totalCurrentValue > 0) {
            for (const type in summary.byType) {
                summary.byType[type].percentage = 
                    (summary.byType[type].amount / summary.totalCurrentValue) * 100;
            }
        }
        
        return {
            investments: processedInvestments,
            summary: summary
        };
    } catch (error) {
        console.error("Error fetching portfolio:", error);
        throw error;
    }
}

// Helper function to get display type name
function getDisplayType(type) {
    const typeMap = {
        bank: 'Банков влог',
        crypto: 'Крипто',
        stock: 'Акции',
        metal: 'Метали'
    };
    return typeMap[type] || type;
}

// Helper function to calculate months between two dates
function monthsBetween(date1, date2) {
    const months = (date2.getFullYear() - date1.getFullYear()) * 12;
    return months + date2.getMonth() - date1.getMonth();
}

module.exports = {
    getUserPortfolio
};