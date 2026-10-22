"""Compare old and new retrieval on a small, explicit franchise benchmark.

This measures whether known franchise names retrieve that franchise. It does not
measure general movie relevance, user satisfaction, or predictive accuracy.
"""

import json
import re
from pathlib import Path

import pandas as pd
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from recommender import BASE_DIR, MovieRecommender, names


CASES = [
    ("harry potter", r"^Harry Potter"),
    ("lord of the rings", r"The (Lord of the Rings|Hobbit)"),
    ("star wars", r"Star Wars|Empire Strikes Back|Return of the Jedi"),
    ("batman", r"Batman|Dark Knight"),
]


def main():
    movies = pd.read_csv(BASE_DIR / "tmdb_5000_movies.csv")
    tags = (movies["overview"].fillna("") + " "
            + movies["genres"].map(lambda x: " ".join(names(x))) + " "
            + movies["keywords"].map(lambda x: " ".join(names(x))))
    baseline = CountVectorizer(max_features=5000, stop_words="english").fit_transform(tags)
    model = MovieRecommender()
    results = []
    for query, relevant in CASES:
        matches = movies.index[movies["title"] == query].tolist()
        if matches:
            scores = cosine_similarity(baseline[matches[0]], baseline).ravel()
            indices = [i for i in scores.argsort()[::-1] if i != matches[0]][:5]
            old = movies.iloc[indices]["title"].tolist()
        else:
            old = movies.loc[tags.str.contains(query, case=False, regex=False), "title"].head(5).tolist()
        new = model.recommend(query, limit=5)["recommendations"]
        precision = lambda titles: sum(bool(re.search(relevant, title, flags=re.I)) for title in titles) / 5
        results.append({"query": query, "relevance_rule": relevant, "baseline": old, "improved": new,
                        "baseline_precision_at_5": precision(old), "improved_precision_at_5": precision(new)})
    report = {
        "scope": "Four hand-specified franchise queries; not general recommendation accuracy.",
        "baseline": "Original CountVectorizer title retrieval / first matching tag rows",
        "model": "Weighted TF-IDF with normalized, partial, and fuzzy title retrieval",
        "mean_baseline_precision_at_5": sum(r["baseline_precision_at_5"] for r in results) / len(results),
        "mean_improved_precision_at_5": sum(r["improved_precision_at_5"] for r in results) / len(results),
        "cases": results,
    }
    destination = Path(__file__).with_name("evaluation.json")
    destination.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=True))


if __name__ == "__main__":
    main()
