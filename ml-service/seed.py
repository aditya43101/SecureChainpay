import requests
import psycopg2
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgrespassword@localhost:5432/securechain")
if "?schema=" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split("?schema=")[0]

def fetch_and_save(symbol, timeframe, limit=1000):
    print(f"Fetching {limit} candles for {symbol} {timeframe}...")
    url = f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval={timeframe}&limit={limit}"
    response = requests.get(url)
    data = response.json()
    
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    for row in data:
        ts = datetime.utcfromtimestamp(row[0] / 1000.0)
        open_price = float(row[1])
        high_price = float(row[2])
        low_price = float(row[3])
        close_price = float(row[4])
        volume = float(row[5])
        
        # Insert avoiding duplicate
        try:
            cursor.execute("""
                INSERT INTO "MarketCandle" (id, symbol, timeframe, timestamp, open, high, low, close, volume, "createdAt")
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (symbol, timeframe, timestamp) DO NOTHING
            """, (symbol, timeframe, ts, open_price, high_price, low_price, close_price, volume, datetime.utcnow()))
        except Exception as e:
            print("Error inserting:", e)
            conn.rollback()
            continue
            
    conn.commit()
    cursor.close()
    conn.close()
    print(f"Saved {symbol} {timeframe}")

if __name__ == "__main__":
    fetch_and_save("BTCUSDT", "1h", 1000)
    fetch_and_save("ETHUSDT", "1h", 1000)
