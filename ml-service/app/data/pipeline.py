import os
import pandas as pd
import ta
from sqlalchemy import create_engine
from dotenv import load_dotenv

# Load from ../.env (root dir)
load_dotenv(os.path.join(os.path.dirname(__file__), '../../../.env'))

# Database Connection
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgrespassword@localhost:5432/securechain")
# SQLAlchemy/psycopg2 doesn't support ?schema=public in the connection string
if "?schema=" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split("?schema=")[0]
engine = create_engine(DATABASE_URL)

def load_data(symbol: str, timeframe: str, limit: int = 5000):
    """
    Load historical candles from PostgreSQL.
    Orders chronologically ascending so oldest is first, newest is last.
    """
    query = f"""
        SELECT timestamp, open, high, low, close, volume 
        FROM "MarketCandle"
        WHERE symbol = '{symbol}' AND timeframe = '{timeframe}'
        ORDER BY timestamp ASC
        LIMIT {limit}
    """
    df = pd.read_sql(query, engine)
    
    # Drop duplicates just in case
    df = df.drop_duplicates(subset=['timestamp']).reset_index(drop=True)
    return df

def generate_features(df: pd.DataFrame):
    """
    Generate Technical Analysis features.
    No future data leakage here as TA library uses rolling windows.
    """
    if len(df) < 50:
        return df

    # Price Features
    df['returns'] = df['close'].pct_change()
    df['high_low_range'] = (df['high'] - df['low']) / df['low']
    
    # Moving Averages
    df['sma20'] = ta.trend.sma_indicator(df['close'], window=20)
    df['ema20'] = ta.trend.ema_indicator(df['close'], window=20)
    df['ema50'] = ta.trend.ema_indicator(df['close'], window=50)
    
    # Relative MAs
    df['price_to_ema20'] = df['close'] / df['ema20']
    df['ema20_to_ema50'] = df['ema20'] / df['ema50']
    
    # Momentum
    df['rsi'] = ta.momentum.rsi(df['close'], window=14)
    df['macd'] = ta.trend.macd(df['close'])
    df['macd_signal'] = ta.trend.macd_signal(df['close'])
    df['macd_hist'] = ta.trend.macd_diff(df['close'])
    df['roc'] = ta.momentum.roc(df['close'], window=12)
    
    # Volatility
    df['atr'] = ta.volatility.average_true_range(df['high'], df['low'], df['close'], window=14)
    df['bb_width'] = ta.volatility.bollinger_wband(df['close'], window=20, window_dev=2)
    
    # Volume Features
    df['volume_change'] = df['volume'].pct_change()
    
    # Drop rows with NaN (from rolling windows)
    df = df.dropna().reset_index(drop=True)
    
    return df

def generate_target(df: pd.DataFrame, horizon: int = 5, threshold: float = 0.005):
    """
    Creates a target for classification.
    Target = 1 if the price increases by > threshold after `horizon` candles.
    Target = 0 otherwise.
    
    CRITICAL: This uses future data to create the target label.
    We must drop the last `horizon` rows from training.
    """
    # Shift backwards to bring future close to current row
    df['future_close'] = df['close'].shift(-horizon)
    
    # Calculate future return
    df['future_return'] = (df['future_close'] - df['close']) / df['close']
    
    # Binary Target
    df['target'] = (df['future_return'] > threshold).astype(int)
    
    # Drop the rows where future_close is NaN (the most recent rows)
    df = df.dropna(subset=['future_close']).reset_index(drop=True)
    
    # We don't want the model to see future_return or future_close during training
    return df
