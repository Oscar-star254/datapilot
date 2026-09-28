"""Prepare chart-ready data from a DataFrame."""
import pandas as pd
import numpy as np
from typing import Any


def prepare_chart_data(df: pd.DataFrame, config: dict) -> dict[str, Any]:
    x_col = config.get("x_column")
    y_col = config.get("y_column")
    group_by = config.get("group_by")
    agg = config.get("aggregation", "sum")
    chart_type = config.get("chart_type", "bar")
    resample = config.get("resample")
    moving_avg = config.get("moving_avg")
    forecast_periods = config.get("forecast_periods", 0)

    if not x_col or x_col not in df.columns:
        return {"data": [], "columns": list(df.columns)}

    MAX_POINTS = 2000

    # Time series
    if resample or moving_avg or forecast_periods:
        if x_col in df.columns:
            df = df.copy()
            df[x_col] = pd.to_datetime(df[x_col], errors="coerce")
            df = df.dropna(subset=[x_col]).sort_values(x_col)
            if y_col and y_col in df.columns:
                ts = df.set_index(x_col)[y_col]
                ts = pd.to_numeric(ts, errors="coerce").dropna()
                if resample:
                    ts = ts.resample(resample).mean()
                if moving_avg and int(moving_avg) > 0:
                    ma_col = f"ma_{moving_avg}"
                    ts_df = ts.reset_index()
                    ts_df.columns = [x_col, y_col]
                    ts_df[ma_col] = ts.rolling(int(moving_avg), min_periods=1).mean().values
                    if forecast_periods and forecast_periods > 0:
                        ts_df = _add_forecast(ts_df, x_col, y_col, forecast_periods)
                    return {"data": _to_records(ts_df, MAX_POINTS), "columns": list(ts_df.columns)}
                if forecast_periods and forecast_periods > 0:
                    ts_df = ts.reset_index()
                    ts_df.columns = [x_col, y_col]
                    ts_df = _add_forecast(ts_df, x_col, y_col, forecast_periods)
                    return {"data": _to_records(ts_df, MAX_POINTS), "columns": list(ts_df.columns)}
                ts_df = ts.reset_index()
                ts_df.columns = [x_col, y_col]
                return {"data": _to_records(ts_df, MAX_POINTS), "columns": list(ts_df.columns)}

    # Histogram: just return the column
    if chart_type == "histogram":
        col_data = pd.to_numeric(df.get(x_col, pd.Series(dtype=float)), errors="coerce").dropna()
        return {"data": [{x_col: float(v)} for v in col_data[:MAX_POINTS]], "columns": [x_col]}

    # Scatter / heatmap: return raw pairs
    if chart_type in ("scatter", "heatmap"):
        if y_col and y_col in df.columns:
            out = df[[x_col, y_col]].dropna().head(MAX_POINTS)
            return {"data": _to_records(out, MAX_POINTS), "columns": [x_col, y_col]}

    # Aggregated
    if y_col and y_col in df.columns:
        grp_cols = [x_col]
        if group_by and group_by in df.columns and group_by != x_col:
            grp_cols.append(group_by)
        numeric_y = pd.to_numeric(df[y_col], errors="coerce")
        df = df.copy()
        df[y_col] = numeric_y
        grouped = df.groupby(grp_cols)[y_col]
        if agg == "sum":
            result = grouped.sum()
        elif agg == "mean":
            result = grouped.mean()
        elif agg == "count":
            result = grouped.count()
        elif agg == "min":
            result = grouped.min()
        elif agg == "max":
            result = grouped.max()
        else:
            result = grouped.sum()
        result_df = result.reset_index()
        return {"data": _to_records(result_df, MAX_POINTS), "columns": list(result_df.columns)}

    # Fallback: just return x column values
    out = df[[x_col]].head(MAX_POINTS)
    return {"data": _to_records(out, MAX_POINTS), "columns": [x_col]}


def _to_records(df: pd.DataFrame, limit: int) -> list[dict]:
    df = df.head(limit)
    records = []
    for row in df.itertuples(index=False):
        r = {}
        for col, val in zip(df.columns, row):
            if isinstance(val, (np.integer,)):
                r[col] = int(val)
            elif isinstance(val, (np.floating,)):
                r[col] = None if np.isnan(val) else float(val)
            elif pd.isna(val) if not isinstance(val, str) else False:
                r[col] = None
            else:
                r[col] = str(val) if not isinstance(val, (int, float, bool, str, type(None))) else val
        records.append(r)
    return records


def _add_forecast(df: pd.DataFrame, x_col: str, y_col: str, periods: int) -> pd.DataFrame:
    """Simple linear trend forecast."""
    import numpy as np
    from sklearn.linear_model import LinearRegression

    y = df[y_col].dropna().values
    x = np.arange(len(y)).reshape(-1, 1)
    model = LinearRegression().fit(x, y)

    last_date = pd.to_datetime(df[x_col].iloc[-1])
    freq = "D"
    if len(df) > 1:
        delta = (pd.to_datetime(df[x_col].iloc[-1]) - pd.to_datetime(df[x_col].iloc[-2]))
        freq = f"{int(delta.total_seconds() // 86400)}D"

    future_dates = pd.date_range(last_date, periods=periods + 1, freq=freq)[1:]
    future_x = np.arange(len(y), len(y) + periods).reshape(-1, 1)
    future_y = model.predict(future_x)

    forecast_df = pd.DataFrame({
        x_col: future_dates,
        y_col: np.nan,
        f"{y_col}_forecast": future_y,
        "__forecast": True,
    })
    df["__forecast"] = False
    df[f"{y_col}_forecast"] = np.nan
    return pd.concat([df, forecast_df], ignore_index=True)
