import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import { useAuth } from '../context/AuthContext.jsx';
import { dashboardAPI, movieAPI, reservationAPI, userAPI, showtimeAPI, seatAPI, reviewAPI, theaterAPI, cloudinaryAPI } from '../services/api.js';
import {
  FiFilm, FiUsers, FiCreditCard, FiDollarSign, FiTrendingUp, FiTrendingDown,
  FiCalendar, FiLogOut, FiUser, FiSettings, FiBarChart2, FiPlus, FiEdit2, FiTrash2, FiStar, FiCheck, FiX, FiMapPin, FiSearch, FiImage, FiCopy, FiExternalLink, FiEye, FiRefreshCw, FiBell
} from 'react-icons/fi';
import './AdminDashboard.css';

function AdminDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const stompClientRef = useRef(null);

  const { logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'));
    setUser(userData);
    fetchMetrics();
    fetchNotifications();
    fetchUnseenCount();
  }, []);

  // WebSocket Connection for Real-time Review Notifications
  useEffect(() => {
    if (isAuthenticated) {
      connectWebSocket();
    }
    return () => disconnectWebSocket();
  }, [isAuthenticated]);

  const connectWebSocket = () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
      const wsUrl = baseUrl.replace('/api/v1', '/ws');
      const socket = new SockJS(wsUrl);
      const stompClient = Stomp.over(socket);
      stompClient.debug = null; // Disable logging for cleaner console

      stompClient.connect({}, (frame) => {
        console.log('WS Connected: ' + frame);
        stompClientRef.current = stompClient;

        stompClient.subscribe('/topic/reviews', (message) => {
          if (message.body === 'NEW_REVIEW') {
            toast('New review received!', { icon: '⭐' });
            fetchUnseenCount();
            // Also refresh notifications list
            fetchNotifications();
          }
        });
      }, (error) => {
        console.error('WS Error:', error);
        // Retry connection after 5 seconds
        setTimeout(connectWebSocket, 5000);
      });
    } catch (err) {
      console.error('Failed to init WS:', err);
    }
  };

  const disconnectWebSocket = () => {
    if (stompClientRef.current) {
      stompClientRef.current.disconnect();
      console.log('WS Disconnected');
    }
  };

  const fetchUnseenCount = async () => {
    try {
      const response = await reviewAPI.getUnseenCount();
      setUnreadCount(response.data.data);
    } catch (error) {
      console.error('Error fetching unseen count:', error);
    }
  };

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = await dashboardAPI.getMetrics(startDate, endDate);
      setMetrics(response.data.data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      // Fetch pending reviews count
      const reviewsRes = await reviewAPI.getPending();
      const pendingReviews = reviewsRes.data.data?.content || [];
      
      // Fetch today's reservations
      const today = new Date().toISOString().split('T')[0];
      const reservationsRes = await reservationAPI.getAll({ date: today, size: 10 });
      const todayReservations = reservationsRes.data.data?.content || [];

      // Build notifications list
      const newNotifications = [];
      
      if (pendingReviews.length > 0) {
        newNotifications.push({
          id: 'reviews',
          type: 'review',
          title: 'Pending Reviews',
          message: `${pendingReviews.length} review${pendingReviews.length > 1 ? 's' : ''} waiting for approval`,
          time: 'Just now',
          count: pendingReviews.length,
          icon: FiStar
        });
      }

      if (todayReservations.length > 0) {
        newNotifications.push({
          id: 'reservations',
          type: 'reservation',
          title: "Today's Reservations",
          message: `${todayReservations.length} new reservation${todayReservations.length > 1 ? 's' : ''} today`,
          time: 'Today',
          count: todayReservations.length,
          icon: FiCreditCard
        });
      }

      setNotifications(newNotifications);
      // unreadCount is handled by fetchUnseenCount separately
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleMarkAsRead = (notifId) => {
    setNotifications(prev => prev.filter(n => n.id !== notifId));
    // If we mark a review notification as read, it doesn't necessarily mark all as seen in DB
    // but we can decrement count locally if needed
  };

  const handleClearAll = async () => {
    try {
      await reviewAPI.markAllAsSeen();
      setNotifications([]);
      setUnreadCount(0);
      toast.success('All reviews marked as seen');
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  };

  const handleBellClick = async () => {
    const newShowState = !showNotifications;
    setShowNotifications(newShowState);
    
    // When opening notifications, mark reviews as seen in the database
    if (newShowState && unreadCount > 0) {
      try {
        await reviewAPI.markAllAsSeen();
        setUnreadCount(0);
      } catch (err) {
        console.error('Error marking as seen:', err);
      }
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const statCards = [
    {
      title: 'Total Revenue',
      value: metrics ? `$${(metrics.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '$0.00',
      icon: FiDollarSign,
      color: 'green',
      trend: '+12.5%',
      trendUp: true,
    },
    {
      title: 'Total Reservations',
      value: metrics ? (metrics.totalReservations || 0).toLocaleString() : '0',
      icon: FiCreditCard,
      color: 'blue',
      trend: '+8.2%',
      trendUp: true,
    },
    {
      title: 'Total Users',
      value: metrics ? (metrics.totalUsers || 0).toLocaleString() : '0',
      icon: FiUsers,
      color: 'purple',
      trend: metrics ? `+${metrics.newUsers || 0}` : '+0',
      trendUp: true,
    },
    {
      title: 'Completion Rate',
      value: metrics ? `${(metrics.reservationCompletionRate || 0).toFixed(1)}%` : '0%',
      icon: FiBarChart2,
      color: 'orange',
      trend: metrics?.reservationCompletionRate > 85 ? '+2.1%' : '-1.3%',
      trendUp: metrics?.reservationCompletionRate > 85,
    },
  ];

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link to="/admin" className="logo">
            <FiFilm className="logo-icon" />
            <span>Cinema<span className="text-gradient">Booking</span></span>
          </Link>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <FiBarChart2 />
            <span>Overview</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'movies' ? 'active' : ''}`}
            onClick={() => setActiveTab('movies')}
          >
            <FiFilm />
            <span>Movies</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'showtimes' ? 'active' : ''}`}
            onClick={() => setActiveTab('showtimes')}
          >
            <FiCalendar />
            <span>Showtimes</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'theaters' ? 'active' : ''}`}
            onClick={() => setActiveTab('theaters')}
          >
            <FiMapPin />
            <span>Theaters</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'reservations' ? 'active' : ''}`}
            onClick={() => setActiveTab('reservations')}
          >
            <FiCreditCard />
            <span>Reservations</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'reviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('reviews')}
          >
            <FiStar />
            <span>Reviews</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'revenue' ? 'active' : ''}`}
            onClick={() => setActiveTab('revenue')}
          >
            <FiDollarSign />
            <span>Revenue Report</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <FiUsers />
            <span>Users</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'images' ? 'active' : ''}`}
            onClick={() => setActiveTab('images')}
          >
            <FiImage />
            <span>Images</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <FiUser className="user-icon" />
            <span className="username">{user?.username || 'Admin'}</span>
            <span className="badge-admin">ADMIN</span>
          </div>
          <button onClick={handleLogout} className="btn-logout">
            <FiLogOut />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Top Bar */}
        <header className="top-bar">
          <div className="top-bar-left">
            <h1 className="page-title">
              {activeTab === 'overview' && 'Dashboard Overview'}
              {activeTab === 'movies' && 'Movie Management'}
              {activeTab === 'showtimes' && 'Showtime Management'}
              {activeTab === 'theaters' && 'Theater Management'}
              {activeTab === 'reservations' && 'Reservations'}
              {activeTab === 'reviews' && 'Review Moderation'}
              {activeTab === 'revenue' && 'Theater Revenue Report'}
              {activeTab === 'users' && 'User Management'}
              {activeTab === 'images' && 'Image Assets'}
            </h1>
          </div>
          <div className="top-bar-right">
            <div className="date-display">
              <FiCalendar />
              <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            
            {/* Notification Bell */}
            <div className="notification-wrapper">
              <button 
                className={`notification-bell ${unreadCount > 0 ? 'has-unread' : ''}`}
                onClick={handleBellClick}
              >
                <FiBell className="bell-icon" />
                {unreadCount > 0 && (
                  <span className="notification-badge">{Math.min(unreadCount, 99)}</span>
                )}
              </button>

              {showNotifications && (
                <div className="notification-dropdown">
                  <div className="notification-header">
                    <h3>Notifications</h3>
                    <div className="notification-actions">
                      <button onClick={fetchNotifications} className="btn-link">
                        <FiRefreshCw className={loading ? 'spinning' : ''} />
                      </button>
                      {notifications.length > 0 && (
                        <button onClick={handleClearAll} className="btn-link">
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="notification-list">
                    {notifications.length === 0 ? (
                      <div className="notification-empty">
                        <FiBell className="empty-bell" />
                        <p>No new notifications</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div 
                          key={notif.id} 
                          className="notification-item"
                          onClick={() => {
                            handleMarkAsRead(notif.id);
                            // Navigate based on type
                            if (notif.type === 'review') setActiveTab('reviews');
                            if (notif.type === 'reservation') setActiveTab('reservations');
                            setShowNotifications(false);
                          }}
                        >
                          <div className={`notification-icon ${notif.type}`}>
                            <notif.icon />
                          </div>
                          <div className="notification-content">
                            <h4>{notif.title}</h4>
                            <p>{notif.message}</p>
                            <span className="notification-time">{notif.time}</span>
                          </div>
                          <div className="notification-count">
                            <span className="count-badge">{notif.count}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="dashboard-content">
          {activeTab === 'overview' && (
            <OverviewTab loading={loading} metrics={metrics} statCards={statCards} />
          )}
          {activeTab === 'movies' && <MoviesTab />}
          {activeTab === 'showtimes' && <ShowtimesTab />}
          {activeTab === 'theaters' && <TheatersTab />}
          {activeTab === 'reservations' && <ReservationsTab />}
          {activeTab === 'reviews' && <ReviewsTab />}
          {activeTab === 'revenue' && <RevenueTab />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'images' && <ImagesTab />}
        </div>
      </main>
    </div>
  );
}

function OverviewTab({ loading, metrics, statCards }) {
  return (
    <motion.div
      className="overview-tab"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Stats Grid */}
      <div className="stats-grid">
        {statCards.map((stat, index) => (
          <StatCard key={stat.title} stat={stat} index={index} loading={loading} />
        ))}
      </div>

      {/* Recent Activity & Charts */}
      <div className="dashboard-grid">
        <div className="dashboard-card large">
          <div className="card-header">
            <h3>Revenue Overview</h3>
          </div>
          <div className="card-content">
            {loading ? (
              <div className="spinner"></div>
            ) : metrics ? (
              <div className="revenue-chart">
                <div className="chart-placeholder">
                  <FiTrendingUp className="chart-icon" />
                  <p>Revenue visualization</p>
                  <span className="chart-value">${(metrics.totalRevenue || 0).toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="revenue-chart">
                <div className="chart-placeholder">
                  <p>No revenue data available</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-header">
            <h3>Reservation Stats</h3>
          </div>
          <div className="card-content">
            {loading ? (
              <div className="spinner"></div>
            ) : metrics ? (
              <div className="reservation-stats">
                <div className="stat-row">
                  <span className="stat-label">Confirmed</span>
                  <span className="stat-value success">{metrics.totalConfirmedReservations || 0}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Canceled</span>
                  <span className="stat-value error">{metrics.totalCanceledReservations || 0}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Completion Rate</span>
                  <span className="stat-value">{(metrics.reservationCompletionRate || 0).toFixed(1)}%</span>
                </div>
              </div>
            ) : (
              <p className="no-data">No reservation data available</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ stat, index, loading }) {
  const Icon = stat.icon;
  
  return (
    <motion.div
      className={`stat-card ${stat.color}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ y: -4, scale: 1.02 }}
    >
      <div className="stat-header">
        <div className={`stat-icon ${stat.color}`}>
          <Icon />
        </div>
        {stat.trend && (
          <span className={`stat-trend ${stat.trendUp ? 'up' : 'down'}`}>
            {stat.trendUp ? <FiTrendingUp /> : <FiTrendingDown />}
            {stat.trend}
          </span>
        )}
      </div>
      <div className="stat-body">
        {loading ? (
          <div className="stat-loading">
            <div className="spinner spinner-sm"></div>
          </div>
        ) : (
          <>
            <h3 className="stat-value">{stat.value}</h3>
            <p className="stat-label">{stat.title}</p>
          </>
        )}
      </div>
    </motion.div>
  );
}

