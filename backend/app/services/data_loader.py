"""Load a dataset from Supabase Storage into a pandas DataFrame."""
import io
import pandas as pd
from app.services.storage import download_file


def load_dataframe(file_path: str, file_type: str) -> pd.DataFrame:
    raw = download_file(file_path)
    buf = io.BytesIO(raw)
    if file_type == "csv":
        return pd.read_csv(buf, low_memory=False)
    elif file_type in ("xlsx", "xls"):
        return pd.read_excel(buf)
    elif file_type == "json":
        return pd.read_json(buf)
    raise ValueError(f"Unsupported file type: {file_type}")


def apply_pipeline(df: pd.DataFrame, steps: list[dict]) -> pd.DataFrame:
    import numpy as np
    from sklearn.preprocessing import MinMaxScaler

    for step in steps:
        t = step.get("type")
        p = step.get("params", {})
        try:
            if t == "drop_duplicates":
                df = df.drop_duplicates()
            elif t == "fill_missing":
                col = p.get("column")
                method = p.get("method", "mean")
                if col and col in df.columns:
                    if method == "mean":
                        df[col] = df[col].fillna(df[col].mean())
                    elif method == "median":
                        df[col] = df[col].fillna(df[col].median())
                    elif method == "mode":
                        df[col] = df[col].fillna(df[col].mode()[0])
                    elif method == "constant":
                        df[col] = df[col].fillna(p.get("value", 0))
                    elif method == "forward_fill":
                        df[col] = df[col].ffill()
                    elif method == "backward_fill":
                        df[col] = df[col].bfill()
            elif t == "drop_missing":
                subset = p.get("subset") or None
                df = df.dropna(subset=[subset] if subset else None)
            elif t == "rename_column":
                col = p.get("column")
                new_name = p.get("new_name")
                if col and new_name and col in df.columns:
                    df = df.rename(columns={col: new_name})
            elif t == "drop_column":
                col = p.get("column")
                if col and col in df.columns:
                    df = df.drop(columns=[col])
            elif t == "convert_type":
                col = p.get("column")
                dtype = p.get("dtype", "float")
                if col and col in df.columns:
                    if dtype == "float":
                        df[col] = pd.to_numeric(df[col], errors="coerce")
                    elif dtype == "int":
                        df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")
                    elif dtype == "str":
                        df[col] = df[col].astype(str)
                    elif dtype == "datetime":
                        df[col] = pd.to_datetime(df[col], errors="coerce")
                    elif dtype == "bool":
                        df[col] = df[col].astype(bool)
            elif t == "remove_outliers":
                col = p.get("column")
                method = p.get("method", "iqr")
                if col and col in df.columns:
                    series = pd.to_numeric(df[col], errors="coerce")
                    if method == "iqr":
                        q1, q3 = series.quantile(0.25), series.quantile(0.75)
                        iqr = q3 - q1
                        mask = (series >= q1 - 1.5 * iqr) & (series <= q3 + 1.5 * iqr)
                    else:
                        z = (series - series.mean()) / series.std()
                        mask = np.abs(z) <= 3
                    df = df[mask | series.isna()]
            elif t == "normalize":
                col = p.get("column")
                method = p.get("method", "minmax")
                if col and col in df.columns:
                    vals = pd.to_numeric(df[col], errors="coerce")
                    if method == "minmax":
                        mn, mx = vals.min(), vals.max()
                        if mx != mn:
                            df[col] = (vals - mn) / (mx - mn)
                    else:
                        mean, std = vals.mean(), vals.std()
                        if std != 0:
                            df[col] = (vals - mean) / std
            elif t == "one_hot_encode":
                col = p.get("column")
                if col and col in df.columns:
                    dummies = pd.get_dummies(df[col], prefix=col, drop_first=False)
                    df = pd.concat([df.drop(columns=[col]), dummies], axis=1)
            elif t == "filter_rows":
                col = p.get("column")
                op = p.get("operator", "eq")
                val = p.get("value")
                if col and col in df.columns:
                    series = df[col]
                    if op == "eq":
                        df = df[series == val]
                    elif op == "neq":
                        df = df[series != val]
                    elif op == "gt":
                        df = df[pd.to_numeric(series, errors="coerce") > float(val)]
                    elif op == "gte":
                        df = df[pd.to_numeric(series, errors="coerce") >= float(val)]
                    elif op == "lt":
                        df = df[pd.to_numeric(series, errors="coerce") < float(val)]
                    elif op == "lte":
                        df = df[pd.to_numeric(series, errors="coerce") <= float(val)]
            elif t == "sort_rows":
                col = p.get("column")
                asc = p.get("ascending", True)
                if col and col in df.columns:
                    df = df.sort_values(col, ascending=asc)
        except Exception:
            pass  # Skip invalid step, continue pipeline
    return df
