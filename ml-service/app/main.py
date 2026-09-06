import os
import pickle
import pandas as pd
from datetime import datetime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

from app.data.pipeline import load_data, generate_features

# Load from ../.env (root dir)
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

app = FastAPI(title="SecureChain ML Prediction Engine")

# Database connection for recording predictions
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgrespassword@localhost:5432/securechain")
if "?schema=" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split("?schema=")[0]
engine = create_engine(DATABASE_URL)

class PredictionRequest(BaseModel):
    symbol: str
    timeframe: str

class PredictionResponse(BaseModel):
    symbol: str
    timeframe: str
    modelVersion: str
    bullishProbability: float
    bearishProbability: float
    timestamp: str
    dataTimestamp: str
    marketRegime: str

def load_model(symbol: str, timeframe: str):
    # Try to find a model matching the symbol and timeframe
    models_dir = "models"
    if not os.path.exists(models_dir):
        return None
        
    for file in os.listdir(models_dir):
        if file.startswith(f"{symbol}_{timeframe}") and file.endswith(".pkl"):
            with open(os.path.join(models_dir, file), 'rb') as f:
                return pickle.load(f)
    return None

def determine_regime(features: pd.Series):
    """
    Very simple regime logic based on moving averages and volatility
    """
    if features['price_to_ema20'] > 1.01 and features['ema20_to_ema50'] > 1.0:
        return "bull"
    elif features['price_to_ema20'] < 0.99 and features['ema20_to_ema50'] < 1.0:
        return "bear"
    elif features['bb_width'] > features.get('bb_width_mean', 10): 
        # Needs historical bb_width_mean ideally, simplifying here
        return "high_volatility"
    else:
        return "sideways"

@app.post("/api/ml/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    # 1. Load Model
    model_data = load_model(request.symbol, request.timeframe)
    if not model_data:
        raise HTTPException(status_code=404, detail="No trained model found for this asset and timeframe.")
    
    # 2. Fetch Latest Data
    try:
        # We need at least 50 candles for EMA50
        df = load_data(request.symbol, request.timeframe, limit=100)
        if len(df) < 50:
            raise HTTPException(status_code=400, detail="Not enough historical data to generate features.")
            
        latest_timestamp = df.iloc[-1]['timestamp']
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        
    # 3. Generate Features
    try:
        features_df = generate_features(df)
        if len(features_df) == 0:
            raise HTTPException(status_code=400, detail="Failed to generate features.")
            
        latest_features = features_df.iloc[-1:]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feature engineering error: {str(e)}")
        
    # 4. Predict
    try:
        model = model_data['model']
        feature_cols = model_data['features']
        
        # Ensure we only pass the columns the model expects
        X = latest_features[feature_cols]
        
        # Probabilities
        probs = model.predict_proba(X)[0]
        bullish_prob = round(probs[1], 4)
        bearish_prob = round(probs[0], 4)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")
        
    # 5. Record Prediction in DB
    try:
        regime = determine_regime(latest_features.iloc[0])
        now = datetime.utcnow()
        
        # We use SQLAlchemy text to safely insert
        with engine.begin() as conn:
            query = text("""
                INSERT INTO "ModelPrediction" 
                (id, "modelVersion", symbol, timeframe, "bullishProbability", "bearishProbability", "dataTimestamp", "createdAt")
                VALUES (gen_random_uuid(), :modelVersion, :symbol, :timeframe, :bullish, :bearish, :dataTs, :created)
            """)
            conn.execute(query, {
                "modelVersion": model_data['version'],
                "symbol": request.symbol,
                "timeframe": request.timeframe,
                "bullish": bullish_prob,
                "bearish": bearish_prob,
                "dataTs": latest_timestamp,
                "created": now
            })
    except Exception as e:
        print(f"Failed to record prediction: {e}")
        # Non-fatal error
        
    return {
        "symbol": request.symbol,
        "timeframe": request.timeframe,
        "modelVersion": model_data['version'],
        "bullishProbability": bullish_prob,
        "bearishProbability": bearish_prob,
        "timestamp": now.isoformat() + "Z",
        "dataTimestamp": latest_timestamp.isoformat() + "Z" if isinstance(latest_timestamp, datetime) else str(latest_timestamp),
        "marketRegime": regime
    }