function MoviesTab() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    genre: '',
    releaseYear: new Date().getFullYear(),
    description: '',
    posterImageUrl: ''
  });

  useEffect(() => {
    fetchMovies();
  }, [currentPage, searchTerm]);

  const fetchMovies = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        size: 10,
        sort: 'id,desc'
      };
      if (searchTerm) params.search = searchTerm;
      
      const response = await movieAPI.getAll(params);
      const data = response.data.data;
      
      setMovies(data?.content || []);
      setTotalPages(data?.totalPages || 0);
    } catch (error) {
      console.error('Error fetching movies:', error);
      setMovies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(0); // reset to first page on search
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'releaseYear' ? parseInt(value) || '' : value
    }));
  };

  const openAddModal = () => {
    setIsEditing(false);
    setFormData({
      title: '',
      genre: '',
      releaseYear: new Date().getFullYear(),
      description: '',
      posterImageUrl: ''
    });
    setIsModalOpen(true);
  };

  const handleEdit = (movie) => {
    setIsEditing(true);
    setSelectedMovie(movie);
    setFormData({
      title: movie.title,
      genre: movie.genre,
      releaseYear: movie.releaseYear,
      description: movie.description,
      posterImageUrl: movie.posterImageUrl
    });
    setIsModalOpen(true);
  };

  const handleDelete = (movie) => {
    setSelectedMovie(movie);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      setFormLoading(true);
      await movieAPI.delete(selectedMovie.id);
      setIsDeleteModalOpen(false);
      fetchMovies();
      toast.success('Movie deleted successfully!');
    } catch (error) {
      console.error('Error deleting movie:', error);
      toast.error('Failed to delete movie.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setFormLoading(true);
      if (isEditing) {
        await movieAPI.update(selectedMovie.id, formData);
        toast.success('Movie updated successfully!');
      } else {
        await movieAPI.create(formData);
        toast.success('Movie added successfully!');
      }
      setIsModalOpen(false);
      fetchMovies(); // Refresh list
    } catch (error) {
      console.error('Error saving movie:', error);
      toast.error('Failed to save movie. Please check your data.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <motion.div
      className="movies-tab"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="tab-header">
        <h2>Movies Library</h2>
        <div className="header-actions">
          <div className="search-box-admin">
            <FiSearch className="search-icon" />
            <input 
              type="text" 
              placeholder="Search movies..." 
              value={searchTerm}
              onChange={handleSearch}
              className="search-input-admin"
            />
          </div>
          <button className="btn-primary" onClick={openAddModal}>
            <FiPlus />
            Add New Movie
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Genre</th>
              <th>Year</th>
              <th>Rating</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="loading-cell">
                  <div className="spinner"></div>
                  <p>Loading movies...</p>
                </td>
              </tr>
            ) : movies.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-cell">
                  <FiFilm />
                  <p>No movies found</p>
                </td>
              </tr>
            ) : (
              movies.map((movie) => (
                <tr key={movie.id}>
                  <td>#{movie.id}</td>
                  <td>
                    <div className="movie-cell">
                      {movie.posterImageUrl && (
                        <img src={movie.posterImageUrl} alt={movie.title} />
                      )}
                      <span>{movie.title}</span>
                    </div>
                  </td>
                  <td><span className="badge">{movie.genre}</span></td>
                  <td>{movie.releaseYear}</td>
                  <td>
                    <div className="rating">
                      <FiStar />
                      {movie.averageRating?.toFixed(1) || '0.0'}
                    </div>
                  </td>
                  <td>
                    <div className="actions">
                      <button className="btn-icon" onClick={() => handleEdit(movie)}>
                        <FiEdit2 />
                      </button>
                      <button className="btn-icon danger" onClick={() => handleDelete(movie)}>
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination-admin">
            <button 
              disabled={currentPage === 0}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="page-btn"
            >
              Previous
            </button>
            <span className="page-info">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button 
              disabled={currentPage === totalPages - 1}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="page-btn"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Movie Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <motion.div 
            className="modal-content"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="modal-header">
              <h3>{isEditing ? 'Edit Movie' : 'Add New Movie'}</h3>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Movie Title</label>
                <input 
                  type="text" 
                  name="title" 
                  value={formData.title} 
                  onChange={handleInputChange} 
                  placeholder="Enter movie title"
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Genre</label>
                  <input 
                    type="text" 
                    name="genre" 
                    value={formData.genre} 
                    onChange={handleInputChange} 
                    placeholder="e.g. Action"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Release Year</label>
                  <input 
                    type="number" 
                    name="releaseYear" 
                    value={formData.releaseYear} 
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Poster Image URL</label>
                <input 
                  type="url" 
                  name="posterImageUrl" 
                  value={formData.posterImageUrl} 
                  onChange={handleInputChange} 
                  placeholder="https://example.com/poster.jpg"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  name="description" 
                  value={formData.description} 
                  onChange={handleInputChange} 
                  placeholder="Enter movie description..."
                  rows="4"
                  required
                ></textarea>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={formLoading}>
                  {formLoading ? <span className="spinner spinner-sm"></span> : isEditing ? 'Update Movie' : 'Save Movie'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="modal-overlay">
          <motion.div 
            className="modal-content small"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button className="btn-close" onClick={() => setIsDeleteModalOpen(false)}>
                <FiX />
              </button>
            </div>
            <div className="modal-body-confirm">
              <div className="alert-icon danger">
                <FiTrash2 />
              </div>
              <p>Are you sure you want to delete <strong>"{selectedMovie?.title}"</strong>?</p>
              <p className="subtitle">This action cannot be undone.</p>
            </div>
            <div className="modal-footer confirm">
              <button className="btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary danger" onClick={confirmDelete} disabled={formLoading}>
                {formLoading ? <span className="spinner spinner-sm"></span> : 'Yes, Delete Movie'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function TheatersTab() {
  const [theaters, setTheaters] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTheater, setSelectedTheater] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    capacity: 100
  });

  useEffect(() => {
    fetchTheaters();
  }, []);

  const fetchTheaters = async () => {
    try {
      setLoading(true);
      const response = await theaterAPI.getAll();
      setTheaters(response.data.data || []);
    } catch (error) {
      console.error('Error fetching theaters:', error);
      toast.error('Failed to load theaters');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'capacity' ? parseInt(value) || '' : value
    }));
  };

  const openAddModal = () => {
    setIsEditing(false);
    setFormData({ name: '', location: '', capacity: 100 });
    setIsModalOpen(true);
  };

  const handleEdit = (theater) => {
    setIsEditing(true);
    setSelectedTheater(theater);
    setFormData({
      name: theater.name,
      location: theater.location,
      capacity: theater.capacity
    });
    setIsModalOpen(true);
  };

  const handleDelete = (theater) => {
    setSelectedTheater(theater);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      setFormLoading(true);
      await theaterAPI.delete(selectedTheater.id);
      setIsDeleteModalOpen(false);
      fetchTheaters();
      toast.success('Theater deleted successfully!');
    } catch (error) {
      console.error('Error deleting theater:', error);
      toast.error('Failed to delete theater.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setFormLoading(true);
      if (isEditing) {
        await theaterAPI.update(selectedTheater.id, formData);
        toast.success('Theater updated successfully!');
      } else {
        await theaterAPI.create(formData);
        toast.success('Theater added successfully!');
      }
      setIsModalOpen(false);
      fetchTheaters();
    } catch (error) {
      console.error('Error saving theater:', error);
      toast.error('Failed to save theater. Please check your data.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <motion.div
      className="theaters-tab"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="tab-header">
        <h2>Theaters Management</h2>
        <button className="btn-primary" onClick={openAddModal}>
          <FiPlus />
          Add New Theater
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Location</th>
              <th>Capacity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="loading-cell"><div className="spinner"></div></td></tr>
            ) : theaters.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty-cell">
                  <FiMapPin />
                  <p>No theaters found</p>
                </td>
              </tr>
            ) : (
              theaters.map((theater) => (
                <tr key={theater.id}>
                  <td>#{theater.id}</td>
                  <td><strong>{theater.name}</strong></td>
                  <td>{theater.location}</td>
                  <td>{theater.capacity} seats</td>
                  <td>
                    <div className="actions">
                      <button className="btn-icon" onClick={() => handleEdit(theater)}>
                        <FiEdit2 />
                      </button>
                      <button className="btn-icon danger" onClick={() => handleDelete(theater)}>
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Theater Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <motion.div 
            className="modal-content"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="modal-header">
              <h3>{isEditing ? 'Edit Theater' : 'Add New Theater'}</h3>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Theater Name</label>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleInputChange} 
                  placeholder="e.g. Cinema Hall 1"
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Location</label>
                  <input 
                    type="text" 
                    name="location" 
                    value={formData.location} 
                    onChange={handleInputChange} 
                    placeholder="e.g. Floor 3"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Capacity</label>
                  <input 
                    type="number" 
                    name="capacity" 
                    value={formData.capacity} 
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={formLoading}>
                  {formLoading ? <span className="spinner spinner-sm"></span> : isEditing ? 'Update Theater' : 'Save Theater'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="modal-overlay">
          <motion.div 
            className="modal-content small"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button className="btn-close" onClick={() => setIsDeleteModalOpen(false)}>
                <FiX />
              </button>
            </div>
            <div className="modal-body-confirm">
              <div className="alert-icon danger">
                <FiTrash2 />
              </div>
              <p>Are you sure you want to delete <strong>"{selectedTheater?.name}"</strong>?</p>
              <p className="subtitle">This will affect all showtimes linked to this theater.</p>
            </div>
            <div className="modal-footer confirm">
              <button className="btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary danger" onClick={confirmDelete} disabled={formLoading}>
                {formLoading ? <span className="spinner spinner-sm"></span> : 'Yes, Delete Theater'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function ShowtimesTab() {
  const [showtimes, setShowtimes] = useState([]);
  const [movies, setMovies] = useState([]);
  const [theaters, setTheaters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedShowtime, setSelectedShowtime] = useState(null);
  const [seats, setSeats] = useState([]);
  const [seatsLoading, setSeatsLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    movieId: '',
    theaterId: '',
    showDate: new Date().toISOString().split('T')[0],
    showTime: '18:00:00',
    totalSeats: 0,
    price: 15.0
  });

  useEffect(() => {
    fetchShowtimes();
  }, [selectedDate]);

  useEffect(() => {
    // Fetch dependencies for form
    const fetchDependencies = async () => {
      try {
        const [moviesRes, theatersRes] = await Promise.all([
          movieAPI.getAll({ size: 100 }),
          theaterAPI.getAll()
        ]);
        setMovies(moviesRes.data.data?.content || moviesRes.data.data || []);
        setTheaters(theatersRes.data.data || []);
      } catch (error) {
        console.error('Error fetching dependencies:', error);
      }
    };
    fetchDependencies();
  }, []);

  const fetchShowtimes = async () => {
    try {
      setLoading(true);
      const response = await showtimeAPI.getByDate(selectedDate);
      setShowtimes(response.data.data || []);
    } catch (error) {
      console.error('Error fetching showtimes:', error);
      setShowtimes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (st) => {
    setSelectedShowtime(st);
    setIsDetailModalOpen(true);
    try {
      setSeatsLoading(true);
      const response = await seatAPI.getByShowtime(st.id);
      setSeats(response.data.data || []);
    } catch (error) {
      console.error('Error fetching seats:', error);
      toast.error('Failed to load seats');
    } finally {
      setSeatsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'movieId' || name === 'theaterId' || name === 'totalSeats') ? parseInt(value) :
              name === 'price' ? parseFloat(value) : value
    }));
  };

  const openAddModal = () => {
    setIsEditing(false);
    const firstTheater = theaters[0];
    setFormData({
      movieId: movies[0]?.id || '',
      theaterId: theaters[0]?.id || '',
      showDate: selectedDate,
      showTime: '18:00',
      totalSeats: firstTheater?.capacity || 100,
      price: 15.0
    });
    setIsModalOpen(true);
  };

  const handleEdit = (st) => {
    setIsEditing(true);
    setSelectedShowtime(st);
    setFormData({
      movieId: st.movieId || st.movie?.id || '',
      theaterId: st.theaterId || st.theater?.id || '',
      showDate: st.showDate,
      showTime: st.showTime.substring(0, 5),
      totalSeats: st.totalSeats,
      price: st.price
    });
    setIsModalOpen(true);
  };

  const handleDelete = (st) => {
    setSelectedShowtime(st);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      setFormLoading(true);
      await showtimeAPI.delete(selectedShowtime.id);
      setIsDeleteModalOpen(false);
      fetchShowtimes();
      toast.success('Showtime deleted!');
    } catch (error) {
      console.error('Error deleting showtime:', error);
      toast.error('Failed to delete showtime.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setFormLoading(true);
      // Backend expects HH:mm:ss
      const submitData = {
        ...formData,
        showTime: formData.showTime.length === 5 ? `${formData.showTime}:00` : formData.showTime,
        totalSeats: parseInt(formData.totalSeats)
      };

      if (isEditing) {
        await showtimeAPI.update(selectedShowtime.id, submitData);
        toast.success('Showtime updated!');
      } else {
        await showtimeAPI.create(submitData);
        toast.success('Showtime created!');
      }
      setIsModalOpen(false);
      fetchShowtimes();
    } catch (error) {
      console.error('Error saving showtime:', error);
      toast.error('Failed to save showtime. Check for conflicts.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <motion.div
      className="showtimes-tab"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="tab-header">
        <h2>Showtime Management</h2>
        <div className="header-actions">
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-input"
          />
          <button className="btn-primary" onClick={openAddModal}>
            <FiPlus />
            New Showtime
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Movie</th>
              <th>Theater</th>
              <th>Time</th>
              <th>Seats</th>
              <th>Price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="loading-cell"><div className="spinner"></div></td></tr>
            ) : showtimes.length === 0 ? (
              <tr><td colSpan="7" className="empty-cell"><FiCalendar /><p>No showtimes for this date</p></td></tr>
            ) : (
              showtimes.map((st) => (
                <tr key={st.id}>
                  <td>#{st.id}</td>
                  <td><strong>{st.movieTitle || st.movie?.title}</strong></td>
                  <td>{st.theaterName || st.theater?.name}</td>
                  <td>{st.showTime}</td>
                  <td><span className="badge">{st.availableSeats}/{st.totalSeats}</span></td>
                  <td className="revenue-amount">${st.price}</td>
                  <td>
                    <div className="actions">
                      <button className="btn-icon" title="View Details" onClick={() => handleViewDetails(st)}><FiEye /></button>
                      <button className="btn-icon" title="Edit" onClick={() => handleEdit(st)}><FiEdit2 /></button>
                      <button className="btn-icon danger" title="Delete" onClick={() => handleDelete(st)}><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Showtime Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <motion.div 
            className="modal-content"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="modal-header">
              <h3>{isEditing ? 'Edit Showtime' : 'Add New Showtime'}</h3>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Select Movie</label>
                <select name="movieId" value={formData.movieId} onChange={handleInputChange} required className="input-admin">
                  <option value="">Choose a movie...</option>
                  {movies.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Select Theater</label>
                <select 
                  name="theaterId" 
                  value={formData.theaterId} 
                  onChange={(e) => {
                    handleInputChange(e);
                    // Auto-update totalSeats based on theater capacity
                    const selectedTheater = theaters.find(t => t.id === parseInt(e.target.value));
                    if (selectedTheater && !isEditing) {
                      setFormData(prev => ({ ...prev, totalSeats: selectedTheater.capacity }));
                    }
                  }} 
                  required 
                  className="input-admin"
                >
                  <option value="">Choose a theater...</option>
                  {theaters.map(t => <option key={t.id} value={t.id}>{t.name} ({t.location}) - Capacity: {t.capacity}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" name="showDate" value={formData.showDate} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label>Time</label>
                  <input type="time" name="showTime" value={formData.showTime} onChange={handleInputChange} required />
                </div>
              </div>
              <div className="form-group">
                <label>Total Seats</label>
                <input 
                  type="number" 
                  name="totalSeats" 
                  value={formData.totalSeats} 
                  onChange={handleInputChange} 
                  required 
                  min="1"
                  max={theaters.find(t => t.id === parseInt(formData.theaterId))?.capacity || 100}
                />
                <small className="form-text">
                  Max: {theaters.find(t => t.id === parseInt(formData.theaterId))?.capacity || 100} seats (theater capacity)
                </small>
              </div>
              <div className="form-group">
                <label>Ticket Price ($)</label>
                <input type="number" step="0.01" name="price" value={formData.price} onChange={handleInputChange} required />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={formLoading}>
                  {formLoading ? <span className="spinner spinner-sm"></span> : isEditing ? 'Update Showtime' : 'Save Showtime'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="modal-overlay">
          <motion.div 
            className="modal-content small"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button className="btn-close" onClick={() => setIsDeleteModalOpen(false)}>
                <FiX />
              </button>
            </div>
            <div className="modal-body-confirm">
              <div className="alert-icon danger">
                <FiTrash2 />
              </div>
              <p>Delete showtime for <strong>"{selectedShowtime?.movieTitle}"</strong>?</p>
              <p className="subtitle">This will cancel all associated reservations.</p>
            </div>
            <div className="modal-footer confirm">
              <button className="btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
              <button className="btn-primary danger" onClick={confirmDelete} disabled={formLoading}>
                {formLoading ? <span className="spinner spinner-sm"></span> : 'Yes, Delete'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Showtime Detail Modal */}
      {isDetailModalOpen && (
        <div className="modal-overlay">
          <motion.div 
            className="modal-content large"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="modal-header">
              <h3>Showtime Details</h3>
              <button className="btn-close" onClick={() => setIsDetailModalOpen(false)}>
                <FiX />
              </button>
            </div>
            <div className="modal-body-detail">
              <div className="detail-info-grid">
                <div className="info-item">
                  <label>Movie</label>
                  <p>{selectedShowtime?.movieTitle || selectedShowtime?.movie?.title}</p>
                </div>
                <div className="info-item">
                  <label>Theater</label>
                  <p>{selectedShowtime?.theaterName || selectedShowtime?.theater?.name}</p>
                </div>
                <div className="info-item">
                  <label>Date & Time</label>
                  <p>{selectedShowtime?.showDate} | {selectedShowtime?.showTime}</p>
                </div>
                <div className="info-item">
                  <label>Price</label>
                  <p className="revenue-amount">${selectedShowtime?.price}</p>
                </div>
              </div>

              <div className="seat-management">
                <div className="tab-header-mini">
                  <h4>Seat Availability ({selectedShowtime?.availableSeats}/{selectedShowtime?.totalSeats})</h4>
                </div>

                {seatsLoading ? (
                  <div className="loading-seats">
                    <div className="spinner spinner-lg"></div>
                    <p>Loading seats...</p>
                  </div>
                ) : seats.length > 0 ? (
                  <div className="seat-view-container">
                    <div className="screen">
                      <span>SCREEN</span>
                    </div>

                    <div className="seats-grid">
                      {(() => {
                        // Group seats by rows (assuming seatNumber format like "A1", "B5", etc.)
                        const seatRows = {};
                        seats.forEach(seat => {
                          const rowLetter = seat.seatNumber.charAt(0);
                          if (!seatRows[rowLetter]) {
                            seatRows[rowLetter] = [];
                          }
                          seatRows[rowLetter].push(seat);
                        });

                        // Sort rows by letter and render
                        return Object.keys(seatRows).sort().map(rowLetter => (
                          <div key={rowLetter} className="seat-row">
                            {seatRows[rowLetter]
                              .sort((a, b) => {
                                const numA = parseInt(a.seatNumber.substring(1));
                                const numB = parseInt(b.seatNumber.substring(1));
                                return numA - numB;
                              })
                              .map(seat => (
                                <div
                                  key={seat.id}
                                  className={`seat ${seat.isReserved || seat.reserved ? 'taken' : 'available'}`}
                                  title={`Seat ${seat.seatNumber}`}
                                >
                                  <span className="seat-num">{seat.seatNumber}</span>
                                </div>
                              ))}
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
                        <div className="seat taken"></div>
                        <span>Taken</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="no-seats">
                    <FiFilm className="no-seats-icon" />
                    <p>No seats available for this showtime</p>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsDetailModalOpen(false)}>Close</button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function ReviewsTab() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    fetchPendingReviews();
  }, []);

  const fetchPendingReviews = async () => {
    try {
      setLoading(true);
      const response = await reviewAPI.getPending();
      setReviews(response.data.data?.content || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast.error('Failed to load pending reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      setActionLoading(prev => ({ ...prev, [id]: 'approving' }));
      await reviewAPI.approve(id);
      setReviews(reviews.filter(r => r.id !== id));
      toast.success('Review approved!');
    } catch (error) {
      console.error('Error approving review:', error);
      toast.error('Failed to approve review');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }));
    }
  };

  const handleReject = async (id) => {
    try {
      setActionLoading(prev => ({ ...prev, [id]: 'rejecting' }));
      await reviewAPI.reject(id);
      setReviews(reviews.filter(r => r.id !== id));
      toast.success('Review rejected');
    } catch (error) {
      console.error('Error rejecting review:', error);
      toast.error('Failed to reject review');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }));
    }
  };

  return (
    <motion.div
      className="reviews-tab"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="tab-header">
        <h2>Review Moderation</h2>
        <button className="btn-primary" onClick={fetchPendingReviews} disabled={loading}>
          <FiRefreshCw className={loading ? 'spinning' : ''} />
          Refresh
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Movie</th>
              <th>Rating</th>
              <th>Comment</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="loading-cell"><div className="spinner"></div></td></tr>
            ) : reviews.length === 0 ? (
              <tr><td colSpan="7" className="empty-cell"><FiStar /><p>No pending reviews</p></td></tr>
            ) : (
              reviews.map((r) => (
                <tr key={r.id}>
                  <td>#{r.id}</td>
                  <td><strong>{r.username}</strong></td>
                  <td>{r.movieTitle}</td>
                  <td>
                    <div className="rating">
                      <FiStar fill="#fbbf24" /> {r.rating}/5
                    </div>
                  </td>
                  <td className="comment-cell">{r.comment}</td>
                  <td>{r.createdAt?.split('T')[0] || '-'}</td>
                  <td>
                    <div className="actions">
                      <button 
                        className="btn-icon success" 
                        onClick={() => handleApprove(r.id)}
                        disabled={actionLoading[r.id]}
                        title="Approve"
                      >
                        {actionLoading[r.id] === 'approving' ? (
                          <span className="spinner spinner-xs"></span>
                        ) : (
                          <FiCheck />
                        )}
                      </button>
                      <button 
                        className="btn-icon danger" 
                        onClick={() => handleReject(r.id)}
                        disabled={actionLoading[r.id]}
                        title="Reject"
                      >
                        {actionLoading[r.id] === 'rejecting' ? (
                          <span className="spinner spinner-xs"></span>
                        ) : (
                          <FiX />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function RevenueTab() {
  const [revenueData, setRevenueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchRevenue();
  }, [dateRange]);

  const fetchRevenue = async () => {
    try {
      setLoading(true);
      const response = await reservationAPI.getRevenue(dateRange.start, dateRange.end);
      setRevenueData(response.data.data || null);
    } catch (error) {
      console.error('Error fetching revenue:', error);
      setRevenueData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="revenue-tab"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="tab-header">
        <h2>Theater Revenue Report</h2>
        <div className="date-range-picker">
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
          />
          <span>to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
          />
        </div>
      </div>

      <div className="revenue-summary">
        {loading ? (
          <div className="loading-cell"><div className="spinner"></div></div>
        ) : revenueData ? (
          <>
            <div className="summary-card">
              <div className="summary-label">Date Range</div>
              <div className="summary-value">
                {revenueData.startDate} to {revenueData.endDate}
              </div>
            </div>
            <div className="summary-card highlight">
              <div className="summary-label">
                <FiDollarSign className="summary-icon" />
                Total Revenue
              </div>
              <div className="summary-value revenue">
                ${revenueData.revenue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <FiDollarSign className="empty-icon" />
            <p>No revenue data for this period</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ReservationsTab() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    fetchReservations();
  }, [currentPage]);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const response = await reservationAPI.getAll({ page: currentPage, size: 10 });
      const data = response.data.data;
      setReservations(data?.content || []);
      setTotalPages(data?.totalPages || 0);
    } catch (error) {
      console.error('Error fetching reservations:', error);
      toast.error('Failed to load reservations');
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

  return (
    <motion.div
      className="reservations-tab"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="tab-header">
        <h2>All Reservations</h2>
        <button className="btn-primary" onClick={fetchReservations} disabled={loading}>
          <FiRefreshCw className={loading ? 'spinning' : ''} />
          Refresh
        </button>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Movie</th>
              <th>Showtime</th>
              <th>Seats</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="loading-cell"><div className="spinner"></div></td></tr>
            ) : reservations.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-cell">
                  <FiCreditCard />
                  <p>No reservations found</p>
                </td>
              </tr>
            ) : (
              reservations.map(res => (
                <tr key={res.id}>
                  <td>#{res.id}</td>
                  <td><strong>{res.username}</strong></td>
                  <td>{res.movieTitle}</td>
                  <td>
                    <div>{res.showDate}</div>
                    <div className="text-secondary">{res.showTime}</div>
                  </td>
                  <td><span className="badge">{res.seatNumbers?.length || 0} seats</span></td>
                  <td>
                    <span className={`badge badge-${
                      res.status === 'CONFIRMED' ? 'success' :
                      res.status === 'CANCELLED' ? 'error' :
                      res.status === 'PENDING' ? 'warning' : 'secondary'
                    }`}>
                      {res.status}
                    </span>
                  </td>
                  <td className="revenue-amount">${res.totalPrice?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td>
                    <button className="btn-icon" onClick={() => handleViewDetails(res.id)} title="View Details">
                      <FiEye />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination-admin">
          <button
            disabled={currentPage === 0}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className="page-btn"
          >
            Previous
          </button>
          <span className="page-info">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages - 1}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className="page-btn"
          >
            Next
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && selectedReservation && (
        <div className="modal-overlay">
          <motion.div
            className="modal-content large"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="modal-header">
              <h3>Reservation Details #{selectedReservation.id}</h3>
              <button className="btn-close" onClick={() => setIsDetailModalOpen(false)}>
                <FiX />
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
                    {selectedReservation.seatNumbers?.map((seat, idx) => (
                      <span key={idx} className="badge">{seat}</span>
                    ))}
                  </div>
                </div>
                <div className="info-item">
                  <label>Status</label>
                  <span className={`badge badge-${
                    selectedReservation.status === 'CONFIRMED' ? 'success' :
                    selectedReservation.status === 'CANCELLED' ? 'error' :
                    selectedReservation.status === 'PENDING' ? 'warning' : 'secondary'
                  }`}>
                    {selectedReservation.status}
                  </span>
                </div>
                <div className="info-item">
                  <label>Booking Date</label>
                  <p>{selectedReservation.bookingDate?.replace('T', ' ') || '-'}</p>
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
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsDetailModalOpen(false)}>Close</button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await userAPI.getAll();
      setUsers(response.data.data?.content || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (id, currentStatus) => {
    try {
      await userAPI.updateStatus(id, !currentStatus);
      fetchUsers();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  return (
    <motion.div
      className="users-tab"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="tab-header">
        <h2>User Management</h2>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="loading-cell"><div className="spinner"></div></td></tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-cell">
                  <FiUsers />
                  <p>No users found</p>
                </td>
              </tr>
            ) : (
              users.map(u => (
                <tr key={u.id}>
                  <td>#{u.id}</td>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td><span className="badge">{u.role}</span></td>
                  <td>
                    <span className={`badge badge-${u.active ? 'success' : 'error'}`}>
                      {u.active ? 'Active' : 'Blocked'}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <button 
                        className={`btn-icon ${u.active ? 'danger' : 'success'}`}
                        onClick={() => handleStatusToggle(u.id, u.active)}
                        title={u.active ? 'Block User' : 'Unblock User'}
                      >
                        {u.active ? <FiX /> : <FiCheck />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function ImagesTab() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      setLoading(true);
      const response = await cloudinaryAPI.getAll();
      setImages(response.data.data || []);
    } catch (error) {
      console.error('Error fetching images:', error);
      toast.error('Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      await cloudinaryAPI.upload(file);
      toast.success('Image uploaded successfully!');
      fetchImages(); // Refresh list
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
      // Clear input
      e.target.value = null;
    }
  };

  const handleDeleteImage = async (publicId) => {
    if (!window.confirm('Delete this image permanently?')) return;

    try {
      await cloudinaryAPI.delete(publicId);
      toast.success('Image deleted!');
      setImages(images.filter(img => img.publicId !== publicId));
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Failed to delete image');
    }
  };

  const copyToClipboard = (url) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard!');
  };

  return (
    <motion.div
      className="images-tab"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="tab-header">
        <h2>Image Gallery (Cloudinary)</h2>
        <div className="header-actions">
          <label className="btn-primary" style={{ cursor: 'pointer' }}>
            {uploading ? (
              <span className="spinner spinner-sm"></span>
            ) : (
              <>
                <FiPlus />
                Upload Image
              </>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner spinner-lg"></div>
          <p>Fetching your gallery...</p>
        </div>
      ) : images.length === 0 ? (
        <div className="empty-state">
          <FiImage className="empty-icon" />
          <h3>No images found</h3>
          <p>Upload some posters or assets to Cloudinary</p>
        </div>
      ) : (
        <div className="image-grid">
          {images.map((img) => (
            <motion.div 
              key={img.publicId} 
              className="image-card"
              whileHover={{ y: -5 }}
            >
              <div className="image-wrapper">
                <img src={img.url} alt={img.publicId} />
                <div className="image-overlay">
                  <button 
                    className="icon-btn" 
                    onClick={() => copyToClipboard(img.url)}
                    title="Copy URL"
                  >
                    <FiCopy />
                  </button>
                  <a 
                    href={img.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="icon-btn"
                    title="Open Original"
                  >
                    <FiExternalLink />
                  </a>
                  <button 
                    className="icon-btn danger" 
                    onClick={() => handleDeleteImage(img.publicId)}
                    title="Delete Image"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
              <div className="image-info-compact">
                <span className="image-name">{img.publicId.split('/').pop()}</span>
                <span className="image-size">{(img.bytes / 1024).toFixed(1)} KB</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default AdminDashboard;
