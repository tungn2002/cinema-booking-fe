import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import { reservationAPI, paymentAPI } from '../services/api.js';
import {
  FiArrowLeft, FiCreditCard, FiCalendar, FiClock, FiMapPin,
  FiCheckCircle, FiXCircle, FiFilm, FiEye, FiDollarSign, FiLock
} from 'react-icons/fi';
import './Reservations.css';

function Reservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, upcoming, past
  const [statusFilter, setStatusFilter] = useState(''); // '', 1=CONFIRMED, 2=PAID, 3=CANCELED
  const [user, setUser] = useState(null);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'));
    setUser(userData);
    fetchReservations();
  }, [filter, statusFilter]);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.statusId = parseInt(statusFilter);
      
      const response = await reservationAPI.getMyReservations(params);
      const data = response.data.data || [];
      setReservations(data);
    } catch (error) {
      console.error('Error fetching reservations:', error);
      toast.error('Failed to load reservations');
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (id) => {
    try {
      const response = await reservationAPI.getById(id);
      setSelectedReservation(response.data.data);
      setIsDetailModalOpen(true);
    } catch (error) {
      console.error('Error fetching reservation details:', error);
      toast.error('Failed to load reservation details');
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this reservation?')) {
      return;
    }

    try {
      await reservationAPI.cancel(id);
      toast.success('Reservation canceled successfully!');
      fetchReservations();
    } catch (error) {
      console.error('Error canceling reservation:', error);
      toast.error(error.response?.data?.message || 'Failed to cancel reservation');
    }
  };

  const handlePayment = async (reservation) => {
    try {
      const response = await paymentAPI.createCheckoutSession({
        reservationId: reservation.id,
        successUrl: `${window.location.origin}/reservations`,
        cancelUrl: `${window.location.origin}/reservations`,
      });

      const url = response.data.data?.sessionUrl || response.data.data?.url;

      if (url) {
        window.location.href = url;
      } else {
        toast.error('Failed to get payment URL');
      }
    } catch (error) {
      console.error('Error creating payment session:', error);
      toast.error(error.response?.data?.message || 'Failed to initiate payment');
    }
  };

  const filteredReservations = reservations.filter(res => {
    if (filter === 'upcoming') {
      return (res.statusId === 1 || res.statusId === 2) && new Date(res.showDate) >= new Date();
    }
    if (filter === 'past') {
      return new Date(res.showDate) < new Date() || res.statusId === 3;
    }
    return true;
  });

  const upcomingCount = reservations.filter(r =>
    (r.statusId === 1 || r.statusId === 2) && new Date(r.showDate) >= new Date()
  ).length;

  const totalSpent = reservations
    .filter(r => r.statusId === 2) // Only PAID
    .reduce((sum, r) => sum + (r.totalPrice || 0), 0);

  const getStatusBadge = (statusId) => {
    switch(statusId) {
      case 1: return { label: 'CONFIRMED', class: 'confirmed' };
      case 2: return { label: 'PAID', class: 'paid' };
      case 3: return { label: 'CANCELED', class: 'canceled' };
      default: return { label: 'Unknown', class: '' };
    }
  };

  return (
    <div className="reservations-page">
      {/* Header */}
      <header className="reservations-header">
        <button className="btn-back-header" onClick={() => navigate('/movies')}>
          <FiArrowLeft />
          Back to Movies
        </button>
        <div className="header-right">
          <span className="user-greeting">Hello, {user?.username}</span>
          <button className="btn-logout-header" onClick={() => {
            logout();
            navigate('/login');
          }}>
            Logout
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="reservations-hero">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="hero-content"
        >
          <FiCreditCard className="hero-icon" />
          <h1>My Tickets</h1>
          <p>View and manage your cinema reservations</p>
        </motion.div>
      </section>

      {/* Main Content */}
      <main className="reservations-main">
        {/* Stats Cards */}
        <div className="stats-cards">
          <motion.div
            className="stat-card total"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="stat-icon">
              <FiCreditCard />
            </div>
            <div className="stat-info">
              <span className="stat-value">{reservations.length}</span>
              <span className="stat-label">Total Reservations</span>
            </div>
          </motion.div>

          <motion.div
            className="stat-card upcoming"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="stat-icon">
              <FiCalendar />
            </div>
            <div className="stat-info">
              <span className="stat-value">{upcomingCount}</span>
              <span className="stat-label">Upcoming Shows</span>
            </div>
          </motion.div>

          <motion.div
            className="stat-card spent"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="stat-icon">
              <FiDollarSign />
            </div>
            <div className="stat-info">
              <span className="stat-value">${totalSpent.toFixed(2)}</span>
              <span className="stat-label">Total Spent</span>
            </div>
          </motion.div>
        </div>

        {/* Filter Controls */}
        <div className="filter-controls">
          <div className="filter-tabs">
            <button
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({reservations.length})
            </button>
            <button
              className={`filter-tab ${filter === 'upcoming' ? 'active' : ''}`}
              onClick={() => setFilter('upcoming')}
            >
              Upcoming ({upcomingCount})
            </button>
            <button
              className={`filter-tab ${filter === 'past' ? 'active' : ''}`}
              onClick={() => setFilter('past')}
            >
              Past
            </button>
          </div>

          <div className="status-filter">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="status-select"
            >
              <option value="">All Status</option>
              <option value="1">Confirmed</option>
              <option value="2">Paid</option>
              <option value="3">Canceled</option>
            </select>
          </div>
        </div>

        {/* Reservations List */}
        <div className="reservations-list">
          {loading ? (
            <div className="loading-state">
              <div className="spinner spinner-lg"></div>
              <p>Loading your tickets...</p>
            </div>
          ) : filteredReservations.length === 0 ? (
            <div className="empty-state">
              <FiFilm className="empty-icon" />
              <h3>No reservations found</h3>
              <p>Book your first movie ticket now!</p>
              <button className="btn-browse" onClick={() => navigate('/movies')}>
                Browse Movies
              </button>
            </div>
          ) : (
            <div className="reservations-grid">
              {filteredReservations.map((reservation, index) => (
                <ReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  index={index}
                  onCancel={handleCancel}
                  onViewDetails={handleViewDetails}
                  onPayment={handlePayment}
                  getStatusBadge={getStatusBadge}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {isDetailModalOpen && selectedReservation && (
        <div className="modal-overlay" onClick={() => setIsDetailModalOpen(false)}>
          <motion.div
            className="modal-content large"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Reservation Details #{selectedReservation.id}</h3>
              <button className="btn-close" onClick={() => setIsDetailModalOpen(false)}>
                <FiXCircle />
              </button>
            </div>
            <div className="modal-body-detail">
              <div className="detail-info-grid">
                <div className="info-item">
                  <label>Customer</label>
                  <p><strong>{selectedReservation.username}</strong></p>
                  <p className="text-secondary">{selectedReservation.userEmail}</p>
                </div>
                <div className="info-item">
                  <label>Movie</label>
                  <p>{selectedReservation.movieTitle}</p>
                </div>
                <div className="info-item">
                  <label>Theater</label>
                  <p>{selectedReservation.theaterName}</p>
                </div>
                <div className="info-item">
                  <label>Showtime</label>
                  <p>{selectedReservation.showDate}</p>
                  <p className="text-secondary">{selectedReservation.showTime}</p>
                </div>
                <div className="info-item">
                  <label>Seats</label>
                  <div className="seats-list">
                    {selectedReservation.seats?.map((seat, idx) => (
                      <span key={idx} className="seat-badge">{seat.seatNumber}</span>
                    ))}
                  </div>
                </div>
                <div className="info-item">
                  <label>Status</label>
                  <span className={`badge badge-${
                    selectedReservation.statusId === 1 ? 'success' :
                    selectedReservation.statusId === 2 ? 'paid' :
                    selectedReservation.statusId === 3 ? 'error' : 'secondary'
                  }`}>
                    {getStatusBadge(selectedReservation.statusId)?.label}
                  </span>
                </div>
                <div className="info-item">
                  <label>Booking Date</label>
                  <p>{selectedReservation.reservationTime?.replace('T', ' ') || '-'}</p>
                </div>
                <div className="info-item highlight">
                  <label>Total Amount</label>
                  <p className="revenue-amount" style={{ fontSize: 'var(--text-2xl)' }}>
                    ${selectedReservation.totalPrice?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {selectedReservation.paymentInfo && (
                <div className="detail-section">
                  <h4>Payment Information</h4>
                  <div className="detail-info-grid">
                    <div className="info-item">
                      <label>Payment Method</label>
                      <p>{selectedReservation.paymentInfo.paymentMethod || '-'}</p>
                    </div>
                    <div className="info-item">
                      <label>Payment Status</label>
                      <p>{selectedReservation.paymentInfo.paymentStatus || '-'}</p>
                    </div>
                    {selectedReservation.paymentInfo.receiptUrl && (
                      <div className="info-item">
                        <label>Receipt</label>
                        <a href={selectedReservation.paymentInfo.receiptUrl} target="_blank" rel="noopener noreferrer" className="btn-link">
                          View Receipt <FiEye />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsDetailModalOpen(false)}>Close</button>
              {selectedReservation.statusId === 1 && (
                <button className="btn-cancel" onClick={() => {
                  setIsDetailModalOpen(false);
                  handleCancel(selectedReservation.id);
                }}>
                  Cancel Reservation
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function ReservationCard({ reservation, index, onCancel, onViewDetails, onPayment, getStatusBadge }) {
  const statusBadge = getStatusBadge(reservation.statusId);
  const isConfirmed = reservation.statusId === 1;
  const isPaid = reservation.statusId === 2;
  const isCanceled = reservation.statusId === 3;
  const isPast = new Date(reservation.showDate) < new Date();

  return (
    <motion.div
      className={`reservation-card ${isCanceled ? 'canceled' : ''}`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ y: -4 }}
    >
      {/* Ticket Header */}
      <div className="ticket-header">
        <div className="ticket-id">
          <span>Ticket #</span>
          <strong>{String(reservation.id).padStart(6, '0')}</strong>
        </div>
        <div className={`status-badge ${statusBadge.class}`}>
          {isConfirmed && <FiCheckCircle />}
          {isPaid && <FiCheckCircle />}
          {isCanceled && <FiXCircle />}
          {statusBadge.label}
        </div>
      </div>

      {/* Ticket Body */}
      <div className="ticket-body">
        {reservation.posterUrl && (
          <div className="ticket-poster">
            <img src={reservation.posterUrl} alt={reservation.movieTitle} />
          </div>
        )}

        <div className="ticket-details">
          <h3 className="ticket-movie">{reservation.movieTitle}</h3>

          <div className="ticket-info-grid">
            <div className="info-item">
              <FiCalendar className="info-icon" />
              <div>
                <span className="info-label">Date</span>
                <span className="info-value">{reservation.showDate}</span>
              </div>
            </div>

            <div className="info-item">
              <FiClock className="info-icon" />
              <div>
                <span className="info-label">Time</span>
                <span className="info-value">{reservation.showTime}</span>
              </div>
            </div>

            <div className="info-item">
              <FiMapPin className="info-icon" />
              <div>
                <span className="info-label">Theater</span>
                <span className="info-value">{reservation.theaterName}</span>
              </div>
            </div>

            <div className="info-item">
              <FiCreditCard className="info-icon" />
              <div>
                <span className="info-label">Seats</span>
                <span className="info-value">{reservation.seats?.map(s => s.seatNumber).join(', ')}</span>
              </div>
            </div>

            <div className="info-item total-price-item">
              <FiDollarSign className="info-icon" />
              <div>
                <span className="info-label">Total Price</span>
                <span className="info-value total-price">${reservation.totalPrice?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Footer - 3 Buttons */}
      <div className="ticket-footer">
        <div className="ticket-actions">
          <button className="btn-view" onClick={() => onViewDetails(reservation.id)}>
            <FiEye /> View Details
          </button>

          {isConfirmed && !isPast && (
            <>
              <button className="btn-pay" onClick={() => onPayment(reservation)}>
                <FiLock /> Pay Now
              </button>
              <button className="btn-cancel" onClick={() => onCancel(reservation.id)}>
                <FiXCircle /> Cancel
              </button>
            </>
          )}

          {isPaid && !isPast && (
            <>
              <button className="btn-pay" onClick={() => onPayment(reservation)}>
                <FiCreditCard /> Re-pay
              </button>
              <button className="btn-cancel" onClick={() => onCancel(reservation.id)}>
                <FiXCircle /> Cancel
              </button>
            </>
          )}

          {isCanceled && (
            <span className="canceled-note">This reservation has been canceled</span>
          )}

          {isPast && (isConfirmed || isPaid) && (
            <span className="past-note">Show completed</span>
          )}
        </div>
      </div>

      {/* Ticket Decorations */}
      <div className="ticket-notch-left"></div>
      <div className="ticket-notch-right"></div>
    </motion.div>
  );
}

export default Reservations;
