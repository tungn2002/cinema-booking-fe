import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import { movieAPI, showtimeAPI, seatAPI, reservationAPI, paymentAPI } from '../services/api.js';
import {
  FiArrowLeft, FiStar, FiCalendar, FiClock, FiCreditCard, FiMapPin,
  FiFilm, FiCheck, FiChevronRight, FiLock
} from 'react-icons/fi';
import './Booking.css';

function Booking() {
  const { showtimeId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [step, setStep] = useState(1); // 1: Seat Selection, 2: Review & Pay, 3: Payment
  const [showtime, setShowtime] = useState(null);
  const [movie, setMovie] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingReservation, setCreatingReservation] = useState(false);
  const [reservation, setReservation] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      toast.error('Please login to book tickets');
      navigate('/login', { state: { from: `/booking/${showtimeId}` } });
      return;
    }
    fetchShowtimeDetails();
  }, [showtimeId, isAuthenticated]);

  const fetchShowtimeDetails = async () => {
    try {
      setLoading(true);
      // Fetch showtime info
      const showtimeRes = await showtimeAPI.getById(showtimeId);
      const showtimeData = showtimeRes.data.data;
      setShowtime(showtimeData);

      // Fetch movie details
      const movieRes = await movieAPI.getById(showtimeData.movieId);
      setMovie(movieRes.data.data);

      // Fetch seats
      const seatsRes = await seatAPI.getByShowtime(showtimeId);
      setSeats(seatsRes.data.data || []);
    } catch (error) {
      console.error('Error fetching showtime details:', error);
      toast.error('Failed to load showtime details');
      navigate('/movies');
    } finally {
      setLoading(false);
    }
  };

  const handleSeatSelect = (seatId) => {
    setSelectedSeats(prev => {
      if (prev.includes(seatId)) {
        return prev.filter(s => s !== seatId);
      }
      return [...prev, seatId];
    });
  };

  const handleContinueToReview = () => {
    if (selectedSeats.length === 0) {
      toast.error('Please select at least one seat');
      return;
    }
    setStep(2);
  };

  const handleCreateReservation = async () => {
    try {
      setCreatingReservation(true);
      const reservationData = {
        showtimeId: parseInt(showtimeId),
        seatIds: selectedSeats,
      };

      const response = await reservationAPI.create(reservationData);
      const createdReservation = response.data.data;
      setReservation(createdReservation);
      toast.success('Reservation created!');
      
      // Move to payment step
      setStep(3);
    } catch (error) {
      console.error('Error creating reservation:', error);
      toast.error(error.response?.data?.message || 'Failed to create reservation');
    } finally {
      setCreatingReservation(false);
    }
  };

  const handlePayment = async () => {
    if (!reservation) {
      toast.error('No reservation found');
      return;
    }

    try {
      // Create Stripe checkout session
      const response = await paymentAPI.createCheckoutSession({
        reservationId: reservation.id,
        successUrl: `${window.location.origin}/payment/success`,
        cancelUrl: `${window.location.origin}/payment/cancel`,
      });

      console.log('Payment response:', response.data);
      
      const data = response.data.data;
      const url = data?.sessionUrl || data?.url;

      if (url) {
        // Redirect to Stripe Checkout
        window.location.href = url;
      } else {
        console.error('No URL in response:', data);
        toast.error('Failed to get payment URL');
      }
    } catch (error) {
      console.error('Error creating payment session:', error);
      toast.error(error.response?.data?.message || 'Failed to initiate payment');
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    }
  };

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner spinner-lg"></div>
        <p>Loading booking details...</p>
      </div>
    );
  }

  if (!showtime || !movie) {
    return (
      <div className="booking-error">
        <h2>Showtime not found</h2>
        <Link to="/movies" className="btn-primary">Browse Movies</Link>
      </div>
    );
  }

  return (
    <div className="booking-page">
      {/* Progress Steps */}
      <div className="booking-progress">
        <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
          <div className="step-number">1</div>
          <span>Select Seats</span>
        </div>
        <div className="progress-line" />
        <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
          <div className="step-number">2</div>
          <span>Review & Pay</span>
        </div>
        <div className="progress-line" />
        <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>
          <div className="step-number">3</div>
          <span>Payment</span>
        </div>
      </div>

      <div className="booking-content">
        {/* Step 1: Seat Selection */}
        <AnimatePresence>
          {step === 1 && (
            <motion.div
              key="step1"
              className="booking-step"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
            >
              <div className="step-header">
                <button className="btn-back" onClick={() => navigate(-1)}>
                  <FiArrowLeft />
                  Back
                </button>
                <h2>Select Your Seats</h2>
              </div>

              {/* Movie Info Bar */}
              <div className="movie-info-bar">
                <div className="movie-info-item">
                  <FiFilm />
                  <span>{movie.title}</span>
                </div>
                <div className="movie-info-item">
                  <FiCalendar />
                  <span>{showtime.showDate}</span>
                </div>
                <div className="movie-info-item">
                  <FiClock />
                  <span>{showtime.showTime}</span>
                </div>
                <div className="movie-info-item">
                  <FiMapPin />
                  <span>{showtime.theaterName}</span>
                </div>
              </div>

              {/* Seat Selection */}
              <div className="seat-selection-container">
                <div className="screen">
                  <span>SCREEN</span>
                </div>

                {seats.length > 0 ? (
                  <>
                    <div className="seats-grid">
                      {(() => {
                        const seatRows = {};
                        seats.forEach(seat => {
                          const rowLetter = seat.seatNumber.charAt(0);
                          if (!seatRows[rowLetter]) {
                            seatRows[rowLetter] = [];
                          }
                          seatRows[rowLetter].push(seat);
                        });

                        return Object.keys(seatRows).sort().map(rowLetter => (
                          <div key={rowLetter} className="seat-row">
                            <span className="row-label">{rowLetter}</span>
                            {seatRows[rowLetter]
                              .sort((a, b) => {
                                const numA = parseInt(a.seatNumber.substring(1));
                                const numB = parseInt(b.seatNumber.substring(1));
                                return numA - numB;
                              })
                              .map(seat => {
                                const isTaken = seat.isReserved;
                                const isSelected = selectedSeats.includes(seat.id);

                                return (
                                  <button
                                    key={seat.id}
                                    className={`seat ${isTaken ? 'taken' : ''} ${isSelected ? 'selected' : ''}`}
                                    disabled={isTaken}
                                    onClick={() => handleSeatSelect(seat.id)}
                                    title={`Seat ${seat.seatNumber}`}
                                  >
                                    <span className="seat-num">{seat.seatNumber}</span>
                                  </button>
                                );
                              })}
                          </div>
                        ));
                      })()}
                    </div>

                    <div className="seat-legend">
                      <div className="legend-item">
                        <div className="seat available"></div>
                        <span>Available</span>
                      </div>
                      <div className="legend-item">
                        <div className="seat selected"></div>
                        <span>Selected</span>
                      </div>
                      <div className="legend-item">
                        <div className="seat taken"></div>
                        <span>Taken</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="no-seats">
                    <FiFilm className="no-seats-icon" />
                    <p>No seats available for this showtime</p>
                  </div>
                )}
              </div>

              {/* Bottom Action Bar */}
              <div className="booking-action-bar">
                <div className="selection-summary">
                  <span>Selected: <strong>{selectedSeats.length} seat{selectedSeats.length !== 1 ? 's' : ''}</strong></span>
                  <span>Total: <strong>${(selectedSeats.length * showtime.price).toFixed(2)}</strong></span>
                </div>
                <button
                  className="btn-primary"
                  onClick={handleContinueToReview}
                  disabled={selectedSeats.length === 0}
                >
                  Continue
                  <FiChevronRight />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 2: Review & Pay */}
        <AnimatePresence>
          {step === 2 && (
            <motion.div
              key="step2"
              className="booking-step"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              <div className="step-header">
                <button className="btn-back" onClick={handleBack}>
                  <FiArrowLeft />
                  Back
                </button>
                <h2>Review & Payment</h2>
              </div>

              <div className="review-container">
                {/* Movie Details */}
                <div className="review-section">
                  <h3>Movie Details</h3>
                  <div className="review-card">
                    <div className="review-poster">
                      {movie.posterImageUrl ? (
                        <img src={movie.posterImageUrl} alt={movie.title} />
                      ) : (
                        <div className="poster-placeholder">
                          <FiFilm />
                        </div>
                      )}
                    </div>
                    <div className="review-info">
                      <h4>{movie.title}</h4>
                      <div className="review-meta">
                        <span className="badge">{movie.genre}</span>
                        <span className="rating">
                          <FiStar className="star-filled" />
                          {movie.averageRating?.toFixed(1) || 'N/A'}
                        </span>
                      </div>
                      <p className="review-description">{movie.description}</p>
                    </div>
                  </div>
                </div>

                {/* Showtime Details */}
                <div className="review-section">
                  <h3>Showtime Details</h3>
                  <div className="review-grid">
                    <div className="review-item">
                      <label>Date</label>
                      <p><FiCalendar /> {showtime.showDate}</p>
                    </div>
                    <div className="review-item">
                      <label>Time</label>
                      <p><FiClock /> {showtime.showTime}</p>
                    </div>
                    <div className="review-item">
                      <label>Theater</label>
                      <p><FiMapPin /> {showtime.theaterName}</p>
                    </div>
                    <div className="review-item">
                      <label>Price per seat</label>
                      <p><FiCreditCard /> ${showtime.price}</p>
                    </div>
                  </div>
                </div>

                {/* Seat Selection */}
                <div className="review-section">
                  <h3>Selected Seats</h3>
                  <div className="selected-seats-list">
                    {seats
                      .filter(seat => selectedSeats.includes(seat.id))
                      .map(seat => (
                        <span key={seat.id} className="seat-badge">
                          {seat.seatNumber}
                        </span>
                      ))}
                  </div>
                </div>

                {/* Price Summary */}
                <div className="review-section">
                  <h3>Price Summary</h3>
                  <div className="price-summary">
                    <div className="price-row">
                      <span>Ticket Price</span>
                      <span>${showtime.price} × {selectedSeats.length}</span>
                      <span>${(showtime.price * selectedSeats.length).toFixed(2)}</span>
                    </div>
                    <div className="price-row">
                      <span>Booking Fee</span>
                      <span>$0.00</span>
                    </div>
                    <div className="price-row total">
                      <span>Total</span>
                      <span>${(showtime.price * selectedSeats.length).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Button */}
                <div className="review-actions">
                  <button
                    className="btn-pay"
                    onClick={handleCreateReservation}
                    disabled={creatingReservation || selectedSeats.length === 0}
                  >
                    {creatingReservation ? (
                      <>
                        <span className="spinner spinner-sm"></span>
                        Processing...
                      </>
                    ) : (
                      <>
                        <FiLock />
                        Proceed to Payment
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 3: Payment */}
        <AnimatePresence>
          {step === 3 && reservation && (
            <motion.div
              key="step3"
              className="booking-step"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              <div className="step-header">
                <button className="btn-back" onClick={handleBack}>
                  <FiArrowLeft />
                  Back
                </button>
                <h2>Payment</h2>
              </div>

              <div className="payment-container">
                <div className="payment-summary">
                  <h3>Order Summary</h3>
                  <div className="summary-row">
                    <span>Reservation ID</span>
                    <span className="mono">#{reservation.id}</span>
                  </div>
                  <div className="summary-row">
                    <span>Movie</span>
                    <span>{movie.title}</span>
                  </div>
                  <div className="summary-row">
                    <span>Showtime</span>
                    <span>{showtime.showDate} at {showtime.showTime}</span>
                  </div>
                  <div className="summary-row">
                    <span>Seats</span>
                    <span>
                      {seats
                        .filter(s => selectedSeats.includes(s.id))
                        .map(s => s.seatNumber)
                        .join(', ')}
                    </span>
                  </div>
                  <div className="summary-row total">
                    <span>Total Amount</span>
                    <span className="amount">${reservation.totalPrice}</span>
                  </div>
                </div>

                <div className="payment-methods">
                  <h3>Payment Method</h3>
                  <div className="payment-info">
                    <p>You will be redirected to Stripe's secure checkout page to complete your payment.</p>
                    <div className="stripe-badge">
                      <span>🔒 Secured by Stripe</span>
                    </div>
                  </div>
                </div>

                <button
                  className="btn-pay-stripe"
                  onClick={handlePayment}
                >
                  <FiCreditCard />
                  Pay with Stripe
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default Booking;
