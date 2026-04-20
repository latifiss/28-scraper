# Historical Data for Bitcoin (BTC)

## Data Summary
- **Coin**: Bitcoin (BTC)
- **Timeframe**: Last 365 days
- **Currency**: USD
- **Data Points**: 366
- **Date Range**: 2025-04-19 to 2026-04-18
- **Fetch Date**: 2026-04-18T21:07:13.199Z

## Price Statistics
- **Highest Price**: $124773.51
- **Lowest Price**: $62853.69
- **Average Price**: $96892.80
- **Start Price**: $84433.75
- **End Price**: $75814.62
- **Change**: -10.21%

## File Structure
- `/json/` - JSON files in various formats
  - Complete data with all fields
  - Crypto model format (matches your ICrypto interface)
  - CoinHistory model format (matches your ICoinHistory interface)
- `/csv/` - CSV files for easy analysis
  - Full price history with timestamps
  - Simple date-price pairs
- `/summaries/` - Summary statistics JSON files

## Data Format Notes
This data matches your Mongoose schemas:
- `ICrypto` interface includes price_history array
- `ICoinHistory` interface includes market_data with prices array
- All timestamps are preserved in both timestamp and ISO date format

## Limitations
Free API tier limited to 365 days of historical data
For full historical data (from 2013), upgrade at: https://www.coingecko.com/en/api/pricing
