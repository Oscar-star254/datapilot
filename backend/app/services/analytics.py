"""Statistical analysis: descriptive, correlation, regression, hypothesis tests."""
import pandas as pd
import numpy as np
from scipy import stats
from typing import Any


def descriptive_stats(df: pd.DataFrame) -> dict[str, Any]:
    numeric = df.select_dtypes(include=[np.number])
    if numeric.empty:
        return {"stats": {}}
    desc = numeric.describe()
    return {"stats": {col: {k: float(v) for k, v in desc[col].items()} for col in desc.columns}}


def correlation_matrix(df: pd.DataFrame, method: str = "pearson") -> dict[str, Any]:
    numeric = df.select_dtypes(include=[np.number])
    if numeric.shape[1] < 2:
        return {"matrix": {}}
    corr = numeric.corr(method=method)
    return {
        "matrix": {col: {c: round(float(v), 4) for c, v in corr[col].items()} for col in corr.columns},
        "method": method,
    }


def run_regression(df: pd.DataFrame, target: str, features: list[str], reg_type: str = "linear") -> dict[str, Any]:
    from sklearn.linear_model import LinearRegression
    from sklearn.preprocessing import PolynomialFeatures
    from sklearn.pipeline import Pipeline

    df_clean = df[[target] + features].dropna()
    if len(df_clean) < 5:
        raise ValueError("Not enough data for regression (need at least 5 rows)")

    X = df_clean[features].values
    y = df_clean[target].values

    if reg_type == "polynomial":
        model = Pipeline([("poly", PolynomialFeatures(degree=2, include_bias=False)), ("lr", LinearRegression())])
    else:
        model = LinearRegression()

    model.fit(X, y)

    if reg_type == "polynomial":
        lr = model.named_steps["lr"]
        coefs = lr.coef_.tolist()
        intercept = float(lr.intercept_)
        feature_names = model.named_steps["poly"].get_feature_names_out(features).tolist()
    else:
        coefs = model.coef_.tolist()
        intercept = float(model.intercept_)
        feature_names = features

    y_pred = model.predict(X)
    ss_res = float(np.sum((y - y_pred) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    r_squared = float(1 - ss_res / ss_tot) if ss_tot != 0 else 0.0
    n, k = len(y), len(features)
    adj_r2 = float(1 - (1 - r_squared) * (n - 1) / (n - k - 1)) if n > k + 1 else r_squared

    # F-stat p-value
    if k > 0 and n > k + 1:
        f_stat = (r_squared / k) / ((1 - r_squared) / (n - k - 1)) if r_squared < 1 else np.inf
        p_value = float(stats.f.sf(f_stat, k, n - k - 1))
    else:
        p_value = 1.0

    residuals = (y - y_pred).tolist()[:100]

    return {
        "r_squared": r_squared,
        "adj_r_squared": adj_r2,
        "p_value": p_value,
        "coefficients": coefs,
        "intercept": intercept,
        "feature_names": feature_names,
        "residuals_sample": residuals,
        "n_samples": n,
    }


def run_hypothesis_test(df: pd.DataFrame, test: str, col1: str, col2: str | None = None) -> dict[str, Any]:
    s1 = pd.to_numeric(df[col1], errors="coerce").dropna().values

    if test == "ttest_ind":
        if not col2 or col2 not in df.columns:
            raise ValueError("Need col2 for independent t-test")
        s2 = pd.to_numeric(df[col2], errors="coerce").dropna().values
        stat, p = stats.ttest_ind(s1, s2)
        df_ = len(s1) + len(s2) - 2
        interp = (
            f"The means of '{col1}' (M={np.mean(s1):.2f}) and '{col2}' (M={np.mean(s2):.2f}) are "
            f"{'significantly different' if p < 0.05 else 'not significantly different'} "
            f"(t={stat:.3f}, df={df_}, p={p:.4f})."
        )
    elif test == "ttest_1samp":
        stat, p = stats.ttest_1samp(s1, popmean=0)
        interp = (
            f"'{col1}' mean ({np.mean(s1):.2f}) is "
            f"{'significantly different' if p < 0.05 else 'not significantly different'} from 0 "
            f"(t={stat:.3f}, p={p:.4f})."
        )
        df_ = len(s1) - 1
    elif test == "chi2":
        if not col2 or col2 not in df.columns:
            raise ValueError("Need col2 for chi-square test")
        ct = pd.crosstab(df[col1], df[col2])
        stat, p, df_, _ = stats.chi2_contingency(ct)
        interp = (
            f"There is {'a significant' if p < 0.05 else 'no significant'} association between "
            f"'{col1}' and '{col2}' (χ²={stat:.3f}, df={df_}, p={p:.4f})."
        )
    elif test == "anova":
        groups = df[col1].dropna().unique()
        samples = [pd.to_numeric(df[df[col1] == g][col2 or col1], errors="coerce").dropna().values for g in groups if col2]
        if not col2 or len(samples) < 2:
            raise ValueError("ANOVA needs a group column (col1) and value column (col2)")
        stat, p = stats.f_oneway(*samples)
        df_ = len(groups) - 1
        interp = (
            f"There {'are' if p < 0.05 else 'are no'} significant differences between "
            f"the {len(groups)} groups (F={stat:.3f}, df={df_}, p={p:.4f})."
        )
    elif test == "shapiro":
        if len(s1) > 5000:
            s1 = s1[:5000]
        stat, p = stats.shapiro(s1)
        df_ = len(s1)
        interp = (
            f"'{col1}' {'is' if p >= 0.05 else 'is not'} normally distributed "
            f"(W={stat:.4f}, p={p:.4f}, n={df_})."
        )
    else:
        raise ValueError(f"Unknown test: {test}")

    return {
        "test_name": test,
        "statistic": float(stat),
        "p_value": float(p),
        "df": float(df_),
        "interpretation": interp,
    }
