"""Regression checks for search quality and the browser-facing API."""

import unittest

from app import app, recommender


class RecommendationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()

    def recommend(self, query, **kwargs):
        response = self.client.post("/recommend", json={"query": query, **kwargs})
        self.assertEqual(response.status_code, 200)
        return response.get_json()

    def test_partial_franchise_returns_real_franchise_films(self):
        result = self.recommend("harry potter", limit=5)
        self.assertEqual(len(result["movies"]), 5)
        self.assertTrue(all(title.startswith("Harry Potter") for title in result["recommendations"]))
        self.assertNotIn("Epic Movie", result["recommendations"])

    def test_misspelled_franchise(self):
        result = self.recommend("harry poter", limit=5)
        self.assertEqual(result["type"], "fuzzy_partial_title")
        self.assertTrue(all(title.startswith("Harry Potter") for title in result["recommendations"]))

    def test_title_case_and_whitespace(self):
        expected = self.recommend("Avatar")
        actual = self.recommend("  AVATAR  ")
        self.assertEqual(actual["recommendations"], expected["recommendations"])
        self.assertNotIn("Avatar", actual["recommendations"])

    def test_misspelled_single_title(self):
        result = self.recommend("interstelar")
        self.assertEqual(result["type"], "fuzzy_title")
        self.assertEqual(result["matched_title"], "Interstellar")
        self.assertNotIn("Interstellar", result["recommendations"])

    def test_genre_phrase_is_not_mistaken_for_title(self):
        result = self.recommend("romantic comedy")
        self.assertEqual(result["type"], "description")
        self.assertTrue(result["movies"])
        for movie in result["movies"]:
            self.assertIn("Romance", movie["genres"])
            self.assertIn("Comedy", movie["genres"])

    def test_filters_apply_to_every_result(self):
        result = self.recommend("space", genre="Science Fiction", min_rating=7, limit=4)
        self.assertGreater(len(result["movies"]), 0)
        self.assertLessEqual(len(result["movies"]), 4)
        for movie in result["movies"]:
            self.assertIn("Science Fiction", movie["genres"])
            self.assertGreaterEqual(movie["rating"], 7)

    def test_unknown_terms_return_empty(self):
        self.assertEqual(self.recommend("zzzxxyyqnotaword")["movies"], [])

    def test_query_is_literal_not_regular_expression(self):
        self.assertEqual(self.recommend("[[[")["movies"], [])

    def test_invalid_requests_are_client_errors(self):
        for data in [None, [], {}, {"query": " "}, {"query": 123}, {"query": "x" * 301},
                     {"query": "Avatar", "genre": "Unknown"}, {"query": "Avatar", "min_rating": "bad"},
                     {"query": "Avatar", "limit": 0}, {"query": "Avatar", "min_rating": 11}]:
            with self.subTest(data=data):
                self.assertEqual(self.client.post("/recommend", json=data).status_code, 400)

    def test_discover_and_suggestions(self):
        response = self.client.get("/movies?genre=Animation&min_rating=7&limit=5")
        self.assertEqual(response.status_code, 200)
        movies = response.get_json()["movies"]
        self.assertEqual(len(movies), 5)
        self.assertTrue(all("Animation" in movie["genres"] and movie["rating"] >= 7 for movie in movies))
        suggestions = self.client.get("/suggest?q=harry%20potter").get_json()["movies"]
        self.assertTrue(suggestions)
        self.assertTrue(all("Harry Potter" in movie["title"] for movie in suggestions))

    def test_cross_origin_browser_access(self):
        response = self.client.post("/recommend", json={"query": "Avatar"}, headers={"Origin": "http://127.0.0.1:5173"})
        self.assertEqual(response.headers["Access-Control-Allow-Origin"], "http://127.0.0.1:5173")

    def test_model_has_no_dense_pairwise_matrix(self):
        self.assertEqual(recommender.features.shape[0], len(recommender.movies))
        self.assertTrue(hasattr(recommender.features, "tocsr"))


if __name__ == "__main__":
    unittest.main()
