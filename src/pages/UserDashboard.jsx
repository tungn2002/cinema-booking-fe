import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { movieAPI } from '../services/api.js';
import { FiSearch, FiFilm, FiStar, FiCalendar, FiClock, FiLogOut, FiUser, FiHome, FiCreditCard } from 'react-icons/fi';
import './UserDashboard.css';

function UserDashboard() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [user, setUser] = useState(null);
  
  const { logout, checkAdmin, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'));
    setUser(userData);
    fetchMovies();
  }, [searchTerm, selectedGenre, selectedYear]);

  const checkAdminRole = async () => {
    if (!isAuthenticated) return;
    const isAdmin = await checkAdmin();
    if (isAdmin) {
      // User is admin but on user dashboard - that's ok, they can switch
    }
  };

  const fetchMovies = async () => {
    try {
      setLoading(true);
      const params = {
        size: 100 // Lấy nhiều phim hơn để bộ lọc Năm/Thể loại đầy đủ hơn
      };
      if (searchTerm) params.search = searchTerm;
      if (selectedGenre && selectedGenre !== 'All') params.genre = selectedGenre;
      if (selectedYear && selectedYear !== 'All') params.year = selectedYear;
      
      const response = await movieAPI.getAll(params);
      const data = response.data.data;
      
      const moviesList = data?.content || data || [];
      setMovies(moviesList);
    } catch (error) {
      console.error('Error fetching movies:', error);
      setMovies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayMovies = movies.map(movie => ({
    ...movie,
    title: movie.title || movie.movieTitle,
    genre: movie.genre || 'Unknown',
    releaseYear: movie.releaseYear || new Date().getFullYear(),
    description: movie.description || 'No description available',
    posterImageUrl: movie.posterImageUrl || movie.posterUrl,
    averageRating: movie.averageRating || 0,
  }));

  const genres = ['All', ...new Set(movies.map(m => m.genre).filter(Boolean))];
  const years = ['All', ...new Set(movies.map(m => m.releaseYear?.toString()).filter(Boolean))].sort((a, b) => b - a);

  return (
    <div className="user-dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <Link to="/movies" className="logo">
            <FiFilm className="logo-icon" />
            <span>Cinema<span className="text-gradient">Booking</span></span>
          </Link>

          <div className="header-actions">
            <nav className="header-nav">
              <Link to="/movies" className="nav-link active">
                <FiHome />
                <span>Movies</span>
              </Link>
              {isAuthenticated && (
                <Link to="/reservations" className="nav-link">
                  <FiCreditCard />
                  <span>My Tickets</span>
                </Link>
              )}
            </nav>

            <div className="user-menu">
              {isAuthenticated ? (
                <>
                  <div className="user-info">
                    <FiUser className="user-icon" />
                    <span className="username">{user?.username || 'User'}</span>
                  </div>
                  <button onClick={handleLogout} className="btn-logout">
                    <FiLogOut />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <Link to="/login" className="btn btn-primary btn-sm">
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <motion.section
        className="hero-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="hero-content">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Discover Amazing <span className="text-gradient">Movies</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Book your tickets for the latest blockbusters and indie gems
          </motion.p>
        </div>
        <div className="hero-decoration">
          <div className="film-reel"></div>
        </div>
      </motion.section>

      {/* Search & Filter */}
      <section className="search-section">
        <div className="search-container">
          <div className="filter-row">
            <div className="search-box">
              <FiSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search movies by title or genre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            
            <div className="year-filter">
              <FiCalendar className="filter-icon" />
              <select 
                className="year-select"
                value={selectedYear || 'All'}
                onChange={(e) => setSelectedYear(e.target.value === 'All' ? '' : e.target.value)}
              >
                <option value="All">All Years</option>
                {years.filter(y => y !== 'All').map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="genre-filters">
            {genres.map((genre) => (
              <button
                key={genre}
                className={`genre-tag ${selectedGenre === genre || (genre === 'All' && !selectedGenre) ? 'active' : ''}`}
                onClick={() => setSelectedGenre(genre === 'All' ? '' : genre)}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Movies Grid */}
      <section className="movies-section">
        {loading ? (
          <div className="loading-container">
            <div className="spinner spinner-lg"></div>
            <p>Loading movies...</p>
          </div>
        ) : displayMovies.length === 0 ? (
          <div className="empty-state">
            <FiFilm className="empty-icon" />
            <h3>No movies found</h3>
            <p>Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="movies-grid">
            {displayMovies.map((movie, index) => (
              <MovieCard key={movie.id} movie={movie} index={index} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MovieCard({ movie, index }) {
  return (
    <motion.div
      className="movie-card"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ y: -8, scale: 1.02 }}
    >
      <div className="movie-poster">
        {movie.posterImageUrl ? (
          <img src={movie.posterImageUrl} alt={movie.title} />
        ) : (
          <div className="poster-placeholder">
            <FiFilm />
          </div>
        )}
        <div className="movie-rating">
          <FiStar className="star-icon" />
          <span>{movie.averageRating?.toFixed(1) || 'N/A'}</span>
        </div>
      </div>

      <div className="movie-info">
        <h3 className="movie-title">{movie.title}</h3>
        <div className="movie-meta">
          <span className="movie-genre">{movie.genre}</span>
          <span className="movie-year">
            <FiCalendar />
            {movie.releaseYear}
          </span>
        </div>
        <p className="movie-description">{movie.description}</p>
        
        <Link to={`/movies/${movie.id}`} className="btn-book">
          <FiCreditCard />
          Book Tickets
        </Link>
      </div>
    </motion.div>
  );
}

export default UserDashboard;
