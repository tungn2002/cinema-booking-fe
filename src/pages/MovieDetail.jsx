import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import { movieAPI, showtimeAPI, seatAPI, reservationAPI, reviewAPI } from '../services/api.js';
import { FiArrowLeft, FiStar, FiCalendar, FiClock, FiCreditCard, FiMapPin, FiFilm, FiSend, FiThumbsUp, FiThumbsDown } from 'react-icons/fi';
import './MovieDetail.css';

function MovieDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [showtimes, setShowtimes] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [availableDates, setAvailableDates] = useState([]);
  const [loadingDates, setLoadingDates] = useState(true);
  const [loading, setLoading] = useState(true);

  // Review state
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [userReview, setUserReview] = useState(null);

  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    fetchMovieDetail();
    loadAvailableDatesAndFetchShowtimes();
    fetchReviews();
  }, [id]);

  const fetchMovieDetail = async () => {
    try {
      const response = await movieAPI.getById(id);
      const movieData = response.data.data;
      setMovie({
        ...movieData,
        duration: movieData.duration || 120,
        director: movieData.director || 'Unknown',
        cast: movieData.cast || 'Unknown',
      });
    } catch (error) {
      console.error('Error fetching movie:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableDatesAndFetchShowtimes = async () => {
    try {
      setLoadingDates(true);
      const datesWithShows = await fetchAvailableDates();
      setAvailableDates(datesWithShows);
      
      // If there are available dates, select the first one and fetch showtimes
      if (datesWithShows.length > 0 && !selectedDate) {
        setSelectedDate(datesWithShows[0]);
        await fetchShowtimes(datesWithShows[0]);
      }
    } catch (error) {
      console.error('Error loading available dates:', error);
    } finally {
      setLoadingDates(false);
    }
  };

  const generateDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    if (!selectedDate) {
      setSelectedDate(dates[0].toISOString().split('T')[0]);
    }
  };

  const fetchAvailableDates = async () => {
    try {
      // Fetch showtimes for next 7 days to find which dates have shows
      const datesWithShowtimes = [];
      const promises = [];
      const dates = [];
      
      // Create array of dates to check
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        dates.push({ dateStr, date });
        promises.push(showtimeAPI.getByDate(dateStr));
      }
      
      // Fetch all dates in parallel
      const responses = await Promise.all(promises);
      
      // Check which dates have showtimes for this movie
      responses.forEach((response, index) => {
        const allShowtimes = response.data.data || [];
        const movieShowtimes = allShowtimes.filter(s =>
          s.movieId === parseInt(id) || s.movie?.id === parseInt(id)
        );
        
        if (movieShowtimes.length > 0) {
          datesWithShowtimes.push(dates[index].dateStr);
        }
      });
      
      return datesWithShowtimes;
    } catch (error) {
      console.error('Error fetching available dates:', error);
      return [];
    }
  };

  const fetchShowtimes = async (date) => {
    try {
      const response = await showtimeAPI.getByDate(date);
      const allShowtimes = response.data.data || [];

      // Filter showtimes for this movie
      const movieShowtimes = allShowtimes.filter(s =>
        s.movieId === parseInt(id) || s.movie?.id === parseInt(id)
      );
      setShowtimes(movieShowtimes);
    } catch (error) {
      console.error('Error fetching showtimes:', error);
      setShowtimes([]);
    }
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    fetchShowtimes(date);
    setBookingStep(1);
    setSelectedShowtime(null);
    setSelectedSeats([]);
  };

  const handleShowtimeSelect = (showtime) => {
    // Navigate to booking page with showtime ID
    navigate(`/booking/${showtime.id}`);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return {
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      date: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
    };
  };

  // Review functions
  const fetchReviews = async () => {
    try {
      setLoadingReviews(true);
      const response = await reviewAPI.getByMovie(id);
      const allReviews = response.data.data || [];
      setReviews(allReviews);
      
      // Find current user's review
      if (isAuthenticated && user) {
        const myReview = allReviews.find(r => r.username === user.username);
        setUserReview(myReview || null);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error('Please login to write a review');
      navigate('/login');
      return;
    }

    if (!reviewForm.comment.trim()) {
      toast.error('Please enter your review');
      return;
    }

    try {
      setSubmittingReview(true);
      await reviewAPI.addReview(id, {
        rating: reviewForm.rating,
        comment: reviewForm.comment
      });
      toast.success('Review submitted! Waiting for approval.');
      setReviewForm({ rating: 5, comment: '' });
      fetchReviews();
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error(error.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderStars = (rating, interactive = false, size = 'normal') => {
    return Array.from({ length: 5 }, (_, i) => (
      <FiStar
        key={i}
        className={`star-icon ${i < rating ? 'filled' : ''} ${interactive ? 'interactive' : ''} ${size}`}
        onClick={() => interactive && setReviewForm(prev => ({ ...prev, rating: i + 1 }))}
      />
    ));
  };

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner spinner-lg"></div>
        <p>Loading movie details...</p>
      </div>
    );
  }

  return (
    <div className="movie-detail-page">
      {/* Header */}
      <header className="detail-header">
        <button className="btn-back" onClick={() => navigate('/movies')}>
          <FiArrowLeft />
          Back to Movies
        </button>
        {isAuthenticated ? (
          <Link to="/reservations" className="btn-my-tickets">
            <FiCreditCard />
            My Tickets
          </Link>
        ) : (
          <Link to="/login" className="btn btn-primary btn-sm">
            Sign In
          </Link>
        )}
      </header>

      {/* Hero Section */}
      <section className="movie-hero">
        <div className="hero-backdrop">
          <div className="backdrop-overlay"></div>
        </div>
        <div className="movie-content">
          <motion.div
            className="movie-poster-large"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            {movie?.posterImageUrl ? (
              <img src={movie.posterImageUrl} alt={movie?.title} />
            ) : (
              <div className="poster-placeholder">
                <FiFilm />
              </div>
            )}
          </motion.div>

          <motion.div
            className="movie-info-large"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h1 className="movie-title-large">{movie?.title}</h1>
            
            <div className="movie-meta-large">
              <span className="meta-item">
                <FiStar className="star-icon" />
                {movie?.averageRating?.toFixed(1) || 'N/A'}
              </span>
              <span className="meta-item">
                <FiCalendar />
                {movie?.releaseYear}
              </span>
              <span className="badge-genre">{movie?.genre}</span>
            </div>

            <p className="movie-description-large">{movie?.description}</p>

            <div className="action-buttons">
              <button className="btn-trailer">
                <FiClock />
                Watch Trailer
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Showtimes Section */}
      <section className="showtimes-section">
        <div className="showtimes-container">
          <h2 className="section-title">Available Showtimes</h2>
          
          <div className="date-selector">
            {loadingDates ? (
              <div className="loading-dates">
                <div className="spinner spinner-sm"></div>
                <p>Loading dates...</p>
              </div>
            ) : availableDates.length > 0 ? (
              availableDates.map((dateStr) => {
                const formatted = formatDate(dateStr);
                return (
                  <button
                    key={dateStr}
                    className={`date-btn ${selectedDate === dateStr ? 'active' : ''}`}
                    onClick={() => handleDateChange(dateStr)}
                  >
                    <span className="day">{formatted.day}</span>
                    <span className="date-num">{formatted.date}</span>
                    <span className="month">{formatted.month}</span>
                  </button>
                );
              })
            ) : (
              <p className="no-dates">No showtimes available for this movie</p>
            )}
          </div>

          {selectedDate && (
            <div className="showtimes-list">
              <h3 className="showtimes-title">Showtimes for {selectedDate}</h3>
              <div className="showtimes-grid">
                {showtimes.length > 0 ? (
                  showtimes.map((showtime) => (
                    <button
                      key={showtime.id}
                      className="showtime-btn"
                      onClick={() => handleShowtimeSelect(showtime)}
                    >
                      <span className="time">{showtime.showTime}</span>
                      <span className="theater">{showtime.theaterName}</span>
                      <span className="price">${showtime.price}</span>
                    </button>
                  ))
                ) : (
                  <p className="no-showtimes">
                    No showtimes available for this date
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Reviews Section */}
      <section className="reviews-section">
        <div className="reviews-container">
          <div className="reviews-header">
            <h2 className="section-title">Audience Reviews</h2>
            <div className="rating-summary">
              <div className="rating-big">
                {movie?.averageRating?.toFixed(1) || 'N/A'}
              </div>
              <div className="rating-stars">
                {renderStars(Math.round(movie?.averageRating || 0))}
              </div>
              <p className="rating-count">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Write Review Form */}
          {isAuthenticated && !userReview ? (
            <motion.div
              className="write-review-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3>Write a Review</h3>
              <form onSubmit={handleSubmitReview}>
                <div className="rating-input">
                  <label>Your Rating:</label>
                  <div className="stars-interactive">
                    {renderStars(reviewForm.rating, true, 'large')}
                  </div>
                  <span className="rating-value">{reviewForm.rating}/5</span>
                </div>
                <div className="form-group">
                  <textarea
                    placeholder="Share your thoughts about this movie..."
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                    rows="4"
                    required
                  />
                </div>
                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="btn-primary"
                    disabled={submittingReview || !reviewForm.comment.trim()}
                  >
                    <FiSend />
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : userReview ? (
            <div className="user-review-info">
              <p>You've already reviewed this movie:</p>
              <div className="user-review-card">
                <div className="review-header">
                  <div className="review-rating">
                    {renderStars(userReview.rating)}
                    <span className="rating-text">{userReview.rating}/5</span>
                  </div>
                  <span className={`review-status badge badge-${userReview.status === 'APPROVED' ? 'success' : 'warning'}`}>
                    {userReview.status}
                  </span>
                </div>
                <p className="review-comment">{userReview.comment}</p>
                <p className="review-date">{userReview.createdAt?.split('T')[0]}</p>
              </div>
            </div>
          ) : (
            <div className="login-prompt">
              <p>Please <Link to="/login">sign in</Link> to write a review</p>
            </div>
          )}

          {/* Reviews List */}
          <div className="reviews-list">
            <h3>All Reviews</h3>
            {loadingReviews ? (
              <div className="loading-reviews">
                <div className="spinner spinner-lg"></div>
                <p>Loading reviews...</p>
              </div>
            ) : reviews.length === 0 ? (
              <div className="no-reviews">
                <FiFilm className="no-reviews-icon" />
                <p>No reviews yet. Be the first to review!</p>
              </div>
            ) : (
              <div className="reviews-grid">
                {reviews.filter(r => r.status === 'APPROVED').map((review) => (
                  <motion.div
                    key={review.id}
                    className="review-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="review-card-header">
                      <div className="reviewer-info">
                        <div className="reviewer-avatar">
                          {review.username?.charAt(0).toUpperCase()}
                        </div>
                        <div className="reviewer-details">
                          <strong className="reviewer-name">{review.username}</strong>
                          <span className="review-date">{review.createdAt?.split('T')[0]}</span>
                        </div>
                      </div>
                      <div className="review-rating">
                        {renderStars(review.rating, false, 'small')}
                      </div>
                    </div>
                    <p className="review-comment">{review.comment}</p>
                    <div className="review-actions">
                      <button className="review-action">
                        <FiThumbsUp />
                        <span>{review.upvotes || 0}</span>
                      </button>
                      <button className="review-action">
                        <FiThumbsDown />
                        <span>{review.downvotes || 0}</span>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default MovieDetail;
