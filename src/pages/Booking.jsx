import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import { movieAPI, showtimeAPI, seatAPI, reservationAPI, paymentAPI } from '../services/api.js';
import { FiArrowLeft, FiStar, FiCalendar, FiClock, FiCreditCard, FiMapPin, FiFilm, FiChevronRight, FiLock, FiAlertCircle, FiCheck } from 'react-icons/fi';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import './Booking.css';

// Load Stripe with the public key from env
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_YOUR_ACTUAL_KEY_HERE'); 

const CheckoutForm = ({ reservation, clientSecret, onSuccess, amount }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Return URL is required, but we will handle it via backend webhook for status
        return_url: `${window.location.origin}/payment/success`,
      },
      redirect: 'if_required' // Try to complete inline without redirect if possible!
    });

    if (error) {
      toast.error(error.message);
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_capture') {
      toast.success('Payment authorized successfully!');
      onSuccess();
    } else {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="premium-checkout-form">
      <PaymentElement />
      <button disabled={isProcessing || !stripe || !elements} className="btn-pay-stripe mt-4">
        {isProcessing ? <span className="spinner spinner-sm"></span> : <FiLock />}
        {isProcessing ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
      </button>
    </form>
  );
};

function Booking() {
  const { showtimeId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [step, setStep] = useState(1);
  const [showtime, setShowtime] = useState(null);
  const [movie, setMovie] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingReservation, setCreatingReservation] = useState(false);
  const [reservation, setReservation] = useState(null);
  const [clientSecret, setClientSecret] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('STRIPE');
  
  // Realtime & Timer state
  const [timeLeft, setTimeLeft] = useState(540); // 9 minutes = 540s
  const stompClientRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      toast.error('Please login to book tickets');
      navigate('/login', { state: { from: `/booking/${showtimeId}` } });
      return;
    }
    fetchShowtimeDetails();
    setupWebSocket();

    return () => {
      if (stompClientRef.current) stompClientRef.current.deactivate();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [showtimeId, isAuthenticated]);

  const setupWebSocket = () => {
    const client = new Client({
      webSocketFactory: () => {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
        const wsUrl = apiUrl.replace('/api/v1', '') + '/ws';
        return new SockJS(wsUrl);
      },
      onConnect: () => {
        console.log('Connected to WS');
        client.subscribe(`/topic/showtimes/${showtimeId}/seats`, (msg) => {
          const data = JSON.parse(msg.body);
          handleSeatRealtimeUpdate(data.seatId, data.status);
        });
      },
      onStompError: (err) => console.error('WS Error:', err)
    });
    client.activate();
    stompClientRef.current = client;
  };

  const handleSeatRealtimeUpdate = (seatId, status) => {
    setSeats(prev => prev.map(s => s.id === seatId ? { ...s, realtimeStatus: status, isReserved: status === 'LOCKED' } : s));
    
    // If a seat becomes locked and is currently selected by US, but we haven't reserved yet...
    // Actually, we don't know who locked it. We just deselect it visually if it's locked.
    if (status === 'LOCKED') {
      setSelectedSeats(prev => {
        if (prev.includes(seatId)) {
          toast.error(`A seat you selected was just locked by someone else!`, { id: 'seat-locked' });
          return prev.filter(id => id !== seatId);
        }
        return prev;
      });
    }
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(540);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeExpired = () => {
    toast.error('Reservation time expired! Seats have been released.', { duration: 5000 });
    // Tell backend to cancel (optional, cron does it, but good for UX sync)
    if (reservation) {
      reservationAPI.cancel(reservation.id).catch(e => console.error(e));
    }
    navigate(`/movies/${movie?.id}`);
  };

  const fetchShowtimeDetails = async () => {
    try {
      setLoading(true);
      const showtimeRes = await showtimeAPI.getById(showtimeId);
      setShowtime(showtimeRes.data.data);
      const movieRes = await movieAPI.getById(showtimeRes.data.data.movieId);
      setMovie(movieRes.data.data);
      const seatsRes = await seatAPI.getByShowtime(showtimeId);
      // Initialize realtimeStatus as AVAILABLE if not set
      const formattedSeats = (seatsRes.data.data || []).map(s => ({...s, realtimeStatus: s.isReserved ? 'LOCKED' : 'AVAILABLE'}));
      setSeats(formattedSeats);
    } catch (error) {
      toast.error('Failed to load showtime details');
      navigate('/movies');
    } finally {
      setLoading(false);
    }
  };

  const handleSeatSelect = (seatId) => {
    setSelectedSeats(prev => prev.includes(seatId) ? prev.filter(s => s !== seatId) : [...prev, seatId]);
  };

  const handleCreateReservation = async () => {
    try {
      setCreatingReservation(true);
      
      // 1. Create Reservation & Lock Seats (Atomic Lua script runs here)
      const resData = { showtimeId: parseInt(showtimeId), seatIds: selectedSeats };
      const response = await reservationAPI.create(resData);
      setReservation(response.data.data);
      
      // 2. Automatically generate Payment Intent
      const payRes = await paymentAPI.createCheckoutSession({
        reservationId: response.data.data.id,
        paymentMethod: paymentMethod

      });
      
      setClientSecret(payRes.data.data.clientSecret || payRes.data.data.url); // For new DTO
      
      toast.success('Seats locked! Complete payment within 9 minutes.');
      startTimer();
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to lock seats. Someone might have taken them!');
    } finally {
      setCreatingReservation(false);
    }
  };

  const handlePaymentSuccess = () => {
    clearInterval(timerRef.current);
    setStep(3); // Show Success UI inline!
  };

  // Format time MM:SS
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg"></div></div>;
  if (!showtime || !movie) return <div className="booking-error"><h2>Showtime not found</h2></div>;

  return (
    <div className="premium-booking-layout">
      {/* Dynamic Timer Banner */}
      <AnimatePresence>
        {step === 2 && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className={`premium-timer-banner ${timeLeft < 60 ? 'danger' : ''}`}
          >
            <FiClock className="pulse-icon" />
            <span>Complete payment in <strong>{formatTime(timeLeft)}</strong> or your seats will be released.</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="premium-glass-panel">
        {/* Anti-slop progress */}
        <div className="premium-progress">
          {[1, 2].map(num => (
            <div key={num} className={`progress-dot ${step >= num ? 'active' : ''} ${step === num ? 'current' : ''}`}>
              <div className="dot-inner">{step > num ? <FiCheck /> : num}</div>
              <span className="dot-label">{num === 1 ? 'Select Seats' : 'Checkout'}</span>
            </div>
          ))}
        </div>

        <div className="booking-content-wrapper">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: SEATS */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="step-container">
                <div className="movie-hero">
                  <img src={movie.posterImageUrl} alt="poster" className="bg-blur" />
                  <div className="hero-content">
                    <button className="btn-icon-back" onClick={() => navigate(-1)}><FiArrowLeft /></button>
                    <div>
                      <h2>{movie.title}</h2>
                      <div className="hero-meta">
                        <span className="badge glass">{showtime.showDate}</span>
                        <span className="badge glass">{showtime.showTime}</span>
                        <span className="badge glass"><FiMapPin /> {showtime.theaterName}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="theater-screen-wrapper">
                  <div className="screen-arc">SCREEN</div>
                  
                  <div className="seats-grid-premium">
                    {(() => {
                      const seatRows = {};
                      seats.forEach(seat => {
                        const rowLetter = seat.seatNumber.charAt(0);
                        if (!seatRows[rowLetter]) seatRows[rowLetter] = [];
                        seatRows[rowLetter].push(seat);
                      });

                      return Object.keys(seatRows).sort().map(rowLetter => (
                        <div key={rowLetter} className="seat-row">
                          <span className="row-label">{rowLetter}</span>
                          {seatRows[rowLetter]
                            .sort((a, b) => parseInt(a.seatNumber.substring(1)) - parseInt(b.seatNumber.substring(1)))
                            .map(seat => {
                              // isReserved is DB truth. realtimeStatus is WebSocket truth. 
                              const isTaken = seat.isReserved || seat.realtimeStatus === 'LOCKED';
                              const isSelected = selectedSeats.includes(seat.id);
                              
                              return (
                                <button
                                  key={seat.id}
                                  className={`seat-premium ${isTaken ? 'taken' : ''} ${isSelected ? 'selected' : ''}`}
                                  disabled={isTaken}
                                  onClick={() => handleSeatSelect(seat.id)}
                                >
                                  {seat.seatNumber}
                                </button>
                              );
                            })}
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                <div className="booking-footer glass-footer">
                  <div className="selection-stats">
                    <div className="stat-value">{selectedSeats.length} <span>Seats</span></div>
                    <div className="stat-value">${(selectedSeats.length * showtime.price).toFixed(2)} <span>Total</span></div>
                  </div>
                  
                  <div className="payment-method-selector" style={{display: 'flex', gap: '15px', alignItems: 'center', color: '#fff', marginRight: 'auto', marginLeft: '20px'}}>
                    <label style={{display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer'}}>
                      <input type="radio" name="paymentMethod" value="STRIPE" checked={paymentMethod === 'STRIPE'} onChange={(e) => setPaymentMethod(e.target.value)} />
                      Stripe
                    </label>
                    <label style={{display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer'}}>
                      <input type="radio" name="paymentMethod" value="PAYPAL" checked={paymentMethod === 'PAYPAL'} onChange={(e) => setPaymentMethod(e.target.value)} />
                      PayPal
                    </label>
                  </div>

                  <button className="btn-glow" onClick={handleCreateReservation} disabled={selectedSeats.length === 0 || creatingReservation}>
                    {creatingReservation ? <span className="spinner"></span> : 'Lock Seats & Continue'} <FiChevronRight />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: CHECKOUT */}
            {step === 2 && reservation && clientSecret && (
              <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="step-container checkout-split">
                
                <div className="checkout-summary">
                  <h3>Order Summary</h3>
                  <div className="ticket-card">
                    <img src={movie.posterImageUrl} alt="poster" />
                    <div className="ticket-info">
                      <h4>{movie.title}</h4>
                      <p><FiCalendar /> {showtime.showDate} • {showtime.showTime}</p>
                      <p><FiMapPin /> {showtime.theaterName}</p>
                      <div className="ticket-seats">
                        {seats.filter(s => selectedSeats.includes(s.id)).map(s => <span key={s.id}>{s.seatNumber}</span>)}
                      </div>
                    </div>
                  </div>
                  <div className="receipt-lines">
                    <div className="line"><span>Tickets ({selectedSeats.length})</span> <span>${(selectedSeats.length * showtime.price).toFixed(2)}</span></div>
                    <div className="line total"><span>Total to Pay</span> <span>${reservation.totalPrice.toFixed(2)}</span></div>
                  </div>
                </div>

                <div className="checkout-payment">
                  <h3>Payment Details</h3>
                  <div className="payment-security-notice">
                    <FiLock /> Your payment is securely held. We only capture funds after confirmation.
                  </div>
                  
                  <div className="stripe-elements-wrapper">
                    {paymentMethod === 'STRIPE' ? (
                      <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#FF3366' } } }}>
                        <CheckoutForm 
                          reservation={reservation} 
                          clientSecret={clientSecret} 
                          amount={reservation.totalPrice} 
                          onSuccess={handlePaymentSuccess} 
                        />
                      </Elements>
                    ) : (
                      <div className="paypal-button-container" style={{padding: '20px', background: '#fff', borderRadius: '8px', minWidth: '300px'}}>
                        <PayPalScriptProvider options={{ "client-id": import.meta.env.VITE_PAYPAL_CLIENT_ID || "test", components: "buttons", currency: "USD", intent: "capture" }}>
                          <PayPalButtons 
                            createOrder={(data, actions) => {
                              return clientSecret; // for Paypal, clientSecret is the orderId returned from our BE
                            }}
                            onApprove={async (data, actions) => {
                              try {
                                const token = localStorage.getItem('token');
                                const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'}/payments/capture-paypal/${reservation.id}`, {
                                  method: 'POST',
                                  headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (res.ok) {
                                  toast.success('PayPal Checkout approved!');
                                  handlePaymentSuccess();
                                } else {
                                  toast.error('Failed to capture PayPal payment');
                                }
                              } catch (err) {
                                toast.error('Error confirming PayPal payment');
                              }
                            }}
                            onError={(err) => {
                              toast.error('PayPal Checkout Error');
                            }}
                          />
                        </PayPalScriptProvider>
                      </div>
                    )}
                  </div>
                </div>
                
              </motion.div>
            )}

            {/* STEP 3: SUCCESS INLINE */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="step-container success-container">
                <div className="success-icon-wrapper"><FiCheck /></div>
                <h2>Payment Successful!</h2>
                <p>Your seats are officially yours. We've sent the PDF ticket to your email.</p>
                <Link to="/user/dashboard" className="btn-glow mt-6">View My Tickets</Link>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default Booking;
