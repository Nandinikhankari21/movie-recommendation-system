"""Local, content-based movie retrieval. No external APIs or generative models."""

import json
import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.sparse import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "data" / "recommender.joblib"
MODEL_VERSION = 3
# Squared weights determine each field's contribution to cosine similarity.
FIELD_WEIGHTS = {"overview": 0.45, "keywords_text": 0.45, "genres_text": 0.08, "title": 0.02}


def expand_query(query):
    value = normalize_title(query)
    for original, replacement in {"romantic": "romance", "sci fi": "science fiction", "scifi": "science fiction", "funny": "comedy"}.items():
        value = re.sub(r"\b" + original + r"\b", replacement, value)
    return value


def normalize_title(value):
    text = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode()
    return " ".join(re.findall(r"[a-z0-9]+", text.lower()))


def names(value):
    if not isinstance(value, str) or not value:
        return []
    return [item["name"] for item in json.loads(value)]


def build_model(source=None, destination=MODEL_PATH):
    source = Path(source or BASE_DIR / "tmdb_5000_movies.csv")
    if not source.exists():
        source = BASE_DIR / "data" / "tmdb_5000_movies.csv"
    movies = pd.read_csv(source).dropna(subset=["title"])
    movies = movies.drop_duplicates("id").reset_index(drop=True)
    movies["overview"] = movies["overview"].fillna("")
    movies["genre_names"] = movies["genres"].map(names)
    movies["keyword_names"] = movies["keywords"].map(names)
    movies["genres_text"] = movies["genre_names"].map(" ".join)
    movies["keywords_text"] = movies["keyword_names"].map(" ".join)
    movies["normalized_title"] = movies["title"].map(normalize_title)
    vectorizers, blocks = {}, []
    for field, weight in FIELD_WEIGHTS.items():
        vectorizer = TfidfVectorizer(
            stop_words="english", ngram_range=(1, 2), sublinear_tf=True,
            max_features=25000 if field == "overview" else 15000,
            strip_accents="unicode", dtype=np.float32,
        )
        blocks.append(vectorizer.fit_transform(movies[field]) * np.sqrt(weight))
        vectorizers[field] = vectorizer
    features = normalize(hstack(blocks, format="csr")).astype(np.float32)
    title_vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), dtype=np.float32)
    title_features = title_vectorizer.fit_transform(movies["normalized_title"])
    artifact = {
        "version": MODEL_VERSION, "movies": movies, "features": features,
        "vectorizers": vectorizers, "title_vectorizer": title_vectorizer,
        "title_features": title_features, "field_weights": FIELD_WEIGHTS,
    }
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, destination, compress=3)
    return artifact


