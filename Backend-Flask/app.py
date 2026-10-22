from flask import Flask, jsonify, request
from flask_cors import CORS

from recommender import MODEL_PATH, MovieRecommender

app = Flask(__name__)
CORS(app)

if not MODEL_PATH.exists():
    raise RuntimeError("The ML model is missing. Run merge.py before starting app.py.")
recommender = MovieRecommender()


def filters(values):
    genre = values.get("genre") or None
    if genre and genre not in recommender.genres:
        raise ValueError("Choose a genre from the available genres.")
    rating = float(values.get("min_rating", 0))
    limit = int(values.get("limit", 9))
    if not 0 <= rating <= 10 or not 1 <= limit <= 30:
        raise ValueError("Rating must be 0?10 and limit must be 1?30.")
    return {"genre": genre, "min_rating": rating, "limit": limit}


@app.get("/health")
def health():
    return jsonify({"status": "ok", "movies": len(recommender.movies), "model": "weighted-tfidf"})


@app.get("/genres")
def genres():
    return jsonify({"genres": recommender.genres, "total_movies": len(recommender.movies)})


@app.get("/movies")
def movies():
    try:
        return jsonify({"movies": recommender.discover(**filters(request.args))})
    except (ValueError, TypeError, OverflowError) as error:
        return jsonify({"error": str(error)}), 400


@app.get("/suggest")
def suggest():
    return jsonify({"movies": recommender.suggest(request.args.get("q", "")[:300])})


@app.post("/recommend")
def recommend():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Send a JSON object with a query."}), 400
    query = data.get("query")
    if not isinstance(query, str) or not query.strip():
        return jsonify({"error": "Enter a movie title, genre, or theme."}), 400
    if len(query) > 300:
        return jsonify({"error": "Keep your search under 300 characters."}), 400
    try:
        return jsonify(recommender.recommend(query.strip(), **filters(data)))
    except (ValueError, TypeError, OverflowError) as error:
        return jsonify({"error": str(error)}), 400


if __name__ == "__main__":
    app.run(debug=True)
