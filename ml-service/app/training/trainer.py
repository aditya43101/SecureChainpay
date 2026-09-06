import os
import pickle
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score, f1_score, precision_score
from sklearn.calibration import CalibratedClassifierCV
from app.data.pipeline import load_data, generate_features, generate_target

def time_series_split(df: pd.DataFrame, test_size=0.2):
    """
    Chronological split to prevent data leakage.
    No random shuffling for time-series data.
    """
    split_idx = int(len(df) * (1 - test_size))
    train = df.iloc[:split_idx]
    test = df.iloc[split_idx:]
    return train, test

def train_and_evaluate(symbol: str, timeframe: str):
    print(f"--- Training pipeline for {symbol} ({timeframe}) ---")
    
    # 1. Load Data
    print("Loading data...")
    df = load_data(symbol, timeframe, limit=10000)
    
    # 2. Features
    print("Generating features...")
    df = generate_features(df)
    
    # 3. Target
    print("Generating target...")
    df = generate_target(df, horizon=5, threshold=0.005)
    
    if len(df) < 200:
        print("Not enough data to train. Need at least 200 candles.")
        return None
        
    # Prepare X and y
    feature_cols = [
        'returns', 'high_low_range', 'price_to_ema20', 'ema20_to_ema50',
        'rsi', 'macd', 'macd_signal', 'macd_hist', 'roc', 
        'atr', 'bb_width', 'volume_change'
    ]
    
    X = df[feature_cols]
    y = df['target']
    
    # 4. Chronological Split
    X_train, X_test = time_series_split(X, test_size=0.2)
    y_train, y_test = time_series_split(y, test_size=0.2)
    
    print(f"Train size: {len(X_train)}, Test size: {len(X_test)}")
    
    # 5. Candidate Models
    models = {
        'LogisticRegression': LogisticRegression(max_iter=1000),
        'RandomForest': RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42)
    }
    
    results = []
    best_model = None
    best_score = 0
    best_name = ""
    
    for name, model in models.items():
        # Calibrate probabilities for better trading estimation
        calibrated_model = CalibratedClassifierCV(model, method='sigmoid', cv=3 if len(X_train) > 1000 else 2)
        calibrated_model.fit(X_train, y_train)
        
        y_pred = calibrated_model.predict(X_test)
        y_prob = calibrated_model.predict_proba(X_test)[:, 1]
        
        roc_auc = roc_auc_score(y_test, y_prob)
        f1 = f1_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred, zero_division=0)
        
        print(f"[{name}] ROC-AUC: {roc_auc:.4f} | F1: {f1:.4f} | Precision: {precision:.4f}")
        
        results.append({
            'model': name,
            'roc_auc': roc_auc,
            'f1': f1,
            'precision': precision,
            'instance': calibrated_model
        })
        
        # Select best model based on ROC-AUC
        if roc_auc > best_score:
            best_score = roc_auc
            best_model = calibrated_model
            best_name = name
            
    print(f"\nBest Model: {best_name} with ROC-AUC: {best_score:.4f}")
    
    # 6. Save Model Artifact
    model_version = f"{symbol}_{timeframe}_{best_name[:3].upper()}_v1"
    os.makedirs('models', exist_ok=True)
    model_path = f"models/{model_version}.pkl"
    
    with open(model_path, 'wb') as f:
        pickle.dump({
            'model': best_model,
            'features': feature_cols,
            'version': model_version,
            'metrics': {'roc_auc': best_score}
        }, f)
        
    print(f"Model saved to {model_path}")
    return model_version

if __name__ == "__main__":
    train_and_evaluate("BTCUSDT", "1h")
    train_and_evaluate("ETHUSDT", "1h")
