"""Fit and save the local TF-IDF recommendation model."""

from recommender import MODEL_PATH, build_model


if __name__ == "__main__":
    artifact = build_model()
    rows, features = artifact["features"].shape
    print(f"Fitted weighted TF-IDF on {rows:,} movies and {features:,} features.")
    print(f"Saved sparse model: {MODEL_PATH} ({MODEL_PATH.stat().st_size / 1_000_000:.1f} MB)")
