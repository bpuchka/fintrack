const { fetchAndStoreHistoricalPrices, checkApiStatus } = require("./fetchPrices");
const fs = require('fs').promises;
const path = require('path');

// Script configuration
const batchSize = 5; // Number of assets to process in each batch
const delay = 5000; // Delay in milliseconds between requests (5 seconds for cached requests)
const useCache = true; // Use cached data where available

// Track last run date to avoid unnecessary API calls
const LAST_RUN_FILE = path.join(__dirname, 'last_run.json');

async function getLastRunInfo() {
  try {
    const data = await fs.readFile(LAST_RUN_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { lastRun: null, apiCallsMade: 0 };
  }
}

async function saveLastRunInfo(info) {
  try {
    await fs.writeFile(LAST_RUN_FILE, JSON.stringify(info));
  } catch (error) {
    console.error('Error saving last run info:', error.message);
  }
}

async function main() {
  try {
    // Get information about the last time this script ran
    const lastRunInfo = await getLastRunInfo();
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // If we already ran today and used most of our API calls, just use cache
    const forceUseCache = lastRunInfo.lastRun === today && lastRunInfo.apiCallsMade >= 20;
    const effectiveUseCache = useCache || forceUseCache;
    
    if (forceUseCache) {
      console.log(`Already made ${lastRunInfo.apiCallsMade} API calls today. Using cache only.`);
    }

    // Check API status only if we're not forcing cache use
    let apiAvailable = true;
    if (!forceUseCache) {
      apiAvailable = await checkApiStatus();
    }
    
    if (apiAvailable) {
      console.log("Starting data fetch...");
      
      // Run the function with parameters
      await fetchAndStoreHistoricalPrices(batchSize, delay, effectiveUseCache);
      
      // Update last run info
      await saveLastRunInfo({ 
        lastRun: today, 
        apiCallsMade: forceUseCache ? lastRunInfo.apiCallsMade : 25 // Assume we used all our calls
      });
      
      console.log("Data fetching and storing completed.");
    } else {
      console.log("API is not available or rate limit reached. Using cache only.");
      // Still run but use cache only
      await fetchAndStoreHistoricalPrices(batchSize, delay, true);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// Run the main function
main();