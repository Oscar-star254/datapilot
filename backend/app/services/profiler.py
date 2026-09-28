"""Dataset profiling: types, missing values, unique counts, sample values."""
import pandas as pd
import numpy as np
from typing import Any


def infer_type(series: pd.Series) -> str:
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    # Try datetime conversion
    try:
        sample = series.dropna().head(50)
        if len(sample) > 0:
            parsed = pd.to_datetime(sample, errors="coerce")
            if parsed.notna().mean() > 0.8:
                return "datetime"
    except Exception:
        pass
    if series.nunique() / max(len(series), 1) < 0.05:
        return "categorical"
    return "text"


def profile_column(series: pd.Series) -> dict[str, Any]:
    n = len(series)
    missing = series.isna().sum()
    result: dict[str, Any] = {
        "name": series.name,
        "dtype": str(series.dtype),
        "inferred_type": infer_type(series),
        "missing_count": int(missing),
        "missing_pct": float(missing / n) if n > 0 else 0.0,
        "unique_count": int(series.nunique()),
        "sample_values": [v for v in series.dropna().head(5).tolist()],
    }

    if result["inferred_type"] == "numeric":
        numeric = pd.to_numeric(series, errors="coerce").dropna()
        if len(numeric) > 0:
            result["stats"] = {
                "min": float(numeric.min()),
                "max": float(numeric.max()),
                "mean": float(numeric.mean()),
                "median": float(numeric.median()),
                "std": float(numeric.std()),
                "q25": float(numeric.quantile(0.25)),
                "q75": float(numeric.quantile(0.75)),
            }
    elif result["inferred_type"] in ("categorical", "text"):
        vc = series.value_counts().head(10)
        result["top_values"] = [{"value": str(k), "count": int(v)} for k, v in vc.items()]

    # Convert sample values to JSON-serializable types
    result["sample_values"] = [
        None if (isinstance(v, float) and np.isnan(v)) else
        int(v) if isinstance(v, (np.integer,)) else
        float(v) if isinstance(v, (np.floating,)) else
        str(v) if not isinstance(v, (str, int, float, bool, type(None))) else v
        for v in result["sample_values"]
    ]
    return result


def profile_dataframe(df: pd.DataFrame) -> dict[str, Any]:
    return {
        "row_count": len(df),
        "duplicate_count": int(df.duplicated().sum()),
        "missing_total": int(df.isna().sum().sum()),
        "columns": [profile_column(df[col]) for col in df.columns],
    }
