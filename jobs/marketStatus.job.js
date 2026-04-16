const axios = require('axios');
const cron = require('node-cron');

// ==================== CONFIGURATION ====================
const API_BASE_URL = 'http://localhost:6060';
const API_ENDPOINT = '/api/stocks/equity/gse/status/update';

const TRADING_START = { hour: 10, minute: 0 };
const TRADING_END = { hour: 15, minute: 0 };
const TIMEZONE = 'Africa/Accra';

const PUBLIC_HOLIDAYS = [
  { month: 1, day: 1 }, // New Year's Day
  { month: 1, day: 7 }, // Constitution Day
  { month: 3, day: 6 }, // Independence Day
  { month: 3, day: 20 }, // Eid-Ul-Fitr (Ramadan)
  { month: 3, day: 21 }, // Shaqq Day
  { month: 4, day: 3 }, // Good Friday (2026)
  { month: 4, day: 6 }, // Easter Monday (2026)
  { month: 5, day: 1 }, // Labour Day
  { month: 7, day: 1 }, // Republic Day
  { month: 9, day: 21 }, // Founder's Day
  { month: 12, day: 4 }, // Farmer's Day
  { month: 12, day: 25 }, // Christmas Day
  { month: 12, day: 26 }, // Boxing Day
];

// ==================== MARKET STATUS FUNCTIONS ====================
const isPublicHoliday = (date = new Date()) => {
  const ghanaDate = new Date(
    date.toLocaleString('en-US', { timeZone: TIMEZONE }),
  );

  const month = ghanaDate.getMonth() + 1;
  const day = ghanaDate.getDate();

  return PUBLIC_HOLIDAYS.some(
    (holiday) => holiday.month === month && holiday.day === day,
  );
};

const isTradingDay = () => {
  const now = new Date();
  const ghanaDate = new Date(
    now.toLocaleString('en-US', { timeZone: TIMEZONE }),
  );

  const day = ghanaDate.getDay();
  const isWeekday = day >= 1 && day <= 5;
  const isHoliday = isPublicHoliday(now);

  return isWeekday && !isHoliday;
};

const getMarketStatus = () => {
  const now = new Date();
  const ghanaDate = new Date(
    now.toLocaleString('en-US', { timeZone: TIMEZONE }),
  );
  const day = ghanaDate.getDay();
  const hours = ghanaDate.getHours();
  const minutes = ghanaDate.getMinutes();
  const currentTimeInMinutes = hours * 60 + minutes;

  const openTimeInMinutes = TRADING_START.hour * 60 + TRADING_START.minute;
  const closeTimeInMinutes = TRADING_END.hour * 60 + TRADING_END.minute;

  // Default values
  let status = 'closed';
  let message = '';

  // Check if it's a trading day
  if (!isTradingDay()) {
    if (day === 0) {
      message = 'Market closed - Sunday';
    } else if (day === 6) {
      message = 'Market closed - Saturday';
    } else if (isPublicHoliday(now)) {
      message = 'Market closed - Public Holiday';
    }
    return { status, message };
  }

  // It's a trading day, check time
  if (
    currentTimeInMinutes >= openTimeInMinutes &&
    currentTimeInMinutes < closeTimeInMinutes
  ) {
    status = 'open';
    message = 'Market open - Regular trading hours';
  } else if (currentTimeInMinutes < openTimeInMinutes) {
    status = 'closed';
    message = 'Market closed - Pre-market';
  } else if (currentTimeInMinutes >= closeTimeInMinutes) {
    status = 'closed';
    message = 'Market closed - After market hours';
  }

  return { status, message };
};

