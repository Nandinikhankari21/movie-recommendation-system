import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Icon from './Icons.jsx';
import Artwork from './Artwork.jsx';
import './chatbot.css';

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const EXAMPLES = ['Harry Potter', 'Interstellar', 'Space exploration', 'Romantic comedy'];

function readSaved() {
  try {
    const value = JSON.parse(localStorage.getItem('frame-watchlist') || '[]');
    return Array.isArray(value) ? value.filter(m => m && Number.isInteger(m.id) && typeof m.title === 'string' && Array.isArray(m.genres)) : [];
  } catch { return []; }
}

function MovieCard({ movie, saved, toggleSaved, onOpen, index }) {
  return <article className="movie-card" style={{ '--delay': `${index * 35}ms` }}>
    <div className="movie-cover">
      <button className="cover-button" onClick={() => onOpen(movie)} aria-label={`Read about ${movie.title}`}><Artwork movie={movie} /></button>
      <button className={`save-button ${saved ? 'is-saved' : ''}`} onClick={() => toggleSaved(movie)} aria-label={`${saved ? 'Remove' : 'Save'} ${movie.title}${saved ? ' from' : ' to'} watchlist`} aria-pressed={saved}><Icon name={saved ? 'check' : 'bookmark'} size={17} /></button>
      <div className="rating-badge" aria-label={`Rating ${movie.rating} out of 10`}><Icon name="star" size={12} />{movie.rating.toFixed(1)}</div>
    </div>
    <div className="movie-content">
      <div className="movie-meta"><span>{movie.year || 'Year unknown'}</span><span>·</span><span>{movie.genres.slice(0, 2).join(' / ') || 'Cinema'}</span></div>
      <button className="movie-title" onClick={() => onOpen(movie)}>{movie.title}</button>
      <p className="movie-overview">{movie.overview || 'A story waiting to be discovered.'}</p>
      <div className="movie-reason"><span className="reason-dot" /><span>{movie.reason}</span></div>
    </div>
  </article>;
}

function MovieDialog({ movie, onClose, saved, toggleSaved, findSimilar }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  return <dialog ref={dialog} className="movie-dialog" onClose={onClose} onClick={event => { if (event.target === event.currentTarget) dialog.current.close(); }} aria-labelledby="dialog-title">
    <div className="dialog-inner">
      <div className="dialog-art"><Artwork movie={movie} /><button className="dialog-close" onClick={() => dialog.current.close()} aria-label="Close movie details"><Icon name="close" /></button></div>
      <div className="dialog-content"><div className="eyebrow">YOUR NEXT MOVIE NIGHT</div><h2 id="dialog-title">{movie.title}</h2>
        <div className="detail-meta"><span className="detail-rating"><Icon name="star" size={16} /> {movie.rating.toFixed(1)} <small>/ 10</small></span><span>{movie.year || 'Year unknown'}</span>{movie.runtime ? <span>{movie.runtime} min</span> : null}<span>{movie.votes.toLocaleString()} ratings</span></div>
        <div className="detail-genres">{movie.genres.map(g => <span key={g}>{g}</span>)}</div>
        <p>{movie.overview || 'No synopsis is available for this film.'}</p>
        <div className="detail-reason"><Icon name="info" size={18} /><span>{movie.reason}</span></div>
        <div className="dialog-actions"><button className="primary-button" onClick={() => findSimilar(movie.title)}>Find similar films <Icon name="arrow" size={17} /></button><button className="secondary-button" onClick={() => toggleSaved(movie)}><Icon name={saved ? 'check' : 'bookmark'} size={17} />{saved ? 'Saved' : 'Watchlist'}</button></div>
      </div>
    </div>
  </dialog>;
}