class MovieRecommender:
    def __init__(self, model_path=MODEL_PATH):
        artifact = joblib.load(model_path)
        if artifact.get("version") != MODEL_VERSION:
            raise ValueError("Model version changed. Run merge.py to rebuild it.")
        self.movies = artifact["movies"]
        self.features = artifact["features"]
        self.vectorizers = artifact["vectorizers"]
        self.title_vectorizer = artifact["title_vectorizer"]
        self.title_features = artifact["title_features"]
        self.titles = self.movies["normalized_title"].tolist()
        self.genres = sorted({genre for genres in self.movies["genre_names"] for genre in genres})
        votes = self.movies["vote_count"].fillna(0).to_numpy(float)
        ratings = self.movies["vote_average"].fillna(0).to_numpy(float)
        prior = float(np.average(ratings, weights=np.maximum(votes, 1)))
        self.quality = (votes * ratings + 200 * prior) / (votes + 200) / 10

    def _match_title(self, query):
        normalized = normalize_title(query)
        exact = [i for i, title in enumerate(self.titles) if title == normalized]
        if exact:
            return "title", [max(exact, key=lambda i: self.quality[i])]
        expanded = expand_query(query)
        genre_words = {word for genre in self.genres for word in normalize_title(genre).split()}
        if expanded and all(word in genre_words for word in expanded.split()):
            return "description", []
        if len(normalized.split()) >= 2:
            partial = [i for i, title in enumerate(self.titles) if normalized in title]
            if partial:
                return "partial_title", partial
        if len(normalized) < 4:
            return "description", []
        scores = (self.title_features @ self.title_vectorizer.transform([normalized]).T).toarray().ravel()
        index = int(scores.argmax())
        ratio = SequenceMatcher(None, normalized, self.titles[index]).ratio()
        if scores[index] >= 0.52 and ratio >= 0.76:
            return "fuzzy_title", [index]
        if len(normalized.split()) >= 2:
            count = len(normalized.split())
            candidates = []
            for i in scores.argsort()[-60:]:
                prefix = " ".join(self.titles[i].split()[:count])
                if scores[i] > 0.25 and SequenceMatcher(None, normalized, prefix).ratio() >= 0.87:
                    candidates.append(int(i))
            if candidates:
                return "fuzzy_partial_title", sorted(candidates, key=lambda i: -self.quality[i])
        return "description", []

    def _query_features(self, query):
        query = expand_query(query)
        blocks = [self.vectorizers[field].transform(["" if field == "title" else query]) * np.sqrt(weight)
                  for field, weight in FIELD_WEIGHTS.items()]
        return normalize(hstack(blocks, format="csr")).astype(np.float32)

    def _eligible(self, genre=None, min_rating=0):
        mask = self.movies["vote_average"].fillna(0).to_numpy() >= min_rating
        if genre:
            mask &= self.movies["genre_names"].map(lambda values: genre in values).to_numpy()
        return mask

    def movie(self, index, score=None, reason=None):
        row = self.movies.iloc[int(index)]
        release = row["release_date"]
        return {
            "id": int(row["id"]), "title": str(row["title"]),
            "year": int(str(release)[:4]) if pd.notna(release) else None,
            "rating": round(float(row["vote_average"]), 1) if pd.notna(row["vote_average"]) else 0,
            "votes": int(row["vote_count"]) if pd.notna(row["vote_count"]) else 0,
            "runtime": int(row["runtime"]) if pd.notna(row["runtime"]) else None,
            "genres": row["genre_names"], "overview": str(row["overview"]),
            "similarity": round(float(score), 4) if score is not None else None,
            "reason": reason or "Highly rated by viewers in the movie dataset",
        }

    def _reason(self, index, seeds, query):
        row = self.movies.iloc[index]
        if seeds:
            source = self.movies.iloc[seeds[0]]
            common_genres = set(row["genre_names"]) & set(source["genre_names"])
            common_tags = set(row["keyword_names"]) & set(source["keyword_names"])
            if common_tags:
                return "Shared themes: " + ", ".join(sorted(common_tags)[:3])
            if common_genres:
                return "Similar " + " / ".join(sorted(common_genres)[:2]).lower() + " storytelling"
            return "Related plot and themes"
        matching = [genre for genre in row["genre_names"] if genre.lower() in query.lower()]
        return "Matches " + ", ".join(matching) if matching else "Related to the themes in your search"

    def recommend(self, query, limit=9, genre=None, min_rating=0):
        mode, seeds = self._match_title(query)
        if seeds:
            centroid = normalize(np.asarray(self.features[seeds].mean(axis=0)))
            scores = np.asarray(self.features @ centroid.T).ravel()
        else:
            scores = (self.features @ self._query_features(query).T).toarray().ravel()
            requested_genres = [genre for genre in self.genres if normalize_title(genre) in expand_query(query)]
            if requested_genres:
                # A genre search must satisfy every explicitly named genre.
                genre_match = self.movies["genre_names"].map(lambda values: all(g in values for g in requested_genres)).to_numpy()
                scores[~genre_match] = 0
        eligible = self._eligible(genre, min_rating) & (scores > 0.025)
        ranking = scores * 0.95 + self.quality * 0.05
        if mode.endswith("partial_title"):
            ranking[seeds] += 1.0
        elif seeds:
            eligible[seeds] = False
        indices = np.flatnonzero(eligible)
        indices = sorted(indices, key=lambda i: (-float(ranking[i]), int(self.movies.iloc[i]["id"])))[:limit]
        details = [self.movie(i, scores[i], self._reason(i, seeds, query)) for i in indices]
        return {
            "type": mode, "query": query,
            "matched_title": self.movies.iloc[seeds[0]]["title"] if seeds else None,
            "recommendations": [movie["title"] for movie in details], "movies": details,
            "message": "" if details else "No matches yet. Try a movie title, a genre, or a few themes.",
        }

    def discover(self, limit=12, genre=None, min_rating=0):
        indices = np.flatnonzero(self._eligible(genre, min_rating))
        indices = sorted(indices, key=lambda i: (-float(self.quality[i]), int(self.movies.iloc[i]["id"])))[:limit]
        return [self.movie(i) for i in indices]

    def suggest(self, query, limit=6):
        value = normalize_title(query)
        if len(value) < 2:
            return []
        indices = [i for i, title in enumerate(self.titles) if value in title]
        indices.sort(key=lambda i: (not self.titles[i].startswith(value), -self.quality[i]))
        return [self.movie(i) for i in indices[:limit]]


if __name__ == "__main__":
    model = MovieRecommender()
    print("Movie recommender. Enter a title or themes; type 'exit' to quit.")
    while True:
        query = input("You: ").strip()
        if query.lower() in {"exit", "quit"}:
            break
        if query:
            print("\n".join(model.recommend(query)["recommendations"]) or "No matching movies found.")
