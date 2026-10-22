# Frame — Movie Recommendation ML Project

A local movie discovery app built with React, Flask, and scikit-learn. It uses
traditional content-based machine learning. There is no generative model,
OpenAI dependency, external recommendation API, or API key.

## Run the project

The backend environment and frontend dependencies have been installed in this
workspace. The new model has also been fitted.

Open two PowerShell terminals **in the project root**.

Backend:

```powershell
cd Backend-Flask
.\myenv\Scripts\python.exe app.py
```

Frontend:

```powershell
cd Frontend-React
npm run dev
```

Open **http://127.0.0.1:5173**. Keep both terminals running; Ctrl+C stops them.
Try `harry potter`, `interstelar`, `romantic comedy`, or `space exploration`.

Restart Flask after updating the model code or fitting a new model. Vite
reloads frontend edits automatically.

Use `.\myenv\Scripts\python.exe` for backend commands. Running plain `python`
may select the global interpreter, which does not have the project packages.

## Setup on another machine

Use Python 3.12+ and Node.js 22.12+ (this workspace uses Python 3.14 and Node 24).

```powershell
cd Backend-Flask
python -m venv myenv
.\myenv\Scripts\python.exe -m pip install -r requirements.txt
.\myenv\Scripts\python.exe merge.py
cd ..\Frontend-React
npm ci
```

Then follow the two-terminal instructions above. Keep
`Backend-Flask/tmdb_5000_movies.csv`; it is the source dataset.
The credits dataset is not required.

## What changed in the ML model

The former model combined raw word counts and returned the first matching
rows for non-exact titles. The new model:

- Normalizes title case, punctuation, and accents.
- Recognizes partial franchise names and small title misspellings.
- Uses separate unigram/bigram TF-IDF representations with sublinear term
  frequency for plot overviews, keywords, genres, and titles.
- Ranks by content similarity with a small vote-count-adjusted rating tie-break.
- Applies genre and minimum-rating filters before returning results.
- Excludes the source movie for exact and corrected-title recommendations.
- Returns metadata and explanations based on shared keywords or genres.
- Stores sparse features and scores on demand, rather than storing every movie pair.

Feature contributions:

| Feature | Weight |
| --- | ---: |
| Plot overview | 45% |
| Keywords | 45% |
| Genres | 8% |
| Title | 2% |

Each TF-IDF block is scaled by the square root of its weight, then the combined
features are L2-normalized. Similarity is cosine similarity. Query descriptions
omit the title block so generic words in movie names do not dominate a theme
search. Known genre phrases are expanded and combined as genre requirements.
Partial-title results prioritize actual matching franchise titles.

The weights are chosen heuristically, not optimized on an independent labeled
dataset. Similarity scores are not confidence percentages or predictions of
enjoyment. TF-IDF relies on vocabulary overlap; it does not understand arbitrary
natural language. It also cannot personalize from viewing history because this
dataset has no user interaction records.

Fit again after changing the dataset or feature extraction:

```powershell
cd Backend-Flask
.\myenv\Scripts\python.exe merge.py
```

The fitted artifact is `Backend-Flask/data/recommender.joblib` (approximately
4.7 MB for 4,803 movies). The old generated CSV and dense similarity matrix
are no longer used.

## UI features

- Responsive discovery page with locally drawn abstract film covers.
- Search suggestions with keyboard selection and example searches.
- Movie details, historical dataset ratings, plot summaries, and shared themes.
- Genre filters, minimum rating, and sorting within the displayed results.
- Saved watchlist stored in this browser; it does not retrain the model.
- Loading, empty, offline, and storage-unavailable states.

The covers are original SVG illustrations, not official movie posters.
Optional Google Fonts fall back to system fonts offline. Movie data and
recommendations run locally.

To change the backend URL, set `VITE_API_URL` in `Frontend-React/.env`, then
restart Vite. The default is `http://127.0.0.1:5000`.

## Validation and evaluation

Backend regressions:

```powershell
cd Backend-Flask
.\myenv\Scripts\python.exe -m unittest test_recommender -v
.\myenv\Scripts\python.exe evaluate.py
```

`evaluate.py` reproduces the old retrieval logic and compares it with the new
model on four explicitly specified franchise queries. Results are written to
`Backend-Flask/evaluation.json`. This is a small **development regression
benchmark**, not an independent test set or general recommendation accuracy.
Precision@5 counts unfilled result slots as misses. General quality still
needs a broader, held-out set of human relevance judgments or user feedback.

Frontend build and browser checks:

```powershell
cd Frontend-React
npm run build
npm run test:e2e
```

Browser tests use installed Google Chrome, start temporary servers on ports
5051 and 5175, and check desktop and phone viewports. They cover search,
suggestions, filters, persistence, details, error recovery, and horizontal
overflow. Set `MOVIE_TEST_PYTHON` if the test Python interpreter is elsewhere.
Test screenshots and traces are written to ignored `test-results/`.

## API

| Route | Purpose |
| --- | --- |
| `GET /health` | Backend readiness and model name |
| `GET /genres` | Available genres and movie count |
| `GET /movies?genre=Drama&min_rating=7&limit=12` | Browse the library |
| `GET /suggest?q=harry` | Title suggestions |
| `POST /recommend` | Recommend from a title or themes |

Example request body:

```json
{"query": "harry potter", "genre": "Fantasy", "min_rating": 7, "limit": 9}
```

The response retains the original `recommendations` array of title strings
and adds a `movies` array of metadata, plus the query matching mode.
