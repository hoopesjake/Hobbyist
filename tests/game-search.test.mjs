import test from "node:test";
import assert from "node:assert/strict";
import { rankGameSearch, gameSearchFilters } from "../src/lib/game-search.ts";
import { gameSearchBody } from "../src/lib/game-validation.ts";
import { discoveryReturnTo, withDiscoveryReturnTo } from "../src/lib/discovery-navigation.ts";

test("exact titles and aliases beat popular loose matches; punctuation and accents normalize", () => {
  const games = [
    { id: 1, name: "Pokemon Legends", rating: 95, rating_count: 1000 },
    { id: 2, name: "Pokémon", rating: 80, rating_count: 50 },
    { id: 3, name: "Pocket Monsters", alternative_names: [{ name: "Pokemon" }], rating: 90, rating_count: 100 },
  ];
  assert.deepEqual(rankGameSearch(games, "POKEMON!").map(game => game.id), [3, 2, 1]);
  assert.deepEqual(games.map(game => game.id), [1, 2, 3]);
});

test("widely reviewed matches beat tiny perfect scores, with ratings breaking popularity ties", () => {
  const games = [
    { id: 1, name: "Halo: Fan Favorite", rating: 100, rating_count: 1 },
    { id: 2, name: "Halo 3", rating: 90, rating_count: 1000 },
    { id: 3, name: "Halo 2", rating: 80, rating_count: 1000 },
    { id: 4, name: "Halo 4" },
  ];
  assert.deepEqual(rankGameSearch(games, "halo").map(game => game.id), [2, 3, 1, 4]);
});

test("the candidate pool is ranked before pagination, deduplicated, and deterministic", () => {
  const games = Array.from({ length: 60 }, (_, id) => ({ id, name: `Halo ${id}`, rating: 80, rating_count: id }));
  const ranked = rankGameSearch([...games, games[0]], "halo");
  assert.equal(ranked.length, 60);
  assert.equal(ranked[0].id, 59);
  assert.equal(new Set([...ranked.slice(0, 20), ...ranked.slice(20, 40)].map(game => game.id)).size, 40);
  assert.equal(gameSearchBody("halo", 1), gameSearchBody("halo", 2));
  assert.match(gameSearchBody("", 2), /limit 21; offset 20;/);
});

test("published game filters use metadata IDs, exclude non-game types and unreleased statuses", () => {
  const filters = gameSearchFilters([
    { id: 10, type: "Main Game" }, { id: 11, type: "Mod" }, { id: 12, type: "Bundle" },
    { id: 13, type: "Remake" }, { id: 14, type: "Update" },
  ], [
    { id: 20, status: "Released" }, { id: 21, status: "Early Access" },
    { id: 22, status: "Cancelled" }, { id: 23, status: "Rumored" },
  ], 1700000000000);
  assert.deepEqual(filters, ["game_type = (10,13)", "(game_status = null | game_status = (20,21))", "first_release_date <= 1700000000", "platforms != null"]);
  assert.throws(() => gameSearchFilters([], [], 0));
});

test("discovery returns preserve search, pagination, and game filters across refreshes", () => {
  for (const root of ["/movies", "/tv", "/games"]) {
    const url = `${root}/discover?q=final+fantasy&page=3${root === "/games" ? "&genre=12&platform=6" : ""}`;
    const detail = withDiscoveryReturnTo(`${root}/42`, url);
    assert.equal(discoveryReturnTo(new URL(detail, "https://hobbyist.local").searchParams.get("returnTo"), root), url);
  }
  assert.equal(withDiscoveryReturnTo("/tv/42?season=2#seasons", "/tv/discover?q=lost"), "/tv/42?season=2&returnTo=%2Ftv%2Fdiscover%3Fq%3Dlost#seasons");
});

test("direct visits and untrusted return URLs fall back to the correct discovery page", () => {
  for (const value of [undefined, ["/games/discover"], "https://evil.test/games/discover", "//evil.test/games/discover", "/movies/discover?q=x", "javascript:alert(1)"]) {
    assert.equal(discoveryReturnTo(value, "/games"), "/games/discover");
  }
  assert.equal(discoveryReturnTo("/games/discover?q=halo&unknown=x#junk", "/games"), "/games/discover?q=halo");
});
