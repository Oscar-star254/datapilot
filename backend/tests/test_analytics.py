"""Tests for analytics service."""
import pandas as pd
import numpy as np
import pytest
from app.services.analytics import descriptive_stats, correlation_matrix, run_regression, run_hypothesis_test
from app.services.profiler import profile_dataframe
from app.services.data_loader import apply_pipeline


@pytest.fixture
def sample_df():
    np.random.seed(42)
    n = 100
    x = np.random.normal(0, 1, n)
    return pd.DataFrame({
        "x": x,
        "y": 2 * x + np.random.normal(0, 0.5, n),
        "z": np.random.normal(5, 2, n),
        "category": np.random.choice(["A", "B", "C"], n),
        "value": np.random.randint(1, 100, n).astype(float),
    })


def test_descriptive_stats_has_all_metrics(sample_df):
    result = descriptive_stats(sample_df)
    assert "stats" in result
    for col in ["x", "y", "z"]:
        assert col in result["stats"]
        assert "mean" in result["stats"][col]
        assert "std" in result["stats"][col]


def test_correlation_pearson(sample_df):
    result = correlation_matrix(sample_df, "pearson")
    assert "matrix" in result
    matrix = result["matrix"]
    assert "x" in matrix
    # x and y should be highly correlated
    assert matrix["x"]["y"] > 0.8


def test_correlation_spearman(sample_df):
    result = correlation_matrix(sample_df, "spearman")
    assert "matrix" in result
    assert result["matrix"]["x"]["y"] > 0.8


def test_regression_r_squared(sample_df):
    result = run_regression(sample_df, "y", ["x"], "linear")
    assert "r_squared" in result
    assert result["r_squared"] > 0.8  # x strongly predicts y
    assert "coefficients" in result
    assert abs(result["coefficients"][0] - 2.0) < 0.5  # coef ≈ 2


def test_regression_multiple(sample_df):
    result = run_regression(sample_df, "y", ["x", "z"], "multiple")
    assert result["r_squared"] > 0.7
    assert len(result["coefficients"]) == 2


def test_regression_polynomial(sample_df):
    result = run_regression(sample_df, "y", ["x"], "polynomial")
    assert result["r_squared"] > 0.7


def test_ttest_independent(sample_df):
    result = run_hypothesis_test(sample_df, "ttest_ind", "x", "z")
    assert "statistic" in result
    assert "p_value" in result
    assert "interpretation" in result
    assert result["p_value"] > 0  # p-value is valid


def test_ttest_1samp_significant(sample_df):
    # z has mean ≈ 5, should be significantly different from 0
    result = run_hypothesis_test(sample_df, "ttest_1samp", "z")
    assert result["p_value"] < 0.05


def test_shapiro(sample_df):
    result = run_hypothesis_test(sample_df, "shapiro", "x")
    assert "statistic" in result
    assert 0 <= result["p_value"] <= 1


def test_profiler_column_types(sample_df):
    profile = profile_dataframe(sample_df)
    assert profile["row_count"] == 100
    col_types = {c["name"]: c["inferred_type"] for c in profile["columns"]}
    assert col_types["x"] == "numeric"
    assert col_types["category"] == "categorical"


def test_pipeline_drop_duplicates():
    df = pd.DataFrame({"a": [1, 1, 2, 3], "b": ["x", "x", "y", "z"]})
    result = apply_pipeline(df, [{"type": "drop_duplicates", "params": {}}])
    assert len(result) == 3


def test_pipeline_fill_missing_mean():
    df = pd.DataFrame({"a": [1.0, None, 3.0, None, 5.0]})
    result = apply_pipeline(df, [{"type": "fill_missing", "params": {"column": "a", "method": "mean"}}])
    assert result["a"].isna().sum() == 0
    assert result["a"].mean() == pytest.approx(3.0, abs=0.5)


def test_pipeline_fill_missing_constant():
    df = pd.DataFrame({"a": [1.0, None, 3.0]})
    result = apply_pipeline(df, [{"type": "fill_missing", "params": {"column": "a", "method": "constant", "value": "0"}}])
    assert result["a"].isna().sum() == 0


def test_pipeline_drop_column():
    df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})
    result = apply_pipeline(df, [{"type": "drop_column", "params": {"column": "b"}}])
    assert "b" not in result.columns


def test_pipeline_rename_column():
    df = pd.DataFrame({"old_name": [1, 2, 3]})
    result = apply_pipeline(df, [{"type": "rename_column", "params": {"column": "old_name", "new_name": "new_name"}}])
    assert "new_name" in result.columns
    assert "old_name" not in result.columns


def test_pipeline_remove_outliers_iqr():
    df = pd.DataFrame({"a": [1, 2, 3, 4, 5, 100]})
    result = apply_pipeline(df, [{"type": "remove_outliers", "params": {"column": "a", "method": "iqr"}}])
    assert 100 not in result["a"].values


def test_pipeline_normalize_minmax():
    df = pd.DataFrame({"a": [0.0, 5.0, 10.0]})
    result = apply_pipeline(df, [{"type": "normalize", "params": {"column": "a", "method": "minmax"}}])
    assert result["a"].min() == pytest.approx(0.0)
    assert result["a"].max() == pytest.approx(1.0)


def test_pipeline_one_hot_encode():
    df = pd.DataFrame({"color": ["red", "blue", "red", "green"]})
    result = apply_pipeline(df, [{"type": "one_hot_encode", "params": {"column": "color"}}])
    assert "color_red" in result.columns or "color" not in result.columns


def test_pipeline_chained():
    df = pd.DataFrame({"a": [1, 1, 2, None, 4], "b": ["x", "x", "y", "z", "w"]})
    steps = [
        {"type": "drop_duplicates", "params": {}},
        {"type": "drop_missing", "params": {}},
    ]
    result = apply_pipeline(df, steps)
    assert result.isna().sum().sum() == 0