// ==================== API CALL FUNCTION ====================
const updateMarketStatus = async () => {
  try {
    console.log(`\n[${new Date().toISOString()}] Checking market status...`);

    const { status, message } = getMarketStatus();
    console.log(`Status: ${status}`);
    console.log(`Message: ${message}`);

    // Call your API endpoint to update the market status
    const response = await axios.post(
      `${API_BASE_URL}${API_ENDPOINT}`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
    );

    console.log(
      `✅ API Response: ${response.status} - ${response.data.message}`,
    );

    // Optional: Get current status to verify
    const statusCheck = await axios.get(
      `${API_BASE_URL}/api/stocks/equity/gse/status`,
    );
    console.log(
      `📊 Current market status in DB: ${statusCheck.data.data.status} - ${statusCheck.data.data.message}`,
    );

    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(
        `❌ API Error: ${error.response.status} - ${error.response.data.message || error.response.statusText}`,
      );
    } else if (error.request) {
      console.error('❌ No response from API server. Is the server running?');
    } else {
      console.error('❌ Error:', error.message);
    }
    return null;
  }
};

// ==================== SCHEDULED JOBS ====================

// Run at market open (10:00 AM) on weekdays
cron.schedule(
  '0 10 * * 1-5',
  async () => {
    if (isTradingDay()) {
      console.log('⏰ Scheduled: Market open check (10:00 AM)');
      await updateMarketStatus();
    }
  },
  {
    timezone: TIMEZONE,
  },
);

// Run at market close (3:00 PM) on weekdays
cron.schedule(
  '0 15 * * 1-5',
  async () => {
    console.log('⏰ Scheduled: Market close check (3:00 PM)');
    await updateMarketStatus();
  },
  {
    timezone: TIMEZONE,
  },
);

// Run every hour during trading hours (10 AM - 3 PM)
cron.schedule(
  '0 10-15 * * 1-5',
  async () => {
    const { status } = getMarketStatus();
    if (status === 'open') {
      console.log('⏰ Scheduled: Hourly update during trading');
      await updateMarketStatus();
    }
  },
  {
    timezone: TIMEZONE,
  },
);

// Run at midnight to handle day changes
cron.schedule(
  '0 0 * * *',
  async () => {
    console.log('⏰ Scheduled: Midnight check');
    await updateMarketStatus();
  },
  {
    timezone: TIMEZONE,
  },
);

// Run at 8:00 AM on weekdays to check for holidays before market opens
cron.schedule(
  '0 8 * * 1-5',
  async () => {
    console.log('⏰ Scheduled: Pre-market check (8:00 AM)');
    await updateMarketStatus();
  },
  {
    timezone: TIMEZONE,
  },
);

// ==================== HEALTH CHECK ====================
const checkAPIHealth = async () => {
  try {
    await axios.get(`${API_BASE_URL}/api/stocks/equity/gse/status`, {
      timeout: 5000,
    });
    console.log('✅ API server is reachable');
    return true;
  } catch (error) {
    console.error(
      '❌ API server is not reachable. Make sure your backend is running on port 6060',
    );
    return false;
  }
};

// ==================== INITIAL RUN ====================
(async () => {
  console.log('='.repeat(50));
  console.log('🚀 GSE Market Status Updater Started');
  console.log('='.repeat(50));
  console.log(`🌍 Timezone: ${TIMEZONE}`);
  console.log(`📡 API Endpoint: ${API_BASE_URL}${API_ENDPOINT}`);

  const ghanaTime = new Date().toLocaleString('en-US', { timeZone: TIMEZONE });
  console.log(`🕒 Current time in Ghana: ${ghanaTime}`);

  const { status, message } = getMarketStatus();
  console.log(`📊 Current market status: ${status} - ${message}`);

  console.log('⏰ Scheduled jobs:');
  console.log('  - 08:00 AM (Pre-market check)');
  console.log('  - 10:00 AM (Market open)');
  console.log('  - Hourly during trading (10AM-3PM)');
  console.log('  - 03:00 PM (Market close)');
  console.log('  - 00:00 AM (Midnight check)');
  console.log('='.repeat(50));

  // Check if API is reachable
  const apiOk = await checkAPIHealth();

  if (apiOk) {
    // Initial update after 5 seconds
    setTimeout(async () => {
      console.log('\n🔄 Running initial market status update...');
      await updateMarketStatus();
    }, 5000);
  }
})();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down market status updater...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down market status updater...');
  process.exit(0);
});