export default function Chatbot() {
  const [view, setView] = useState('discover');
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('');
  const [rating, setRating] = useState('0');
  const [sort, setSort] = useState('recommended');
  const [genres, setGenres] = useState([]);
  const [total, setTotal] = useState(0);
  const [movies, setMovies] = useState([]);
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(readSaved);
  const [storageError, setStorageError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem('frame-watchlist', JSON.stringify(saved)); setStorageError(''); }
    catch { setStorageError('Browser storage is unavailable. Your watchlist will last for this visit.'); }
  }, [saved]);

  useEffect(() => {
    const controller = new AbortController();
    axios.get(`${API}/genres`, { signal: controller.signal, timeout: 15000 }).then(({ data }) => { setGenres(data.genres); setTotal(data.total_movies); }).catch(() => {});
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    if (view !== 'discover') return;
    const controller = new AbortController();
    setLoading(true); setError(''); setSuggestions([]);
    const params = { genre, min_rating: Number(rating), limit: 12 };
    const request = query
      ? axios.post(`${API}/recommend`, { query, ...params }, { signal: controller.signal, timeout: 15000 })
      : axios.get(`${API}/movies`, { params, signal: controller.signal, timeout: 15000 });
    request.then(({ data }) => { setMovies(data.movies); setResult(query ? data : null); })
      .catch(err => { if (!controller.signal.aborted) setError(err.response?.data?.error || 'We couldn’t reach the movie library. Make sure the Flask backend is running, then try again.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, genre, rating, retry, view]);

  useEffect(() => {
    setActiveSuggestion(-1);
    if (input.trim().length < 2 || input.trim() === query) { setSuggestions([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => axios.get(`${API}/suggest`, { params: { q: input.trim() }, signal: controller.signal, timeout: 5000 }).then(({ data }) => setSuggestions(data.movies)).catch(() => {}), 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [input, query]);

  function toggleSaved(movie) { setSaved(current => current.some(m => m.id === movie.id) ? current.filter(m => m.id !== movie.id) : [...current, movie]); }
  function search(value) {
    const next = value.trim();
    setInput(next); setQuery(next); setView('discover'); setSuggestions([]); setSort('recommended');
    if (next === query) setRetry(current => current + 1);
    setSelected(null);
  }
  function navigate(next) { setView(next); setSuggestions([]); if (next === 'discover') { setQuery(''); setInput(''); setGenre(''); setRating('0'); } }
  function searchKeys(event) {
    if (event.key === 'Escape') setSuggestions([]);
    if (suggestions.length && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      setActiveSuggestion(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
    }
    if (event.key === 'Enter' && activeSuggestion >= 0 && suggestions[activeSuggestion]) { event.preventDefault(); search(suggestions[activeSuggestion].title); }
  }

  let visible = view === 'watchlist' ? saved.filter(m => (!genre || m.genres.includes(genre)) && m.rating >= Number(rating)) : movies;
  visible = [...visible];
  if (sort === 'rating') visible.sort((a, b) => b.rating - a.rating);
  if (sort === 'newest') visible.sort((a, b) => (b.year || 0) - (a.year || 0));
  if (sort === 'title') visible.sort((a, b) => a.title.localeCompare(b.title));
  const isSaved = movie => saved.some(m => m.id === movie.id);

  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="#discover" onClick={event => { event.preventDefault(); navigate('discover'); }} aria-label="Frame home"><span className="brand-mark"><Icon name="film" size={23} /></span>frame<span className="brand-period">.</span></a>
      <div className="sidebar-label">YOUR MOVIE CORNER</div>
      <nav aria-label="Main navigation">{[['discover', 'compass', 'Discover'], ['watchlist', 'bookmark', 'My watchlist']].map(([key, icon, label]) => <button key={key} className={`nav-item ${view === key ? 'active' : ''}`} onClick={() => navigate(key)} aria-current={view === key ? 'page' : undefined}><Icon name={icon} /><span>{label}</span>{key === 'watchlist' && <span className="nav-count">{saved.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-quote"><Icon name="film" size={25} /><p>Less scrolling.<br /><strong>More cinema.</strong></p><span>There’s a story for every mood.</span></div><div className="local-status"><span />{total ? `${total.toLocaleString()} films to explore` : 'Your local movie library'}</div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb">Your library <span>/</span> <strong>{view === 'watchlist' ? 'My watchlist' : 'Discover'}</strong></div><div className="topbar-right"><span className="edition">THE MOVIE NIGHT EDIT</span><span className="profile" aria-label="Movie explorer">M</span></div></header>
      <main className="main-content">
        <>
          {view === 'discover' ? <>
            <section className="hero"><div className="hero-copy"><div className="hero-eyebrow"><span /> A LITTLE DISCOVERY. A GREAT MOVIE.</div><h1>Find your next<br /><em>favorite story.</em></h1><p>Start with a film you love, a mood, or a little curiosity.<br className="desktop-break" /> We’ll help you find something worth watching.</p><button onClick={() => inputRef.current?.focus()} className="hero-link">Let’s find your film <Icon name="arrow" size={17} /></button></div><div className="hero-visual" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="floating-cover cover-back"><Artwork movie={{ id: 7, title: 'Another world awaits', genres: ['Adventure'], year: 2014 }} /></div><div className="floating-cover cover-front"><Artwork movie={{ id: 6, title: 'A world of possibilities', genres: ['Science Fiction'], year: 2016 }} /></div><span className="hero-spark spark-one">✦</span><span className="hero-spark spark-two">✧</span><span className="hero-note">FOR THE LOVE OF FILM</span></div></section>
            <section className="search-section" aria-label="Search the movie library"><form className="search-form" onSubmit={event => { event.preventDefault(); search(input); }}><Icon name="search" size={22} /><input ref={inputRef} value={input} onChange={event => setInput(event.target.value)} onKeyDown={searchKeys} onBlur={() => setSuggestions([])} placeholder="A favorite film, a genre, a feeling…" maxLength={300} aria-label="Search movie titles, genres, or themes" role="combobox" aria-expanded={suggestions.length > 0} aria-controls="movie-suggestions" aria-autocomplete="list" aria-activedescendant={activeSuggestion >= 0 ? `suggestion-${activeSuggestion}` : undefined} autoComplete="off" />{input && <button type="button" className="clear-search" aria-label="Clear search" onClick={() => { search(''); inputRef.current?.focus(); }}><Icon name="close" size={17} /></button>}<button type="submit" className="primary-button">Find my next film <Icon name="arrow" size={17} /></button></form>
              {suggestions.length > 0 && <ul className="suggestions" id="movie-suggestions" role="listbox" aria-label="Matching movie titles">{suggestions.map((movie, i) => <li id={`suggestion-${i}`} key={movie.id} role="option" aria-selected={activeSuggestion === i} className={activeSuggestion === i ? 'suggestion-active' : ''} onMouseDown={event => event.preventDefault()}><button type="button" onClick={() => search(movie.title)}><Icon name="film" size={18} /><span>{movie.title}</span><small>{movie.year}</small><Icon name="arrow" size={15} /></button></li>)}</ul>}
              <div className="search-examples"><span>A little inspiration:</span>{EXAMPLES.map(example => <button key={example} onClick={() => search(example)}>{example}<Icon name="arrow" size={12} /></button>)}</div>
            </section>
          </> : <section className="watchlist-heading"><div className="eyebrow">SAVED FOR A GOOD NIGHT</div><h1>Your next watches,<br /><em>all in one place.</em></h1><p>Your personal shortlist. Saved in this browser, ready when you are.</p></section>}

          <section className="results-section" aria-labelledby="results-heading"><div className="results-title-row"><div><div className="section-kicker">{view === 'watchlist' ? 'YOUR COLLECTION' : query ? 'THE SEARCH IS PART OF THE STORY' : 'GOOD STORIES START HERE'}</div><h2 id="results-heading">{view === 'watchlist' ? 'My watchlist' : query ? <>Picks for <span>“{query}”</span></> : 'Worth your watch'}{!(loading && view === 'discover') && <span className="result-count">{visible.length}</span>}</h2><p className="section-subtitle">{view === 'watchlist' ? 'The films you’re keeping for later.' : result?.type === 'fuzzy_title' ? `Showing films similar to ${result.matched_title}.` : result?.type === 'partial_title' ? 'Films from this collection, plus stories with a similar spirit.' : query ? 'A few stories with something in common.' : 'Well-loved films. A good place to begin.'}</p></div><label className="sort-control"><span>Sort by</span><select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort movies"><option value="recommended">{query ? 'Recommended' : view === 'watchlist' ? 'Saved order' : 'Our picks'}</option><option value="rating">Highest rated</option><option value="newest">Newest first</option><option value="title">Title A–Z</option></select></label></div>
            <div className="filter-bar"><div className="genre-filters" aria-label="Filter by genre"><button className={!genre ? 'selected' : ''} onClick={() => setGenre('')} aria-pressed={!genre}>All films</button>{['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Science Fiction', 'Thriller', 'Romance', 'Animation'].filter(item => !genres.length || genres.includes(item)).map(item => <button key={item} className={genre === item ? 'selected' : ''} onClick={() => setGenre(item)} aria-pressed={genre === item}>{item === 'Science Fiction' ? 'Sci-fi' : item}</button>)}</div><label className="rating-filter"><Icon name="sliders" size={16} /><select value={rating} onChange={event => setRating(event.target.value)} aria-label="Minimum movie rating"><option value="0">Any rating</option><option value="6">6+ rating</option><option value="7">7+ rating</option><option value="8">8+ rating</option></select></label></div>
            {storageError && <p className="storage-note" role="status">{storageError}</p>}
            <div aria-live="polite" aria-busy={loading && view === 'discover'}>
              {view === 'discover' && loading ? <div className="movie-grid skeleton-grid" aria-label="Loading films">{Array.from({ length: 6 }, (_, i) => <div className="skeleton-card" key={i}><div /><span /><span /></div>)}</div>
                : view === 'discover' && error ? <div className="empty-state" role="alert"><span className="empty-icon"><Icon name="film" size={30} /></span><h3>The library is taking an intermission</h3><p>{error}</p><button className="primary-button" onClick={() => setRetry(v => v + 1)}>Try again <Icon name="arrow" size={17} /></button></div>
                : visible.length ? <div className="movie-grid">{visible.map((movie, index) => <MovieCard key={movie.id} movie={movie} index={index} saved={isSaved(movie)} toggleSaved={toggleSaved} onOpen={setSelected} />)}</div>
                : <div className="empty-state"><span className="empty-icon"><Icon name={view === 'watchlist' ? 'bookmark' : 'search'} size={30} /></span><h3>{view === 'watchlist' && !saved.length ? 'Your next favorite belongs here' : 'A different direction, perhaps?'}</h3><p>{view === 'watchlist' && !saved.length ? 'Tap the bookmark on a film to save it for your next movie night.' : 'No films match this combination. Try another title or give your filters a little room.'}</p><button className="primary-button" onClick={() => { if (view === 'watchlist' && !saved.length) navigate('discover'); else { setGenre(''); setRating('0'); if (view !== 'watchlist') search(''); } }}>Explore films <Icon name="arrow" size={17} /></button></div>}
            </div>
          </section>
        </>
        <footer className="page-footer"><span>Made for the love of a good story.</span><span>FRAME <span className="footer-dot">✦</span> FIND YOUR NEXT FAVORITE</span></footer>
      </main>
    </div>
    {selected && <MovieDialog key={selected.id} movie={selected} onClose={() => setSelected(null)} saved={isSaved(selected)} toggleSaved={toggleSaved} findSimilar={search} />}
  </div>;
}
